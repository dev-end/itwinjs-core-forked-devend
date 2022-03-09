/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import Foundation
import os

import IModelJsNative

class ViewController: ObservableObject {
    private let logger = Logger(subsystem: "com.bentley.core-test-runner", category: "tests")
    private var numFailed: Int32 = -1
    @Published var testsFinished = false
    
    func runTests() {
        let host = IModelJsHost.sharedInstance()
        let bundlePath = Bundle.main.bundlePath
        let mainPath = bundlePath.appending("/Assets/main.js")
        let main = URL(fileURLWithPath: mainPath)
        logger.log("(ios): Running tests.")
        host.loadBackend(main) { [self] (numFailed: UInt32) in
            self.numFailed = Int32(numFailed)
            logger.log("(ios): Finished Running tests. \(numFailed) tests failed.")
            self.testsFinished = true
        }
        
//        let result = semaphore.wait(timeout: DispatchTime.now() + DispatchTimeInterval.seconds(60 * 30))
//
//        switch result {
//        case .timedOut:
//            logger.log("(ios): Tests timed out.")
//
//        case .success:
//            logger.log("(ios): Finished running tests.")
//            let testOutputPath = bundlePath.appending("/Assets/junit_results.xml")
//            let fileManager = FileManager.default
//            if !fileManager.fileExists(atPath: testOutputPath) {
//                logger.log("(ios): Test results not found. Path: \(testOutputPath)")
//            }
//        }
//
//        testsFinished = true
    }
}

