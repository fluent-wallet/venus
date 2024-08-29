module.exports = async ({ github, context, core, exec }) => {

  let versionBranch = `qa-release/dev`;

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



  // exist pull request

  const finalPrTitle = `Release QA version`;
  const prBody = `This PR is created by github action.
  It update the Android versionCode (increment 1) and versionName(read from package.json).
  And it also update the IOS CURRENT_PROJECT_VERSION (increment 1). but is not update the IOS MARKETING_VERSION
  `;

  let { data: pullRequests } = await github.rest.pulls.list({
    ...context.repo,
    state: "open",
    head: `${context.repo.owner}:${versionBranch}`,
    base: "qa",
  });

  if (pullRequests.length > 0) {
    const [pullRequest] = pullRequests;
    await github.rest.pulls.update({
      pull_number: pullRequest.number,
      title: finalPrTitle,
      body: prBody,
      ...context.repo,
      state: "open",
    });
  } else {
    await github.rest.pulls.create({
      base: "qa",
      head: versionBranch,
      title: finalPrTitle,
      body: prBody,
      ...context.repo,
    });
  }
};
