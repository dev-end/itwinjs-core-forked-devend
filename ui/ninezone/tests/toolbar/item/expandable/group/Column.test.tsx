/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Column from "../../../../../src/toolbar/item/expandable/group/Column";

describe("<Column />", () => {
  it("should render", () => {
    mount(<Column />);
  });

  it("renders correctly", () => {
    shallow(<Column />).should.matchSnapshot();
  });
});
