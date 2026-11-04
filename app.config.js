const { version } = require('./package.json');

const soraFonts = [
  { name: 'thin', weight: 100 },
  { name: 'extralight', weight: 200 },
  { name: 'light', weight: 300 },
  { name: 'regular', weight: 400 },
  { name: 'medium', weight: 500 },
  { name: 'semibold', weight: 600 },
  { name: 'bold', weight: 700 },
  { name: 'extrabold', weight: 800 },
].map(({ name, weight }) => ({
  path: `./packages/ui-new/assets/fonts/sora_${name}.ttf`,
  weight,
}));

module.exports = () => {
  const environment = process.env.APP_ENV || 'dev';
  if (!['dev', 'qa', 'prod'].includes(environment)) {
    throw new Error(`Unsupported APP_ENV: ${environment}`);
  }
  const passwordCryptoKey = process.env.PASSWORD_CRYPTO_KEY;
  if (!passwordCryptoKey) {
    throw new Error('PASSWORD_CRYPTO_KEY is required. Use the existing key for existing wallet data.');
  }
  const production = environment === 'prod';
  const androidPackage = production ? 'io.bimwallet' : `io.bimwallet.${environment}`;
  const buildNumber = process.env.APP_BUILD_NUMBER || '999';
  const displayVersion = process.env.APP_DISPLAY_VERSION || (environment === 'qa' ? `${version}-qa` : version);
  return {
    name: production ? 'BIM Wallet' : `BIM Wallet ${environment}`,
    slug: 'venus-wallet',
    version,
    extra: { appEnv: environment, passwordCryptoKey, displayVersion, buildNumber },
    experiments: { reactCompiler: true },
    scheme: ['bimwallet', 'ethereum', 'wc'],
    orientation: 'portrait',
    icon: './assets/native/icon.png',
    userInterfaceStyle: 'automatic',
    ios: {
      bundleIdentifier: 'io.bimwallet',
      deploymentTarget: '16.4',
      scheme: ['metamask', 'dapp'],
      privacyManifests: require('./assets/native/privacy-manifest.json'),
      buildNumber,
      infoPlist: {
        NSFaceIDUsageDescription: 'Authenticate to access your wallet.',
        NSAppTransportSecurity: { NSAllowsArbitraryLoads: false, NSAllowsLocalNetworking: true },
        ITSAppUsesNonExemptEncryption: false,
        branch_universal_link_domains: ['bimwallet.app.link', 'bimwallet-alternate.app.link', 'bimwallet.test.app.link', 'bimwallet-alternate.test.app.link'],
        UIRequiredDeviceCapabilities: ['arm64'],
      },
    },
    android: {
      package: androidPackage,
      versionCode: Number(buildNumber),
      allowBackup: false,
      permissions: ['INTERNET', 'CAMERA', 'READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE'],
      blockedPermissions: ['android.permission.READ_MEDIA_IMAGES', 'android.permission.READ_MEDIA_VIDEO', 'android.permission.RECORD_AUDIO'],
      intentFilters: [{ action: 'VIEW', category: ['BROWSABLE', 'DEFAULT'], data: [{ scheme: 'http' }, { scheme: 'https' }] }],
    },
    plugins: [
      'expo-dev-client',
      'expo-localization',
      [
        'expo-build-properties',
        {
          android: { minSdkVersion: 28 },
          ios: {
            extraPods: [{ name: 'simdjson', path: '../node_modules/@nozbe/simdjson', modular_headers: true }],
          },
        },
      ],
      ['expo-camera', { cameraPermission: 'Scan QR codes with your camera.', microphonePermission: false, recordAudioAndroid: false }],
      ['expo-image-picker', { photosPermission: 'Select images from your photo library.', microphonePermission: false }],
      [
        'expo-media-library',
        {
          photosPermission: 'Access images in your photo library.',
          savePhotosPermission: 'Save images to your photo library.',
          granularPermissions: [],
        },
      ],
      [
        'expo-font',
        {
          ios: { fonts: soraFonts.map(({ path }) => path) },
          android: { fonts: [{ fontFamily: 'Sora', fontDefinitions: soraFonts }] },
        },
      ],
      'react-native-bsim',
      './plugins/withVenusNative',
      [
        'expo-splash-screen',
        {
          image: './assets/native/splash-logo.png',
          backgroundColor: '#FAFAFA',
          resizeMode: 'contain',
          android: { imageWidth: 288 },
          ios: { imageWidth: 90 },
        },
      ],
    ],
  };
};
