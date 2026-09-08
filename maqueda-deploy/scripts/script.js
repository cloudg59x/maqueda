/**
 * Maqueda dApp. Runs inside the Trust Wallet dApp browser (or with the Trust Wallet extension).
 *
 * Flows (unchanged from the previous version, see README.md):
 *   - no ?token          connect wallet, report it to the admin API, show the signing demo
 *   - ?token=eth|usdc    payment page: amount -> confirmation -> eth_sendTransaction
 *   - not in Trust Wallet deep-link into the app (mobile) or send to the download page (desktop)
 *
 * Configuration lives in config.js (window.MAQUEDA_CONFIG). No build step, no dependencies.
 */
(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Config & chain helpers
  // ---------------------------------------------------------------------------

  const CONFIG = window.MAQUEDA_CONFIG || {};
  const PARAMS = new URLSearchParams(window.location.search);
  const API_BASE_URL = (PARAMS.get("api") || CONFIG.API_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
  const CHAIN_KEY = (PARAMS.get("chain") || CONFIG.CHAIN || "mainnet").toLowerCase();
  const CHAIN = (CONFIG.CHAINS && CONFIG.CHAINS[CHAIN_KEY]) || (CONFIG.CHAINS && CONFIG.CHAINS.mainnet) || null;

  const DEBUG = PARAMS.get("debug") === "1";

  // Phones have no console: with ?debug=1 every log line is also appended to an on-page panel.
  function debugPanel(level, args) {
    if (!DEBUG || !document.body) return;
    let panel = document.getElementById("debug-panel");
    if (!panel) {
      panel = document.createElement("pre");
      panel.id = "debug-panel";
      panel.className = "debug-panel";
      document.body.classList.add("has-debug-panel");
      document.body.appendChild(panel);
    }
    const text = args.map((a) => (typeof a === "string" ? a : serialize(a))).join(" ");
    panel.textContent += `${new Date().toISOString().slice(11, 19)} ${level} ${text}\n`;
    const lines = panel.textContent.split("\n");
    if (lines.length > 60) panel.textContent = lines.slice(-60).join("\n");
    panel.scrollTop = panel.scrollHeight;
  }

  /** Compact JSON. Wallet errors hide code/message behind non-enumerable fields, so they are picked explicitly. */
  function serialize(value) {
    if (value instanceof Error) {
      const picked = { name: value.name, code: value.code, message: value.message, data: value.data };
      return JSON.stringify(picked, (k, v) => (v === undefined ? undefined : v));
    }
    if (value && typeof value === "object") {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return String(value);
  }

  const log = (...args) => { console.log("[maqueda]", ...args); debugPanel("LOG", args); };
  const warn = (...args) => { console.warn("[maqueda]", ...args); debugPanel("WARN", args); };
  const err = (...args) => { console.error("[maqueda]", ...args); debugPanel("ERROR", args); };

  /**
   * Wallets disagree on the chain id format: hex string ("0xaa36a7"), decimal string ("11155111") or a plain
   * number (Trust Wallet mobile). Everything goes through here and comes out as lowercase hex, or null.
   */
  function normalizeChainId(value) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number" || typeof value === "bigint") return `0x${BigInt(value).toString(16)}`;
    const str = String(value).trim().toLowerCase();
    if (/^0x[0-9a-f]+$/.test(str)) return str;
    if (/^\d+$/.test(str)) return `0x${BigInt(str).toString(16)}`;
    return null;
  }

  function chainName(chainId) {
    const id = normalizeChainId(chainId);
    if (!CONFIG.CHAINS) return id || "Unknown";
    const found = Object.values(CONFIG.CHAINS).find((c) => c.chainId.toLowerCase() === id);
    return found ? found.name : `Unknown (${chainId})`;
  }

  function tokenInfo(tokenId) {
    const id = String(tokenId || "").toLowerCase();
    if (!CHAIN) return null;
    if (id === CHAIN.nativeSymbol.toLowerCase()) return { id, symbol: CHAIN.nativeSymbol, decimals: 18, address: null, coingeckoId: "ethereum", native: true };
    const t = CHAIN.tokens && CHAIN.tokens[id];
    if (!t) return null;
    return { id, symbol: id.toUpperCase(), decimals: t.decimals, address: t.address, coingeckoId: t.coingeckoId, native: false };
  }

  // ---------------------------------------------------------------------------
  // Small utilities
  // ---------------------------------------------------------------------------

  const $ = (id) => document.getElementById(id);
  const setMessage = (html, asHtml = false) => {
    const el = document.querySelector(".message");
    if (!el) return;
    if (asHtml) el.innerHTML = html;
    else el.textContent = html;
  };

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  function shortAddress(address, head = 6, tail = 4) {
    if (!address || address.length < head + tail + 2) return address || "";
    return `${address.slice(0, head)}…${address.slice(-tail)}`;
  }

  function isHexAddress(value) {
    return /^0x[0-9a-fA-F]{40}$/.test(String(value || "").trim());
  }

  function utf8ToHex(text) {
    const bytes = new TextEncoder().encode(text);
    return "0x" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  /** "1.5" with 6 decimals -> 1500000n. Exact, no floats. */
  function parseUnits(amount, decimals) {
    const [intPart, fracPart = ""] = String(amount).trim().split(".");
    if (!/^\d*$/.test(intPart) || !/^\d*$/.test(fracPart)) throw new Error("Invalid amount");
    const frac = (fracPart + "0".repeat(decimals)).slice(0, decimals);
    return BigInt(intPart || "0") * 10n ** BigInt(decimals) + BigInt(frac || "0");
  }

  function toHex(value) {
    return "0x" + BigInt(value).toString(16);
  }

  function formatUnits(raw, decimals, maxFraction = 6) {
    const s = BigInt(raw).toString().padStart(decimals + 1, "0");
    const int = s.slice(0, s.length - decimals);
    const frac = s.slice(s.length - decimals).slice(0, maxFraction).replace(/0+$/, "");
    return frac ? `${int}.${frac}` : int;
  }

  /** ABI-encode ERC-20 transfer(address,uint256). */
  function encodeErc20Transfer(to, rawAmount) {
    const selector = "a9059cbb";
    const addr = to.toLowerCase().replace(/^0x/, "").padStart(64, "0");
    const amt = BigInt(rawAmount).toString(16).padStart(64, "0");
    return "0x" + selector + addr + amt;
  }

  // ---------------------------------------------------------------------------
  // Device information
  // ---------------------------------------------------------------------------

  function getBrowserInfo() {
    const ua = navigator.userAgent;
    if (ua.includes("Firefox")) return "Firefox";
    if (ua.includes("Edg")) return "Edge";
    if (ua.includes("Chrome")) return "Chrome";
    if (ua.includes("Safari")) return "Safari";
    return "Unknown";
  }

  function getOSInfo() {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
    if (ua.includes("Android")) return "Android";
    if (ua.includes("Windows")) return "Windows";
    if (ua.includes("Mac")) return "MacOS";
    if (ua.includes("Linux")) return "Linux";
    return "Unknown";
  }

  function getDeviceType() {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return "tablet";
    if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) return "mobile";
    return "desktop";
  }

  function getDeviceInformation() {
    return {
      userAgent: navigator.userAgent,
      browser: getBrowserInfo(),
      os: getOSInfo(),
      deviceType: getDeviceType(),
      screenInfo: `${window.screen.width}x${window.screen.height} (${window.devicePixelRatio}x density)`,
    };
  }

  function isMobileDevice() {
    // User agent only: window width or touch support would flag narrow desktop windows and touch laptops.
    return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  function isTrustWalletMobile() {
    return navigator.userAgent.includes("TrustWallet");
  }

  /**
   * IP + coarse location in one https call (ipapi.co, no key). The old ip-api.com endpoint is http only
   * and browsers block it from an https page. Fails soft: the admin still gets the IP from the request.
   */
  async function getIpAndLocation() {
    try {
      const res = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(6000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      if (d.error) throw new Error(d.reason || "ipapi error");
      return {
        ipAddress: d.ip || null,
        country: d.country_name || null,
        region: d.region || null,
        city: d.city || null,
        latitude: typeof d.latitude === "number" ? d.latitude : null,
        longitude: typeof d.longitude === "number" ? d.longitude : null,
      };
    } catch (error) {
      warn("Geolocation lookup failed:", error.message || error);
      return {};
    }
  }

  // ---------------------------------------------------------------------------
  // Wallet discovery (EIP-6963 with legacy fallback)
  // ---------------------------------------------------------------------------

  const announcedProviders = new Map();
  let provider = null;

  function initializeEIP6963() {
    window.addEventListener("eip6963:announceProvider", (event) => {
      const { info, provider: p } = event.detail;
      if (announcedProviders.has(info.uuid)) return;
      announcedProviders.set(info.uuid, { info, provider: p });
      log("Wallet announced:", info.name, info.rdns);
    });
    window.dispatchEvent(new Event("eip6963:requestProvider"));
  }

  function legacyTrustWalletProvider() {
    const eth = window.ethereum;
    if (eth) {
      if (eth.isTrust || eth.isTrustWallet) return eth;
      if (Array.isArray(eth.providers)) {
        const p = eth.providers.find((x) => x.isTrust || x.isTrustWallet);
        if (p) return p;
      }
      // Last resort: any injected provider (previous behaviour).
      return eth;
    }
    return window.trustwallet || null;
  }

  function getTrustWalletProvider() {
    for (const entry of announcedProviders.values()) {
      if (entry.info && entry.info.rdns === "com.trustwallet.app") return entry.provider;
    }
    return legacyTrustWalletProvider();
  }

  // ---------------------------------------------------------------------------
  // Admin API
  // ---------------------------------------------------------------------------

  async function reportClient(data) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/clients/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        warn("Admin API rejected client data:", res.status, await res.text().catch(() => ""));
        return null;
      }
      return await res.json();
    } catch (error) {
      warn("Admin API unreachable:", error.message || error);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Chain helpers on the provider
  // ---------------------------------------------------------------------------

  async function currentChainId() {
    const fromRequest = await provider.request({ method: "eth_chainId" }).catch((e) => { warn("eth_chainId failed:", e); return null; });
    const normalized = normalizeChainId(fromRequest) ?? normalizeChainId(provider.chainId) ?? null;
    log("eth_chainId raw:", fromRequest, "provider.chainId:", provider.chainId, "->", normalized);
    return normalized;
  }

  /**
   * Ask the wallet to switch to the configured chain; adds it first if unknown. Never throws:
   * returns { ok: true } or { ok: false, current, reason, raw } so the UI can explain what to do by hand.
   */
  async function ensureConfiguredChain() {
    if (!CHAIN) return { ok: true };
    const target = CHAIN.chainId.toLowerCase();
    let current = await currentChainId();
    if (current === target) return { ok: true };
    log(`Wallet is on ${current || "unknown chain"}, switching to ${CHAIN.name} (${target})`);

    const attempts = [];
    try {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN.chainId }] });
      attempts.push("switch: ok");
    } catch (error) {
      attempts.push(`switch: ${serialize(error)}`);
      warn("wallet_switchEthereumChain failed:", error);
      if (error && error.code === 4001) return { ok: false, current, reason: "rejected by user", raw: attempts.join(" | ") };
      try {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: CHAIN.chainId,
            chainName: CHAIN.name,
            nativeCurrency: { name: "Ether", symbol: CHAIN.nativeSymbol, decimals: 18 },
            rpcUrls: CHAIN.rpcUrls || [],
            blockExplorerUrls: [CHAIN.explorerUrl],
          }],
        });
        attempts.push("add: ok");
      } catch (addError) {
        attempts.push(`add: ${serialize(addError)}`);
        warn("wallet_addEthereumChain failed:", addError);
      }
    }

    // Trust it only if the wallet now reports the target chain.
    current = await currentChainId();
    if (current === target) return { ok: true };
    return { ok: false, current, reason: "the wallet did not switch", raw: attempts.join(" | ") };
  }

  function showTestnetBanner() {
    if (!CHAIN || !CHAIN.isTestnet) return;
    let banner = $("testnet-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "testnet-banner";
      banner.className = "testnet-banner";
      document.body.prepend(banner);
    }
    banner.textContent = `TEST MODE · ${CHAIN.name} · funds have no value`;
  }

  // ---------------------------------------------------------------------------
  // Routing
  // ---------------------------------------------------------------------------

  function initializeApp() {
    log("Initializing", { api: API_BASE_URL, chain: CHAIN_KEY });
    showTestnetBanner();
    const tokenId = PARAMS.get("token");
    const receiverAddress = PARAMS.get("receiver");
    setTimeout(() => route(tokenId, receiverAddress), CONFIG.PROVIDER_DISCOVERY_MS || 2000);
  }

  function route(tokenId, receiverAddress) {
    const inTrustWalletApp = isTrustWalletMobile();
    provider = getTrustWalletProvider();
    const hasProvider = provider !== null;
    const isLocalFile = window.location.protocol === "file:";
    const mobile = isMobileDevice();

    log("Detection:", {
      inTrustWalletApp,
      hasProvider,
      mobile,
      isLocalFile,
      announced: Array.from(announcedProviders.values()).map((p) => p.info.rdns),
    });

    if (isLocalFile) {
      setMessage("Running locally may prevent wallet detection.<br>Serve this page over http/https.", true);
      warn("Wallet extensions cannot interact with file:// URLs.");
      return;
    }

    if (inTrustWalletApp || (hasProvider && mobile)) {
      // Trust Wallet dApp browser (by user agent, or mobile + injected provider).
      if (tokenId) {
        setMessage("Loading payment page…");
        initializePaymentPage(tokenId, receiverAddress);
      } else {
        setMessage("Trust Wallet detected. Loading app…");
        startWalletApp();
      }
      return;
    }

    if (hasProvider) {
      // Desktop extension.
      if (tokenId) {
        setMessage("Opening in Trust Wallet app for payment…");
        setTimeout(redirectToWallet, 1500);
      } else {
        setMessage("Trust Wallet extension detected. Click anywhere to connect.");
        document.body.addEventListener("click", startWalletApp);
      }
      return;
    }

    // No Trust Wallet at all.
    if (tokenId && mobile) {
      setMessage("Opening in Trust Wallet dApp browser…");
      setTimeout(redirectToWallet, 1500);
    } else if (tokenId) {
      setMessage("Please open this link on a mobile device with Trust Wallet installed");
      setTimeout(() => { window.location.href = "https://trustwallet.com/download"; }, 5000);
    } else {
      redirectToWallet();
    }
  }

  function redirectToWallet() {
    setMessage("Redirecting to Trust Wallet…");
    if (isMobileDevice()) {
      const url = encodeURIComponent(window.location.href);
      window.location.href = `https://link.trustwallet.com/open_url?coin_id=60&url=${url}`;
    } else {
      setMessage("Please install Trust Wallet extension");
      window.location.href = "https://trustwallet.com/download";
    }
  }

  // ---------------------------------------------------------------------------
  // Connect flow (no ?token)
  // ---------------------------------------------------------------------------

  function startWalletApp() {
    document.body.removeEventListener("click", startWalletApp);
    setMessage("Connecting to Trust Wallet…");
    connectToWallet();
  }

  /**
   * Ask the wallet for accounts and report the wallet to the admin right away, so it shows up in
   * Admin -> Clients as soon as the user approves the connection popup, whatever happens next.
   */
  async function connectAndReport() {
    if (!provider) throw new Error("Trust Wallet provider not found");
    const accounts = await provider.request({ method: "eth_requestAccounts" });
    const account = accounts && accounts[0];
    if (!account) throw new Error("No accounts found");
    log("Connected account:", account);
    const network = await currentChainId();
    const location = await getIpAndLocation();
    await reportClient({ walletAddress: account, network, ...location, ...getDeviceInformation() });
    attachProviderListeners();
    return { account, network };
  }

  async function connectToWallet() {
    try {
      const { account } = await connectAndReport();
      setMessage(`Connected: ${shortAddress(account)}`);
      showSigningOptions(account);
    } catch (error) {
      err("Connection error:", error);
      setMessage(error && error.code === 4001 ? "Connection rejected by user" : "Connection failed");
    }
  }

  let listenersAttached = false;
  function attachProviderListeners() {
    if (listenersAttached || !provider || typeof provider.on !== "function") return;
    listenersAttached = true;
    provider.on("accountsChanged", (accounts) => {
      if (accounts.length === 0) setMessage("Wallet disconnected");
      else setMessage(`Connected: ${shortAddress(accounts[0])}`);
    });
    provider.on("chainChanged", async (rawChainId) => {
      const chainId = normalizeChainId(rawChainId);
      log("Network changed to:", chainId, `(raw: ${rawChainId})`);
      try {
        const accounts = await provider.request({ method: "eth_accounts" });
        if (accounts.length > 0) await reportClient({ walletAddress: accounts[0], network: chainId });
      } catch (error) {
        warn("Could not report network change:", error);
      }
      window.location.reload();
    });
  }

  // ---------------------------------------------------------------------------
  // Signing demo (connect flow)
  // ---------------------------------------------------------------------------

  function showSigningOptions(account) {
    const container = document.querySelector(".loader-container");
    container.innerHTML = `
      <h2>Maqueda</h2>
      <p>Connected account: <code>${escapeHtml(shortAddress(account))}</code></p>
      <button id="sign-message-btn" class="btn">Sign Message</button>
      <button id="sign-typed-data-btn" class="btn btn-secondary">Sign Typed Data</button>
      <div id="signature-result" class="signature-result"></div>
    `;
    $("sign-message-btn").addEventListener("click", () => signMessage(account));
    $("sign-typed-data-btn").addEventListener("click", () => signTypedData(account));
  }

  function renderSignature(title, signature) {
    const el = $("signature-result");
    el.innerHTML = `
      <h3>${escapeHtml(title)}</h3>
      <p><code>${escapeHtml(signature.slice(0, 20))}…${escapeHtml(signature.slice(-20))}</code></p>
      <button id="copy-signature-btn" class="btn btn-secondary">Copy signature</button>
    `;
    $("copy-signature-btn").addEventListener("click", () => navigator.clipboard.writeText(signature).catch(() => {}));
  }

  function renderSigningError(error) {
    err("Signing error:", error);
    $("signature-result").textContent = error && error.code === 4001 ? "Signature rejected by user" : "Signing failed";
  }

  async function signMessage(account) {
    try {
      $("signature-result").textContent = "Waiting for signature…";
      const hexMessage = utf8ToHex("Sign this message to authenticate with Maqueda");
      const signature = await provider.request({ method: "personal_sign", params: [hexMessage, account] });
      renderSignature("Signature", signature);
    } catch (error) {
      renderSigningError(error);
    }
  }

  async function signTypedData(account) {
    try {
      const chainId = parseInt((await currentChainId()) || "0x1", 16);
      const typedData = {
        domain: { name: "Maqueda", version: "1", chainId },
        types: {
          EIP712Domain: [
            { name: "name", type: "string" },
            { name: "version", type: "string" },
            { name: "chainId", type: "uint256" },
          ],
          Person: [
            { name: "name", type: "string" },
            { name: "wallet", type: "address" },
          ],
          Mail: [
            { name: "from", type: "Person" },
            { name: "to", type: "Person" },
            { name: "contents", type: "string" },
          ],
        },
        primaryType: "Mail",
        message: {
          from: { name: "User", wallet: account },
          to: { name: "Maqueda", wallet: "0x0000000000000000000000000000000000000000" },
          contents: "Welcome to Maqueda!",
        },
      };
      $("signature-result").textContent = "Waiting for signature…";
      const signature = await provider.request({ method: "eth_signTypedData_v4", params: [account, JSON.stringify(typedData)] });
      renderSignature("Typed data signature", signature);
    } catch (error) {
      renderSigningError(error);
    }
  }

  // ---------------------------------------------------------------------------
  // Payment flow (?token=eth|usdc|usdt&receiver=0x…)
  // ---------------------------------------------------------------------------

  const payment = { token: null, prices: null, account: null };

  function initializePaymentPage(tokenId, receiverAddress) {
    payment.token = tokenInfo(tokenId);
    $("loader-container").style.display = "none";
    $("payment-container").style.display = "block";

    if (!payment.token) {
      $("send-screen").innerHTML = `<p class="error">Token "${escapeHtml(tokenId)}" is not supported on ${escapeHtml(CHAIN ? CHAIN.name : "this chain")}.</p>`;
      return;
    }
    if (!payment.token.native && !payment.token.address) {
      $("send-screen").innerHTML = `<p class="error">${escapeHtml(payment.token.symbol)} has no contract configured on ${escapeHtml(CHAIN.name)}. See config.js.</p>`;
      return;
    }

    $("send-title").textContent = `Send ${payment.token.symbol}`;
    if (receiverAddress) $("receiver-address").value = receiverAddress;

    const amountInput = $("amount");
    $("receiver-address").addEventListener("input", validateInputs);
    amountInput.addEventListener("input", () => {
      validateInputs();
      updateUsdPreview(amountInput.value);
    });
    $("next-btn").addEventListener("click", showConfirmationScreen);
    $("back-btn").addEventListener("click", showSendScreen);
    $("confirm-btn").addEventListener("click", confirmTransaction);
    validateInputs();
    loadPrices().then(() => updateUsdPreview(amountInput.value));
  }

  function validateInputs() {
    const address = $("receiver-address").value.trim();
    const amount = $("amount").value;
    const ok = isHexAddress(address) && amount && parseFloat(amount) > 0;
    $("next-btn").disabled = !ok;
  }

  async function loadPrices() {
    const fallback = CONFIG.FALLBACK_PRICES_USD || {};
    const ids = ["ethereum", payment.token.coingeckoId].filter(Boolean).join(",");
    try {
      const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      payment.prices = {
        eth: body.ethereum ? body.ethereum.usd : fallback.eth,
        token: body[payment.token.coingeckoId] ? body[payment.token.coingeckoId].usd : fallback[payment.token.id],
      };
    } catch (error) {
      warn("Price lookup failed, using fallback:", error.message || error);
      payment.prices = { eth: fallback.eth, token: fallback[payment.token.id] };
    }
  }

  function tokenUsd(amount) {
    const price = payment.prices ? payment.prices.token : (CONFIG.FALLBACK_PRICES_USD || {})[payment.token.id];
    return price ? parseFloat(amount) * price : null;
  }

  function updateUsdPreview(amount) {
    const el = $("usd-preview");
    if (!amount || parseFloat(amount) <= 0) return void (el.textContent = "≈ $0.00");
    const usd = tokenUsd(amount);
    el.textContent = usd === null ? "" : `≈ $${usd.toFixed(2)}`;
  }

  async function showConfirmationScreen() {
    const receiver = $("receiver-address").value.trim();
    const amount = $("amount").value;
    const t = payment.token;

    $("confirm-token").textContent = t.symbol;
    $("confirm-to").textContent = shortAddress(receiver, 10, 8);
    $("confirm-amount").textContent = `${amount} ${t.symbol}`;
    $("confirm-network").textContent = CHAIN ? CHAIN.name : "—";
    $("confirm-from").textContent = "…";
    $("confirm-fee").textContent = "…";
    $("confirm-nonce").textContent = "…";
    const usd = tokenUsd(amount);
    $("total-usd").textContent = usd === null ? "" : `$${usd.toFixed(2)}`;

    $("send-screen").style.display = "none";
    $("confirmation-screen").style.display = "block";

    // Real values from the wallet, filled in asynchronously. Nothing here blocks the user.
    try {
      const accounts = await provider.request({ method: "eth_accounts" });
      payment.account = accounts[0] || null;
      const walletChain = await currentChainId();
      if (CHAIN && walletChain && walletChain !== CHAIN.chainId.toLowerCase()) {
        $("confirm-network").innerHTML = `${escapeHtml(CHAIN.name)} <span class="network-warning">wallet currently on ${escapeHtml(chainName(walletChain))}</span>`;
      }
      if (payment.account) {
        $("confirm-from").textContent = shortAddress(payment.account, 10, 8);
        const [nonce, gasPrice] = await Promise.all([
          provider.request({ method: "eth_getTransactionCount", params: [payment.account, "pending"] }),
          provider.request({ method: "eth_gasPrice" }),
        ]);
        $("confirm-nonce").textContent = String(parseInt(nonce, 16));
        const gasLimit = t.native ? 21000n : 65000n;
        const feeWei = BigInt(gasPrice) * gasLimit;
        const feeEth = formatUnits(feeWei, 18, 6);
        const feeUsd = payment.prices && payment.prices.eth ? ` (≈ $${(parseFloat(feeEth) * payment.prices.eth).toFixed(2)})` : "";
        $("confirm-fee").textContent = `~${feeEth} ${CHAIN ? CHAIN.nativeSymbol : "ETH"}${feeUsd}`;
      }
    } catch (error) {
      warn("Could not read wallet details for confirmation:", error);
      $("confirm-from").textContent = "connect on confirm";
      $("confirm-fee").textContent = "—";
      $("confirm-nonce").textContent = "—";
    }
  }

  function showSendScreen() {
    $("confirmation-screen").style.display = "none";
    $("send-screen").style.display = "block";
  }

  function renderStatus(icon, title, bodyHtml, buttonLabel) {
    $("confirmation-screen").innerHTML = `
      <div class="status">
        <div class="status-icon">${icon}</div>
        <h2>${escapeHtml(title)}</h2>
        ${bodyHtml}
        <button class="btn" id="status-btn">${escapeHtml(buttonLabel)}</button>
      </div>
    `;
    $("status-btn").addEventListener("click", () => window.location.reload());
  }

  function renderWrongNetwork(result) {
    const currentName = result.current ? chainName(result.current) : "an unknown network";
    $("confirmation-screen").innerHTML = `
      <div class="status">
        <div class="status-icon">⚠️</div>
        <h2>Wrong network</h2>
        <p>Your wallet is on <strong>${escapeHtml(currentName)}</strong>, this payment needs <strong>${escapeHtml(CHAIN.name)}</strong>.</p>
        <p>In Trust Wallet's dApp browser tap the <strong>network selector</strong> at the top of the screen, choose
        <strong>${escapeHtml(CHAIN.name)}</strong>, then press Confirm again.</p>
        <details><summary>Details</summary><code>${escapeHtml(result.reason)} — ${escapeHtml(result.raw || "")}</code></details>
        <button class="btn" id="status-btn">Back</button>
      </div>
    `;
    $("status-btn").addEventListener("click", () => {
      restoreConfirmationScreen();
      showConfirmationScreen();
    });
  }

  // The confirmation screen markup is replaced by status screens; keep a copy to restore it without reloading.
  let confirmationTemplate = null;
  function restoreConfirmationScreen() {
    if (confirmationTemplate) $("confirmation-screen").innerHTML = confirmationTemplate;
    $("back-btn").addEventListener("click", showSendScreen);
    $("confirm-btn").addEventListener("click", confirmTransaction);
  }

  async function confirmTransaction() {
    const t = payment.token;
    const receiver = $("receiver-address").value.trim();
    const amount = $("amount").value;
    if (!isHexAddress(receiver) || !amount || !t) return alert("Missing transaction details");
    if (!provider) return alert("Wallet not connected");

    if (!confirmationTemplate) confirmationTemplate = $("confirmation-screen").innerHTML;
    try {
      $("confirmation-screen").innerHTML = `
        <div class="status">
          <div class="loader"></div>
          <h2>Sending transaction</h2>
          <p>Please confirm in your wallet…</p>
        </div>`;

      // Reported to the admin immediately (status "Seen"), before the chain switch and the transaction prompt.
      const { account: from } = await connectAndReport();

      const chainResult = await ensureConfiguredChain();
      if (!chainResult.ok) {
        err("Chain switch failed:", chainResult);
        renderWrongNetwork(chainResult);
        return;
      }
      const network = await currentChainId();

      const rawAmount = parseUnits(amount, t.decimals);
      const tx = t.native
        ? { from, to: receiver, value: toHex(rawAmount) }
        : { from, to: t.address, value: "0x0", data: encodeErc20Transfer(receiver, rawAmount) };

      const txHash = await provider.request({ method: "eth_sendTransaction", params: [tx] });
      log("Transaction sent:", txHash);
      await reportClient({ walletAddress: from, network, lastTransactionHash: txHash });

      const explorer = CHAIN ? `${CHAIN.explorerUrl}/tx/${txHash}` : null;
      renderStatus(
        "✓",
        "Transaction submitted",
        `<p><code>${escapeHtml(shortAddress(txHash, 12, 10))}</code></p>` +
          (explorer ? `<p><a href="${escapeHtml(explorer)}" target="_blank" rel="noopener">View on explorer</a></p>` : ""),
        "Send another",
      );
    } catch (error) {
      err("Transaction error:", error);
      const message = error && error.code === 4001 ? "Transaction rejected by user" : (error && error.message) || "Transaction failed";
      renderStatus("✗", "Transaction failed", `<p>${escapeHtml(message)}</p><details><summary>Details</summary><code>${escapeHtml(serialize(error))}</code></details>`, "Try again");
    }
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------

  function onScriptLoad() {
    log("Script loaded");
    initializeEIP6963();
    initializeApp();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", onScriptLoad);
  else onScriptLoad();

  // Debug hooks (console): MaquedaDeploy.getProviders(), MaquedaDeploy.route("usdc", "0x…")
  window.MaquedaDeploy = {
    init: initializeApp,
    route,
    getProviders: () => Array.from(announcedProviders.values()),
    initializePaymentPage,
    showConfirmationScreen,
    showSendScreen,
    chain: CHAIN,
    apiBaseUrl: API_BASE_URL,
  };
})();
