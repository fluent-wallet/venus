const { AndroidConfig, withAndroidManifest, withAppBuildGradle, withInfoPlist } = require('expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

function withBsimDependencies(config) {
  return withAppBuildGradle(config, (mod) => {
    // Package the local AARs in the app; the BSIM library uses compileOnly.
    mod.modResults.contents = mergeContents({
      tag: 'bsim-dependencies',
      src: mod.modResults.contents,
      newSrc: `    implementation files(project(':react-native-bsim').file('libs/bsimlib.aar'))
    implementation files(project(':react-native-bsim').file('libs/omachannel.aar'))`,
      anchor: /^dependencies\s*\{/,
      offset: 1,
      comment: '//',
    }).contents;
    return mod;
  });
}

module.exports = function withBSIM(config) {
  config = AndroidConfig.Permissions.withPermissions(config, [
    'android.permission.BLUETOOTH',
    'android.permission.BLUETOOTH_ADMIN',
    'android.permission.BLUETOOTH_SCAN',
    'android.permission.BLUETOOTH_CONNECT',
    'android.permission.ACCESS_FINE_LOCATION',
  ]);
  config = withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    const scanPermission = manifest['uses-permission']?.find((item) => item.$['android:name'] === 'android.permission.BLUETOOTH_SCAN');
    if (scanPermission) {
      scanPermission.$['android:usesPermissionFlags'] = 'neverForLocation';
    }
    manifest['uses-feature'] = [
      ...(manifest['uses-feature'] || []).filter((item) => item.$['android:name'] !== 'android.hardware.bluetooth_le'),
      { $: { 'android:name': 'android.hardware.bluetooth_le', 'android:required': 'true' } },
    ];
    return mod;
  });
  config = withInfoPlist(config, (mod) => {
    mod.modResults.NSBluetoothAlwaysUsageDescription ??= 'Communicate with hardware wallets using Bluetooth.';
    mod.modResults.NSLocationWhenInUseUsageDescription ??= 'Discover nearby hardware wallets.';
    return mod;
  });
  return withBsimDependencies(config);
};
