#!/usr/bin/env bash

xcrun xcodebuild build-for-testing \
  -configuration Release \
  -sdk iphoneos \
  -project core-test-runner.xcodeproj \
  -scheme core-test-runner \
  -derivedDataPath DerivedData \
  -allowProvisioningUpdates

appcenter test run xcuitest \
  --async \
  --app $APP \
  --devices $DEVICES \
  --test-series $TEST_SERIES \
  --locale "en_US" \
  --build-dir "DerivedData/Build/Products/Release-iphoneos/" \
  --token $TOKEN