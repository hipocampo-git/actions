const core = require("@actions/core");
const github = require("@actions/github");
const mysqlPromise = require('mysql2/promise');
const {Storage} = require('@google-cloud/storage');
// import { Storage, UploadResponse, StorageOptions } from '@google-cloud/storage';
const {google} = require('googleapis');

core.group('Doing something async', async () => {
  let connection = null;
  try {
    const prId = core.getInput('pull-request-id');
    const instancePrefix = 'hipocampo-test-ci-537';
    // const instancePrefix = `hipocampo-test-ci-${prId}`;

    const auth = new google.auth.GoogleAuth({
      keyFilename: `./admin_sa_key.json`,
      scopes: 'https://www.googleapis.com/auth/cloud-platform',
      projectId: 'bitcoin-core-test'
    });

    let sqlAdmin = google.sqladmin('v1beta4');

    const instances = await sqlAdmin.instances.list(
        {project: 'bitcoin-core-test', auth: auth});

    for (const instance of instances.data.items) {
      if (instance.name.startsWith(instancePrefix)) {
        console.log(instance.name);
        await sqlAdmin.instances.delete({
          project: 'bitcoin-core-test',
          resourceId: instance.name
        });
      }
    }

    // instances.data.items.forEach((instance) => {
    //   if (instance.name.startsWith(instancePrefix)) {
    //     console.log(instance.name);
    //     await sqlAdmin.instances.delete({
    //
    //     });
    //   }
    // });


    // Find all buckets starting with the instance prefix
    // const storage = new Storage({
    //   projectId: 'bitcoin-core-test',
    //   keyFilename: './admin_storage_sa_key.json'
    // });
    // const [buckets] = await storage.getBuckets();
    //
    // console.log('Buckets:');
    // buckets.forEach(bucket => {
    //   console.log(bucket.name);
    //   if (bucket.name.startsWith('instancePrefix')) {
    //     console.log(`Deleting bucket ${bucket.name}`);
    //     // bucket.delete();
    //   }
    // });

    // delete all buckets
    console.log('here 1');
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
