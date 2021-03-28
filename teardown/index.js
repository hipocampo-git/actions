const core = require("@actions/core");
const github = require("@actions/github");
const mysqlPromise = require('mysql2/promise');
const {Storage} = require('@google-cloud/storage');
// import { Storage, UploadResponse, StorageOptions } from '@google-cloud/storage';
const {google} = require('googleapis');
let sqlAdmin = google.sqladmin('v1beta4');
const {GoogleAuth} = require("google-auth-library");

core.group('Doing something async', async () => {
  let connection = null;
  try {
    const prId = core.getInput('pull-request-id');

    // Take in the pr #
    const instancePrefix = `hipocampo-test-ci-${prId}`;

    // find all databases starting with the instance prefix
    const auth = new GoogleAuth({
      keyFile: 'keyfile.json',
      scopes: 'https://www.googleapis.com/auth/cloud-platform',
    });
    const client = await auth.getClient();
    console.log('HERE 10');

    // Delete all databases


    // Find all buckets starting with the instance prefix
    // const storage = new Storage({
    //   projectId: 'bitcoin-core-test',
    //   keyFilename: 'keyfile.json'
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
