module.exports = async () => {
  const fs = require("fs/promises");
  const path = require("path");
  // android
  const androidFilePath = path.join(__dirname, "../../android/app/build.gradle");
  const data = await fs.readFile(androidFilePath, "utf8");
  const versionCodeMatch = data.match(/versionCode (\d+)/);

  const currentVersionCode = parseInt(versionCodeMatch[1], 10);
 
  const newVersionCode = currentVersionCode + 1;
  const newVersionName = process.env.VERSION;

  const updatedData = data.replace(/versionCode (\d+)/, `versionCode ${newVersionCode}`)
  .replace(/versionName "(\d+\.\d+\.\d+)"/, `versionName "${newVersionName}"`);

  await fs.writeFile(androidFilePath, updatedData);

  // ios
  const iosFilePath = path.join(__dirname, "../../ios/BIMWallet.xcodeproj/project.pbxproj");
  const iosData = await fs.readFile(iosFilePath, "utf8");

  const currentProjectVersionMatch = iosData.match(/CURRENT_PROJECT_VERSION = (\d+);/);

  const currentProjectVersion = parseInt(currentProjectVersionMatch[1], 10);

  const newProjectVersion = currentProjectVersion + 1;

  const updatedIosData = iosData.replace(/CURRENT_PROJECT_VERSION = (\d+);/g, `CURRENT_PROJECT_VERSION = ${newProjectVersion};`);

  await fs.writeFile(iosFilePath, updatedIosData);
};
