# Admin Rework + Balance Monitor — Implementation Plan

> **For Claude:** Execute task by task in this session. Never commit or push (owner rule). Design: `2026-09-07-admin-rework-design.md`.

**Goal:** Working admin panel (dark, shadcn) that lists connected wallets with live ETH/USDC/USDT balances, alerts below a USD threshold (in-app + Telegram), lets the admin (de)activate wallets, and audit-logs everything. Plus a clean dev setup and English docs.

**Architecture:** Next.js 16 app (server components + server actions) shares Prisma and `src/lib` with a separate Node worker (`tsx`) that polls balances via `viem` multicall and CoinGecko prices. Postgres runs in Docker; Next and worker run on the host in dev.

**Tech Stack:** Next 16, React 19, Prisma 5 (kept; v7 migration out of scope), Tailwind v4, shadcn (zinc, dark), TanStack Table, react-hook-form + zod, viem 2, tsx, concurrently, vitest.

**Working directory for all commands:** `maqueda-core/` unless stated.

---

## Phase 0 — Dev experience

### Task 0.1: Dependencies + scripts
- Modify `package.json`: add `viem`, `react-hook-form`, `@hookform/resolvers`, `tsx`, `concurrently`, `vitest`, `@types/node`. Remove `@types/jest`, `types: ["jest"]` from tsconfig. Keep Prisma 5.
- Scripts: `dev` (concurrently next+worker), `dev:next`, `dev:worker`, `worker`, `db:up`, `db:down`, `db:migrate`, `db:seed`, `db:reset`, `db:studio`, `test`, `typecheck`.
- `prisma.seed` config pointing to `tsx prisma/seed.ts`.
- Run `npm install`. Verify: `npx tsc --noEmit` runs (errors expected until later tasks).

### Task 0.2: Compose + Dockerfile + env
- Create `compose.yml` (replace `docker-compose.yml`): `postgres:16-alpine` with healthcheck, named volume; `adminer` under profile `tools`; `app` + `worker` under profile `full` (prod-like, `env_file: .env`, `depends_on: condition: service_healthy`).
- Rewrite `Dockerfile` as multi-stage production build (deps → build → runner), `output: "standalone"` in `next.config.ts`. Separate target `worker` running `tsx src/worker/monitor.ts`.
- Delete `init.sql`, `scripts/setup-db.sh`, `docker-compose.yml`.
- Create `.env.example` with a comment per variable: `DATABASE_URL`, `JWT_SECRET`, `CHAIN_ID`, `RPC_URL`, `COINGECKO_BASE_URL`, `NEXT_PUBLIC_APP_URL`, `DAPP_ORIGINS`. Telegram lives in DB settings, not env.
- Update `.gitignore` (keep `.env*` ignored, add `!.env.example`).
- Verify: `npm run db:up` starts Postgres healthy (requires Docker daemon; if not running, note it and continue).

### Task 0.3: Test runner
- Create `vitest.config.ts` with `@` alias. Move `__tests__/auth.test.ts` to `src/lib/__tests__/auth.test.ts`, port to vitest.
- Verify: `npm test` passes.

## Phase 1 — Data layer

### Task 1.1: Prisma schema
- Modify `prisma/schema.prisma`: add `MonitoredToken`, `BalanceSnapshot`, `Alert`, `Setting`, `WorkerState`; extend `Client` (`lastBalanceUsd`, `belowThreshold`, `lastCheckedAt`, relations); extend `AuditLog` (`actor`, `details Json?`). Enums `AlertType`.
- Create migration folder `prisma/migrations/20260907190000_monitoring/migration.sql` by running `npx prisma migrate dev --name monitoring` (needs DB) — if DB unavailable, write SQL by hand with `prisma migrate diff`.
- Verify: `npx prisma generate` + `npx prisma validate`.

### Task 1.2: Seed
- Create `prisma/seed.ts`: upsert tokens (mainnet + Sepolia; Sepolia USDT disabled, address null), default settings (`threshold_usd=0`, `poll_interval_sec=15`), admin user from env `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` (defaults documented).
- Verify: `npm run db:seed`.

### Task 1.3: Lib modules (pure, tested)
- Create `src/lib/settings.ts`: `getSettings()`, `updateSettings(partial, actor)` (writes audit diff), typed keys + zod schema.
- Create `src/lib/audit.ts`: `audit({ actor, action, clientId?, details?, ip?, ua? })`. Replace usages in `client-tracking.ts`.
- Create `src/lib/tokens.ts`: `formatUnits`, `toUsd(raw, decimals, price)` using `viem` helpers + `Decimal`.
- Create `src/lib/chains.ts` (replaces `networks.ts`): `0x1`, `0xaa36a7` → name, explorer URL, viem chain object.
- Tests: `src/lib/__tests__/tokens.test.ts` (USD math with 6/18 decimals, rounding).

## Phase 2 — Worker

### Task 2.1: Alert rule engine (pure)
- Create `src/worker/rules.ts`: `evaluate({ previous: {belowThreshold, snapshots}, current: balances, thresholdUsd, isFirstRun }) → { alerts[], nextBelowThreshold }`.
- Tests `src/worker/__tests__/rules.test.ts`: below → alert once; stays below → none; back above → BACK_ABOVE; threshold 0 → BALANCE_CHANGED per change; first run → none.

### Task 2.2: Price feed
- Create `src/worker/prices.ts`: CoinGecko fetch, 60 s cache, last-known fallback, returns `{ prices, stale: boolean }`.
- Test with mocked `fetch`.

### Task 2.3: Balance fetcher
- Create `src/worker/balances.ts`: `viem` `createPublicClient` from `RPC_URL`, `multicall` `balanceOf` for ERC-20, `getBalance` for native. Input: clients[], tokens[]. Output: `Map<clientId, Map<tokenId, bigint>>`.
- Test with a stubbed public client.

### Task 2.4: Notifier
- Create `src/worker/telegram.ts`: `sendTelegram(token, chatId, text)`; `notifyPending()` picks alerts with `notifiedAt null`.

### Task 2.5: Monitor loop
- Create `src/worker/monitor.ts`: tick = settings → clients/tokens → prices → balances → per-client evaluate → persist snapshots/alerts/client fields → notify → `WorkerState`. Audit start/stop/errors. SIGTERM handling. Structured console logs with prefix `[worker]`.
- Verify: `npm run dev:worker` against seeded DB with one fake client row; observe log line per tick.

## Phase 3 — Admin UI

### Task 3.1: Theme + layout
- Rewrite `src/app/globals.css` for Tailwind v4 + shadcn zinc (OKLCH vars, `@theme inline`), dark values on `:root` (dark only), drop `@tailwind` v3 directives.
- Root layout: `className="dark"` on `<html>`, metadata title "Maqueda Admin".
- `admin/layout.tsx`: `SidebarProvider` + `AppSidebar` + `SidebarInset` + `SiteHeader` (breadcrumb + bell). Remove per-page wrappers.
- Create `src/components/brand/logo.tsx`: inline SVG, abstract sci-fi crypto mark, black/white, `currentColor`.
- Sidebar: nav (Dashboard, Clients, Alerts, Users, Settings), `NavUser` fed from session (`getCurrentUser()` in `lib/auth.ts`), logout server action.
- Delete dead files listed in design.
- Verify: `npm run dev:next`, login, all nav links render without double sidebar.

### Task 3.2: Server actions
- Rewrite `src/actions/client-actions.ts`: use `lib/db`, `requireAdmin()` helper, audit on activate/deactivate, `getClientsWithBalances()` (joins latest snapshot per token), `getClientDetail(id)`, `getClientBalanceHistory(id)`.
- Create `src/actions/alert-actions.ts`: list (filters), `markRead(ids)`, `markAllRead()`, unread count.
- Create `src/actions/settings-actions.ts`: `getSettings`, `saveSettings(form)` zod-validated, `sendTelegramTest()`.
- Create `src/actions/dashboard-actions.ts`: stats + worker health.
- Fix `user-actions.ts` audit + `requireAdmin`.
- Add shadcn components: `dialog`, `alert-dialog`, `form`, `switch`, `command`, `popover`, `scroll-area`.

### Task 3.3: Clients pages
- `src/components/clients/clients-table.tsx` (client component, TanStack): columns per design, search, status filter, sort, row click, 30 s `router.refresh()`.
- `src/components/clients/client-actions-menu.tsx`: dropdown with activate/deactivate via `useTransition` + `AlertDialog` + toast.
- `src/app/admin/clients/page.tsx` server → passes data.
- `src/app/admin/clients/[id]/page.tsx`: `await params`; tabs Balances (token cards + recharts area chart), Alerts, Audit log, Device/Geo.

### Task 3.4: Dashboard + Alerts pages
- `/admin`: stat cards, worker health badge, recent alerts list.
- `/admin/alerts`: table with type/read filters, mark read buttons.
- Header bell: unread count badge, popover with last 5 alerts, link to page.

### Task 3.5: Settings page
- react-hook-form + zod form: threshold, poll interval, Telegram token/chat id, "Send test message" button; monitored tokens table with enable switch.
- Saves write audit diff. Toasts.

### Task 3.6: Users page
- Fix layout, delete with `AlertDialog`, audit.

## Phase 4 — API hardening (minimal)

### Task 4.1: `/api/clients/connect`
- zod validation, address checksum via `viem` `isAddress`/`getAddress`, `DAPP_ORIGINS` env for CORS instead of `*`, audit `actor: "dapp"`.
- Add `GET /api/clients/status?address=` returning `{ isActive }` (for the future dApp kick, not wired now).

### Task 4.2: Middleware
- Verify Next 16 naming (`proxy.ts` vs `middleware.ts`); adjust if deprecated. Keep matcher.

## Phase 5 — Docs

### Task 5.1: READMEs
- Root `README.md`, `AGENTS.md` (+ `CLAUDE.md` symlink), `maqueda-core/README.md`, `maqueda-core/docs/architecture.md`, `docs/worker.md`, `docs/admin-ui.md`, `maqueda-deploy/README.md`, `maqueda-sol/README.md`. Cross-link all.

### Task 5.2: Final verification
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
- Manual: seed → dev → login → clients table shows seeded fake client with balances from Sepolia → set threshold → alert appears → Telegram test message.
