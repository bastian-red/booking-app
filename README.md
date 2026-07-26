# Booking App — concurrency-safe, timezone-correct scheduling

A Calendly-style scheduling platform. Hosts publish event types and weekly availability; guests book
slots through a public link, pay (optionally) with Stripe, and get email confirmations and reminders.

The two hard problems are solved properly:

1. **No double-booking under concurrency** — a PostgreSQL `GiST` exclusion constraint makes overlapping
   bookings for a host structurally impossible, even when many clients race for the same slot. A Redis
   lock sits in front for clean error messages.
2. **Timezone / DST correctness** — availability is stored in the host's local wall clock and resolved to
   absolute UTC with full daylight-saving handling, then shown to each guest in their own timezone.

![CI](https://github.com/bastian-red/booking-app/actions/workflows/ci.yml/badge.svg)

![Demo](assets/demo.gif)

*The booking flow, recorded from the Playwright suite: a host publishes availability, a guest opens
the public link and books a slot, and the double-booking guard refuses the second attempt.*

Not deployed anywhere, deliberately: this repo is the artefact. It runs locally in about a minute
(see [Running it](#running-it)) and the flow above is reproducible with `pnpm --filter @booking/e2e
test:e2e`.

---

## Architecture

```mermaid
flowchart LR
  guest([Guest]) -->|public booking link| web
  host([Host]) -->|dashboard| web
  web[apps/web · Next.js + Auth.js] -->|REST + HS256 service token| api
  api[apps/api · NestJS] --> pg[(PostgreSQL)]
  api --> redis[(Redis)]
  api -->|enqueue jobs| redis
  worker[apps/worker · BullMQ] -->|consume jobs| redis
  worker --> pg
  worker -->|emails| smtp[(SMTP / Mailhog)]
  api -->|checkout + webhooks| stripe[(Stripe)]

  subgraph shared packages
    db[packages/db · Prisma]
    engine[packages/shared · slot engine + contracts]
    pay[services/payments]
    notif[services/notifications]
  end
  api --- db
  api --- engine
  api --- pay
  worker --- notif
```

### How the guarantees work

- **Exclusion constraint** (`packages/db/prisma/migrations/*_booking_no_overlap`):
  `EXCLUDE USING gist (host_id WITH =, tstzrange(start_utc, end_utc, '[)') WITH &&) WHERE status <> 'CANCELLED'`.
  Two overlapping non-cancelled bookings for the same host can never both commit.
- **Redis lock** (`apps/api/src/redis/redis.service.ts`): `SET NX PX` per `host:slotStart`, released with a
  token-checked Lua script. Serializes racing attempts so losers get a clean `409`.
- **Slot engine** (`packages/shared/src/slots/engine.ts`): pure, deterministic, unit-tested against DST
  spring-forward and fall-back transitions.

---

## Tech stack

| Layer         | Choice                                                        |
| ------------- | ------------------------------------------------------------- |
| Frontend      | Next.js 14 (App Router), Auth.js v5 (credentials, JWT)        |
| Backend       | NestJS 10 (REST)                                              |
| Worker        | BullMQ (reminders, pending-booking expiry, heartbeat)         |
| Database      | PostgreSQL 16 + Prisma                                        |
| Cache / queue | Redis 7 (locks, BullMQ, worker heartbeat)                     |
| Payments      | Stripe (Checkout + idempotent webhooks), toggleable           |
| Email         | Nodemailer → Mailhog in dev                                   |
| Dates         | `date-fns` + `date-fns-tz`                                    |
| Tooling       | pnpm workspaces + Turborepo, TypeScript, Vitest, Playwright   |

## Monorepo layout

```
apps/web        Next.js: host dashboard + public booking + Auth.js
apps/api        NestJS: availability, slots, bookings, payments webhook, /health, auth
apps/worker     BullMQ workers: confirmation, reminder, expiry, heartbeat
services/payments        Stripe wrapper + contract
services/notifications   Email templates + transport
packages/db     Prisma schema + migrations (incl. exclusion constraint)
packages/shared slot engine + Zod contracts shared by web and api
infra           docker-compose + Dockerfiles
e2e             Playwright end-to-end tests
```

---

## Getting started

Prerequisites: Node 20+, pnpm (via `corepack enable`), Docker.

```bash
# 1. Infrastructure (Postgres + Redis + Mailhog)
docker compose -f infra/docker-compose.yml up -d

# 2. Install
pnpm install

# 3. Environment
cp .env.example .env        # generate AUTH_SECRET with: openssl rand -base64 32

# 4. Database
pnpm db:deploy              # apply migrations (creates the exclusion constraint)
pnpm db:seed                # demo host: demo@booking.local / password123

# 5. Run everything (web :3000, api :4000, worker)
pnpm dev
```

- Web: http://localhost:3000
- API health: http://localhost:4000/health
- Mailhog inbox: http://localhost:8027

Container ports are deliberately off the defaults (Postgres `5434`, Redis `6381`, Mailhog `1027`
and `8027`), so the stack starts on a machine that already runs a system PostgreSQL or another
project's Redis. The compose project is named `booking` for the same reason: without an explicit
name Compose derives it from the `infra/` directory, which every project in this portfolio has.

Payments are **off by default** (`PAYMENTS_ENABLED=false`), so paid event types auto-confirm without
Stripe keys. Set the flag to `true` and add test keys to enable the Stripe Checkout flow.

---

## Testing

Three lanes:

```bash
pnpm test                              # gate: fast unit tests (slot engine DST, payments, auth, worker)
pnpm --filter @booking/api test:integration   # concurrency: N racers, exactly 1 booking (needs DB+Redis)
pnpm --filter @booking/e2e test:e2e            # Playwright: full host→guest flow (needs full stack)
```

The **integration test** is the proof of the core guarantee: it fires 12 concurrent booking requests at
the same slot and asserts exactly one succeeds, then asserts the DB rejects a direct overlapping insert.

CI (`.github/workflows/ci.yml`) runs all three lanes on every push.

---

## Running the whole stack in containers

`pnpm dev` is the fast loop, but every service also has a Dockerfile and the compose file runs the
lot. This is not deployed anywhere; the images exist because a service that cannot start on its own
has a design problem, and CI builds all three on every push to prove they still can.

| Service    | Source                     | Notes                                                        |
| ---------- | -------------------------- | ------------------------------------------------------------ |
| web        | `infra/Dockerfile.web`     | Next.js standalone. `HOSTNAME=0.0.0.0` so it binds all interfaces, not just the loopback. |
| api        | `infra/Dockerfile.api`     | `PORT=4000` to match the port the app listens on. `prisma migrate deploy` runs before it serves. |
| worker     | `infra/Dockerfile.worker`  | BullMQ consumer; exposes no port. Its liveness is the Redis heartbeat `/health` reads. |
| Postgres   | `postgres:16-alpine`       | Named volume. `DATABASE_URL` for api + worker.                |
| Redis      | `redis:7-alpine`           | Named volume. `REDIS_URL` for api + worker.                   |

- api, worker and web share one `AUTH_SECRET` (the HS256 service-token contract). A mismatch is a
  total auth outage that presents as every request returning 401, so it is worth checking first.
- `NEXT_PUBLIC_API_BASE_URL` is inlined into the browser bundle **at build time**, so changing it
  after a build does nothing until the next one. api's CORS origin is `APP_BASE_URL`.
- **`/health` is real.** It returns `503` when Postgres or Redis is down and fails fast rather than
  hanging on a disconnected dependency, so it reports genuine dependency health rather than process
  liveness. `e2e/tests/health.spec.ts` asserts both the 200 and the contents.

### Environment variables

See `.env.example` for the full, documented list (database, Redis, Auth.js secret, Stripe keys +
`PAYMENTS_ENABLED`, SMTP, reminder lead time, pending-booking expiry).
