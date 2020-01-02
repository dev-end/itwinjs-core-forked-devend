/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { NewBadge } from "../../ui-core";

describe("<NewBadge />", () => {
  it("should render", () => {
    const wrapper = mount(<NewBadge />);
    wrapper.unmount();
  });
  it("renders correctly", () => {
    shallow(<NewBadge />).should.matchSnapshot();
  });
});
