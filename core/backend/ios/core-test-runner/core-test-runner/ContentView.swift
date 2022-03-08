//
//  ContentView.swift
//  core-test-runner
//
//  Created by Daniel Toby on 3/8/22.
//  Copyright © 2022 Bentley Systems, Inc. All rights reserved.
//

import SwiftUI

struct ContentView: View {
    var viewController = ViewController()
    
    var body: some View {
        ZStack {
            if viewController.testsFinished {
                Text("Finished Running Tests.")
            } else {
                Text("Running tests...")
            }
        }.onAppear {
            viewController.runTests()
        }
    }
}
