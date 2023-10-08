// eslint-disable-next-line no-undef
module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: [
    ['@babel/plugin-proposal-decorators', { version: 'legacy' }],
    ['@babel/plugin-transform-private-methods', { loose: true }], // for ethers
    [
      'module-resolver',
      {
        extensions: ['.ios.js', '.android.js', '.ios.jsx', '.android.jsx', '.js', '.jsx', '.json', '.ts', '.tsx'],
        root: ['.'],
        alias: {
          '@core': './packages/core',
          '@assets': './packages/ui/assets',
          '@components': './packages/ui/components',
          '@pages': './packages/ui/pages',
          //see: https://github.com/margelo/react-native-quick-crypto#replace-crypto-browserify
          crypto: './node_modules/react-native-quick-crypto',
          stream: './node_modules/stream-browserify',
          buffer: './node_modules/@craftzdog/react-native-buffer',
        },
      },
    ],
    ['nativewind/babel', { allowModuleTransform: ['@rneui/themed'] }],
  ],
};
