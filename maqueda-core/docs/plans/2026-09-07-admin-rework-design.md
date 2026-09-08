# Admin Area Rework + Wallet Balance Monitor — Design

Date: 2026-09-07
Status: approved (brainstorm with owner)
Scope: MVP. Must work, not hyper-scalable.

## Goal

Clients connect their Trust Wallet to the dApp (`maqueda-deploy`), their address is stored.
The admin must:

1. See every connected wallet with live balances (ETH, USDC, USDT on Ethereum).
2. Be notified (in-app + Telegram) when a wallet's total USD value drops below a global threshold.
3. Activate / deactivate a wallet.
4. Have every user and system action recorded in an audit log.

Out of scope for now: smart contract, automatic penalties, dApp-side "kick" enforcement
(server keeps `isActive` and will expose a status endpoint later).

## Decisions

| Topic | Decision | Why |
|---|---|---|
| Chain | Ethereum only. `CHAIN_ID` env: `0xaa36a7` (Sepolia) in dev, `0x1` in prod | Same code, same wallet, same address on both |
| Tokens | Fixed list ETH, USDC, USDT stored in `MonitoredToken` | No indexer needed; `multicall balanceOf` on any RPC |
| Prices | CoinGecko `/simple/price`, 60 s in-memory cache | Free, no key |
| Threshold | One global USD threshold on **total** wallet value. `0` = alert on every balance change | Simple; per-token would be noisy |
| Notification | In-app `Alert` table + Telegram bot | Cheapest way to be woken up |
| Worker | Separate Node process (`tsx src/worker/monitor.ts`), polling | Isolated from Next, restartable, hosts future auto-penalty logic |
| Dev setup | Postgres in Docker, Next + worker on host | Native HMR on macOS; no stale `node_modules` volume |
| Theme | Dark only, shadcn default dark palette, no toggle | Owner preference |
| Language | Everything in English | Owner preference |
| Git | Never commit/push from an AI session | Owner controls what reaches the public GitHub Pages deploy |

## Data model (Prisma)

```
MonitoredToken   id, symbol, address? (null = native), decimals, chainId, coingeckoId, enabled
BalanceSnapshot  id, clientId, tokenId, rawBalance Decimal(78,0), usdValue Decimal(18,2), takenAt
                 written only when rawBalance differs from the previous snapshot
Alert            id, clientId?, type (BELOW_THRESHOLD | BACK_ABOVE | BALANCE_CHANGED | WORKER_ERROR),
                 message, payload Json?, readAt?, notifiedAt?, createdAt
Setting          key @unique, value String
                 keys: threshold_usd, poll_interval_sec, telegram_bot_token, telegram_chat_id
AuditLog         existing + actor (userId? | "worker" | "dapp"), action, details Json, clientId?
Client           existing + lastBalanceUsd Decimal?, belowThreshold Boolean, lastCheckedAt DateTime?
WorkerState      id="monitor", lastRunAt, lastError?, lastDurationMs
```

Seed: tokens for `0x1` and `0xaa36a7`, default settings, admin user.

Verify token addresses before seeding (do not trust memory):
- Mainnet USDC `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` (6 dec)
- Mainnet USDT `0xdAC17F958D2ee523a2206206994597C13D831ec7` (6 dec)
- Sepolia USDC (Circle) `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` (6 dec)
- Sepolia USDT: no official contract → deploy a mock ERC-20 or leave disabled

## Worker loop

Every `poll_interval_sec` (re-read each tick, default 15):

1. Load active clients and enabled tokens for `CHAIN_ID`.
2. Fetch prices (cached 60 s). On failure reuse last known prices; emit one `WORKER_ERROR` alert.
3. One `viem` `multicall` for all (client × ERC-20) `balanceOf` + batched `getBalance` for ETH.
4. Per client: compare raw vs last snapshot; write `BalanceSnapshot` on change; recompute `lastBalanceUsd`.
5. Alert rules:
   - threshold > 0: total drops below and `belowThreshold` was false → `BELOW_THRESHOLD`, set flag.
     Total goes back above → `BACK_ABOVE`, clear flag. No repeats.
   - threshold == 0: any raw change → `BALANCE_CHANGED` with per-token delta.
   - First snapshot for a client never alerts.
6. Each alert → DB row → Telegram `sendMessage`. Telegram failure leaves `notifiedAt` null; retried next tick.
7. Update `WorkerState`. Write `AuditLog` for start/stop, alerts, notifications, errors.

Per-tick try/catch; one failed tick never kills the loop. Graceful shutdown on SIGTERM.
Single worker instance assumed (documented).

## Admin UI

Layout: one `admin/layout.tsx` with `SidebarProvider` + `SidebarInset` + header. Pages never re-wrap.
Sidebar: real user from session, working logout, alert bell with unread count, SVG logo.

Pages:
- `/admin` — stat cards (active wallets, below threshold, unread alerts, worker last run), last 10 alerts, worker health.
- `/admin/clients` — TanStack data table: address (copy + explorer link), chain, ETH/USDC/USDT, total USD,
  status badge, last seen, actions. Search, status filter, sort, row click → detail, auto-refresh 30 s.
- `/admin/clients/[id]` — header + actions; tabs Balances (token cards + USD history chart), Alerts, Audit log, Device/Geo.
  Deactivate behind `AlertDialog`.
- `/admin/alerts` — table, filter by type/read, mark read.
- `/admin/settings` — react-hook-form + zod: threshold, poll interval, Telegram token/chat id + "Send test message",
  monitored tokens enable/disable. Saves write `SETTINGS_CHANGED` audit with diff.
- `/admin/users` — keep, fix layout, delete with confirmation.

All server actions: `verifySession` + ADMIN role + audit log. Mutations via `useTransition` + sonner toast.

Cleanup: delete `components/admin/sidebar.tsx`, `chart-area-interactive`, `section-cards`, `nav-documents`,
`dashboard/data.json`, `test-login`, `api/test-user`. Fix `client-actions.ts` to use `lib/db` singleton.
Fix `params` await in detail page. Prune dead networks from `networks.ts`.

## Dev experience

- `compose.yml`: `postgres` with healthcheck; `adminer` under profile `tools`; `app` + `worker` under profile `full`.
- `.env.example` with a comment per variable.
- Scripts: `dev` (next + worker via concurrently), `dev:next`, `dev:worker`, `db:up`, `db:down`, `db:migrate`,
  `db:seed`, `db:reset`, `db:studio`, `worker`.
- `Dockerfile`: multi-stage production only.
- Quick start: `cp .env.example .env && npm i && npm run db:up && npm run db:migrate && npm run dev`.

## Docs

```
README.md                         repo map + quick start
AGENTS.md (CLAUDE.md symlink)     AI entry point: conventions, where things live, git rules
maqueda-core/README.md            setup, scripts, env, src layout
maqueda-core/docs/architecture.md data model, flows, decisions
maqueda-core/docs/worker.md       loop, alert rules, debugging
maqueda-core/docs/admin-ui.md     pages, components, patterns
maqueda-deploy/README.md          dApp flow, GH Pages deploy, relation to docs/
maqueda-sol/README.md             placeholder
```

## Testing

- Unit: alert rule engine (pure function: previous state + balances + threshold → alerts), price cache, USD math.
- Integration: worker tick against a mocked viem client and a real Postgres.
- Manual: Sepolia wallet in Trust Wallet, faucet ETH + Circle USDC, watch dashboard + Telegram.
