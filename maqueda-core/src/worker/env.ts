/**
 * Load .env for the standalone worker. Next.js does this itself; plain Node does not.
 * Uses Node 20.12+'s built-in loader so there is no dotenv dependency.
 * Existing process env always wins (Docker / CI set variables explicitly).
 */
import path from "node:path";
import fs from "node:fs";

export function loadEnv(): void {
  const candidates = [".env.local", ".env"].map((f) => path.resolve(process.cwd(), f));
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    try {
      // process.loadEnvFile does not override already-set variables.
      process.loadEnvFile(file);
    } catch (error) {
      console.warn(`[worker] could not load ${file}:`, error);
    }
  }
}
