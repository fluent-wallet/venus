// run npx react-native-asset to link assets
module.exports = {
  dependencies: {
    'react-native-bsim': { platforms: { android: null, ios: null } },
  },
  project: {
    ios: {},
    android: {}, // grouped into "project"
  },
  iosAssets: ['./packages/ui-new/assets/fonts', './packages/ui-new/assets/lottie'],
};
