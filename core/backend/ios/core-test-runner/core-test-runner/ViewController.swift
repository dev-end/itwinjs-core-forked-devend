/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import UIKit

import IModelJsNative

class ViewController: UIViewController, WKUIDelegate, WKNavigationDelegate, UIDocumentPickerDelegate {
    private var webView : WKWebView? = nil

    override func viewDidLoad() {
        super.viewDidLoad()
        runTests()
    }

    private func runTests () {
        let host = IModelJsHost.sharedInstance()
        let bundlePath = Bundle.main.bundlePath
        let mainPath = bundlePath.appending("/Assets/main.js")
        let main = URL(fileURLWithPath: mainPath)
        let client = MobileAuthorizationClient(viewController: self)
        print("(ios): Running tests.")
        host.loadBackend(main, withAuthClient: client, withInspect: true) { (numFailed: UInt32) in
            print("(ios): Finished running tests.")
            let testOutputPath = bundlePath.appending("/Assets/junit_results.xml")
            let fileManager = FileManager.default
            if !fileManager.fileExists(atPath: testOutputPath) {
                print("(ios): Test results not found. Path: \(testOutputPath)")
                exit(-1)
            }
            exit(Int32(numFailed))
        }
    }
}

