# Architecture

Back to [maqueda-core README](../README.md) · [repo root](../../README.md)

## Components

```
Trust Wallet ──▶ dApp (maqueda-deploy, static) ──POST /api/clients/connect──▶ Next.js (maqueda-core)
                                                                                   │
                                                              Postgres ◀───────────┤ server actions / pages
                                                                 ▲                 │
                                                                 │                 └─▶ admin browser (dark UI)
                                                       worker (tsx process)
                                                       viem multicall ──▶ RPC (Sepolia / mainnet)
                                                       CoinGecko prices
                                                       Telegram sendMessage
```

Two processes share one codebase and one Prisma client:

- **Next.js app** serves the admin UI and the public dApp endpoints.
- **Worker** (`src/worker/monitor.ts`) polls balances and writes snapshots, alerts and audit rows.
  It only imports `src/lib` and `src/worker`, so it can run without Next.

## Data model

Defined in [`prisma/schema.prisma`](../prisma/schema.prisma).

| Model | Role |
|---|---|
| `User`, `Session` | Admin accounts and cookie sessions (JWT, HS256, 7 days) |
| `Client` | One row per wallet address seen by the dApp. Holds device/geo info and denormalised monitoring state: `lastBalanceUsd`, `belowThreshold`, `lastCheckedAt`, `isActive` |
| `MonitoredToken` | Tokens the worker reads, per chain. `address = null` means native coin |
| `BalanceSnapshot` | `(client, token, rawBalance, usdValue, takenAt)`. Written **only when the raw balance changes**, so history stays small and the chart is a step function |
| `Alert` | What the worker flagged. `readAt` = in-app read state, `notifiedAt` = Telegram delivered |
| `Setting` | Key/value app settings editable from the UI (`threshold_usd`, `poll_interval_sec`, `telegram_*`) |
| `WorkerState` | Single row heartbeat (`id = "monitor"`) shown on the dashboard |
| `AuditLog` | Every admin action and worker/dApp event. `actor` is `user:<id>`, `worker`, `dapp` or `system` |

Money: raw on-chain balances are `Decimal(78,0)` in Postgres and `bigint` in code. USD is computed in
integer micro-dollars (`lib/tokens.ts#rawToUsd`) and stored as `Decimal(18,2)`.

## Flows

**Wallet connects** → dApp POSTs to `/api/clients/connect` → zod validation, address checksummed with viem,
`upsertClient` → audit `CLIENT_CONNECTED` / `CLIENT_UPDATED`.

**Worker tick** → see [worker.md](worker.md).

**Admin action** (activate, deactivate, delete, settings, users, mark alerts read) → server action in
`src/actions` → `requireAdmin()` → Prisma → `audit()` → `revalidatePath`.

**Notifications** → alerts with `notifiedAt = null` are sent to Telegram at the end of each tick
(`src/worker/notify.ts`). Failures are audited and retried next tick.

## Decisions

| Decision | Why |
|---|---|
| Fixed token list instead of an indexer | Enumerating "all tokens" needs Alchemy/Moralis; three tokens cover payments and work on any RPC |
| Global USD threshold on total value; `0` = alert on every change | One number to reason about; per-token thresholds were noisier |
| Separate worker process, polling | Isolated from Next's request lifecycle, restartable, future home of automatic penalties |
| Postgres in Docker, app on host | Native HMR on macOS; bind-mounted `node_modules` volumes caused stale dependencies |
| Dark theme only | Owner preference; removes a whole class of theme bugs |
| Prisma 5 kept | v7 changes config and adapters; not worth it for this iteration |
| Kick-from-dApp on hold | The server cannot revoke a wallet's connection; the dApp must poll `/api/clients/status`. Endpoint exists, dApp wiring deferred |
| Wallet status "Seen", not "Active" | The connect popup only shares an address; nothing is enforceable until an on-chain `approve`. See [plans/2026-09-08-enforcement-model.md](plans/2026-09-08-enforcement-model.md) |
| Enforcement via ERC-20 allowance, ETH monitored only | Native ETH has no `approve`; escrow rejected for now. Same document |

History: [plans/](plans/) holds the design and plan documents per iteration.
