module.exports = {
  presets: ['babel-preset-expo'],
  overrides: [
    {
      // Keep exports writable for the native crypto patches in packages/setup/shimPerf.ts.
      test: (filename) => typeof filename === 'string' && /node_modules[\\/]@noble[\\/]hashes[\\/](hmac|pbkdf2|sha3)\.js$/.test(filename),
      presets: [['babel-preset-expo', { disableImportExportTransform: false }]],
    },
  ],
};
