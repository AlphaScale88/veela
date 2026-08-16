/**
 * The environment variables this app actually reads.
 *
 * ## Why not `@types/node`
 *
 * `lib/api.ts` reads `process.env["EXPO_PUBLIC_API_URL"]`, and the tsconfig sets
 * `"types": ["nativewind/types"]` — which **replaces** TypeScript's default "load every
 * @types package" behaviour rather than adding to it. So `process` was undeclared and
 * `tsc --noEmit` failed with TS2591.
 *
 * It only failed in CI. Locally a long-lived `node_modules` had `@types/node` hoisted
 * somewhere the compiler happened to find; a clean `--frozen-lockfile` install does not.
 * That is the whole class of bug CI exists to catch, and it caught this one.
 *
 * Pulling in `@types/node` would fix it and would also declare `Buffer`, `fs`, Node's
 * `setTimeout` overloads and the rest — none of which exist in a React Native runtime.
 * Typing a Node API as available in an app that has no Node is how you get a green
 * typecheck and a red screen on device.
 *
 * So this declares exactly what Expo genuinely provides: `EXPO_PUBLIC_*` variables, which
 * Babel **inlines at build time**. That is also why they are all optional — an unset
 * variable is inlined as `undefined`, not as an empty string, and callers must handle it.
 */
declare namespace NodeJS {
  interface ProcessEnv {
    /** Where the Hono API lives. Unset in local development, where the app falls back to
     *  `http://localhost:3000`. */
    readonly EXPO_PUBLIC_API_URL?: string;
  }
}

declare const process: {
  readonly env: NodeJS.ProcessEnv;
};
