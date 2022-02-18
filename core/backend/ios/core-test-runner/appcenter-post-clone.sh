#!/usr/bin/env bash

git config --local user.email imodeljs-admin@users.noreply.github.com
git config --local user.name imodeljs-admin

node ../../../../common/scripts/install-run-rush.js install

node ../../../../common/scripts/install-run-rush.js build -v -p max

npm run ios:build:test-runner

xcrun xcodebuild build-for-testing \
  -configuration Release \
  -sdk iphoneos \
  -project core-test-runner.xcodeproj \
  -scheme core-test-runner \
  -derivedDataPath DerivedData \
  -allowProvisioningUpdates