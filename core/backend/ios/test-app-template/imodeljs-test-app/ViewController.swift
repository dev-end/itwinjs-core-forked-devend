/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import UIKit
import WebKit

import ITwinMobile

class ViewController: UIViewController, WKUIDelegate, WKNavigationDelegate, UIDocumentPickerDelegate {
    private var webView : WKWebView? = nil


    func setupBackend () {
        let host = IModelJsHost.sharedInstance()
        let bundlePath = Bundle.main.bundlePath;
        let mainPath = bundlePath.appending ("/Assets/main.js");
        let main = URL(fileURLWithPath: mainPath);
        let client = MobileAuthorizationClient(viewController: self);
        host.loadBackend(main, withAuthClient: client,withInspect: true)
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupBackend()

    }

}

