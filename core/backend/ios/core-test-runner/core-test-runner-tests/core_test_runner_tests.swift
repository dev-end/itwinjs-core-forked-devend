//
//  core_test_runner_tests.swift
//  core-test-runner-tests
//
//  Created by Daniel Toby on 3/8/22.
//  Copyright © 2022 Bentley Systems, Inc. All rights reserved.
//

import XCTest

class core_test_runner_tests: XCTestCase {
    
    func testAll() throws {
        // UI tests must launch the application that they test.
        let app = XCUIApplication()
        app.launch()
        
        let finishedTestsLabel = app.staticTexts["Finished Running Tests."]
        XCTAssert(finishedTestsLabel.waitForExistence(timeout: 30))
    }
}
