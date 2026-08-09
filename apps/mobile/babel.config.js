module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    // NO `react-native-reanimated/plugin` here. babel-preset-expo adds it
    // automatically whenever the package is installed — listing it again applies the
    // transform twice.
    //
    // NativeWind is pinned to an exact version rather than a caret range, and that is
    // load-bearing: react-native-css-interop 0.2.6 (pulled in by NativeWind 4.2.x)
    // lists "react-native-worklets/plugin" unconditionally in its Babel preset, with
    // a comment saying it is for Reanimated 4 and later. Expo SDK 52 pins Reanimated
    // 3.16, where that package does not exist, so Metro fails every bundle with
    // "Cannot find module 'react-native-worklets/plugin'". Widen the range only
    // together with a Reanimated 4 upgrade.
  };
};
