import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Standalone output is consumed by the production Dockerfile (target "app").
  output: "standalone",
  // The repo root also has a lockfile; pin the workspace root to this package.
  turbopack: { root: path.resolve(__dirname) },
};

export default nextConfig;
