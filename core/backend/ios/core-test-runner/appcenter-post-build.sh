#!/usr/bin/env bash

counter(){
    for file in "$1"/*
    do
    if [ -d "$file" ]
    then
            echo "$file"
            counter "$file"
    fi
    done
}

counter "$APPCENTER_OUTPUT_DIRECTORY"

appcenter test run xcuitest \
  --async \
  --app $APP \
  --devices $DEVICES \
  --test-series $TEST_SERIES \
  --locale "en_US" \
  --build-dir "DerivedData/Build/Products/Release-iphoneos/" \
  --token $TOKEN