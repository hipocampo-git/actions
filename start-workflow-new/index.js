const core = require("@actions/core");
const github = require("@actions/github");
const mysqlPromise = require('mysql2/promise');

core.group('Doing something async', async () => {
  let connection = null;
  try {
    core.startGroup('env variables');
    console.log(JSON.stringify(process.env, null, "\t"));
    core.endGroup();

    const eventName = github.context.eventName;

    let prIdOutput = '';
    let herokuAppOutput = '';
    let branchNameOutput = '';
    let instanceNameOutput = '';
    let testTagsOutput = 'smoke';
    let sizesOutput = {
      value: ['large']
    };
    let skipDeployOutput = false;

    const herokuAppPrefix = 'hipocampo-pr-';
    const instancePrefix = 'hipocampo-test-ci-';

    core.debug('HERE AA');
    console.log('HERE 10');

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
      case 'workflow_dispatch':
        console.log('HERE 20');
        console.log(JSON.stringify(github.context.payload));
        branchNameOutput =  github.context.payload.pull_request.head.ref;
        prIdOutput = github.context.payload.number;
        instanceNameOutput = instancePrefix + prIdOutput;

        const [readResponse] =
            await connection.execute(readQueryTemplate(prIdOutput));

        if (readResponse.length === 0) {
          console.log('pull request id not found, creating new ci entry.');
          const query =
              `INSERT INTO workflows
               (branch, pull_request_id, heroku_app, database_name, test_tags,
                sizes)
               VALUES ("${branchNameOutput}", ${prIdOutput},
                "${herokuAppOutput}", "${instanceNameOutput}",
                 "${testTagsOutput}", '${JSON.stringify(sizesOutput)}')`;

          console.log(query);

          await connection.execute(query);
        } else {
          // Check if there's a database suffix value and if so, append it to
          // the instance name.
          // If a database is deleted, google doesn't let you reuse the same
          // name for a period of time.
          core.debug(`Database suffix: ${readResponse[0].database_suffix}`);
          // Testing to see if info() statements should up in the caller
          // even when ACTIONS_STEP_DEBUG is set to false.
          core.info(`Database suffix: ${readResponse[0].database_suffix}`);
          // Have gone back and forth on this, but null (non-string value)
          // should be the correct literal for the comparison below.
          if (readResponse[0].database_suffix !== null) {
            instanceNameOutput += `-${readResponse[0].database_suffix}`;
          }

          skipDeployOutput = (!! readResponse[0].skip_deploy);
          testTagsOutput = readResponse[0].test_tags;
          // We'll use the default in the action code if the database contains
          // null for sizes.
          if (readResponse[0].sizes !== null) {
            sizesOutput = JSON.parse(readResponse[0].sizes);
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

        let readQuery2 =
            `SELECT * FROM workflows WHERE pull_request_id=${prIdOutput}`;

        core.debug(readQuery2);

        const [readResponse2] =
            await connection.execute(readQuery2);

        // These values should be immutable for push to master events
        testTagsOutput = 'all';
        sizesOutput = {
          value: ['large', 'small']
        };

        if (readResponse2.length === 0) {
          core.setFailed(
              'No CI workflow db entry found during push to master event');
          return;
        } else {
          instanceNameOutput = readResponse2[0].database_name;
          branchNameOutput = readResponse2[0].branch;

          // Have gone back and forth on this, but null (non-string value)
          // should be the correct literal for the comparison below.
          if (readResponse2[0].database_suffix !== null) {
            instanceNameOutput += `-${readResponse2[0].database_suffix}`;
          }
        }
        break;
      case 'default':
        // Default is workflow dispatch right now
        // TODO: figure out the specific string for workflow dispatch events.
        core.setFailed(`Event ${eventName} not found`);
        break;
    }

    herokuAppOutput = herokuAppPrefix + prIdOutput;

    core.setOutput("pull-request-id", prIdOutput);
    core.setOutput("heroku-app-name", herokuAppOutput);
    core.setOutput("branch-name", branchNameOutput);
    core.setOutput("instance-name", instanceNameOutput);
    core.setOutput("skip-deploy", skipDeployOutput);
    core.setOutput("test-tags", testTagsOutput);
    core.setOutput("sizes", JSON.stringify(sizesOutput));
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
