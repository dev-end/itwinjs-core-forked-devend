/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Rendering */

import { Id64String } from "@bentley/bentleyjs-core";
import { ConvexClipPlaneSet, CurveLocationDetail, Geometry, LineSegment3d, Matrix3d, Point2d, Point3d, Transform, Vector2d, Vector3d, XAndY } from "@bentley/geometry-core";
import { Plane3dByOriginAndUnitNormal } from "@bentley/geometry-core";
import { ColorDef, Frustum, FrustumPlanes, LinePixels, Npc, ViewFlags } from "@bentley/imodeljs-common";
import { GraphicBuilder, GraphicType } from "./render/GraphicBuilder";
import { CanvasDecoration, Decorations, GraphicBranch, GraphicList, RenderClipVolume, RenderGraphic, RenderTarget } from "./render/System";
import { TileRequests } from "./tile/TileTree";
import { BackgroundMapState } from "./tile/WebMercatorTileTree";
import { ScreenViewport, Viewport } from "./Viewport";
import { ViewState3d } from "./ViewState";

const gridConstants = { maxPoints: 50, maxRefs: 25, maxDotsInRow: 250, maxHorizon: 500, dotTransparency: 100, lineTransparency: 200, planeTransparency: 225 };

export class ViewContext {
  public readonly viewFlags: ViewFlags;
  public readonly viewport: Viewport;
  public readonly frustum: Frustum;
  public readonly frustumPlanes: FrustumPlanes;

  constructor(vp: Viewport) {
    this.viewport = vp;
    this.viewFlags = vp.viewFlags.clone(); // viewFlags can diverge from viewport after attachment
    this.frustum = vp.getFrustum();
    this.frustumPlanes = new FrustumPlanes(this.frustum);
  }

  public getPixelSizeAtPoint(inPoint?: Point3d): number { return this.viewport.viewFrustum.getPixelSizeAtPoint(inPoint); }
}

/** @hidden */
export class NullContext extends ViewContext {
}

export class RenderContext extends ViewContext {
  constructor(vp: Viewport) { super(vp); }
  public get target(): RenderTarget { return this.viewport.target; }
  public createGraphicBuilder(type: GraphicType, transform?: Transform, id?: Id64String): GraphicBuilder { return this.target.createGraphicBuilder(type, this.viewport, transform, id); }
  public createBranch(branch: GraphicBranch, location: Transform, clip?: RenderClipVolume): RenderGraphic { return this.target.renderSystem.createBranch(branch, location, clip); }
}

export class DynamicsContext extends RenderContext {
  private _dynamics?: GraphicList;

  public addGraphic(graphic: RenderGraphic) {
    if (undefined === this._dynamics)
      this._dynamics = [];
    this._dynamics.push(graphic);
  }

  /** @hidden */
  public changeDynamics(): void { this.viewport!.changeDynamics(this._dynamics); }
}

/** Object passed to [[Decorator]]s to supply the context of the frame to be rendered. */
export class DecorateContext extends RenderContext {
  public decorationDiv: HTMLDivElement;
  public get screenViewport(): ScreenViewport { return this.viewport as ScreenViewport; }
  /** @hidden */
  constructor(vp: ScreenViewport, private readonly _decorations: Decorations) {
    super(vp);
    this.decorationDiv = vp.decorationDiv;
  }

  /** @hidden */
  public static getGridDimension(props: { nRepetitions: number, min: number }, gridSize: number, org: Point3d, dir: Point3d, points: Point3d[]): boolean {
    // initialized only to avoid warning.
    let distLow = 0.0;
    let distHigh = 0.0;

    for (let i = 0, n = points.length; i < n; ++i) {
      const distance = org.vectorTo(points[i]).dotProduct(dir);
      if (i) {
        if (distance < distLow)
          distLow = distance;
        if (distance > distHigh)
          distHigh = distance;
      } else {
        distLow = distHigh = distance;
      }
    }

    if (distHigh <= distLow)
      return false;

    props.min = Math.floor(distLow / gridSize); // NOTE: Should be ok to let grid extend outside project extents since view extends padded for ground plane...
    const max = Math.ceil(distHigh / gridSize);
    props.nRepetitions = max - props.min;
    props.min *= gridSize;

    return true;
  }

  /** @hidden */
  public static getGridPlaneViewIntersections(planePoint: Point3d, planeNormal: Vector3d, vp: Viewport, useProjectExtents: boolean): Point3d[] {
    const plane = Plane3dByOriginAndUnitNormal.create(planePoint, planeNormal);
    if (undefined === plane)
      return [];

    const frust = vp.getFrustum();
    const limitRange = useProjectExtents && vp.view.isSpatialView();

    // Limit non-view aligned grid to project extents in spatial views...
    if (limitRange) {
      const range = vp.view.iModel.projectExtents.clone();
      if (range.isNull)
        return [];
      range.intersect(frust.toRange(), range);
      if (range.isNull)
        return [];
      frust.initFromRange(range);
    }

    const index = new Array<[number, number]>(
      // lines connecting front to back
      [Npc._000, Npc._001],
      [Npc._100, Npc._101],
      [Npc._010, Npc._011],
      [Npc._110, Npc._111],
      // around front face
      [Npc._000, Npc._100],
      [Npc._100, Npc._110],
      [Npc._110, Npc._010],
      [Npc._010, Npc._000],
      // around back face.
      [Npc._001, Npc._101],
      [Npc._101, Npc._111],
      [Npc._111, Npc._011],
      [Npc._011, Npc._001]);

    const intersections: CurveLocationDetail[] = [];
    for (let i = 0, n = index.length; i < n; ++i) {
      const corner1 = frust.getCorner(index[i][0]),
        corner2 = frust.getCorner(index[i][1]);
      const lineSegment = LineSegment3d.create(corner1, corner2);
      lineSegment.appendPlaneIntersectionPoints(plane, intersections);
    }

    return intersections.map((cld: CurveLocationDetail) => cld.point.clone());
  }

  public addDecorationFromBuilder(builder: GraphicBuilder) { this.addDecoration(builder.type, builder.finish()); }

  public addDecoration(type: GraphicType, decoration: RenderGraphic) {
    switch (type) {
      case GraphicType.Scene:
        if (undefined === this._decorations.normal)
          this._decorations.normal = [];
        this._decorations.normal.push(decoration);
        break;

      case GraphicType.WorldDecoration:
        if (!this._decorations.world)
          this._decorations.world = [];
        this._decorations.world.push(decoration);
        break;

      case GraphicType.WorldOverlay:
        if (!this._decorations.worldOverlay)
          this._decorations.worldOverlay = [];
        this._decorations.worldOverlay.push(decoration);
        break;

      case GraphicType.ViewOverlay:
        if (!this._decorations.viewOverlay)
          this._decorations.viewOverlay = [];
        this._decorations.viewOverlay.push(decoration);
        break;
    }
  }

  /** Add a [[CanvasDecoration]] to the current frame. */
  public addCanvasDecoration(decoration: CanvasDecoration, atFront = false) {
    if (undefined === this._decorations.canvasDecorations)
      this._decorations.canvasDecorations = [];

    const list = this._decorations.canvasDecorations;
    if (0 === list.length || true === atFront)
      list.push(decoration);
    else
      list.unshift(decoration);
  }

  public addHtmlDecoration(decoration: HTMLElement) { this.decorationDiv.appendChild(decoration); }

  /** @hidden */
  public drawStandardGrid(gridOrigin: Point3d, rMatrix: Matrix3d, spacing: XAndY, gridsPerRef: number, isoGrid: boolean = false, fixedRepetitions?: Point2d): void {
    const vp = this.viewport;

    // rotMatrix returns new Vectors instead of references
    const xVec = rMatrix.rowX(),
      yVec = rMatrix.rowY(),
      zVec = rMatrix.rowZ(),
      viewZ = vp.rotation.getRow(2);

    if (!vp.isCameraOn && Math.abs(viewZ.dotProduct(zVec)) < 0.005)
      return;

    const refScale = (0 === gridsPerRef) ? 1.0 : gridsPerRef;
    const refSpacing = Vector2d.create(spacing.x, spacing.y).scale(refScale);

    let gridOrg = new Point3d();
    let repetitions = new Point2d();

    if (undefined === fixedRepetitions || 0 === fixedRepetitions.x || 0 === fixedRepetitions.y) {
      // expect gridOrigin and zVec to be modified from this call
      const intersections = DecorateContext.getGridPlaneViewIntersections(gridOrigin, zVec, vp, undefined !== fixedRepetitions);

      if (intersections.length < 3)
        return;

      const min = new Point2d(),
        xProps = { nRepetitions: repetitions.x, min: min.x },
        yProps = { nRepetitions: repetitions.y, min: min.y };
      if (!DecorateContext.getGridDimension(xProps, refSpacing.x, gridOrigin, Point3d.createFrom(xVec), intersections) ||
        !DecorateContext.getGridDimension(yProps, refSpacing.y, gridOrigin, Point3d.createFrom(yVec), intersections))
        return;

      // update vectors. (workaround for native passing primitives by reference)
      repetitions.x = xProps.nRepetitions; min.x = xProps.min;
      repetitions.y = yProps.nRepetitions; min.y = yProps.min;

      gridOrg.plus3Scaled(gridOrigin, 1, xVec, min.x, yVec, min.y, gridOrg);
    } else {
      gridOrg = gridOrigin;
      repetitions = fixedRepetitions;
    }

    if (0 === repetitions.x || 0 === repetitions.y)
      return;

    const gridX = xVec.scale(refSpacing.x),
      gridY = yVec.scale(refSpacing.y);

    const testPt = gridOrg.plus2Scaled(gridX, repetitions.x / 2.0, gridY, repetitions.y / 2.0);

    let maxGridPts = gridConstants.maxPoints;
    let maxGridRefs = gridConstants.maxRefs;

    if (maxGridPts < 10)
      maxGridPts = 10;
    if (maxGridRefs < 10)
      maxGridRefs = 10;

    // values are "per 1000 pixels"
    const minGridSeparationPixels = 1000 / maxGridPts,
      minRefSeparation = 1000 / maxGridRefs;
    let meterPerPixel = vp.getPixelSizeAtPoint(testPt);

    if ((refSpacing.x / meterPerPixel) < minRefSeparation || (refSpacing.y / meterPerPixel) < minRefSeparation)
      gridsPerRef = 0;

    // Avoid z fighting with coincident geometry
    gridOrg.plusScaled(viewZ, meterPerPixel, gridOrg); // was SumOf(DPoint2dCR point, DPoint2dCR vector, double s)
    meterPerPixel *= refScale;

    const drawDots = ((refSpacing.x / meterPerPixel) > minGridSeparationPixels) && ((refSpacing.y / meterPerPixel) > minGridSeparationPixels);
    const builder = this.createGraphicBuilder(GraphicType.WorldDecoration, undefined, undefined);

    DecorateContext.drawGrid(builder, isoGrid, drawDots, gridOrg, gridX, gridY, gridsPerRef, repetitions, vp);
    this.addDecorationFromBuilder(builder);
  }

  /** @hidden */
  public static drawGrid(graphic: GraphicBuilder, doIsogrid: boolean, drawDots: boolean, gridOrigin: Point3d, xVec: Vector3d, yVec: Vector3d, gridsPerRef: number, repetitions: Point2d, vp: Viewport) {
    const eyePoint = vp.worldToViewMap.transform1.columnZ();
    const viewZ = Vector3d.createFrom(eyePoint);

    const aa = Geometry.conditionalDivideFraction(1, eyePoint.w);
    if (aa !== undefined) {
      const xyzEye = viewZ.scale(aa);
      viewZ.setFrom(gridOrigin.vectorTo(xyzEye));
    }

    let normResult = viewZ.normalize(viewZ);
    if (!normResult)
      return;
    const zVec = xVec.crossProduct(yVec);
    normResult = zVec.normalize(zVec);
    if (!normResult)
      return;

    const color = vp.getContrastToBackgroundColor();
    const lineColor = color.clone();
    const dotColor = color.clone();
    const planeColor = color.clone();
    lineColor.setTransparency(gridConstants.lineTransparency);
    dotColor.setTransparency(gridConstants.dotTransparency);
    planeColor.setTransparency(gridConstants.planeTransparency);
    let linePat = LinePixels.Solid;

    if (viewZ.dotProduct(zVec) < 0.0) {   // Provide visual indication that grid is being viewed from the back (grid z not towards eye)...
      planeColor.setFrom(ColorDef.red);
      planeColor.setTransparency(gridConstants.planeTransparency);
      linePat = LinePixels.Code2;
    }

    const gpr = gridsPerRef > 0 ? gridsPerRef : 1;
    const rpg = 1 / gpr;

    if (doIsogrid)
      gridsPerRef = 0;  // turn off reference grid for iso

    if (drawDots) {
      const dotXVec = Vector3d.createFrom(xVec);
      const dotYVec = Vector3d.createFrom(yVec);

      dotXVec.scale(rpg, dotXVec);
      dotYVec.scale(rpg, dotYVec);

      graphic.setSymbology(dotColor, planeColor, 1);
      DecorateContext.drawGridDots(graphic, doIsogrid, gridOrigin, dotYVec, repetitions.y * gpr, dotXVec, repetitions.x * gpr, gridsPerRef, vp);
    }

    if (0 < gridsPerRef) {
      graphic.setSymbology(lineColor, planeColor, 1, linePat);
      DecorateContext.drawGridRefs(graphic, gridOrigin, xVec, yVec, repetitions.x, repetitions.y);
      DecorateContext.drawGridRefs(graphic, gridOrigin, yVec, xVec, repetitions.y, repetitions.x);
    }

    // don't draw grid plane if perpendicular to view
    if (viewZ.isPerpendicularTo(xVec))
      return;

    // grid refs or points will give visual indication of grid plane...
    // note: references to same points here are okay
    const shapePoints: Point3d[] = [
      gridOrigin,
      gridOrigin.plusScaled(xVec, repetitions.x),
      gridOrigin.plus2Scaled(xVec, repetitions.x, yVec, repetitions.y),
      gridOrigin.plusScaled(yVec, repetitions.y),
      gridOrigin,
    ];

    if (0 === gridsPerRef) {
      graphic.setSymbology(lineColor, planeColor, 1, linePat);
      graphic.addLineString(shapePoints);
    }

    graphic.setBlankingFill(planeColor);
    graphic.addShape(shapePoints);
  }

  /** Private grid-specific function for computing intersections of a ray with a convex set of clipping planes. */
  private static getClipPlaneIntersection(clipDistance: { min: number, max: number }, origin: Point3d, direction: Vector3d, convexSet: ConvexClipPlaneSet): boolean {
    clipDistance.min = -Number.MAX_VALUE;
    clipDistance.max = Number.MAX_VALUE;

    for (let i = 0; i < 6; i++) {
      const plane = convexSet.planes[i];
      const vD = plane.dotProductVector(direction);
      const vN = plane.evaluatePoint(origin);

      const testValue = -vN / vD;
      if (vD > 0.0) {
        if (testValue > clipDistance.min)
          clipDistance.min = testValue;
      } else if (vD < 0.0) {
        if (testValue < clipDistance.max)
          clipDistance.max = testValue;
      }
    }

    return clipDistance.min < clipDistance.max;
  }

  private static drawGridDots(graphic: GraphicBuilder, doIsoGrid: boolean, origin: Point3d, rowVec: Vector3d, rowRepetitions: number, colVec: Vector3d, colRepetitions: number, refSpacing: number, vp: Viewport) {
    const colSpacing = colVec.magnitude();
    const colNormal = colVec.normalize();
    if (!colNormal)
      return;

    const points: Point3d[] = [];

    const cameraOn = vp.isCameraOn;
    let zCamera = 0.0;
    let zCameraLimit = 0.0;
    const viewZ = Vector3d.create();

    if (cameraOn) {
      const view = vp.view as ViewState3d;
      const camera = view.camera;
      const sizeLimit = gridConstants.maxHorizon * colSpacing / vp.viewDelta.x;

      vp.rotation.rowZ(viewZ);
      zCamera = viewZ.dotProduct(camera.getEyePoint());
      zCameraLimit = zCamera - camera.focusDist * sizeLimit;
    }

    const corners = vp.getFrustum();
    const clipPlanes: ConvexClipPlaneSet = corners.getRangePlanes(true, true, 0);
    const clipDistance = { min: 0, max: 0 };
    for (let i = 0; i < rowRepetitions; i++) {
      if (0 !== refSpacing && 0 === (i % refSpacing))
        continue;

      const dotOrigin = origin.plusScaled(rowVec, i);
      if (DecorateContext.getClipPlaneIntersection(clipDistance, dotOrigin, colNormal, clipPlanes)) {
        if (cameraOn) {
          const startPoint = dotOrigin.plusScaled(colNormal, clipDistance.min);
          const endPoint = dotOrigin.plusScaled(colNormal, clipDistance.max);
          if (viewZ.dotProduct(startPoint) < zCameraLimit && viewZ.dotProduct(endPoint) < zCameraLimit)
            continue;
        }

        let nToDisplay = 0;
        let jMin = Math.floor(clipDistance.min / colSpacing);
        let jMax = Math.ceil(clipDistance.max / colSpacing);

        // Choose values that result in the least amount of dots between jMin-jMax and 0-colRepetitions...
        jMin = jMin < 0 ? 0 : jMin;
        jMax = jMax > colRepetitions ? colRepetitions : jMax;

        const isoOffset = doIsoGrid && (i & 1) ? 0.5 : 0.0;
        for (let j = jMin; j <= jMax && nToDisplay < gridConstants.maxDotsInRow; j++) {
          if (0 !== refSpacing && 0 === (j % refSpacing))
            continue;
          const point = dotOrigin.plusScaled(colVec, j + isoOffset);
          if (cameraOn) {
            const pointZ = viewZ.dotProduct(point);
            if (pointZ < zCamera && pointZ > zCameraLimit)
              points.push(point);
          } else {
            points.push(point);
          }
          nToDisplay++;
        }
      }
    }
    if (points.length !== 0)
      graphic.addPointString(points);
  }

  private static drawGridRefs(graphic: GraphicBuilder, org: Point3d, rowVec: Vector3d, colVec: Vector3d, rowRepetitions: number, colRepetitions: number) {
    const gridEnd = org.plusScaled(colVec, colRepetitions);

    for (let i = 0; i <= rowRepetitions; i += 1) {
      const linePoints: Point3d[] = [
        org.plusScaled(rowVec, i),
        gridEnd.plusScaled(rowVec, i),
      ];
      graphic.addLineString(linePoints);
    }
  }

  /** Display skyBox (cube) graphic that encompasses entire scene and rotates with camera. See RenderSystem.createSkyBox(). */
  public setSkyBox(graphic: RenderGraphic) { this._decorations.skyBox = graphic; }

  /** Display view coordinate graphic as background with smooth shading, default lighting, and z testing disabled. e.g., a sky box. */
  public setViewBackground(graphic: RenderGraphic) { this._decorations.viewBackground = graphic; }
}

/** @hidden */
export class SceneContext extends RenderContext {
  public readonly graphics: RenderGraphic[] = [];
  public readonly backgroundGraphics: RenderGraphic[] = [];
  public readonly requests: TileRequests;
  public backgroundMap?: BackgroundMapState;

  public constructor(vp: Viewport, requests: TileRequests) {
    super(vp);
    this.requests = requests;
  }

  public outputGraphic(graphic: RenderGraphic): void { this.backgroundMap ? this.backgroundGraphics.push(graphic) : this.graphics.push(graphic); }
}
