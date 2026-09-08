# maqueda-sol

Placeholder for the on-chain part. Nothing is implemented yet.

Back to [repo root](../README.md).

## Intended scope

Decided model (see [enforcement-model.md](../maqueda-core/docs/plans/2026-09-08-enforcement-model.md)):
**ERC-20 allowance**. The client calls `approve(contract, X)` on USDC/USDT; the contract's `claimPenalty` does
`transferFrom` when rules are broken; the operator (or the worker, see
[maqueda-core/docs/worker.md](../maqueda-core/docs/worker.md#extending)) triggers it. ETH is monitored only,
never a guarantee.

## When starting

- Use Foundry or Hardhat; deploy to Sepolia first (`0xaa36a7`), the admin already supports it.
- The worker will need the contract address and an operator key in env; keep them out of the DB.
- Mirror every on-chain call with an `AuditLog` row and an `Alert` on failure.
