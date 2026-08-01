#!/usr/bin/env bash
#
# Smoke the documented developer command.
#
# scripts/env-contract.mjs proves the variables are declared. It cannot prove
# they arrive: that depends on package.json pointing "dev" at scripts/dev.sh, on
# dev.sh sourcing .env, and on turbo passing the names through. This boots the
# real `pnpm dev` and asserts the app serves.
#
# Why this is not folded into scripts/e2e.sh: that lane sources .env itself and
# starts `node apps/api/dist/main.js` and `next start` directly, never touching
# turbo. It is a genuinely different path, and it stayed green while `pnpm dev`
# was broken. A lane that cannot fail the way the README fails is not covering it.
#
# Usage: ./scripts/dev-smoke.sh
# Assumes Postgres and Redis are up and the database is migrated and seeded.
set -euo pipefail

# Job control, so each background job lands in its own process group and the
# cleanup below can take down turbo *and* the next/nest/worker children it
# spawned. Killing only the turbo PID leaves servers holding :3000 and :4000,
# which makes the next run fail for a reason unrelated to the code.
set -m

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DEV_PID=""
LOG=/tmp/booking-dev-smoke.log

cleanup() {
  if [[ -n "$DEV_PID" ]] && kill -0 "$DEV_PID" 2>/dev/null; then
    kill -- -"$DEV_PID" 2>/dev/null || true
    wait "$DEV_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

[[ -f .env ]] || { echo "No .env. See README.md, 'Running it'." >&2; exit 1; }

# Read what the probes need WITHOUT sourcing .env.
#
# This is the difference between a real check and a vacuous one: a version of
# this script that did `set -a; . ./.env` put every variable into its own
# environment, where `pnpm dev` inherited them as an ordinary child process. It
# then passed with the fix reverted, because the app was being configured by the
# test rather than by the repo. A test that supplies the thing it is testing for
# proves nothing.
env_value() {
  sed -n "s/^[[:space:]]*$1=//p" .env | tail -1
}
API_BASE_URL="$(env_value API_BASE_URL)"
APP_BASE_URL="$(env_value APP_BASE_URL)"
API_BASE_URL="${API_BASE_URL:-http://localhost:4000}"
APP_BASE_URL="${APP_BASE_URL:-http://localhost:3000}"

# Every name .env defines is stripped from the child's environment, so the only
# way the app can see one is if dev.sh loaded it and turbo passed it through.
# That reproduces what a fresh clone experiences: a .env on disk, nothing in the
# shell.
mapfile -t ENV_KEYS < <(sed -n 's/^[[:space:]]*\([A-Z][A-Z0-9_]*\)=.*/\1/p' .env | sort -u)
UNSET_ARGS=()
for key in "${ENV_KEYS[@]}"; do UNSET_ARGS+=(-u "$key"); done

for url in "${API_BASE_URL}/health" "${APP_BASE_URL}/"; do
  if curl -sf "$url" >/dev/null 2>&1; then
    echo "Something is already serving ${url}. Stop it first." >&2
    exit 1
  fi
done

# The booking page is the assertion that matters, and it needs a real event type
# id. The seed creates cuids, so the id cannot be hardcoded; it is read from the
# database the same way any other tool in this repo would. This runs with .env
# loaded on purpose -- it is the test harness talking to Postgres, not the app
# under test being handed its configuration.
echo "==> Resolving a seeded event type"
EVENT_TYPE_ID="$(
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
  pnpm --filter @booking/db exec node -e "
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    prisma.eventType
      .findFirst({ where: { slug: 'intro-call' }, select: { id: true } })
      .then((row) => {
        if (!row) { console.error('seed missing: no intro-call event type'); process.exit(1); }
        process.stdout.write(row.id);
        return prisma.\$disconnect();
      });
  " 2>/dev/null
)"
[[ -n "$EVENT_TYPE_ID" ]] || { echo "Could not resolve a seeded event type. Run: pnpm db:seed" >&2; exit 1; }

echo "==> Starting: pnpm dev (with every .env name stripped from the environment)"
env "${UNSET_ARGS[@]}" pnpm dev >"$LOG" 2>&1 &
DEV_PID=$!

# Dev-mode Next compiles a route on first request, so the first GET is slow by
# design. 120s covers a cold .next on a loaded machine without hiding a hang.
wait_for() {
  local url="$1" name="$2"
  for _ in $(seq 1 120); do
    if curl -sf "$url" >/dev/null 2>&1; then return 0; fi
    # A process that has already exited will never become healthy, and waiting
    # out the full timeout hides the reason it died.
    if ! kill -0 "$DEV_PID" 2>/dev/null; then
      echo "pnpm dev exited before ${name} came up. Log:" >&2
      tail -40 "$LOG" >&2
      return 1
    fi
    sleep 1
  done
  echo "${name} never came up at ${url}. Log:" >&2
  tail -40 "$LOG" >&2
  return 1
}

wait_for "${API_BASE_URL}/health" api
wait_for "${APP_BASE_URL}/" web

echo "==> Checking /health reports its dependencies"
health="$(curl -sf "${API_BASE_URL}/health")"
for dep in db redis worker; do
  if ! grep -q "\"${dep}\":true" <<<"$health"; then
    echo "/health does not report ${dep} healthy: ${health}" >&2
    exit 1
  fi
done

# The load-bearing assertion. The homepage is static marketing and renders fine
# with a dead API, so checking it would prove nothing. /book/<id> is server
# rendered from /public/event-types/:id, so the seeded title only appears if the
# web app actually reached the API -- which only happens if AUTH_SECRET and
# API_BASE_URL survived the trip through turbo. Before this fix that request
# failed with ECONNREFUSED.
echo "==> Checking the booking page rendered data from the API"
page="$(curl -sf "${APP_BASE_URL}/book/${EVENT_TYPE_ID}")"
if ! grep -q 'Intro Call' <<<"$page"; then
  echo "/book/${EVENT_TYPE_ID} did not render the seeded event type. It is an error card, not the booking page." >&2
  tail -40 "$LOG" >&2
  exit 1
fi

# The symptoms of the original bug, by name. The worker is the loudest of them:
# with REDIS_URL stripped it retries against the default :6379 forever while
# booking-redis listens on :6381.
echo "==> Checking the dev log is clean"
if grep -qE "ECONNREFUSED|MissingSecret|AUTH_SECRET is not set|AUTH_SECRET must be set" "$LOG"; then
  echo "pnpm dev logged an environment failure:" >&2
  grep -nE "ECONNREFUSED|MissingSecret|AUTH_SECRET is not set|AUTH_SECRET must be set" "$LOG" | head -5 >&2
  exit 1
fi

echo "==> OK: pnpm dev serves the booking page, /health green on db + redis + worker"
