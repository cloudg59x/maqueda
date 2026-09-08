#!/usr/bin/env node
/**
 * Dev server + https tunnels for testing the dApp from a phone (Trust Wallet refuses plain http).
 *
 *   node dev-server.mjs                           # from the repo root
 *   npm run dapp:tunnel                           # from maqueda-core
 *
 * What it does:
 *   1. serves maqueda-deploy/ on DAPP_PORT, injecting API_BASE_URL and CHAIN into scripts/config.js on the fly
 *      (the file on disk is never modified);
 *   2. opens two Cloudflare quick tunnels (no account needed): one for the dApp, one for the admin API;
 *   3. prints ready-to-open URLs.
 *
 * Environment (all optional):
 *   DAPP_PORT=8000        port for the static dApp server
 *   API_PORT=3000         port where maqueda-core (`npm run dev`) is listening
 *   DAPP_CHAIN=sepolia    chain injected into config.js (sepolia | mainnet)
 *   DAPP_RECEIVER=0x…     receiver pre-filled in the printed payment URLs
 *   NO_TUNNEL=1           skip cloudflared, LAN-only URLs (http, will not work inside Trust Wallet)
 *
 * Requires: Node 20+, cloudflared (`brew install cloudflared`).
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { spawn, execFileSync } from "node:child_process";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "maqueda-deploy");
const DAPP_PORT = Number(process.env.DAPP_PORT ?? 8000);
const API_PORT = Number(process.env.API_PORT ?? 3000);
const CHAIN = process.env.DAPP_CHAIN ?? "sepolia";
const RECEIVER = process.env.DAPP_RECEIVER ?? "0x0000000000000000000000000000000000000000";
const NO_TUNNEL = process.env.NO_TUNNEL === "1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const children = [];
let apiBaseUrl = `http://localhost:${API_PORT}`; // replaced by the tunnel URL once known

// ---------------------------------------------------------------------------
// Static server with config injection
// ---------------------------------------------------------------------------

async function injectedConfig() {
  const source = await readFile(path.join(ROOT, "scripts", "config.js"), "utf8");
  return source
    .replace(/API_BASE_URL:\s*"[^"]*"/, `API_BASE_URL: "${apiBaseUrl}"`)
    .replace(/CHAIN:\s*"[^"]*"/, `CHAIN: "${CHAIN}"`)
    .replace(/^\/\/ Maqueda dApp configuration\./m, "// Maqueda dApp configuration (values injected by dev-server.mjs).");
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "/") pathname = "/index.html";

    if (pathname === "/scripts/config.js") {
      res.writeHead(200, { "content-type": MIME[".js"], "cache-control": "no-store" });
      return res.end(await injectedConfig());
    }

    const file = path.join(ROOT, pathname);
    if (!file.startsWith(ROOT + path.sep)) {
      res.writeHead(404);
      return res.end("Not found");
    }
    const info = await stat(file).catch(() => null);
    if (!info || !info.isFile()) {
      res.writeHead(404);
      return res.end("Not found");
    }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
    res.end(await readFile(file));
  } catch (error) {
    res.writeHead(500);
    res.end(String(error));
  }
});

// ---------------------------------------------------------------------------
// Cloudflare quick tunnels
// ---------------------------------------------------------------------------

function hasCloudflared() {
  try {
    execFileSync("cloudflared", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** Start `cloudflared tunnel --url` and resolve with the public https URL it prints. */
function startTunnel(label, port) {
  return new Promise((resolve, reject) => {
    const child = spawn("cloudflared", ["tunnel", "--url", `http://localhost:${port}`, "--no-autoupdate"], { stdio: ["ignore", "pipe", "pipe"] });
    children.push(child);
    let resolved = false;
    const onData = (chunk) => {
      const match = String(chunk).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match && !resolved) {
        resolved = true;
        resolve(match[0]);
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("exit", (code) => {
      if (!resolved) reject(new Error(`cloudflared (${label}) exited with code ${code}`));
    });
    setTimeout(() => {
      if (!resolved) reject(new Error(`cloudflared (${label}) did not report a URL within 30 s`));
    }, 30_000);
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function lanAddress() {
  for (const list of Object.values(networkInterfaces())) {
    for (const iface of list ?? []) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return "localhost";
}

async function apiIsUp() {
  try {
    const res = await fetch(`http://localhost:${API_PORT}/api/clients/status?address=0x0000000000000000000000000000000000000000`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

function shutdown() {
  for (const child of children) child.kill("SIGTERM");
  server.close();
  process.exit(0);
}

function printUrls(dappUrl, apiUrl) {
  const q = (params) => `${dappUrl}/?${new URLSearchParams({ chain: CHAIN, api: apiUrl, ...params })}`;
  console.log("");
  console.log("┌─ Maqueda dApp test URLs ─────────────────────────────────────────────");
  console.log(`│ chain         ${CHAIN}`);
  console.log(`│ dApp          ${dappUrl}`);
  console.log(`│ admin API     ${apiUrl}`);
  console.log("│");
  console.log(`│ connect only  ${q({})}`);
  console.log(`│ pay USDC      ${q({ token: "usdc", receiver: RECEIVER })}`);
  console.log(`│ pay ETH       ${q({ token: "eth", receiver: RECEIVER })}`);
  console.log(`│ test page     ${dappUrl}/test.html?${new URLSearchParams({ chain: CHAIN, api: apiUrl })}`);
  console.log("│");
  console.log("│ Open the URL in the Trust Wallet dApp browser (or scan it from Safari/Chrome).");
  console.log("│ Ctrl+C stops the server and the tunnels.");
  console.log("└──────────────────────────────────────────────────────────────────────");
  console.log("");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(DAPP_PORT, "0.0.0.0", resolve);
}).catch((error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`[dev-server] port ${DAPP_PORT} is already in use (another static server?). Stop it or run with DAPP_PORT=<free port>.`);
    process.exit(1);
  }
  throw error;
});
console.log(`[dev-server] serving ${ROOT} on http://localhost:${DAPP_PORT} (chain: ${CHAIN})`);

if (!(await apiIsUp())) {
  console.warn(`[dev-server] warning: admin API not reachable on http://localhost:${API_PORT}. Start it with \`npm run dev\` in maqueda-core.`);
}

if (NO_TUNNEL) {
  const lan = lanAddress();
  apiBaseUrl = `http://${lan}:${API_PORT}`;
  printUrls(`http://${lan}:${DAPP_PORT}`, apiBaseUrl);
} else {
  if (!hasCloudflared()) {
    console.error("[dev-server] cloudflared not found. Install it with `brew install cloudflared`, or run with NO_TUNNEL=1 for LAN-only http URLs.");
    shutdown();
  }
  console.log("[dev-server] opening Cloudflare tunnels…");
  const [dappUrl, apiUrl] = await Promise.all([startTunnel("dapp", DAPP_PORT), startTunnel("api", API_PORT)]);
  apiBaseUrl = apiUrl;
  printUrls(dappUrl, apiUrl);
}
