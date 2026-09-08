# Enforcement model — decision record

Date: 2026-09-08
Status: decided with the owner. Contract not started yet.

## The misunderstanding this settles

The owner expected that when a client approves the dApp's **connect popup**, the client is adhering to the
contract (penalties included) and the admin can then act on that wallet.

That is not what the popup does. `eth_requestAccounts` only shares the client's address with the page:
no signature, nothing on-chain, no permission over funds. Trust Wallet does not list in-app dApp browser
connections anywhere (its "Connected dApps" screen is WalletConnect sessions only) because there is no
persistent link to list. A wallet cannot be debited by a third party, ever: there is no "pignoramento" of a
plain wallet on a blockchain.

## How enforcement without further consent actually works

The client consents **once, on-chain**, by sending a transaction to the contract. From then on the contract
executes the rules with no further consent. Two possible models:

| Model | Client action | Operator can | Risk |
|---|---|---|---|
| Escrow | `deposit(amount)`: funds leave the wallet and sit in the contract | release or claim penalty per contract rules | none, funds already held |
| **Allowance** (chosen) | `approve(contract, X)` on an ERC-20: funds stay in the wallet, contract may pull up to X | `transferFrom` on penalty while balance and allowance cover it | client can revoke or empty the wallet; the balance monitor exists for this |

**Decision: allowance on the monitored ERC-20s (USDC, USDT). ETH is monitored only**: native ETH has no
`approve`, so it can never be a guarantee. (WETH or an ETH escrow were considered and rejected for now.)

## Consequences

- Adhesion = the client's `approve` transaction, shown in Trust Wallet with contract address and amount. The dApp
  will get a "Join / Authorize" screen for it once the contract exists.
- Admin status ladder for a wallet:
  - **Seen**: reported by the dApp after the connect popup. Nothing enforceable. (implemented)
  - **Enrolled**: `allowance(client, contract) > 0` and balance covers it. Read on-chain by the worker. (with the contract)
  - **Deactivated**: excluded by an admin. (implemented)
  Only Enrolled wallets are ones the operator can act on. Never label a merely-connected wallet as active or connected.
- No signature-based verification (`personal_sign` challenge) for now: the owner chose not to add the extra popup.
  Consequence: `/api/clients/connect` is public and unauthenticated, so a "Seen" row proves nothing by itself.
- The worker keeps monitoring balances; with allowance it must also read `allowance()` per token and alert when
  balance < allowance (the guarantee is no longer covered).

## What the contract must expose (for the next iteration)

- `allowance` reads happen on the token contracts, not on ours: the worker calls `token.allowance(client, contract)`.
- `claimPenalty(client, token, amount)`: operator only, `transferFrom(client, operator, amount)`.
- `release`/nothing to do for allowance: the client revokes the approve themselves at the end.
- Events for every claim so the worker can audit them.
