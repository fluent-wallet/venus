module.exports = async () => {
  const fs = require("fs/promises");
  const path = require("path");
  // android
  const data = await fs.readFile(path.join(__dirname, "../../android/app/build.gradle"), "utf8");
  const versionCodeMatch = data.match(/versionCode (\d+)/);

  const currentVersionCode = parseInt(versionCodeMatch[1], 10);
 
  const newVersionCode = currentVersionCode + 1;
  const newVersionName = process.env.VERSION;

  const updatedData = data.replace(/versionCode (\d+)/, `versionCode ${newVersionCode}`)
  .replace(/versionName "(\d+\.\d+\.\d+)"/, `versionName "${newVersionName}"`);


  await fs.writeFile("android/app/build.gradle", updatedData);

  // ios

  const iosData = await fs.readFile(path.join(__dirname, "../../ios/BIMWallet.xcodeproj/project.pbxproj"), "utf8");
  
};
