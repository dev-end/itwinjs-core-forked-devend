/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import DefaultStateManager, { StateManager } from "@src/zones/state/Manager";
import { TargetType } from "@src/zones/state/Target";
import { NineZoneProps } from "@src/zones/state/NineZone";
import { HorizontalAnchor } from "@src/widget/Stacked";
import TestProps from "./TestProps";
import { WidgetProps } from "@src/zones/state/Widget";

// use expect, because dirty-chai ruins the should.exist() helpers
const expect = chai.expect;

describe("StateManager", () => {
  it("should construct an instance", () => {
    new StateManager();
  });

  describe("handleTabClick", () => {
    it("should open widget", () => {
      const state = DefaultStateManager.handleTabClick(6, 33, TestProps.defaultProps);
      state.zones[6].widgets[0].tabIndex.should.eq(33);
    });

    it("should change tab", () => {
      const state = DefaultStateManager.handleTabClick(6, 13, TestProps.openedZone6);
      state.zones[6].widgets[0].tabIndex.should.eq(13);
    });

    it("should close widget", () => {
      const state = DefaultStateManager.handleTabClick(6, 14, TestProps.openedZone6);
      state.zones[6].widgets[0].tabIndex.should.eq(-1);
    });

    it("should not close widget when zone is floating", () => {
      const state = DefaultStateManager.handleTabClick(6, 14, TestProps.floatingOpenedZone6);

      state.zones[6].widgets[0].tabIndex.should.eq(14);
    });
  });

  describe("mergeDrop", () => {
    it("should merge zones", () => {
      const props: NineZoneProps = {
        ...TestProps.openedZone6,
        draggingWidget: {
          id: 9,
          lastPosition: {
            x: 0,
            y: 0,
          },
        },
      };
      const state = DefaultStateManager.mergeDrop(6, props);

      state.zones[6].widgets.length.should.eq(2);
      const w6 = state.zones[6].widgets[0];
      const w9 = state.zones[6].widgets[1];

      w6.id.should.eq(6);
      w9.id.should.eq(9);
    });

    it("should merge swapped zones", () => {
      const props: NineZoneProps = {
        ...TestProps.swapped6and9,
        draggingWidget: {
          id: 6,
          lastPosition: {
            x: 0,
            y: 0,
          },
        },
      };
      const state = DefaultStateManager.mergeDrop(9, props);

      state.zones[6].widgets.length.should.eq(2);
      const w6 = state.zones[6].widgets[1];
      const w9 = state.zones[6].widgets[0];

      w6.id.should.eq(6);
      w9.id.should.eq(9);
    });

    it("should merge bounds", () => {
      const props: NineZoneProps = {
        ...TestProps.openedZone6,
        draggingWidget: {
          id: 9,
          lastPosition: {
            x: 0,
            y: 0,
          },
        },
      };
      const state = DefaultStateManager.mergeDrop(6, props);

      const bounds = state.zones[6].bounds;
      bounds.left.should.eq(10);
      bounds.top.should.eq(20);
      bounds.right.should.eq(99);
      bounds.bottom.should.eq(110);
    });

    it("should unset floating bounds of target zone", () => {
      const props: NineZoneProps = {
        ...TestProps.floatingOpenedZone6,
        draggingWidget: { id: 9, lastPosition: { x: 0, y: 0, }, },
      };
      const state = DefaultStateManager.mergeDrop(6, props);

      expect(state.zones[6].floatingBounds).undefined;
    });

    it("should merge all vertical zones between dragging zone and target zone", () => {
      const props: NineZoneProps = {
        ...TestProps.defaultProps,
        draggingWidget: { id: 1, lastPosition: { x: 0, y: 0, }, },
      };
      const state = DefaultStateManager.mergeDrop(7, props);

      state.zones[7].widgets.length.should.eq(3);
      state.zones[7].widgets.findIndex((w) => w.id === 1).should.eq(2);
      state.zones[7].widgets.findIndex((w) => w.id === 4).should.eq(1);
      state.zones[7].widgets.findIndex((w) => w.id === 7).should.eq(0);
    });

    it("should merge widget 6 to zone 4", () => {
      const props: NineZoneProps = {
        ...TestProps.openedZone6,
        draggingWidget: { id: 6, lastPosition: { x: 0, y: 0, }, },
      };
      const state = DefaultStateManager.mergeDrop(4, props);

      state.zones[4].widgets.length.should.eq(2);
      const w4 = state.zones[4].widgets[0];
      const w6 = state.zones[4].widgets[1];

      w4.id.should.eq(4);
      w6.id.should.eq(6);
    });

    it("should merge widget 9 to zone 7 when nine zone is in footer mode", () => {
      const props: NineZoneProps = {
        ...TestProps.defaultProps,
        draggingWidget: { id: 9, lastPosition: { x: 0, y: 0, }, },
      };
      const state = DefaultStateManager.mergeDrop(7, props);

      state.zones[7].widgets.length.should.eq(2);
      const w7 = state.zones[7].widgets[0];
      const w9 = state.zones[7].widgets[1];

      w7.id.should.eq(7);
      w9.id.should.eq(9);
    });

    it("should set default anchor of dragged zone", () => {
      const props: NineZoneProps = {
        ...TestProps.inWidgetMode,
        draggingWidget: { id: 7, lastPosition: { x: 0, y: 0, }, },
        zones: {
          ...TestProps.inWidgetMode.zones,
          7: {
            ...TestProps.inWidgetMode.zones[7],
            anchor: HorizontalAnchor.Right,
          }
        }
      };
      const state = DefaultStateManager.mergeDrop(8, props);

      expect(state.zones[8].anchor).exist;
      state.zones[8].anchor!.should.eq(HorizontalAnchor.Left);
    });
  });

  describe("backDrop", () => {
    it("should unset anchor", () => {
      const props: NineZoneProps = {
        ...TestProps.defaultProps,
        draggingWidget: { id: 9, lastPosition: { x: 0, y: 0, }, },
        zones: {
          ...TestProps.defaultProps.zones,
          9: {
            ...TestProps.defaultProps.zones[9],
            anchor: HorizontalAnchor.Left,
          },
        },
      };
      const state = DefaultStateManager.backDrop(props);
      expect(state.zones[9].anchor).undefined;
    });

    it("should unset floating bounds", () => {
      const props: NineZoneProps = {
        ...TestProps.defaultProps,
        draggingWidget: { id: 9, lastPosition: { x: 0, y: 0, }, },
        zones: {
          ...TestProps.defaultProps.zones,
          9: {
            ...TestProps.defaultProps.zones[9],
            floatingBounds: {
              bottom: 10,
              left: 99,
              right: 999,
              top: 0,
            },
          },
        },
      };
      const state = DefaultStateManager.backDrop(props);
      expect(state.zones[9].floatingBounds).undefined;
    });
  });

  describe("handleWidgetTabDragStart", () => {
    it("should set floating bounds", () => {
      const state = DefaultStateManager.handleWidgetTabDragStart(6, 1, { x: 0, y: 0 }, { x: 0, y: 0 }, TestProps.openedZone6);

      expect(state.zones[6].floatingBounds).exist;
      state.zones[6].floatingBounds!.left.should.eq(10);
      state.zones[6].floatingBounds!.top.should.eq(20);
      state.zones[6].floatingBounds!.right.should.eq(99);
      state.zones[6].floatingBounds!.bottom.should.eq(54);
    });

    it("should unmerge merged zone", () => {
      const state = DefaultStateManager.handleWidgetTabDragStart(9, 1, { x: 0, y: 0 }, { x: 0, y: 0 }, TestProps.merged9To6);

      state.zones[6].widgets.length.should.eq(1, "z6");
      state.zones[6].widgets[0].id.should.eq(6, "z6");
      state.zones[9].widgets.length.should.eq(1, "z9");
      state.zones[9].widgets[0].id.should.eq(9, "z9");
    });

    it("should set bounds when unmerging", () => {
      const state = DefaultStateManager.handleWidgetTabDragStart(9, 1, { x: 0, y: 0 }, { x: 0, y: 0 }, TestProps.merged9To6);

      const bounds6 = state.zones[6].bounds;
      bounds6.top.should.eq(20, "bounds6.top");
      bounds6.left.should.eq(10, "bounds6.left");
      bounds6.right.should.eq(99, "bounds6.right");
      bounds6.bottom.should.eq(65, "bounds6.bottom");
      expect(state.zones[6].floatingBounds, "floatingBounds6").undefined;

      const bounds9 = state.zones[9].bounds;
      bounds9.top.should.eq(65, "bounds9.top");
      bounds9.left.should.eq(10, "bounds9.left");
      bounds9.right.should.eq(99, "bounds9.right");
      bounds9.bottom.should.eq(110, "bounds9.bottom");
      expect(state.zones[9].floatingBounds, "floatingBounds9").exist;
      state.zones[9].floatingBounds!.top.should.eq(20, "floatingBounds9.top");
      state.zones[9].floatingBounds!.left.should.eq(10, "floatingBounds9.left");
      state.zones[9].floatingBounds!.right.should.eq(99, "floatingBounds9.right");
      state.zones[9].floatingBounds!.bottom.should.eq(110, "floatingBounds9.bottom");
    });

    it("should set bounds when unmerging switched widgets", () => {
      const state = DefaultStateManager.handleWidgetTabDragStart(6, 1, { x: 0, y: 0 }, { x: 0, y: 0 }, TestProps.merged6To9);

      const bounds9 = state.zones[9].bounds;
      bounds9.top.should.eq(82, "bounds9.top");
      bounds9.left.should.eq(10, "bounds9.left");
      bounds9.right.should.eq(99, "bounds9.right");
      bounds9.bottom.should.eq(110, "bounds9.bottom");
      expect(state.zones[9].floatingBounds, "floatingBounds9").undefined;

      const bounds6 = state.zones[6].bounds;
      bounds6.top.should.eq(54, "bounds6.top");
      bounds6.left.should.eq(10, "bounds6.left");
      bounds6.right.should.eq(99, "bounds6.right");
      bounds6.bottom.should.eq(82, "bounds6.bottom");
      expect(state.zones[6].floatingBounds, "floatingBounds6").exist;
      state.zones[6].floatingBounds!.top.should.eq(54, "floatingBounds6.top");
      state.zones[6].floatingBounds!.left.should.eq(10, "floatingBounds6.left");
      state.zones[6].floatingBounds!.right.should.eq(99, "floatingBounds6.right");
      state.zones[6].floatingBounds!.bottom.should.eq(110, "floatingBounds6.bottom");
    });

    it("should set bounds when unmerging horizontally merged zones", () => {
      const state = DefaultStateManager.handleWidgetTabDragStart(9, 1, { x: 0, y: 0 }, { x: 0, y: 0 }, TestProps.merged9To8);

      const bounds8 = state.zones[8].bounds;
      bounds8.top.should.eq(20, "bounds8.top");
      bounds8.left.should.eq(10, "bounds8.left");
      bounds8.right.should.eq(54.5, "bounds8.right");
      bounds8.bottom.should.eq(110, "bounds8.bottom");
      expect(state.zones[8].floatingBounds, "floatingBounds8").undefined;

      const bounds9 = state.zones[9].bounds;
      bounds9.top.should.eq(20, "bounds9.top");
      bounds9.left.should.eq(54.5, "bounds9.left");
      bounds9.right.should.eq(99, "bounds9.right");
      bounds9.bottom.should.eq(110, "bounds9.bottom");
      expect(state.zones[9].floatingBounds, "floatingBounds9").exist;
      state.zones[9].floatingBounds!.top.should.eq(20, "floatingBounds9.top");
      state.zones[9].floatingBounds!.left.should.eq(10, "floatingBounds9.left");
      state.zones[9].floatingBounds!.right.should.eq(99, "floatingBounds9.right");
      state.zones[9].floatingBounds!.bottom.should.eq(110, "floatingBounds9.bottom");
    });

    it("should set dragging widget when unmerging", () => {
      const state = DefaultStateManager.handleWidgetTabDragStart(9, 1, { x: 10, y: 20 }, { x: 0, y: 0 }, TestProps.merged9To6);

      expect(state.draggingWidget).exist;
      state.draggingWidget!.id.should.eq(9);
      state.draggingWidget!.lastPosition.x.should.eq(10);
      state.draggingWidget!.lastPosition.y.should.eq(20);
    });

    it("should open tab of home widget when unmerging active widget", () => {
      const state = DefaultStateManager.handleWidgetTabDragStart(9, 3, { x: 0, y: 0 }, { x: 0, y: 0 }, TestProps.merged9To6);

      state.zones[6].widgets[0].tabIndex.should.eq(1, "z6");
      state.zones[9].widgets[0].tabIndex.should.eq(1, "z9");
    });

    it("should open dragged tab when unmerging inactive widget", () => {
      const props: NineZoneProps = {
        ...TestProps.merged9To6,
        zones: {
          ...TestProps.merged9To6.zones,
          6: {
            ...TestProps.merged9To6.zones[6],
            widgets: [
              {
                id: 6,
                tabIndex: 2,
              },
              {
                id: 9,
                tabIndex: -1,
              },
            ],
          }
        }
      };
      const state = DefaultStateManager.handleWidgetTabDragStart(9, 5, { x: 0, y: 0 }, { x: 0, y: 0 }, props);

      state.zones[6].widgets[0].tabIndex.should.eq(2, "z6");
      state.zones[9].widgets[0].tabIndex.should.eq(5, "z9");
    });

    it("return merged widget to default zone when dragging widget in default zone", () => {
      const state = DefaultStateManager.handleWidgetTabDragStart(6, 5, { x: 0, y: 0 }, { x: 0, y: 0 }, TestProps.merged9To6);

      state.zones[6].widgets.length.should.eq(1, "z6");
      state.zones[6].widgets[0].id.should.eq(6, "z6");
      state.zones[9].widgets.length.should.eq(1, "z9");
      state.zones[9].widgets[0].id.should.eq(9, "z9");
    });

    it("should unset anchors for merged zones", () => {
      const state = DefaultStateManager.handleWidgetTabDragStart(7, 1, { x: 0, y: 0 }, { x: 0, y: 0 }, TestProps.merged9And8To7);
      expect(state.zones[7].anchor, "7").undefined;
      expect(state.zones[8].anchor, "8").undefined;
      expect(state.zones[9].anchor, "9").undefined;
    });

    it("should set bounds when unmerging 3 widgets to 2 zones", () => {
      const state = DefaultStateManager.handleWidgetTabDragStart(9, 1, { x: 0, y: 0 }, { x: 0, y: 0 }, TestProps.merged9And8To7);

      state.zones[7].bounds.top.should.eq(10, "bounds7.top");
      state.zones[7].bounds.left.should.eq(20, "bounds7.left");
      state.zones[7].bounds.right.should.eq(60, "bounds7.right");
      state.zones[7].bounds.bottom.should.eq(100, "bounds7.bottom");
      expect(state.zones[7].floatingBounds, "floatingBounds7").undefined;

      state.zones[9].bounds.top.should.eq(10, "bounds9.top");
      state.zones[9].bounds.left.should.eq(60, "bounds9.left");
      state.zones[9].bounds.right.should.eq(80, "bounds9.right");
      state.zones[9].bounds.bottom.should.eq(100, "bounds9.bottom");

      expect(state.zones[9].floatingBounds, "floatingBounds9").exist;
      state.zones[9].floatingBounds!.top.should.eq(10, "floatingBounds9.top");
      state.zones[9].floatingBounds!.left.should.eq(20, "floatingBounds9.left");
      state.zones[9].floatingBounds!.right.should.eq(80, "floatingBounds9.right");
      state.zones[9].floatingBounds!.bottom.should.eq(100, "floatingBounds9.bottom");
    });

    it("should unmerge 3 widgets to 2 zones", () => {
      const state = DefaultStateManager.handleWidgetTabDragStart(9, 1, { x: 0, y: 0 }, { x: 0, y: 0 }, TestProps.merged9And8To7);

      state.zones[7].widgets.length.should.eq(2);
      state.zones[7].widgets[0].id.should.eq(7);
      state.zones[7].widgets[1].id.should.eq(8);

      state.zones[9].widgets.length.should.eq(1);
      state.zones[9].widgets[0].id.should.eq(9);
    });

    it("should unmerge all when dragging middle widget", () => {
      const state = DefaultStateManager.handleWidgetTabDragStart(8, 1, { x: 0, y: 0 }, { x: 0, y: 0 }, TestProps.merged9And8To7);

      state.zones[7].widgets.length.should.eq(1, "zones7.widgets.length");
      state.zones[8].widgets.length.should.eq(1, "zones8.widgets.length");
      state.zones[9].widgets.length.should.eq(1, "zones9.widgets.length");

      state.zones[7].widgets[0].id.should.eq(7);
      state.zones[8].widgets[0].id.should.eq(8);
      state.zones[9].widgets[0].id.should.eq(9);
    });

    it("should open 1st tab of home widget when unmerging", () => {
      const props = TestProps.merged9And8To7;
      const widgets: ReadonlyArray<{ -readonly [P in keyof WidgetProps]: WidgetProps[P] }> = props.zones[7].widgets;
      widgets[0].tabIndex = -1;
      widgets[2].tabIndex = 2;
      const state = DefaultStateManager.handleWidgetTabDragStart(9, 3, { x: 0, y: 0 }, { x: 0, y: 0 }, TestProps.merged9And8To7);

      state.zones[7].widgets[0].tabIndex.should.eq(1, "z7.widgets[0]");
      state.zones[7].widgets[1].tabIndex.should.eq(-1, "z7.widgets[1]");
      state.zones[9].widgets[0].tabIndex.should.eq(2, "z9");
    });
  });

  describe("handleTargetChanged", () => {
    it("should change the target", () => {
      const props: NineZoneProps = {
        ...TestProps.openedZone6,
        draggingWidget: { id: 9, lastPosition: { x: 0, y: 0, }, },
      };
      const state = DefaultStateManager.handleTargetChanged({ widgetId: 9, type: TargetType.Merge }, props);

      expect(state.target).exist;
      state.target!.widgetId.should.eq(9);
    });
  });
});
