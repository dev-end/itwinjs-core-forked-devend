#!/usr/bin/env bash

appcenter test run xcuitest \
  --app "$(app_center_app)" \
  --devices "$(app_center_devices)" \
  --test-series "$(app_center_test_series)" \
  --locale "en_US" \
  --build-dir "DerivedData/Build/Products/Debug-iphoneos/" \
  --token "$(app_center_token)"