# Balance monitor worker

Back to [maqueda-core README](../README.md) · [architecture](architecture.md)

Entry point: [`src/worker/monitor.ts`](../src/worker/monitor.ts). Run with `npm run worker`
(or `npm run dev:worker` for restart-on-change). Loads `.env` itself via `src/worker/env.ts`.

## Tick

Every `poll_interval_sec` (read from the `Setting` table each tick, default 15 s):

1. `getMonitoredChain()` from `CHAIN_ID`; `getSettings()`.
2. Load active clients and enabled `MonitoredToken`s for that chain.
3. Prices from CoinGecko (`prices.ts`): one request for all `coingeckoId`s, cached 60 s in memory and
   persisted in `Setting.price_cache` (`price-store.ts`) so a restarted worker is not blind. 15 s timeout,
   one retry. On failure the last known prices are reused (`stale: true`) and one `WORKER_ERROR` alert is
   created until prices recover; with no cache at all the tick is skipped and the alert says so.
4. Balances (`balances.ts`): one `multicall` for every (wallet × ERC-20) `balanceOf`, plus batched
   `getBalance` for ETH. A failed token read leaves that token untouched for this tick.
5. Latest snapshot per (client, token) in one query (`distinct`).
6. Per client, `rules.ts#evaluate` (pure) returns changes, alerts and the new `belowThreshold` flag.
7. One transaction per client: new `BalanceSnapshot` rows for changed tokens, `Alert` rows, `Client` fields.
8. `notify.ts` sends pending alerts to Telegram and stamps `notifiedAt`.
9. `WorkerState` heartbeat updated; a log line summarises the tick.

A throwing tick is caught, recorded in `WorkerState.lastError` and audited as `WORKER_TICK_FAILED`;
the loop continues. `SIGINT`/`SIGTERM` stop the loop cleanly and audit `WORKER_STOPPED`.

## Alert rules (`rules.ts`)

| Threshold | Condition | Alert |
|---|---|---|
| `> 0` | total USD drops below and client was not below | `BELOW_THRESHOLD` (once) |
| `> 0` | total USD back above and client was below | `BACK_ABOVE` |
| `= 0` | any raw balance changed | `BALANCE_CHANGED` with per-token deltas, plus `total $X (ETH $price, was $Y)` so a total that moved with the market is not mistaken for a transfer |
| any | first tick for a client (`lastCheckedAt = null`) | nothing, state recorded |

Tests: [`src/worker/__tests__/rules.test.ts`](../src/worker/__tests__/rules.test.ts).

## Telegram

Configured in Admin → Settings (bot token + chat id, stored in `Setting`). Message format is HTML with a
link back to the client page (`NEXT_PUBLIC_APP_URL`). Delivery stops at the first failure in a tick and
retries next tick, so a Telegram outage never loses alerts.

## What a wake-up looks like

After the Mac sleeps (or Docker/network are not up yet) you will see a burst of `tick failed` lines:
`Can't reach database server`, viem `fetch failed`, CoinGecko `operation was aborted due to timeout`.
This is expected. Each failure is caught, recorded in `WorkerState.lastError`, and the loop keeps going;
the first successful tick clears it. Only the price feed creates an alert (once), because stale prices
change the USD numbers the rules act on.

## Debugging

- `npm run dev:worker` and watch `[worker] ... tick ok: N wallets, M tokens, S snapshots, A alerts, telegram ...`.
- Dashboard → Worker card shows last tick, duration, last error.
- Force a change: send a small amount of Sepolia ETH to a monitored wallet; next tick writes a snapshot.
- Sepolia faucets: Google Cloud Web3 faucet, Alchemy faucet. Sepolia USDC: <https://faucet.circle.com>.
- No official USDT on Sepolia: deploy any mintable ERC-20 (6 decimals), set its address in Settings → Monitored tokens, enable it.

## Extending

Automatic penalties belong here: after `evaluate`, a new step decides whether to call the future contract.
Keep it as a pure decision function + a small executor, mirror the alert pattern, audit every call.
