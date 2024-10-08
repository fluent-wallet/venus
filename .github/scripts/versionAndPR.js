const fs = require("fs/promises");
const path = require("path");

async function updateVersion(pkgVersion) {
  // android
  const androidFilePath = path.join(__dirname, "../../android/app/build.gradle");
  const data = await fs.readFile(androidFilePath, "utf8");
  const versionCodeMatch = data.match(/versionCode (\d+)/);

  const currentVersionCode = parseInt(versionCodeMatch[1], 10);

  const updatedData = data.replace(/versionCode (\d+)/, `versionCode ${currentVersionCode + 1}`)
  .replace(/versionName "(\d+\.\d+\.\d+)"/, `versionName "${pkgVersion}"`);

  await fs.writeFile(androidFilePath, updatedData);

  // ios
  const iosFilePath = path.join(__dirname, "../../ios/BIMWallet.xcodeproj/project.pbxproj");
  const iosData = await fs.readFile(iosFilePath, "utf8");

  const currentProjectVersionMatch = iosData.match(/CURRENT_PROJECT_VERSION = (\d+);/);
  const currentProjectVersion = parseInt(currentProjectVersionMatch[1], 10);

  const updatedIosData = iosData.replace(/CURRENT_PROJECT_VERSION = (\d+);/g, `CURRENT_PROJECT_VERSION = ${currentProjectVersion + 1};`);

  await fs.writeFile(iosFilePath, updatedIosData);
}

module.exports = async ({ github, context, core, exec, release }) => {

  


  const versionBranch = release === 'prod' ?"prod-release/qa" : `qa-release/dev`;

  // switch to branch

  let { stderr } = await exec.getExecOutput("git", ["checkout", versionBranch], {
    ignoreReturnCode: true,
  });
  let isCreatingBranch = !stderr
    .toString()
    .includes(`Switched to a new branch '${versionBranch}'`);
  if (isCreatingBranch) {
    await exec.exec("git", ["checkout", "-b", versionBranch]);
  }
  // reset the qa-release/dev any change 
  await exec.exec("git", ["reset", `--hard`, context.sha]);

  // yarn version apply
  await exec.exec("yarn", ["version", "apply"])
  
  // remove the version 
  await exec.exec("rm", ["-rf", path.join(__dirname, "../../.yarn/versions")])

  // get current package.json version
  const pkg = require(path.join(__dirname, "../../package.json"));
  
  // update android and ios version

  await updateVersion(pkg.version)

  // git add and commit
  const {stdout} = await exec.getExecOutput("git", ["status", "--porcelain"])

  if (stdout.length > 0) {
    // need to commit
    await exec.exec("git",["config", "user.name", `"github-actions[bot]"`]);
    await exec.exec("git", ["config", "user.email", `"github-actions[bot]@users.noreply.github.com"`]);
    await exec.exec("git", ["add", "."]);
    await exec.exec("git", ["commit", "-m", "update version"]);
  }

  // force push
  await exec.exec("git", ["push", "--force", "origin", `HEAD:${versionBranch}`]);



  // start PR to QA
  const PRTitle = release === 'prod' ? `Release prod version`: `Release QA version`;
  const PRBody = `This PR is created by github action.

  It update the Android versionCode (increment 1) and versionName(read from package.json).

  And it also update the IOS CURRENT_PROJECT_VERSION (increment 1). but is not update the IOS MARKETING_VERSION

  **Note**: Check the PR before merge.

  - [ ] 1. Please check that the version name is correct.
  - [ ] 2. Please check that the version code is correct.
  - [ ] 3. Please check that the CURRENT_PROJECT_VERSION is correct.
  - [ ] 4. Please check that the version.json is correct.
  `;

  let { data: releaseQAPullRequests } = await github.rest.pulls.list({
    ...context.repo,
    state: "open",
    head: `${context.repo.owner}:${versionBranch}`,
    base: release === 'prod' ? "main" : "qa",
  });

  if (releaseQAPullRequests.length > 0) {
    const [pullRequest] = releaseQAPullRequests;
    await github.rest.pulls.update({
      pull_number: pullRequest.number,
      title: PRTitle,
      body: PRBody,
      ...context.repo,
      state: "open",
    });
  } else {
    await github.rest.pulls.create({
      base: release === 'prod' ? "main" : "qa",
      head: versionBranch,
      title: PRTitle,
      body: PRBody,
      ...context.repo,
    });
  }

  // end PR to QA
};
