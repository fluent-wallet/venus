// eslint-disable-next-line no-undef
module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: [
    ['@babel/plugin-proposal-decorators', { version: 'legacy' }],
    [
      'module-resolver',
      {
        extensions: ['.ios.js', '.android.js', '.ios.jsx', '.android.jsx', '.js', '.jsx', '.json', '.ts', '.tsx'],
        root: ['.'],
        alias: {
          '@core': './packages/core',
          "@WalletCoreExtends": './packages/WalletCoreExtends',
          '@assets': './packages/ui/assets',
          '@components': './packages/ui/components',
          '@pages': './packages/ui/pages',
          '@modules': './packages/ui/modules',
          '@hooks': './packages/ui/hooks',
          '@router': './packages/ui/router',
          '@service': './packages/ui/service',
          '@utils': './packages/ui/utils',
          //see: https://github.com/margelo/react-native-quick-crypto#replace-crypto-browserify
          'bn.js': './node_modules/react-native-bignumber',
          crypto: './node_modules/react-native-quick-crypto',
          stream: './node_modules/stream-browserify',
          buffer: './node_modules/@craftzdog/react-native-buffer',
        },
      },
    ],
    ['nativewind/babel', { allowModuleTransform: ['@rneui/themed', 'react-native-linear-gradient'] }],
    'react-native-reanimated/plugin',
  ],
  overrides: [
    {
      test: './node_modules/ethers', // only for ethers not for all the modules, see: https://github.com/ethers-io/ethers.js/issues/3996
      plugins: [['@babel/plugin-transform-private-methods', { loose: true }]],
    },
  ],
};
