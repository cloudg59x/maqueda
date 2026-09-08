# Maqueda

Crypto payment + security-deposit platform. Clients connect a Trust Wallet through a small dApp,
their address is recorded, and an admin panel monitors those wallets (ETH, USDC, USDT on Ethereum),
raises alerts when balances drop, and lets the operator activate/deactivate clients.
A smart contract for deposits and penalties is planned but not started.

## Repository map

| Path | What it is | Docs |
|---|---|---|
| [`maqueda-core/`](maqueda-core/README.md) | Next.js 16 admin panel + Node worker + Prisma/Postgres | [README](maqueda-core/README.md), [architecture](maqueda-core/docs/architecture.md), [worker](maqueda-core/docs/worker.md), [admin UI](maqueda-core/docs/admin-ui.md) |
| [`maqueda-deploy/`](maqueda-deploy/README.md) | Static dApp (HTML + vanilla JS) that talks to Trust Wallet and calls the admin API | [README](maqueda-deploy/README.md) |
| [`maqueda-sol/`](maqueda-sol/README.md) | Placeholder for the Solidity deposit/penalty contract | [README](maqueda-sol/README.md) |
| [`dev-server.mjs`](dev-server.mjs) | Serves the dApp + opens https tunnels to test from a phone (`npm run dapp:tunnel` here or in maqueda-core) | [maqueda-deploy README](maqueda-deploy/README.md#testing-from-a-phone-https-tunnels) |
| [`AGENTS.md`](AGENTS.md) | Entry point for AI coding agents: conventions, rules, where to look | |

## Quick start (development)

Requirements: Node 20+, Docker (OrbStack/Docker Desktop) for Postgres.

```bash
cd maqueda-core
cp .env.example .env          # then edit JWT_SECRET, RPC_URL
npm install
npm run db:up                 # Postgres in Docker, waits for healthcheck
npm run db:migrate            # apply Prisma migrations
npm run db:seed               # tokens, settings, first admin user
npm run dev                   # Next.js on :3000 + balance worker, both on the host
```

Sign in at <http://localhost:3000> with the seeded admin (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from `.env`).

## Status

- Done: admin panel (dark, shadcn), balance monitor worker, in-app + Telegram alerts, audit log, client (de)activation.
- On hold: dApp-side enforcement of deactivated wallets (`GET /api/clients/status` exists, dApp does not call it yet).
- Not started: smart contract, automatic penalties.

Design and plan for the current iteration: [`maqueda-core/docs/plans/`](maqueda-core/docs/plans/).
