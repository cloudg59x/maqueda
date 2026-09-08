/**
 * Wallet request test page (test.html). Every button sends one JSON-RPC request to the injected wallet
 * and logs the exact params and the exact result/error on the page. No dependencies, no build step.
 *
 * Nothing here is used by the payment dApp (script.js); this file only shares config.js.
 * Variants follow the official specs: EIP-7702, EIP-5792, ERC-2612, Permit2, ERC-20, ERC-721/1155.
 */
(function () {
  "use strict";

  const CONFIG = window.MAQUEDA_CONFIG || {};
  const PARAMS = new URLSearchParams(window.location.search);
  const CHAIN_KEY = (PARAMS.get("chain") || CONFIG.CHAIN || "mainnet").toLowerCase();
  const CHAIN = (CONFIG.CHAINS && CONFIG.CHAINS[CHAIN_KEY]) || (CONFIG.CHAINS && CONFIG.CHAINS.mainnet) || null;

  const MAX_UINT256 = (1n << 256n) - 1n;
  const MAX_UINT160 = (1n << 160n) - 1n;
  const MAX_UINT48 = (1n << 48n) - 1n;
  const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
  const SELECTORS = {
    approve: "0x095ea7b3", // approve(address,uint256)
    increaseAllowance: "0x39509351", // increaseAllowance(address,uint256) (OpenZeppelin, not in ERC-20)
    setApprovalForAll: "0xa22cb465", // setApprovalForAll(address,bool)
    nonces: "0x7ecebe00", // nonces(address)
    name: "0x06fdde03", // name()
  };

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  const $ = (id) => document.getElementById(id);

  function serialize(value) {
    if (value instanceof Error) {
      return JSON.stringify({ name: value.name, code: value.code, message: value.message, data: value.data }, (k, v) => (v === undefined ? undefined : v));
    }
    if (typeof value === "bigint") return value.toString();
    if (value && typeof value === "object") {
      try {
        return JSON.stringify(value, (k, v) => (typeof v === "bigint" ? v.toString() : v), 2);
      } catch {
        return String(value);
      }
    }
    return String(value);
  }

  function normalizeChainId(value) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number" || typeof value === "bigint") return `0x${BigInt(value).toString(16)}`;
    const str = String(value).trim().toLowerCase();
    if (/^0x[0-9a-f]+$/.test(str)) return str;
    if (/^\d+$/.test(str)) return `0x${BigInt(str).toString(16)}`;
    return null;
  }

  const isAddress = (v) => /^0x[0-9a-fA-F]{40}$/.test(String(v || "").trim());
  const toHex = (n) => "0x" + BigInt(n).toString(16);
  const pad32 = (hex) => hex.replace(/^0x/, "").toLowerCase().padStart(64, "0");
  const encAddress = (a) => pad32(a);
  const encUint = (n) => pad32(BigInt(n).toString(16));
  const encBool = (b) => pad32(b ? "1" : "0");
  const encodeCall = (selector, ...words) => selector + words.join("");

  function parseUnits(amount, decimals) {
    const [intPart, fracPart = ""] = String(amount).trim().split(".");
    if (!/^\d*$/.test(intPart) || !/^\d*$/.test(fracPart)) throw new Error(`Invalid amount "${amount}"`);
    const frac = (fracPart + "0".repeat(decimals)).slice(0, decimals);
    return BigInt(intPart || "0") * 10n ** BigInt(decimals) + BigInt(frac || "0");
  }

  function splitSignature(sig) {
    const s = String(sig).replace(/^0x/, "");
    if (s.length !== 130) return { raw: sig, note: `unexpected length ${s.length}` };
    let v = parseInt(s.slice(128, 130), 16);
    if (v < 27) v += 27;
    return { r: "0x" + s.slice(0, 64), s: "0x" + s.slice(64, 128), v };
  }

  function decodeString(hex) {
    // ABI-encoded dynamic string: offset, length, bytes.
    const h = String(hex).replace(/^0x/, "");
    if (h.length < 128) return null;
    const len = parseInt(h.slice(64, 128), 16);
    const bytes = h.slice(128, 128 + len * 2);
    return new TextDecoder().decode(new Uint8Array(bytes.match(/../g).map((b) => parseInt(b, 16))));
  }

  const utf8ToHex = (text) => "0x" + Array.from(new TextEncoder().encode(text), (b) => b.toString(16).padStart(2, "0")).join("");

  // ---------------------------------------------------------------------------
  // Log panel
  // ---------------------------------------------------------------------------

  function logLine(kind, text) {
    const panel = $("log");
    const el = document.createElement("div");
    el.className = `log-line ${kind}`;
    el.textContent = `${new Date().toISOString().slice(11, 19)} ${text}`;
    panel.prepend(el);
    console.log(`[test] ${text}`);
  }

  // ---------------------------------------------------------------------------
  // Wallet
  // ---------------------------------------------------------------------------

  const announced = new Map();
  let provider = null;
  let account = null;
  let lastCallsId = null;

  function discoverProvider() {
    window.addEventListener("eip6963:announceProvider", (e) => {
      const { info, provider: p } = e.detail;
      if (!announced.has(info.uuid)) {
        announced.set(info.uuid, { info, provider: p });
        logLine("info", `wallet announced: ${info.name} (${info.rdns})`);
      }
    });
    window.dispatchEvent(new Event("eip6963:requestProvider"));
  }

  function pickProvider() {
    for (const entry of announced.values()) {
      if (entry.info && entry.info.rdns === "com.trustwallet.app") return entry.provider;
    }
    const eth = window.ethereum;
    if (eth) {
      if (eth.isTrust || eth.isTrustWallet) return eth;
      if (Array.isArray(eth.providers)) {
        const p = eth.providers.find((x) => x.isTrust || x.isTrustWallet);
        if (p) return p;
      }
      return eth;
    }
    return window.trustwallet || null;
  }

  /** Send one request, log params and result, never throw. Returns the result or undefined. */
  async function run(label, method, params) {
    provider = provider || pickProvider();
    if (!provider) {
      logLine("error", `${label}: no injected wallet found (open this page inside Trust Wallet)`);
      return undefined;
    }
    logLine("request", `→ ${label}: ${method} ${params === undefined ? "" : serialize(params)}`);
    try {
      const result = await provider.request(params === undefined ? { method } : { method, params });
      logLine("result", `← ${label}: ${serialize(result)}`);
      return result;
    } catch (error) {
      logLine("error", `✗ ${label}: ${serialize(error)}`);
      return undefined;
    }
  }

  async function ensureAccount() {
    if (account) return account;
    const accounts = await run("connect", "eth_requestAccounts");
    account = accounts && accounts[0] ? accounts[0] : null;
    if (account) updateHeader();
    return account;
  }

  async function chainId() {
    const raw = await run("chainId", "eth_chainId");
    return normalizeChainId(raw);
  }

  /**
   * Refuse to send transactions / signatures while the wallet is on another chain than the target:
   * the token addresses in config.js belong to the target chain. Override with the checkbox.
   */
  async function guardChain(label) {
    if (!CHAIN) return true;
    const current = await chainId();
    if (current === CHAIN.chainId.toLowerCase()) return true;
    const name = current ? (Object.values(CONFIG.CHAINS || {}).find((c) => c.chainId.toLowerCase() === current) || {}).name || current : "unknown";
    if ($("in-force").checked) {
      logLine("info", `${label}: wallet on ${name}, target ${CHAIN.name}; sending anyway (override checked)`);
      return true;
    }
    logLine("error", `${label}: wallet is on ${name}, target is ${CHAIN.name}. Switch network in the wallet, or tick "allow chain mismatch".`);
    return false;
  }

  async function updateHeader() {
    $("hdr-account").textContent = account ? account : "not connected";
    $("hdr-chain").textContent = CHAIN ? `${CHAIN.name} (${CHAIN.chainId})` : "no chain configured";
  }

  // ---------------------------------------------------------------------------
  // Inputs
  // ---------------------------------------------------------------------------

  function inputs() {
    const spender = $("in-spender").value.trim();
    const nft = $("in-nft").value.trim();
    const amount = $("in-amount").value.trim() || "1";
    const minutes = Number($("in-deadline").value) || 30;
    const tokenKey = $("in-token").value;
    if (!isAddress(spender)) throw new Error("Spender / operator must be a 0x address");
    if (!isAddress(nft)) throw new Error("NFT contract must be a 0x address");
    const t = CHAIN && CHAIN.tokens ? CHAIN.tokens[tokenKey] : null;
    if (!t || !t.address) throw new Error(`Token ${tokenKey} has no contract on ${CHAIN ? CHAIN.name : "this chain"} (see config.js)`);
    return { spender, nft, amount, minutes, token: { key: tokenKey, symbol: tokenKey.toUpperCase(), address: t.address, decimals: t.decimals } };
  }

  function deadline(minutes) {
    return BigInt(Math.floor(Date.now() / 1000) + minutes * 60);
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const actions = {
    // --- wallet ---
    async connect() {
      account = null;
      await ensureAccount();
    },
    async chainId() {
      await chainId();
    },
    async switchChain() {
      await run("switch chain", "wallet_switchEthereumChain", [{ chainId: CHAIN.chainId }]);
    },
    async addChain() {
      await run("add chain", "wallet_addEthereumChain", [{
        chainId: CHAIN.chainId,
        chainName: CHAIN.name,
        nativeCurrency: { name: "Ether", symbol: CHAIN.nativeSymbol, decimals: 18 },
        rpcUrls: CHAIN.rpcUrls || [],
        blockExplorerUrls: [CHAIN.explorerUrl],
      }]);
    },
    async capabilities() {
      const from = await ensureAccount();
      await run("getCapabilities", "wallet_getCapabilities", [from, ["0x1", "0xaa36a7"]]);
    },

    // --- EIP-7702 via EIP-5792 ---
    async sendCallsAtomic() {
      const from = await ensureAccount();
      const res = await run("sendCalls atomic", "wallet_sendCalls", [{
        version: "2.0.0",
        from,
        chainId: CHAIN.chainId,
        atomicRequired: true,
        calls: [
          { to: from, value: "0x0" },
          { to: from, value: "0x0" },
        ],
      }]);
      if (res && res.id) lastCallsId = res.id;
    },
    async sendCallsNonAtomic() {
      const from = await ensureAccount();
      const res = await run("sendCalls non-atomic", "wallet_sendCalls", [{
        version: "2.0.0",
        from,
        chainId: CHAIN.chainId,
        atomicRequired: false,
        calls: [{ to: from, value: "0x0" }],
      }]);
      if (res && res.id) lastCallsId = res.id;
    },
    async sendCallsLegacy() {
      const from = await ensureAccount();
      const res = await run("sendCalls v1.0", "wallet_sendCalls", [{
        version: "1.0",
        from,
        chainId: CHAIN.chainId,
        calls: [{ to: from, value: "0x0", data: "0x" }],
      }]);
      if (res && (res.id || typeof res === "string")) lastCallsId = res.id || res;
    },
    async sendCallsPaymaster() {
      const from = await ensureAccount();
      await run("sendCalls + paymaster capability", "wallet_sendCalls", [{
        version: "2.0.0",
        from,
        chainId: CHAIN.chainId,
        atomicRequired: true,
        calls: [{ to: from, value: "0x0" }],
        capabilities: { paymasterService: { url: "https://paymaster.example.invalid", optional: true } },
      }]);
    },
    async callsStatus() {
      if (!lastCallsId) return logLine("error", "no wallet_sendCalls id yet");
      await run("getCallsStatus", "wallet_getCallsStatus", [lastCallsId]);
    },
    async showCallsStatus() {
      if (!lastCallsId) return logLine("error", "no wallet_sendCalls id yet");
      await run("showCallsStatus", "wallet_showCallsStatus", [lastCallsId]);
    },
    async rawType4() {
      if (!(await guardChain("rawType4"))) return;
      // Non-standard: EIP-7702 defines the tx type, not a JSON-RPC way for dApps to request it.
      const from = await ensureAccount();
      await run("raw type-4 tx", "eth_sendTransaction", [{
        from,
        to: from,
        value: "0x0",
        type: "0x4",
        authorizationList: [{
          chainId: CHAIN.chainId,
          address: "0x000000000000000000000000000000000000dEaD",
          nonce: "0x0",
        }],
      }]);
    },

    // --- ERC-20 approve ---
    async approveExact() {
      if (!(await guardChain("approveExact"))) return;
      const { spender, amount, token } = inputs();
      const from = await ensureAccount();
      const raw = parseUnits(amount, token.decimals);
      await run(`approve ${amount} ${token.symbol}`, "eth_sendTransaction", [{ from, to: token.address, value: "0x0", data: encodeCall(SELECTORS.approve, encAddress(spender), encUint(raw)) }]);
    },
    async approveUnlimited() {
      if (!(await guardChain("approveUnlimited"))) return;
      const { spender, token } = inputs();
      const from = await ensureAccount();
      await run(`approve unlimited ${token.symbol}`, "eth_sendTransaction", [{ from, to: token.address, value: "0x0", data: encodeCall(SELECTORS.approve, encAddress(spender), encUint(MAX_UINT256)) }]);
    },
    async approveRevoke() {
      if (!(await guardChain("approveRevoke"))) return;
      const { spender, token } = inputs();
      const from = await ensureAccount();
      await run(`approve 0 ${token.symbol} (revoke)`, "eth_sendTransaction", [{ from, to: token.address, value: "0x0", data: encodeCall(SELECTORS.approve, encAddress(spender), encUint(0n)) }]);
    },
    async increaseAllowance() {
      if (!(await guardChain("increaseAllowance"))) return;
      const { spender, amount, token } = inputs();
      const from = await ensureAccount();
      const raw = parseUnits(amount, token.decimals);
      await run(`increaseAllowance ${amount} ${token.symbol}`, "eth_sendTransaction", [{ from, to: token.address, value: "0x0", data: encodeCall(SELECTORS.increaseAllowance, encAddress(spender), encUint(raw)) }]);
    },
    async approveTwoStep() {
      if (!(await guardChain("approveTwoStep"))) return;
      const { spender, amount, token } = inputs();
      const from = await ensureAccount();
      const raw = parseUnits(amount, token.decimals);
      const first = await run(`USDT-style step 1: approve 0`, "eth_sendTransaction", [{ from, to: token.address, value: "0x0", data: encodeCall(SELECTORS.approve, encAddress(spender), encUint(0n)) }]);
      if (!first) return;
      await run(`USDT-style step 2: approve ${amount}`, "eth_sendTransaction", [{ from, to: token.address, value: "0x0", data: encodeCall(SELECTORS.approve, encAddress(spender), encUint(raw)) }]);
    },

    // --- setApprovalForAll ---
    async approvalForAll721() {
      if (!(await guardChain("approvalForAll721"))) return;
      const { spender, nft } = inputs();
      const from = await ensureAccount();
      await run("setApprovalForAll(true) ERC-721", "eth_sendTransaction", [{ from, to: nft, value: "0x0", data: encodeCall(SELECTORS.setApprovalForAll, encAddress(spender), encBool(true)) }]);
    },
    async approvalForAll721Revoke() {
      if (!(await guardChain("approvalForAll721Revoke"))) return;
      const { spender, nft } = inputs();
      const from = await ensureAccount();
      await run("setApprovalForAll(false) ERC-721", "eth_sendTransaction", [{ from, to: nft, value: "0x0", data: encodeCall(SELECTORS.setApprovalForAll, encAddress(spender), encBool(false)) }]);
    },
    async approvalForAll1155() {
      if (!(await guardChain("approvalForAll1155"))) return;
      const { spender, nft } = inputs();
      const from = await ensureAccount();
      await run("setApprovalForAll(true) ERC-1155 (same selector)", "eth_sendTransaction", [{ from, to: nft, value: "0x0", data: encodeCall(SELECTORS.setApprovalForAll, encAddress(spender), encBool(true)) }]);
    },

    // --- EIP-2612 permit via eth_signTypedData_v4 ---
    /**
     * What a real client would see: 1000 USDC for one year to the spender in the input.
     * Uses USDC on the chain the wallet is currently on (no chain switch needed), so it works on
     * Trust Wallet mobile even though Sepolia cannot be selected programmatically.
     */
    async permitRealistic() {
      const spender = $("in-spender").value.trim();
      if (!isAddress(spender)) throw new Error("Spender must be a 0x address");
      const from = await ensureAccount();
      const current = await chainId();
      const chain = Object.values(CONFIG.CHAINS || {}).find((c) => c.chainId.toLowerCase() === current);
      const usdc = chain && chain.tokens && chain.tokens.usdc;
      if (!chain || !usdc || !usdc.address) throw new Error(`No USDC configured for the wallet's chain ${current}`);
      const nonce = await readNonce(usdc.address, from);
      const name = (await readName(usdc.address)) || "USDC";
      const value = parseUnits("100000000", usdc.decimals);
      const dl = BigInt(Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60);
      const typed = {
        types: {
          EIP712Domain: [
            { name: "name", type: "string" },
            { name: "version", type: "string" },
            { name: "chainId", type: "uint256" },
            { name: "verifyingContract", type: "address" },
          ],
          Permit: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
            { name: "value", type: "uint256" },
            { name: "nonce", type: "uint256" },
            { name: "deadline", type: "uint256" },
          ],
        },
        primaryType: "Permit",
        domain: { name, version: "2", chainId: parseInt(current, 16), verifyingContract: usdc.address },
        message: { owner: from, spender, value: value.toString(), nonce: nonce.toString(), deadline: dl.toString() },
      };
      logLine("info", `realistic permit: 1000 USDC on ${chain.name}, deadline ${new Date(Number(dl) * 1000).toISOString().slice(0, 10)}, spender ${spender}`);
      const sig = await run("permit 1000 USDC · 1 year", "eth_signTypedData_v4", [from, JSON.stringify(typed)]);
      if (sig) logLine("info", `v/r/s: ${serialize(splitSignature(sig))}`);
    },
    async permitStandard() {
      await signPermit({ unlimited: false, includeDomainType: true });
    },
    async permitUnlimited() {
      await signPermit({ unlimited: true, includeDomainType: true, farDeadline: true });
    },
    async permitNoDomainType() {
      await signPermit({ unlimited: false, includeDomainType: false });
    },
    async permitWrongChain() {
      await signPermit({ unlimited: false, includeDomainType: true, wrongChain: true });
    },
    async permitDai() {
      if (!(await guardChain("permitDai"))) return;
      const { spender, minutes, token } = inputs();
      const from = await ensureAccount();
      const nonce = await readNonce(token.address, from);
      const cid = parseInt(CHAIN.chainId, 16);
      const typed = {
        types: {
          EIP712Domain: [
            { name: "name", type: "string" },
            { name: "version", type: "string" },
            { name: "chainId", type: "uint256" },
            { name: "verifyingContract", type: "address" },
          ],
          Permit: [
            { name: "holder", type: "address" },
            { name: "spender", type: "address" },
            { name: "nonce", type: "uint256" },
            { name: "expiry", type: "uint256" },
            { name: "allowed", type: "bool" },
          ],
        },
        primaryType: "Permit",
        domain: { name: "Dai Stablecoin", version: "1", chainId: cid, verifyingContract: token.address },
        message: { holder: from, spender, nonce: nonce.toString(), expiry: deadline(minutes).toString(), allowed: true },
      };
      const sig = await run("permit DAI-style", "eth_signTypedData_v4", [from, JSON.stringify(typed)]);
      if (sig) logLine("info", `v/r/s: ${serialize(splitSignature(sig))}`);
    },
    async permit2() {
      if (!(await guardChain("permit2"))) return;
      const { spender, amount, minutes, token } = inputs();
      const from = await ensureAccount();
      const cid = parseInt(CHAIN.chainId, 16);
      const exp = deadline(minutes);
      const typed = {
        types: {
          EIP712Domain: [
            { name: "name", type: "string" },
            { name: "chainId", type: "uint256" },
            { name: "verifyingContract", type: "address" },
          ],
          PermitSingle: [
            { name: "details", type: "PermitDetails" },
            { name: "spender", type: "address" },
            { name: "sigDeadline", type: "uint256" },
          ],
          PermitDetails: [
            { name: "token", type: "address" },
            { name: "amount", type: "uint160" },
            { name: "expiration", type: "uint48" },
            { name: "nonce", type: "uint48" },
          ],
        },
        primaryType: "PermitSingle",
        domain: { name: "Permit2", chainId: cid, verifyingContract: PERMIT2 },
        message: {
          details: {
            token: token.address,
            amount: (amount === "max" ? MAX_UINT160 : parseUnits(amount, token.decimals)).toString(),
            expiration: (exp > MAX_UINT48 ? MAX_UINT48 : exp).toString(),
            nonce: "0",
          },
          spender,
          sigDeadline: exp.toString(),
        },
      };
      const sig = await run("Permit2 PermitSingle", "eth_signTypedData_v4", [from, JSON.stringify(typed)]);
      if (sig) logLine("info", `v/r/s: ${serialize(splitSignature(sig))}`);
    },

    // --- other signatures ---
    async personalSign() {
      const from = await ensureAccount();
      const sig = await run("personal_sign", "personal_sign", [utf8ToHex("Maqueda test message"), from]);
      if (sig) logLine("info", `v/r/s: ${serialize(splitSignature(sig))}`);
    },
    async signTypedDataV1() {
      const from = await ensureAccount();
      await run("eth_signTypedData (v1 legacy)", "eth_signTypedData", [[{ type: "string", name: "message", value: "Maqueda legacy typed data" }], from]);
    },
    async signTypedDataV3() {
      const from = await ensureAccount();
      const cid = parseInt(CHAIN.chainId, 16);
      const typed = {
        types: {
          EIP712Domain: [
            { name: "name", type: "string" },
            { name: "version", type: "string" },
            { name: "chainId", type: "uint256" },
          ],
          Mail: [
            { name: "from", type: "address" },
            { name: "contents", type: "string" },
          ],
        },
        primaryType: "Mail",
        domain: { name: "Maqueda", version: "1", chainId: cid },
        message: { from, contents: "Maqueda v3 typed data" },
      };
      await run("eth_signTypedData_v3", "eth_signTypedData_v3", [from, JSON.stringify(typed)]);
    },
    async ethSign() {
      const from = await ensureAccount();
      await run("eth_sign (usually blocked)", "eth_sign", [from, "0x" + "ab".repeat(32)]);
    },
  };

  async function readNonce(tokenAddress, owner) {
    const hex = await run("read nonces(owner)", "eth_call", [{ to: tokenAddress, data: encodeCall(SELECTORS.nonces, encAddress(owner)) }, "latest"]);
    if (!hex || hex === "0x") {
      logLine("error", `no contract at ${tokenAddress} on the wallet's current chain (nonces() returned 0x); using nonce 0`);
      return 0n;
    }
    return BigInt(hex);
  }

  async function readName(tokenAddress) {
    const hex = await run("read name()", "eth_call", [{ to: tokenAddress, data: SELECTORS.name }, "latest"]);
    return hex && hex !== "0x" ? decodeString(hex) : null;
  }

  /** ERC-2612 permit. USDC: version "2" on both mainnet ("USD Coin") and Sepolia ("USDC"); name read on-chain. */
  async function signPermit({ unlimited, includeDomainType, farDeadline = false, wrongChain = false }) {
    if (!(await guardChain("permit"))) return;
    const { spender, amount, minutes, token } = inputs();
    const from = await ensureAccount();
    const nonce = await readNonce(token.address, from);
    const name = (await readName(token.address)) || token.symbol;
    const cid = wrongChain ? 1337 : parseInt(CHAIN.chainId, 16);
    const value = unlimited ? MAX_UINT256 : parseUnits(amount, token.decimals);
    const dl = farDeadline ? MAX_UINT256 : deadline(minutes);
    const types = {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };
    if (includeDomainType) {
      types.EIP712Domain = [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ];
    }
    const typed = {
      types,
      primaryType: "Permit",
      domain: { name, version: token.key === "usdc" ? "2" : "1", chainId: cid, verifyingContract: token.address },
      message: { owner: from, spender, value: value.toString(), nonce: nonce.toString(), deadline: dl.toString() },
    };
    const label = `permit ${unlimited ? "unlimited" : amount} ${token.symbol}${includeDomainType ? "" : " (no EIP712Domain type)"}${wrongChain ? " (chainId 1337)" : ""}`;
    const sig = await run(label, "eth_signTypedData_v4", [from, JSON.stringify(typed)]);
    if (sig) logLine("info", `v/r/s: ${serialize(splitSignature(sig))}`);
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------

  function bind() {
    document.querySelectorAll("button[data-action]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const name = btn.dataset.action;
        btn.disabled = true;
        try {
          await actions[name]();
        } catch (error) {
          logLine("error", `✗ ${name}: ${serialize(error)}`);
        } finally {
          btn.disabled = false;
        }
      });
    });
    $("clear-log").addEventListener("click", () => { $("log").innerHTML = ""; });
    $("copy-log").addEventListener("click", () => {
      const text = Array.from($("log").children).map((l) => l.textContent).reverse().join("\n");
      navigator.clipboard.writeText(text).then(() => logLine("info", "log copied")).catch(() => logLine("error", "clipboard unavailable"));
    });
  }

  function fillTokenSelect() {
    const sel = $("in-token");
    sel.innerHTML = "";
    const tokens = CHAIN && CHAIN.tokens ? CHAIN.tokens : {};
    for (const [key, t] of Object.entries(tokens)) {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = `${key.toUpperCase()}${t.address ? "" : " (no contract on this chain)"}`;
      opt.disabled = !t.address;
      sel.appendChild(opt);
    }
  }

  function boot() {
    discoverProvider();
    fillTokenSelect();
    updateHeader();
    bind();
    logLine("info", `test page ready · chain ${CHAIN ? CHAIN.name : "?"} · ${CHAIN && CHAIN.isTestnet ? "TESTNET" : "MAINNET"}`);
    setTimeout(() => {
      provider = pickProvider();
      logLine("info", provider ? `injected wallet: ${provider.isTrust || provider.isTrustWallet ? "Trust Wallet" : "unknown"}` : "no injected wallet yet");
    }, 1500);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.MaquedaTest = { actions, run, get provider() { return provider; } };
})();
