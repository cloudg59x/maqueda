# maqueda-deploy (dApp)

Static page (`index.html` + `scripts/config.js` + `scripts/script.js`) opened inside the Trust Wallet
dApp browser. It detects the wallet (EIP-6963 with legacy fallback), connects, collects device/geo info,
reports the wallet to the admin API, and offers a "pay with token" flow driven by URL parameters.
No build step, no dependencies.

Back to [repo root](../README.md) · admin API lives in [maqueda-core](../maqueda-core/README.md).

## Configuration (`scripts/config.js`)

| Key | Meaning |
|---|---|
| `API_BASE_URL` | Admin API. Its `DAPP_ORIGINS` must include this page's origin |
| `CHAIN` | `"mainnet"` or `"sepolia"`: chain the payment flow targets |
| `CHAINS` | Chain ids, explorer, token contracts (USDC/USDT) per chain |
| `FALLBACK_PRICES_USD` | Used for the USD preview when CoinGecko is unreachable |
| `PROVIDER_DISCOVERY_MS` | Wait for wallet extensions before routing (default 2000) |

Per-visit overrides for testing: `?chain=sepolia` and `?api=https://admin.example`.

## URL parameters

| Param | Effect |
|---|---|
| none | Connect flow: request accounts, report to admin, show the signing demo |
| `token=eth\|usdc\|usdt` | Payment flow for that token on the configured chain |
| `receiver=0x…` | Pre-fills the receiver address |
| `chain=sepolia\|mainnet` | Overrides `CONFIG.CHAIN` |
| `api=…` | Overrides `CONFIG.API_BASE_URL` |

## Routing (unchanged behaviour)

| Context | No `token` | With `token` |
|---|---|---|
| Trust Wallet app (user agent) or mobile + injected provider | connect flow | payment page |
| Desktop with Trust Wallet extension | "click anywhere to connect" | deep-link to the mobile app after 1.5 s |
| Mobile without Trust Wallet | deep-link to Trust Wallet | deep-link after 1.5 s |
| Desktop without Trust Wallet | trustwallet.com/download | message, then download page after 5 s |
| `file://` | message only (extensions cannot inject into local files) | same |

## Payment flow

1. Amount + receiver (validated as a 0x address). USD preview from CoinGecko, fallback prices otherwise.
2. Confirmation screen filled with real wallet data: sender account, pending nonce, fee estimate from `eth_gasPrice`.
3. On confirm: `eth_requestAccounts`, and the wallet is **reported to the admin right away** (it shows up in
   Admin → Clients even if the transaction is later rejected), then `wallet_switchEthereumChain` to the configured chain (adds Sepolia if the
   wallet does not know it), then `eth_sendTransaction`:
   - ETH: native transfer with `value`;
   - USDC/USDT: ERC-20 `transfer(to, amount)` encoded by hand (`0xa9059cbb…`), amounts converted with the token's decimals.
4. The tx hash is reported to the admin API and linked to the block explorer.

If the wallet refuses the automatic chain switch, the page shows **"Wrong network"** with the chain the wallet is
on and asks the user to pick the right one from Trust Wallet's network selector, then Confirm again (no reload).
The confirmation screen also warns when the wallet is on a different chain than the configured one.

Add `&debug=1` to any URL to get an on-page log panel (phones have no console): every `[maqueda]` line, including
the raw `eth_chainId` value and the raw error returned by `wallet_switchEthereumChain`.

## Testing from a phone (https tunnels)

Trust Wallet's dApp browser refuses plain `http://`, so a LAN address is not enough. `dev-server.mjs` (repo root)
serves this folder, injects `API_BASE_URL` and `CHAIN` into `config.js` on the fly (the file on disk is
untouched), opens two Cloudflare quick tunnels (dApp + admin API, no account needed) and prints the URLs:

```bash
brew install cloudflared            # once
cd maqueda-core && npm run dev      # admin + worker, in another terminal
npm run dapp:tunnel                 # from the repo root or from maqueda-core
```

```
┌─ Maqueda dApp test URLs ───────────────────────────
│ dApp          https://<random>.trycloudflare.com
│ admin API     https://<random>.trycloudflare.com
│ connect only  https://…/?chain=sepolia&api=https://…
│ pay USDC      https://…/?chain=sepolia&api=https://…&token=usdc&receiver=0x…
│ pay ETH       …
```

Environment overrides: `DAPP_PORT` (8000), `API_PORT` (3000), `DAPP_CHAIN` (sepolia), `DAPP_RECEIVER`
(address in the printed payment URLs), `NO_TUNNEL=1` (LAN-only http, fine for desktop browsers).
Tunnel URLs change on every run; Ctrl+C closes everything. While the tunnel is up the dev admin is
reachable from the internet: use a real password or close it when done.

## Test mode on Sepolia

Set `CHAIN: "sepolia"` (or open with `?chain=sepolia`). An orange **TEST MODE** banner appears, the payment
flow targets chain `0xaa36a7`, and USDC points to Circle's Sepolia contract.

1. Trust Wallet → Settings → Preferences → enable **Testnet**; add "Ethereum Sepolia".
2. Sepolia ETH from a faucet (Google Cloud, Alchemy); Sepolia USDC from <https://faucet.circle.com>.
3. Open this page in the Trust Wallet dApp browser with `?token=usdc&receiver=0x…&chain=sepolia`.
4. Run the admin worker with `CHAIN_ID=0xaa36a7` to watch the balances move.

The same wallet address exists on both chains, so what you test on Sepolia is what happens on mainnet.

Trust Wallet's "Connected dApps" screen lists WalletConnect sessions only; connections made inside the in-app
dApp browser do not appear there. Check Admin → Clients instead. The mobile provider reports the chain id as a
plain number; `script.js` normalizes every chain id to hex before using it.

## API contract (server side: `maqueda-core/src/app/api/clients/`)

| Endpoint | When the dApp calls it | Body / query |
|---|---|---|
| `POST /api/clients/connect` | after `eth_requestAccounts`, on `chainChanged`, after a transaction | `{ walletAddress, network (hex chain id), ipAddress?, country?, region?, city?, latitude?, longitude?, userAgent?, browser?, os?, deviceType?, screenInfo?, lastTransactionHash? }` |
| `GET /api/clients/status?address=0x…` | **not wired yet** | returns `{ known, isActive }` so a deactivated wallet can be refused client-side |

IP and location come from `https://ipapi.co/json/` (https, no key). If it fails the admin still records the
IP from the request headers.

## Signature test page (`test.html`)

`test.html` + `scripts/test.js` is a standalone lab to see how Trust Wallet reacts to each request type the
future contract may need. Open it inside the Trust Wallet dApp browser (the tunnel prints a `test page` URL)
and press buttons; every request and the exact result/error appear in the on-page log (Copy button).

| Section | Buttons | What to expect |
|---|---|---|
| Wallet | connect, `eth_chainId`, switch/add chain, `wallet_getCapabilities` | capabilities show `atomic.status`: `supported`, `ready` (wallet will prompt the EOA → smart-account upgrade) or `unsupported` |
| EIP-7702 | `wallet_sendCalls` v2.0.0 atomic / non-atomic, v1.0 shape, with paymaster capability, `wallet_getCallsStatus`, `wallet_showCallsStatus`, raw `eth_sendTransaction` type `0x4` | a dApp **cannot** request a 7702 authorization directly (wallets whitelist delegation contracts); the EIP-5792 batch is the standard way to trigger the upgrade prompt. The raw type-4 tx is expected to be refused |
| ERC-20 approve | exact, unlimited, revoke (0), `increaseAllowance`, USDT-style 0 → amount | real transactions on the selected token; spender is the input (dummy `…dEaD` by default) |
| setApprovalForAll | ERC-721 true/false, ERC-1155 true | same selector `0xa22cb465`; the wallet decodes it and should warn |
| EIP-2612 permit | exact, unlimited + no deadline, without `EIP712Domain` type, wrong `chainId`, DAI-style, Permit2 `PermitSingle` | off-chain `eth_signTypedData_v4`; nonce and token name are read on-chain so the signature is valid; `v r s` are logged |
| Other | `personal_sign`, `eth_signTypedData` v1, `_v3`, `eth_sign` | `eth_sign` is normally blocked by wallets |

Do not press approve/setApprovalForAll on mainnet with a real spender unless you mean it. The page refuses to
send transactions or signatures while the wallet is on a different chain than the target (token addresses are
per chain); tick "allow chain mismatch" to override.

**Observed on Trust Wallet mobile (dApp browser, 2026-09-08):**
- `eth_chainId` returns a plain number (`1`).
- `wallet_switchEthereumChain` / `wallet_addEthereumChain` to Sepolia → `Not supported chainId`: testnets cannot be
  selected programmatically in the in-app browser; the user has to pick the network in the wallet UI, if available at all.
- `wallet_getCapabilities` / `wallet_sendCalls` → error `4200 EthereumProvider does not support calling …`: **no EIP-5792**,
  therefore no dApp-triggered EIP-7702 in Trust Wallet mobile. A raw `eth_sendTransaction` with `type: "0x4"` is shown
  as a plain transaction (the authorization list is ignored).
- `approve` and `setApprovalForAll` popups are shown normally.

## Publishing

This folder is the only copy of the dApp. Host it as static files (GitHub Pages, any CDN); there is no
build step. Before publishing set `API_BASE_URL` and `CHAIN` in `config.js`, and add this page's origin to
the admin's `DAPP_ORIGINS`.

## Debugging

Open the console: every log line is prefixed `[maqueda]`. `MaquedaDeploy.getProviders()` lists wallets that
announced themselves; `MaquedaDeploy.initializePaymentPage("usdc", "0x…")` renders the payment page without a wallet.
