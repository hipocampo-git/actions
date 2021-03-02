// const { Toolkit } = require("actions-toolkit");
const core = require("@actions/core");
const github = require("@actions/github");
const mysqlPromise = require('mysql2/promise');

// async function run() {
const foo = core.group('Do something async', async () => {
  let connection = null;
  try {
    core.startGroup("Logging context object");
    console.log(JSON.stringify(github.context, null, "\t"));
    core.endGroup();

    core.startGroup("Logging payload object");
    console.log(JSON.stringify(github.context.payload, null, "\t"));
    core.endGroup();


    core.startGroup("env variables");
    console.log(JSON.stringify(process.env, null, "\t"));
    core.endGroup();

    const token = core.getInput("token");
    // const commitMessage = core.getInput("commit-message");
    // const eventName = core.getInput("event-name");
    const eventName = github.context.eventName;
    const prId = core.getInput("pull-request-id");
    const actionName = core.getInput("action-name");
    // const title = core.getInput("title");
    // const body = core.getInput("body");
    // const assignees = core.getInput("assignees");

    const octokit = github.getOctokit(token);

    let prIdOutput = '';
    let herokuAppOutput = '';
    let branchNameOutput = '';
    let instanceNameOutput = '';
    // let ciIdOutput = '';
    const herokuAppPrefix = 'hipocampo-pr-';
    const instancePrefix = 'hipocampo-test-ci-';

    const dbUser = process.env.DBUSER;
    const dbPassword = process.env.DBPASSWORD;
    const dbHost = '127.0.0.1';
    const dbName = 'main';

    core.debug(`EVENT NAME: ${eventName}`);

    connection = await mysqlPromise.createConnection({
      host: dbHost,
      user: dbUser,
      password: dbPassword,
      database: dbName,
      connectTimeout: 30000
    });

    let readQueryTemplate = (prId) => {
      return `SELECT * FROM workflows WHERE pull_request_id=${prId}`;
    };

    // let readQuery =
    // `SELECT * FROM workflows WHERE branch="${branchNameOutput}"`;

    switch (eventName) {
      // if pull request event, do x
      // BRANCH NAME ==> ${GITHUB_HEAD_REF}
      // PR # ==> github.event.pull_request.number
      // HEROKU APP ==> hipocampo-pr- + PR #
      // if activity == "opened" ==> write into workflows table
      case 'pull_request':
        // let pr = tools.context.payload.pull_request;
        branchNameOutput =  github.context.payload.pull_request.head.ref;
        prIdOutput = github.context.payload.number;
        herokuAppOutput = herokuAppPrefix + prIdOutput;
        instanceNameOutput = instancePrefix + prIdOutput;

        // let insertId = null;
        let status = 'new';
        let herokuAppName = null;

        const [readResponse] =
            await connection.execute(readQueryTemplate(prIdOutput));

        core.debug(readResponse);

        if (readResponse.length === 0) {
          console.log('pull request id not found, creating new ci entry.');
          const query =
              `INSERT INTO workflows
               (branch, pull_request_id, heroku_app, database_name)
               VALUES ("${branchNameOutput}", ${prIdOutput}, "${herokuAppOutput}", "${instanceNameOutput}")`;

          const [response] = await connection.execute(query);

          // ciIdOutput = response.insertId;
        } else {
          // ciIdOutput = readResponse[0].id;
          // herokuAppName = readResponse[0].heroku_app;
          // instanceNameOutput = readResponse[0].database_name;
          // prIdOutput =
          // It's possible that we created the db record but failed prior to
          // deploying heroku.
          if (herokuAppName) {
            status = 'existing';
          }
          // console.log(
          //     `ci id ${ciIdOutput} found for branch ${branchNameOutput}`);
        }
        break;
      // if push event, do y
      // PR # ==> extracted from commit message
      // BRANCH NAME ==> do lookup in workflows table based of PR #
      // HEROKU APP ==> do lookup in workflows table based of PR #
      case 'push':
        // const commits = github.context.payload.commits;

        const commitMessage = github.context.payload.head_commit.message;
        let begin = commitMessage.indexOf('(#') + '(#'.length;
        let end = commitMessage.indexOf(')', begin);
        prIdOutput = commitMessage.substring(begin, end).trim();

        if (! prIdOutput) {
          core.setFailed(
              'Failed to parse pull request # from commit message');
          return;
        }

        herokuAppOutput = herokuAppPrefix + prIdOutput;

        let readQuery2 =
            `SELECT * FROM workflows WHERE pull_request_id=${prIdOutput}`;

        core.debug(readQuery2);

        const [readResponse2] =
            await connection.execute(readQuery2);

        if (readResponse2.length === 0) {
          core.setFailed(
              'No CI workflow db entry found during push to master event');
          return;
        } else {
          instanceNameOutput = readResponse2[0].database_name;
          branchNameOutput = readResponse2[0].branch;
        }
        break;
      // if workflow dispatch event do z
      //  BRANCH NAME ==> ${GITHUB_REF#refs/heads/}
      // PR # ==> either ${{ github.event.number}} or do a lookup
      // HEROKU APP ==> hipocampo-pr- + PR # (or do a lookup)
      case 'default':
        // Default is workflow dispatch right now
        // TODO: figure out the specific string for workflow dispatch events.
        break;
    }

    // const response = await octokit.issues.create({
    //   ...github.context.repo,
    //   title,
    //   body,
    //   assignees: assignees ? assignees.split("\n") : undefined
    // });

    // TODO: Not sure if we need to output this still.
    core.setOutput("pull-request-id", prIdOutput);
    core.setOutput("heroku-app-name", herokuAppOutput);
    core.setOutput("branch-name", branchNameOutput);
    core.setOutput("instance-name", instanceNameOutput);
    // connection.end();
  } catch (error) {
    core.setFailed(error.message);
    core.setOutput("pull-request-id", "something");
  } finally {
    if (connection) {
      // The github action won't terminate without this.
      connection.end();
    }
  }
});

return;

// foo.resolve(1);
