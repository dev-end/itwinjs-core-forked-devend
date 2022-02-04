/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

const path = require("path");
const glob = require("glob");

module.exports = {
  mode: "development",
  entry: [
    ...glob.sync(path.resolve(__dirname, "lib/**/*.test.js"))
    // path.resolve(__dirname, "ios/scripts/runMocha.js")
  ],
  output: {
    path: path.resolve(__dirname, "lib/ios"),
    filename: "main.js",
    devtoolModuleFilenameTemplate: "file:///[absolute-resource-path]",
    globalObject: "this",
  },
  target: "node",
  devtool: "source-map",
  resolve: {
    mainFields: ["main"]
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        use: "source-map-loader",
        enforce: "pre"
      },
      {
        test: /growl\.js$/,
        use: 'null-loader'
      },
      {
        test: /xunit\.js$/,
        use: 'null-loader'
      },
      {
        test: /bunyan/,
        use: 'null-loader'
      }
    ]
  },
  node: {
    __filename: false,
    __dirname: false
  },
  externals: {
    "@bentley/imodeljs-native": "commonjs @bentley/imodeljs-native",
  }
}