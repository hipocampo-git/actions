const core = require("@actions/core");
const github = require("@actions/github");
const mysqlPromise = require('mysql2/promise');

core.group('Doing something async', async () => {
  let connection = null;
  try {
    core.startGroup("env variables");
    console.log(JSON.stringify(process.env, null, "\t"));
    core.endGroup();

    const eventName = github.context.eventName;

    let prIdOutput = '';
    let herokuAppOutput = '';
    let branchNameOutput = '';
    let instanceNameOutput = '';
    let skipDeployOutput = false;

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

    switch (eventName) {
      case 'pull_request':
        branchNameOutput =  github.context.payload.pull_request.head.ref;
        prIdOutput = github.context.payload.number;
        herokuAppOutput = herokuAppPrefix + prIdOutput;
        instanceNameOutput = instancePrefix + prIdOutput;

        let status = 'new';
        let herokuAppName = null;

        const [readResponse] =
            await connection.execute(readQueryTemplate(prIdOutput));

        if (readResponse.length === 0) {
          console.log('pull request id not found, creating new ci entry.');
          const query =
              `INSERT INTO workflows
               (branch, pull_request_id, heroku_app, database_name)
               VALUES ("${branchNameOutput}", ${prIdOutput}, "${herokuAppOutput}", "${instanceNameOutput}")`;

          const [response] = await connection.execute(query);
        } else {
          // Check if there's a database suffix value and if so, append it to
          // the instance name.
          // If a database is deleted, google doesn't let you reuse the same
          // name for a period of time.
          core.debug(`Database suffix: ${readResponse[0].database_suffix}`);
          if (readResponse[0].database_suffix !== null) {
            instanceNameOutput += `-${readResponse[0].database_suffix}`;
          }

          skipDeployOutput = (!! readResponse[0].skip_deploy);

          // It's possible that we created the db record but failed prior to
          // deploying heroku.
          if (herokuAppName) {
            // We currently aren't doing anything with these status values.
            // TODO: Either remove them or make use of them.
            status = 'existing';
          }
        }
        break;
      case 'push':
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
      case 'default':
        // Default is workflow dispatch right now
        // TODO: figure out the specific string for workflow dispatch events.
        break;
    }

    core.setOutput("pull-request-id", prIdOutput);
    core.setOutput("heroku-app-name", herokuAppOutput);
    core.setOutput("branch-name", branchNameOutput);
    core.setOutput("instance-name", instanceNameOutput);
    core.setOutput("skip-deploy", skipDeployOutput);
  } catch (error) {
    core.setFailed(error.message);
  } finally {
    if (connection) {
      // NOTE: The github action won't terminate without this line.
      connection.end();
    }
  }
});

return;
