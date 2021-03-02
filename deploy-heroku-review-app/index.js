const { Toolkit } = require("actions-toolkit");
// const core = require("@actions/core");

const Heroku = require("heroku-client");
const heroku = new Heroku({ token: process.env.HEROKU_API_TOKEN });

/**
 * Sleep prior to calling a function.
 * @param {Function} fn function to call after sleeping
 * @param {integer} timeout sleep duration in ms
 * @return {Promise<unknown>}
 */
const sleep = (fn, timeout) => {
  return new Promise((resolve) => {
    // wait 3s before calling fn(par)
    setTimeout(() => resolve(fn()), timeout)
  })
};

// Run your GitHub Action!
Toolkit.run(
  async (tools) => {
    // tools.context.ref
    // tools.context.sha
    // tools.context.repo

    // Required information
    const event = tools.context.event;

    let pr;
    let branch;
    let version;
    let fork;
    let pr_number;
    let repo_url;
    let repo_name;
    let owner;
    // tools.log.debug("context info",
    //   tools.context);
    // tools.log.debug("payload info",
    //     tools.context.payload);
    if (event !== 'push') {
       pr = tools.context.payload.pull_request;
       branch = pr.head.ref;
       version = pr.head.sha;
       fork = pr.head.repo.fork;
       pr_number = pr.number;
       repo_url = pr.head.repo.html_url;
       repo_name = pr.head.repo.name;
       owner = pr.head.repo.owner.login;
    } else {
      branch = tools.context.ref;
      version = tools.context.sha;
      fork = tools.context.repo.fork;
      pr_number = '';
      repo_url = tools.context.payload.repository.html_url;
      repo_name = tools.context.payload.repository.name;
      owner = tools.context.payload.repository.owner.login;
    }

    // Note!! Make sure you use a personal access token and not the implicit
    //        secrets.GITHUB_TOKEN
    const github_pa_token = process.env.GITHUB_PA_TOKEN;

    const source_url = `https://${owner}:${github_pa_token}@api.github.com/repos/${owner}/${repo_name}/tarball/${branch}`;

    let fork_repo_id;
    if (fork) {
      fork_repo_id = pr.head.repo.id;
    }

    tools.log.debug("Deploy Info", {
      branch,
      version,
      fork,
      pr_number,
      source_url,
      repo_name,
      owner
    });

    let action = tools.context.payload.action;

    // Output value indicating if this was a new or existing deployment.
    let status = 'new';

    // We can delete a review app without them being a collaborator
    // as the only people that can close PRs are maintainers or the author
    // HIPOCAMPO TODO: Need to put the clean-up logic back in, here or another
    //                 action.
    // if (action === "closed") {

    // Fetch all PRs
    tools.log.pending("Listing review apps");
    const reviewApps = await heroku.get(
      `/pipelines/${process.env.HEROKU_PIPELINE_ID}/review-apps`
    );
    tools.log.complete("Fetched review app list");

    // Filter to the one for this PR
    let app = reviewApps.find((app) => app.pr_number == pr_number);
    if (!app) {
      tools.log.info(`Did not find review app for PR number ${pr_number}`);
      // return;
    } else {
      tools.log.pending(`Deleting existing review app id ${app.id}`);
      await heroku.delete(`/review-apps/${app.id}`);

      let checkDeleteStatus = async() => {
        tools.log.debug(
            `Checking deletion status for review app ${app.id}`);
        let resp = await heroku.request({
          path: `/review-apps/${app.id}`,
          method: "GET"
        });

        tools.log.debug('Response received', resp);

        // if not pending, done = true;
        if (resp.status === 'deleting') {
          tools.log.debug("Waiting...");
          await sleep(checkDeleteStatus, 20000);
        } else if (resp.status === 'errored') {
          tools.log.fatal('Heroku deletion failed');
          tools.log.debug(JSON.stringify(resp));
          return;
        } else if (resp.status === 'deleted') {
          tools.log.debug(`Successfully deleted app ${app.id}`);
        } else {
          tools.log.fatal(`Unexpected delete response status: ${resp.status}`);
          tools.log.debug(JSON.stringify(resp));
          return
        }
      }

      await checkDeleteStatus();
      tools.log.debug("Review app deleted");
    }

    // Also check for apps using the same branch name
    // Filter to the one for this branch
    tools.log.debug('app data');
    app = reviewApps.find((app) => {
      tools.log.debug(app);
      return app.branch === branch;
    });
    if (!app) {
      tools.log.info(`Did not find review app for branch ${branch}`);
      // return;
    } else {
      tools.log.pending(`Deleting existing review app id ${app.id}`);
      await heroku.delete(`/review-apps/${app.id}`);

      let checkDeleteStatus = async() => {
        tools.log.debug(
            `Checking deletion status for review app ${app.id}`);
        let resp = await heroku.request({
          path: `/review-apps/${app.id}`,
          method: "GET"
        });

        tools.log.debug('Response received', resp);

        // if not pending, done = true;
        if (resp.status === 'deleting') {
          tools.log.debug("Waiting...");
          await sleep(checkDeleteStatus, 20000);
        } else if (resp.status === 'errored') {
          tools.log.fatal('Heroku deletion failed');
          tools.log.debug(JSON.stringify(resp));
          return;
        } else if (resp.status === 'deleted') {
          tools.log.debug(`Successfully deleted app ${app.id}`);
        } else {
          tools.log.fatal(`Unexpected delete response status: ${resp.status}`);
          tools.log.debug(JSON.stringify(resp));
          return
        }
      }

      await checkDeleteStatus();
      tools.log.debug("Review app deleted");
    }

    tools.log.debug('HERE 111111');

    //   return;
    // }

    // Do they have the required permissions?
    let requiredCollaboratorPermission = process.env.COLLABORATOR_PERMISSION;
    if (requiredCollaboratorPermission) {
      requiredCollaboratorPermission = requiredCollaboratorPermission.split(
        ","
      );
    } else {
      requiredCollaboratorPermission = ["triage", "write", "maintain", "admin"];
    }

    // const reviewAppLabelName =
    //   process.env.REVIEW_APP_LABEL_NAME || "review-app";

    const perms = await tools.github.repos.getCollaboratorPermissionLevel({
      ...tools.context.repo,
      username: tools.context.actor,
    });

    if (!requiredCollaboratorPermission.includes(perms.data.permission)) {
      tools.exit.success("User is not a collaborator. Skipping");
    }

    tools.log.info(`User is a collaborator: ${perms.data.permission}`);

    // let createReviewApp = false;
    let createReviewApp = true;

    // if (["opened", "reopened", "synchronize"].indexOf(action) !== -1) {
    //   tools.log.info("PR opened by collaborator");
    //   createReviewApp = true;
    //   await tools.github.issues.addLabels({
    //     ...tools.context.repo,
    //     labels: ["review-app"],
    //     issue_number: pr_number,
    //   });
    // } else if (action === "labeled") {
    //   const labelName = tools.context.payload.label.name;
    //   tools.log.info(`${labelName} label was added by collaborator`);
    //
    //   if (labelName === reviewAppLabelName) {
    //     createReviewApp = true;
    //   } else {
    //     tools.log.debug(`Unexpected label, not creating app: ${labelName}`);
    //   }
    // }

    if (createReviewApp) {
      // If it's a fork, creating the review app will fail as there are no secrets available
      if (fork && event == "pull_request") {
        tools.log.pending("Fork detected. Exiting");
        tools.log.pending(
          "If you would like to support PRs from forks, use the pull_request_target event"
        );
        tools.log.success("Action complete");
        return;
      }

      // try {
      //   const resp = await heroku.request({
      //     path: `/review-apps${id}`,
      //     method: "DELETE"
      //   });
      // } catch (error) {
      //   tools.log.debug('Delete failed', error);
      //   tools.log.debug("Unable to delete existing review app");
      // }

      // Otherwise we can complete it in this run
      let resp;
      let reviewAppId = null;
      try {
        tools.log.pending("Creating review app");
        if (event !== 'push') {
          resp = await heroku.request({
            path: "/review-apps",
            method: "POST",
            body: {
              branch,
              pipeline: process.env.HEROKU_PIPELINE_ID,
              source_blob: {
                url: source_url,
                version,
              },
              fork_repo_id,
              pr_number,
              environment: {
                GIT_REPO_URL: repo_url,
              }
            }
          });
        } else {
          resp = await heroku.request({
            path: "/review-apps",
            method: "POST",
            body: {
              branch,
              pipeline: process.env.HEROKU_PIPELINE_ID,
              source_blob: {
                url: source_url,
                version,
              },
              environment: {
                GIT_REPO_URL: repo_url,
              }
            }
          });
        }
        tools.log.debug("Initiated review app creation");
        tools.log.debug('Response data', resp);
        reviewAppId = resp.id;
      } catch (e) {
        tools.log.debug('Deploy failed',
          e);
        // HIPOCAMPO UPDATE: We are now deleting the existing review apps
        //                   every time so we should never get here.
        // A 409 is a conflict, which means the app already exists
        if (e.statusCode !== 409) {
          throw e;
        }
        status = 'existing';
        tools.log.complete("Review app is already created");
      }

      let checkDeployStatus = async() => {
        tools.log.debug(
            `Checking deployment status for review app ${reviewAppId}`);
        resp = await heroku.request({
          path: `/review-apps/${reviewAppId}`,
          method: "GET"
        });

        tools.log.debug('Response received', resp);

        // if not pending, done = true;
        if (resp.status === 'pending' || resp.status == 'creating') {
          tools.log.debug("Waiting...");
          await sleep(checkDeployStatus, 60000);
        } else if (resp.status === 'created') {
          tools.outputs.status = status;
          tools.log.debug('outputs', tools.outputs);
          // resp = await heroku.request({
          //   path: `/apps/${reviewAppId}`,
          //   method: "GET"
          // });
          // tools.log.debug('App info', resp);
          // tools.outputs.review-app-name = resp.name;

          tools.log.success("Action complete");
        } else if (resp.status === 'errored') {
          tools.log.fatal('Heroku deployment failed');
          tools.log.debug(JSON.stringify(resp));
          return;
        } else {
          tools.log.debug(`Unexpected status of ${resp.status}`);
          tools.log.debug(JSON.stringify(resp));
        }
      }

      await checkDeployStatus();

      tools.log.debug('OFP - Exiting');

      // let done = false;
      // while (! done) {
      //   // Check review app status
      //   tools.log.debug("Checking deployment status...");
      //   resp = await heroku.request({
      //     path: `/review-apps/${reviewAppId}`,
      //     method: "GET"
      //   });
      //
      //   // if not pending, done = true;
      //   if (resp.status !== 'pending') {
      //     done = true;
      //   }
      // }
    }

    // print(f"::set-output name=review_app_name::{review_app_name}")
    // tools.outputs.status = status;
    // tools.log.success("Action complete");
  },
  {
    event: [
      "pull_request.opened",
      "pull_request.reopened",
      "pull_request.synchronize",
      "pull_request.closed",
      "pull_request_target.opened",
      "pull_request_target.reopened",
      "pull_request_target.synchronize",
      "pull_request_target.closed",
      "push"
    ],
    secrets: ["GITHUB_TOKEN", "GITHUB_PA_TOKEN", "HEROKU_API_TOKEN", "HEROKU_PIPELINE_ID"],
  }
);
