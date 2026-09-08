# maqueda-core

Admin panel and balance monitor. Next.js 16 (App Router, React 19), Prisma 5 on Postgres, shadcn/ui,
a standalone Node worker using viem + CoinGecko.

Part of the [Maqueda repo](../README.md). AI agents: read [`AGENTS.md`](../AGENTS.md) first.

## Setup

```bash
cp .env.example .env     # every variable is documented inline
npm install              # also runs `prisma generate`
npm run db:up            # Postgres 16 in Docker (compose.yml), waits until healthy
npm run db:migrate       # prisma migrate dev
npm run db:seed          # monitored tokens, default settings, first admin user
npm run dev              # Next.js + worker together (colored logs: next / worker)
```

Open <http://localhost:3000>, sign in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.

To see balances you need a client row. Either connect a wallet through the dApp
([maqueda-deploy](../maqueda-deploy/README.md)) pointed at `http://localhost:3000`, or insert one manually:

```bash
curl -X POST http://localhost:3000/api/clients/connect \
  -H 'content-type: application/json' \
  -d '{"walletAddress":"0xYourSepoliaAddress","network":"0xaa36a7"}'
```

## Scripts

| Script | Does |
|---|---|
| `dev` | `dev:next` + `dev:worker` via concurrently |
| `dev:next` | Next.js dev server on :3000 |
| `dev:worker` | Worker with `tsx watch` (restarts on file change) |
| `worker` | Worker once, production style |
| `build` / `start` | Production build / server |
| `typecheck`, `lint`, `test` | `tsc --noEmit`, ESLint, vitest |
| `db:up` / `db:down` | Start / stop Postgres container |
| `db:migrate` | `prisma migrate dev` (creates a migration if the schema changed) |
| `db:deploy` | `prisma migrate deploy` (CI / prod, no prompts) |
| `db:seed` | Run `prisma/seed.ts` (idempotent) |
| `db:reset` | Drop, migrate, seed |
| `db:studio` | Prisma Studio GUI |
| `dapp:tunnel` | Serve the dApp + open https tunnels for phone testing (see [maqueda-deploy README](../maqueda-deploy/README.md#testing-from-a-phone-https-tunnels)) |
| `dapp:lan` | Same, LAN-only http, no tunnel |

Optional: `docker compose --profile tools up -d` adds Adminer on <http://localhost:8080>.
`docker compose --profile full up --build` runs app + worker in containers (production-like check).

## Environment

See [`.env.example`](.env.example). Summary:

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection |
| `JWT_SECRET` | Signs admin session cookies |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | First admin, created by seed if no users exist |
| `CHAIN_ID` | Chain the worker monitors: `0xaa36a7` Sepolia, `0x1` mainnet |
| `RPC_URL` | JSON-RPC endpoint for that chain |
| `COINGECKO_BASE_URL` | Price API base |
| `DAPP_ORIGINS` | CORS allowlist for `/api/clients/*` |
| `NEXT_PUBLIC_APP_URL` | Absolute URL used in Telegram links |

Telegram bot token and chat id are stored in the DB and edited in Admin → Settings.

## Layout

```
prisma/            schema.prisma, migrations/, seed.ts
src/
  app/             routes (App Router)
    admin/         dashboard, clients, clients/[id], alerts, users, settings
    api/clients/   public endpoints for the dApp (connect, status)
    auth/login     sign-in page
  actions/         server actions, one file per domain (auth, clients, alerts, settings, users, dashboard)
  components/      ui/ (shadcn), then one folder per domain (clients/, alerts/, settings/, users/, brand/)
  lib/             shared code: db, auth, audit, settings, chains, tokens, format, cors, security
  worker/          balance monitor: monitor.ts (loop), rules.ts, prices.ts, balances.ts, notify.ts, telegram.ts
  proxy.ts         edge redirect for anonymous /admin visits (Next 16 "proxy", formerly middleware)
docs/              architecture.md, worker.md, admin-ui.md, plans/
```

More: [architecture](docs/architecture.md) · [worker](docs/worker.md) · [admin UI](docs/admin-ui.md).

## Troubleshooting

- **Migrations "succeed" but the Docker database is empty / data looks stale**: another Postgres is
  listening on the host (Homebrew's `postgres` on 127.0.0.1:5432 is the usual suspect) and shadows the
  container. That is why `compose.yml` maps the container to **host port 5433** and `.env.example` uses it.
  Check with `lsof -nP -iTCP:5432 -sTCP:LISTEN`; stop the extra server with `brew services stop postgresql@15`
  if you do not need it.

- **Worker shows "Not running" on the dashboard**: it is not started, or `RPC_URL`/`CHAIN_ID` are wrong.
  Run `npm run dev:worker` and read the `[worker]` log lines.
- **`prisma migrate dev` fails to connect**: `npm run db:up` and wait for "healthy"; check `DATABASE_URL`.
- **No prices / "stale prices"**: CoinGecko rate limit or network. The worker keeps the last known prices
  and creates one `WORKER_ERROR` alert.
- **HMR does not pick up changes**: you are running Next inside Docker. Do not; run it on the host (`npm run dev`).
