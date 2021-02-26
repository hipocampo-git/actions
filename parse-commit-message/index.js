const core = require("@actions/core");
const github = require("@actions/github");

async function run() {
  try {
    const token = core.getInput("token");
    const message = core.getInput("commit-message");
    // const title = core.getInput("title");
    // const body = core.getInput("body");
    // const assignees = core.getInput("assignees");

    const octokit = github.getOctokit(token);

    // const response = await octokit.issues.create({
    //   ...github.context.repo,
    //   title,
    //   body,
    //   assignees: assignees ? assignees.split("\n") : undefined
    // });
    let begin = message.indexOf('(#') + '(#'.length;
    let end = message.indexOf(')', begin);
    const pullRequestId = message.substring(begin, end).trim();

    core.setOutput("pull-request-id", JSON.stringify(pullRequestId));
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
