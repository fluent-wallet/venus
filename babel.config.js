module.exports = {
  // Keep the legacy class/decorator transform pipeline required by WatermelonDB and Inversify.
  // This changes Babel output only; the app still runs on the current Hermes runtime.
  presets: [['babel-preset-expo', { unstable_transformProfile: 'hermes-v0' }]],
  plugins: [
    [
      'module-resolver',
      {
        alias: {
          crypto: 'react-native-quick-crypto',
          stream: 'stream-browserify',
          buffer: '@craftzdog/react-native-buffer',
        },
      },
    ],
  ],
  overrides: [
    {
      // Keep exports writable for the native crypto patches in packages/setup/shimPerf.ts.
      test: (filename) => typeof filename === 'string' && /node_modules[\\/]@noble[\\/]hashes[\\/](hmac|pbkdf2|sha3)\.js$/.test(filename),
      presets: [['babel-preset-expo', { unstable_transformProfile: 'hermes-v0', disableImportExportTransform: false }]],
    },
  ],
};
