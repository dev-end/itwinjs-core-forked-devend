/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { render } from "@testing-library/react";
import sinon from "sinon";
import * as React from "react";
import { Orientation } from "@bentley/ui-core";
import TestUtils from "../../TestUtils";
import { PropertyRecord } from "@bentley/imodeljs-frontend";
import { ActionButtonList, ActionButtonRendererProps } from "../../../ui-components";

describe("ActionButtonList", () => {
  let propertyRecord: PropertyRecord;

  before(async () => {
    await TestUtils.initializeUiComponents();
    propertyRecord = TestUtils.createPrimitiveStringProperty("Label", "Model");
  });

  it("renders action buttons", () => {
    const renderer = (_: ActionButtonRendererProps) => {
      return (
        <div className="custom-action-button">
          Action button content
        </div>
      );
    };

    const actionButtonListRenderer = render(
      <ActionButtonList
        orientation={Orientation.Horizontal}
        property={propertyRecord}
        actionButtonRenderers={[renderer]}
      />);

    const listElement = actionButtonListRenderer.container.querySelector(".custom-action-button")! as HTMLElement;
    expect(listElement.textContent).to.be.eq("Action button content");
  });

  it("renders in correct horizontal orientation", () => {
    const renderer = sinon.spy();
    const actionButtonListRenderer = render(
      <ActionButtonList
        orientation={Orientation.Horizontal}
        property={propertyRecord}
        actionButtonRenderers={[renderer]}
      />);

    expect(actionButtonListRenderer.container.children[0].classList.contains("components-property-action-button-list--horizontal")).to.be.true;
  });

  it("renders in correct vertical orientation", () => {
    const renderer = sinon.spy();
    const actionButtonListRenderer = render(
      <ActionButtonList
        orientation={Orientation.Vertical}
        property={propertyRecord}
        actionButtonRenderers={[renderer]}
      />);

    expect(actionButtonListRenderer.container.children[0].classList.contains("components-property-action-button-list--vertical")).to.be.true;
  });

});
