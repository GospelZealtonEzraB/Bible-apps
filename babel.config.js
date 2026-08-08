module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated 4 sources its Babel plugin from react-native-worklets.
    // This plugin must be listed last.
    plugins: ['react-native-worklets/plugin'],
  };
};
