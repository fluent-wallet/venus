module.exports = {
  preset: "jest-expo",
  moduleNameMapper: {
    "^buffer$": "@craftzdog/react-native-buffer",
  },
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo|expo-.*|@expo/.*|ky|lodash-es|@noble/(curves|secp256k1|hashes|ciphers)|@scure/(bip32|bip39|base)|react-native-ble-plx)/)",
  ],

  collectCoverageFrom: ["packages/core/**/*.{ts,tsx}"],
  coveragePathIgnorePatterns: ["/node_modules/", "/__tests__/"],
};
