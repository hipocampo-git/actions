const core = require("@actions/core");
const github = require("@actions/github");
const mysqlPromise = require('mysql2/promise');
const {Storage} = require('@google-cloud/storage');
// import { Storage, UploadResponse, StorageOptions } from '@google-cloud/storage';
const {google} = require('googleapis');


// const {GoogleAuth} = require("google-auth-library");

core.group('Doing something async', async () => {
  let connection = null;
  try {
    const prId = core.getInput('pull-request-id');
    const saKey = core.getInput('admin-sa-key');

    // Take in the pr #
    const instancePrefix = `hipocampo-test-ci-${prId}`;

    // const gcp_sa_key = core.getSecret('myPassword');

    // find all databases starting with the instance prefix
    // const auth = new google.auth.GoogleAuth({
    //   keyFile: './sql/keyfile.json',
    //   scopes: 'https://www.googleapis.com/auth/cloud-platform'
    // });
    // https://googleapis.dev/nodejs/google-auth-library/5.5.0/interfaces/GoogleAuthOptions.html#info
    const fullpath = '/home/runner/work/hipocampo/hipocampo';

    const auth = new google.auth.GoogleAuth({
      keyFilename: `${fullpath}/admin2.json`,
      scopes: 'https://www.googleapis.com/auth/cloud-platform',
      projectId: 'bitcoin-core-test'
    });

    let sqlAdmin = google.sqladmin('v1beta4');

    // const client = await google.auth.getClient({
    //   keyFilename: `${fullpath}/admin_sa_key.json`,
    //   scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    //   projectId: 'bitcoin-core-test'
    // });

    // let sqlAdmin = google.sqladmin({version: 'v1beta4', auth: auth});
    console.log('HERE 10');
    const instances = await sqlAdmin.instances.list({project: 'bitcoin-core-test',
      auth: auth});
    console.log(instances);

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
