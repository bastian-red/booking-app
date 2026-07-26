#!/usr/bin/env bash
#
# Record the README's demo GIF from the real Playwright suite.
#
# The frames come from `e2e/tests/demo.spec.ts`, which drives the app through the
# same pages and selectors `booking-flow.spec.ts` asserts against. That is the
# point: the demo cannot show a flow the suite does not cover, and it breaks
# loudly when the product does.
#
# Assembled with ImageMagick rather than ffmpeg from Playwright's video, because
# ffmpeg needs a root install and ImageMagick is already here. The result is a
# slideshow of real screens rather than smooth video, which is an honest trade
# for zero extra dependencies.
#
# Usage: ./scripts/demo-gif.sh
# Assumes Postgres, Redis and Mailhog are up (infra/docker-compose.yml).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SHOTS="$ROOT/e2e/demo-shots"
OUT="$ROOT/assets/demo.gif"
API_PID=""
WEB_PID=""
WORKER_PID=""

cleanup() {
  for pid in "$WEB_PID" "$WORKER_PID" "$API_PID"; do
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
    fi
  done
}
trap cleanup EXIT

command -v convert >/dev/null 2>&1 || {
  echo "ImageMagick's 'convert' is required and was not found." >&2
  exit 1
}

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

export DATABASE_URL="${DATABASE_URL:-postgresql://booking:booking@localhost:5434/booking?schema=public}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6381}"
export AUTH_SECRET="${AUTH_SECRET:-demo-secret-at-least-32-characters-long}"
export API_PORT="${API_PORT:-4000}"
export WEB_PORT="${WEB_PORT:-3000}"
export API_BASE_URL="${API_BASE_URL:-http://localhost:${API_PORT}}"
export APP_BASE_URL="${APP_BASE_URL:-http://localhost:${WEB_PORT}}"
export NEXT_PUBLIC_API_BASE_URL="$API_BASE_URL"
export PAYMENTS_ENABLED=false

# A leftover server from an interrupted run is the nastiest failure here: the new
# process fails to bind, the run talks to the stale one, and the GIF shows code
# that is no longer on disk. The API is probed on /health because its root 404s,
# which `curl -f` would read as "nothing is listening".
for url in "${API_BASE_URL}/health" "${APP_BASE_URL}/"; do
  if curl -sf "$url" >/dev/null 2>&1; then
    echo "Something is already serving ${url}. Stop it first." >&2
    exit 1
  fi
done

echo "==> Clearing previous frames"
rm -rf "$SHOTS"
mkdir -p "$ROOT/assets"

echo "==> Migrating and seeding"
pnpm --filter @booking/db exec prisma migrate deploy >/dev/null
pnpm --filter @booking/db run seed >/dev/null

echo "==> Building"
# NODE_ENV=production is required: `next build` under development produces a
# broken prerender.
NODE_ENV=production pnpm build >/dev/null

echo "==> Starting api, worker, web"
node apps/api/dist/main.js >/tmp/booking-demo-api.log 2>&1 &
API_PID=$!
node apps/worker/dist/main.js >/tmp/booking-demo-worker.log 2>&1 &
WORKER_PID=$!
pnpm --filter @booking/web exec next start -p "$WEB_PORT" >/tmp/booking-demo-web.log 2>&1 &
WEB_PID=$!

wait_for() {
  local url="$1" name="$2" pid="$3"
  for _ in $(seq 1 90); do
    curl -sf "$url" >/dev/null 2>&1 && return 0
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "${name} exited during startup:" >&2
      tail -30 "/tmp/booking-demo-${name}.log" >&2
      return 1
    fi
    sleep 1
  done
  echo "${name} never came up:" >&2
  tail -30 "/tmp/booking-demo-${name}.log" >&2
  return 1
}

wait_for "${API_BASE_URL}/health" api "$API_PID"
wait_for "${APP_BASE_URL}/" web "$WEB_PID"

echo "==> Recording"
DEMO=1 pnpm --filter @booking/e2e exec playwright test --project=chromium --grep "@demo"

shopt -s nullglob
frames=("$SHOTS"/*.png)
if [[ ${#frames[@]} -eq 0 ]]; then
  echo "No frames were produced in ${SHOTS}." >&2
  exit 1
fi
echo "==> Captured ${#frames[@]} frames"

echo "==> Assembling ${OUT}"
# -delay is hundredths of a second, so 180 holds each frame 1.8s: long enough to
# read a screen, short enough that the loop stays under 20 seconds. The last
# frame holds longer so the loop does not snap back mid-thought.
convert -delay 180 -loop 0 "${frames[@]}" \
  -delay 320 "${frames[-1]}" \
  -resize 1000x \
  -layers optimize \
  "$OUT"

echo "==> ${OUT} ($(du -h "$OUT" | cut -f1))"
if [[ "$(stat -c%s "$OUT")" -gt 3500000 ]]; then
  echo "WARNING: over 3.5MB. Re-run with a smaller -resize, or drop a frame." >&2
fi
