// const { Toolkit } = require("actions-toolkit");
const core = require("@actions/core");
const github = require("@actions/github");
const mysqlPromise = require('mysql2/promise');

// async function run() {
core.group('Do something async', async () => {
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
    const commitMessage = core.getInput("commit-message");
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
    const herokuAppPrefix = 'hipocampo-pr-';

    // const event = tools.context.event;

    const dbUser = process.env.DBUSER;
    const dbPassword = process.env.DBPASSWORD;
    const dbHost = '127.0.0.1';
    const dbName = 'main';

    core.debug(`EVENT NAME: ${eventName}`);

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

        let insertId = null;
        let status = 'new';
        let herokuAppName = null;
        let readQuery = `SELECT * FROM workflows WHERE branch="${branchNameOutput}"`;

        core.debug('here AA');

        // const connection = await core.group('Do something async', async () => {
        //   const connection = await mysqlPromise.createConnection({
        //     host: dbHost,
        //     user: dbUser,
        //     password: dbPassword,
        //     database: dbName,
        //     connectTimeout: 30000
        //   });
        //   return connection;
        //   core.debug(someVar1);
        // });
        const connection = await mysqlPromise.createConnection({
          host: dbHost,
          user: dbUser,
          password: dbPassword,
          database: dbName,
          connectTimeout: 30000
        });

        // const readResponse = await core.group('Do something else async', async () => {
        //   const [readResponse] = await connection.execute(readQuery);
        //   return readResponse
        //   core.debug(someVar2);
        // });
        //
        // core.debug(readResponse);

        // if (readResponse.length === 0) {
        //   console.log('Branch name not found, creating new ci entry.');
        //   const query =
        //       `INSERT INTO workflows
        //        (branch, pull_request_id)
        //        VALUES ("${branchNameOutput}", ${prIdOutput})`;
        //
        //   const [response] = await connection.execute(query);
        //
        //   insertId = response.insertId;
        // } else {
        //   insertId = readResponse[0].id;
        //   herokuAppName = readResponse[0].heroku_app;
        //   // It's possible that we created the db record but failed prior to
        //   // deploying heroku.
        //   if (herokuAppName) {
        //     status = 'existing';
        //   }
        //   console.log(`ci id ${insertId} found for branch ${branchNameOutput}`);
        // }
        break;
      // if push event, do y
      // PR # ==> extracted from commit message
      // BRANCH NAME ==> do lookup in workflows table based of PR #
      // HEROKU APP ==> do lookup in workflows table based of PR #
      case 'push':
        let begin = message.indexOf('(#') + '(#'.length;
        let end = message.indexOf(')', begin);
        prIdOutput = message.substring(begin, end).trim();
        branchNameOutput = tools.context.ref;
        herokuAppOutput = herokuAppPrefix + prIdOutput;
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
    core.setOutput("pull-request-id", JSON.stringify(prIdOutput));
    core.setOutput("heroku-app-name", JSON.stringify(herokuAppOutput));
    core.setOutput("branch-name", JSON.stringify(branchNameOutput));
  } catch (error) {
    core.setFailed(error.message);
    core.setOutput("pull-request-id", "something");
  }
});
