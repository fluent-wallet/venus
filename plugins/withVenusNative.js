const fs = require('node:fs');
const path = require('node:path');
const { IOSConfig, withAppBuildGradle, withProjectBuildGradle, withDangerousMod, withXcodeProject } = require('expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

function withWatermelonDB(config) {
  return withProjectBuildGradle(config, (mod) => {
    const marker = '// Venus WatermelonDB BuildConfig';
    if (!mod.modResults.contents.includes(marker)) {
      // AGP 9 no longer generates BuildConfig by default for Android libraries.
      mod.modResults.contents += `
${marker}
subprojects { project ->
  if (project.name == 'nozbe_watermelondb') {
    project.plugins.withId('com.android.library') {
      project.android.buildFeatures.buildConfig = true
    }
  }
}
`;
    }
    return mod;
  });
}

function withAndroidSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    mod.modResults.contents = mergeContents({
      tag: 'bim-wallet-native',
      src: mod.modResults.contents,
      newSrc: "apply from: rootProject.file('../plugins/android-signing.gradle')",
      anchor: /^dependencies\s*\{/,
      offset: 0,
      comment: '//',
    }).contents;
    return mod;
  });
}

function withAndroidAssets(config) {
  return withDangerousMod(config, [
    'android',
    async (mod) => {
      const sourceRoot = path.join(mod.modRequest.projectRoot, 'assets/native');
      const appRoot = path.join(mod.modRequest.platformProjectRoot, 'app');

      fs.cpSync(path.join(sourceRoot, 'lottie'), path.join(appRoot, 'src/main/assets/lottie'), { recursive: true });
      fs.copyFileSync(path.join(sourceRoot, 'debug.keystore'), path.join(appRoot, 'debug.keystore'));
      return mod;
    },
  ]);
}

function withIosLottieAssets(config) {
  return withXcodeProject(config, (mod) => {
    const project = mod.modResults;
    const sourceRoot = path.join(mod.modRequest.projectRoot, 'assets/native/lottie');
    IOSConfig.XcodeUtils.ensureGroupRecursively(project, 'Resources');

    for (const animation of ['animationEnter', 'welcome']) {
      const directory = path.join(sourceRoot, animation);
      for (const filename of fs.readdirSync(directory).filter((file) => file.endsWith('.webp'))) {
        IOSConfig.XcodeUtils.addResourceFileToGroup({
          filepath: path.relative(mod.modRequest.platformProjectRoot, path.join(directory, filename)),
          groupName: 'Resources',
          project,
          isBuildFile: true,
        });
      }
    }
    return mod;
  });
}

module.exports = function withVenusNative(config) {
  config = withWatermelonDB(config);
  config = withAndroidSigning(config);
  config = withAndroidAssets(config);
  return withIosLottieAssets(config);
};
