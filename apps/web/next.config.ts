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

  /**
   * The Services pages moved from `/services/*` to top level, matching how the reference
   * publishes them. Anything already linking to the old paths — a bookmark, a message, an
   * indexed URL — keeps working.
   *
   * `permanent: true` issues a 308, which is right here: the move is deliberate and settled,
   * and a permanent redirect is what tells a search engine to transfer the old URL's standing
   * to the new one rather than treating it as a temporary detour. A 307 would leave both URLs
   * competing indefinitely.
   *
   * Note `/services/valuation` → `/home-valuation`: the path changed name as well as depth, so
   * this is the one redirect that would be silently wrong if written by pattern rather than
   * listed.
   */
  async redirects() {
    return [
      { source: "/services/mortgage", destination: "/mortgage", permanent: true },
      { source: "/services/insurance", destination: "/insurance", permanent: true },
      { source: "/services/agent-finder", destination: "/agent-finder", permanent: true },
      { source: "/services/valuation", destination: "/home-valuation", permanent: true },
      /* `/resources` was removed on 18/08/2026 and its content merged into Market Regulations,
         which already rendered the same stamp duty scales from the same rule set. Permanent
         rather than temporary for the same reason as the Services moves: the page is not coming
         back, so the old URL's standing should transfer rather than the two competing. */
      { source: "/resources", destination: "/research/market-regulations", permanent: true },
    ];
  },
};

export default config;
