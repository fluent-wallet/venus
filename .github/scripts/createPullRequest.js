module.exports = async ({ github, context, core, exec }) => {

   const branch =  "dev";
  let versionBranch = `qa-release/${branch}`;

  // switch to branch

  let { stderr } = await exec.getExecOutput("git", ["checkout", branch], {
    ignoreReturnCode: true,
  });
  let isCreatingBranch = !stderr
    .toString()
    .includes(`Switched to a new branch '${branch}'`);
  if (isCreatingBranch) {
    await exec.exec("git", ["checkout", "-b", branch]);
  }

  await exec.exec("git", ["reset", `--hard`, github.context.sha]);

  // exist pull request

  const finalPrTitle = `Release QA version ${process.env.VERSION}`;
  const prBody = `This PR is created by github action.
  It update the Android versionCode (increment 1) and versionName(read from package.json).
  And it also update the IOS CURRENT_PROJECT_VERSION (increment 1). but is not update the IOS MARKETING_VERSION
  `;

  let { data: pullRequests } = await github.rest.pulls.list({
    ...github.context.repo,
    state: "open",
    head: `${github.context.repo.owner}:${versionBranch}`,
    base: branch,
  });

  if (pullRequests.length > 0) {
    const [pullRequest] = pullRequests;
    await github.rest.pulls.update({
      pull_number: pullRequest.number,
      title: finalPrTitle,
      body: prBody,
      ...github.context.repo,
      state: "open",
    });
  } else {
    await github.rest.pulls.create({
      base: branch,
      head: versionBranch,
      title: finalPrTitle,
      body: prBody,
      ...github.context.repo,
    });
  }
};
