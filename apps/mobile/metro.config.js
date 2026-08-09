const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Metro must watch the workspace root so edits to @veela/* packages trigger a reload.
config.watchFolders = [workspaceRoot];

// Look in this app's node_modules first, then the workspace root's.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// `disableHierarchicalLookup` is deliberately NOT set.
//
// Expo's monorepo guide recommends turning it on, but that advice targets npm and
// yarn, where hoisting can put two copies of React on the resolution path. pnpm
// isolates instead: a dependency lives inside its dependent's own node_modules,
// under the .pnpm virtual store. Hierarchical lookup — walking up from the
// importing file — is exactly how Metro reaches those nested packages.
//
// Turning it on here made every bundle fail with "Unable to resolve module
// @expo/metro-runtime from expo-router/entry-classic.js", even though expo-router
// declares that dependency and it was installed: Metro was forbidden from looking
// where pnpm had put it.

module.exports = withNativeWind(config, { input: "./global.css" });
