const core = require("@actions/core");
const github = require("@actions/github");

// Wrapper async function so we can use await.
async function run() {
  try {
    const token = core.getInput("token");
    const prNumber1 = core.getInput("pr_number1");
    const prNumber2 = core.getInput("pr_number2");

    const octokit = github.getOctokit(token);

    core.startGroup("Logging context object");
    console.log(JSON.stringify(github.context, null, "\t"));
    core.endGroup();

    const pullNumber = prNumber1 || prNumber2;
    core.debug(`PR #: ${pullNumber}`);

    let retLabel = '';

    const response = await octokit.issues.listLabelsOnIssue({
      ...github.context.repo,
      issue_number: pullNumber
    });

    const label = response.data.filter((label) => {
      core.debug(label.name);
      return label.name.startsWith('hipocampo-');
    });

    if (label.length > 0) {
      retLabel = label[0].name;
    }

    core.startGroup("Logging issue object");
    console.log(JSON.stringify(response.data, null, "\t"));
    core.endGroup();

    core.setOutput("label", retLabel );
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
