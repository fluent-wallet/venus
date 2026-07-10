// eslint-disable-next-line no-undef
module.exports = {
  // Keep the legacy class/decorator transform pipeline required by WatermelonDB and Inversify.
  // This changes Babel output only; the app still runs on the current Hermes runtime.
  presets: [['babel-preset-expo', { unstable_transformProfile: 'hermes-v0' }]],
  plugins: [
    ['babel-plugin-react-compiler', {target: "19"}],
    [
      'module-resolver',
      {
        extensions: ['.ios.js', '.android.js', '.ios.jsx', '.android.jsx', '.js', '.jsx', '.json', '.ts', '.tsx'],
        root: ['.'],
        alias: {
          '@core': './packages/core',
          "@WalletCoreExtends": './packages/WalletCoreExtends',
          '@assets': './packages/ui-new/assets',
          '@components': './packages/ui-new/components',
          '@pages': './packages/ui-new/pages',
          '@modules': './packages/ui-new/modules',
          '@hooks': './packages/ui-new/hooks',
          '@router': './packages/ui-new/router',
          '@service': './packages/ui-new/service',
          '@utils': './packages/ui-new/utils',
          //see: https://github.com/margelo/react-native-quick-crypto#replace-crypto-browserify
          // 'bn.js': './node_modules/react-native-bignumber',
          crypto: './node_modules/react-native-quick-crypto',
          stream: './node_modules/stream-browserify',
          buffer: './node_modules/@craftzdog/react-native-buffer',
        },
      },
    ],
    'react-native-reanimated/plugin',
  ],
};
