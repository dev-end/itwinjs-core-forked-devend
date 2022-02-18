#!/usr/bin/env bash

appcenter test run xcuitest \
  --app $APP \
  --devices $DEVICES \
  --test-series $TEST_SERIES \
  --locale "en_US" \
  --build-dir "DerivedData/Build/Products/Release-iphoneos/" \
  --token $TOKEN