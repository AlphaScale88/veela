import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // Workspace packages ship TypeScript source; let Next compile them.
  transpilePackages: [
    "@veela/core",
    "@veela/types",
    "@veela/ui",
    "@veela/api",
    "@veela/db",
    "@veela/fixtures",
  ],
  typedRoutes: true,
};

export default config;
