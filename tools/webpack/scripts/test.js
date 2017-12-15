/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
"use strict";

// Do this as the first thing so that any code reading it knows the right env.
require("./utils/initialize")("test");
const isCoverage = (process.env.MOCHA_ENV === "coverage");

const argv = require('yargs').argv;
const path = require("path");
const paths = require("../config/paths");
const { spawn, handleInterrupts } = require("./utils/simpleSpawn");

// Support jest-style args for updating all snapshots
if (argv.updateSnapshot || argv.u)
  process.env.CHAI_JEST_SNAPSHOT_UPDATE_ALL = "true";

// Some additional options are required for CI builds
const reporterOptions = (!CONTINUOUS_INTEGRATION) ? [ "--inline-diffs",  "--colors" ] : [
  "--reporter", "mocha-junit-reporter",
  "--reporter-options", `mochaFile=${paths.appJUnitTestResults}`,
];

const watchOptions = (!CONTINUOUS_INTEGRATION && argv.watch) ? ["--watch", "--interactive"] : [];
const debugOptions = (argv.debug) ? ["--inspect-brk=" + argv.debug] : [];

// Start the tests
const args = [
  ...debugOptions,
  require.resolve("mocha-webpack/lib/cli"),
  "--webpack-config",  require.resolve("../config/webpack.config.test.js"),
  "--require", require.resolve("./utils/jsdomSetup"),
  "--include", require.resolve("./utils/testSetup"),
  ...watchOptions,
  ...reporterOptions,
  path.resolve(paths.appTest, "**/*.@(js|jsx|ts|tsx)"),
];

// If we're running coverage, we need to include the app source dir
if (isCoverage) {
  args.push(path.resolve(paths.appSrc, "**/*!(.d).@(js|jsx|ts|tsx)"));
}

spawn("node", args).then((code) =>  process.exit(code));
handleInterrupts();
