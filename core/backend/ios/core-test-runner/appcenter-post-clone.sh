#!/usr/bin/env bash

node ../../../../common/scripts/install-run-rush.js install

node ../../../../common/scripts/install-run-rush.js build -v -p max

node npm run ios:build:test-runner