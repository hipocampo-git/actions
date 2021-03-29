const core = require("@actions/core");
const github = require("@actions/github");
const {Storage} = require('@google-cloud/storage');
const {google} = require('googleapis');

core.group('Doing something async', async () => {
  let connection = null;
  const projectName = 'bitcoin-core-test';
  try {
    const prId = core.getInput('pull-request-id') || 'none';
    const instancePrefix = `hipocampo-test-ci-${prId}`;

    console.log(`Pull request id #1: ${prId}`);
    console.log(`Pull request id #2: ${github.context.payload.number}`);
    console.log(`Instance prefix: ${instancePrefix}`);


    console.log('Tearing down databases');
    const auth = new google.auth.GoogleAuth({
      keyFilename: `./admin_sa_key.json`,
      scopes: 'https://www.googleapis.com/auth/cloud-platform',
      projectId: projectName
    });

    let sqlAdmin = google.sqladmin('v1beta4');

    const instances = await sqlAdmin.instances.list(
        {project: projectName, auth: auth});

    for (const instance of instances.data.items) {
      if (instance.name.startsWith(instancePrefix)) {
        console.log(`Deleting instance: ${instance.name}`);
        await sqlAdmin.instances.delete({
          project: projectName,
          instance: instance.name,
          auth: auth
        });
      }
    }

    const storage = new Storage({
      projectId: projectName,
      keyFilename: './admin_storage_sa_key.json'
    });
    const [buckets] = await storage.getBuckets();

    console.log('Tearing down buckets');
    for (const bucket of buckets) {
      console.log(bucket.name);
      if (bucket.name.startsWith(instancePrefix)) {
        // Delete the files first
        const [files] = await storage.bucket(bucket.name).getFiles();
        for (const file of files) {
          console.log(`Deleting file: ${file.name}`);
          await file.delete();
        };
        console.log(`Deleting bucket: ${bucket.name}`);
        // await storage.bucket(bucketName).delete();
        await bucket.delete();
      }
    }
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
