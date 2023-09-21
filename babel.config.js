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
          '@assets': './packages/ui/assets',
          '@components': './packages/ui/components',
          '@pages': './packages/ui/pages',
        },
      },
    ],
  ],
};
