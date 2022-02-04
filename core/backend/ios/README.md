# Running core tests on ios

Steps one through four are performed on every `npm run build:ios`. Steps five and six are required

1. Webpack the tests using the test.webpack.config.js.

2. Install the ios native library via ios/scripts/installIosNativeLib.js

3. Copy this template to lib/ios. **Do not edit the copied project. It should only be used to run the tests.**

4. Copy the webpacked test file and ios/scripts/main.js. This is the entry point provided to iModeljsHost. It invokes mocha on the webpacked tests. Any other assets required by the tests should be copied at this time.

5. In lib/ios/assets, run `npm init -y` and `npm install mocha`.

6. Open the project in Xcode and run.