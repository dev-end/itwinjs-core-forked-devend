/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module CartesianGeometry */

import { ClipPlane } from "./ClipPlane";
import { ConvexClipPlaneSet } from "./ConvexClipPlaneSet";
import { ClipPlaneContainment } from "./ClipUtils";
import { Vector2d } from "../geometry3d/Point2dVector2d";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { Range3d } from "../geometry3d/Range";
import { Transform } from "../geometry3d/Transform";
import { Geometry } from "../Geometry";
import { PolygonOps } from "../geometry3d/PolygonOps";
import { Matrix4d } from "../geometry4d/Matrix4d";
import { UnionOfConvexClipPlaneSets } from "./UnionOfConvexClipPlaneSets";
import { Triangulator } from "../topology/Triangulation";
import { HalfEdgeGraph, HalfEdge, HalfEdgeMask } from "../topology/Graph";

/**
 * Bit mask type for referencing subsets of 6 planes of range box.
 * @public
 */
export enum ClipMaskXYZRangePlanes {
  /** no planes */
  None = 0x00,
  /** low x plane */
  XLow = 0x01,
  /** high x plane */
  XHigh = 0x02,
  /** low y plane */
  YLow = 0x04,
  /** high y plane */
  YHigh = 0x08,
  /** low z plane */
  ZLow = 0x10,
  /** high z plane */
  ZHigh = 0x20,
  /** all x and y planes, neither z plane */
  XAndY = 0x0f,
  /** all 6 planes */
  All = 0x3f,
}

/**
 * * ClipPrimitve is a base class for clipping implementations that use
 *   * A ClipPlaneSet designated "clipPlanes"
 *   * an "invisible" flag
 * * When constructed directly, objects of type ClipPrimitive (directly, not through a derived class) will have just planes
 * * Derived classes (e.g. ClipShape) carry additional data of a swept shape.
 * * ClipPrimitive can be constructed with no planes.
 *     * Derived class is responsible for filling the plane sets.
 *     * At discrtionn of derived classes, plane construction can be done at construction time or "on demand when" queries call `ensurePlaneSets ()`
 * * ClipPrimitive can be constructetd with planes (and no derived class).
 * @public
 */
export class ClipPrimitive {
  /** The (union of) convex regions. */
  protected _clipPlanes?: UnionOfConvexClipPlaneSets;
  /** If true, pointInside inverts the sense of the pointInside for the _clipPlanes */
  protected _invisible: boolean;

  public fetchClipPlanesRef(): UnionOfConvexClipPlaneSets | undefined { this.ensurePlaneSets(); return this._clipPlanes; }
  public get invisible(): boolean { return this._invisible; }

  protected constructor(planeSet?: UnionOfConvexClipPlaneSets | undefined, isInvisible: boolean = false) {
    this._clipPlanes = planeSet;
    this._invisible = isInvisible;
  }
  /**
   * Create a ClipPrimitive, capturing the supplied plane set as the clip planes.
   * @param planes clipper
   * @param isInvisible true to invert sense of the test
   */
  public static createCapture(planes: UnionOfConvexClipPlaneSets | ConvexClipPlaneSet | undefined, isInvisible: boolean = false): ClipPrimitive {
    let planeData;
    if (planes instanceof UnionOfConvexClipPlaneSets)
      planeData = planes;
    if (planes instanceof ConvexClipPlaneSet)
      planeData = UnionOfConvexClipPlaneSets.createConvexSets([planes]);

    return new ClipPrimitive(planeData, isInvisible);
  }

  public toJSON(): any {
    const data: any = {};
    if (this._clipPlanes)
      data.clips = this._clipPlanes.toJSON();
    if (this._invisible)
      data.invisible = true;
    return { planes: data };
  }

  /**
   * Returns true if the planes are present.
   * * This can be false (for instance) if a ClipShape is holding a polygon but has not yet been asked to construct the planes.
   */
  public arePlanesDefined(): boolean {
    return this._clipPlanes !== undefined;
  }

  public clone(): ClipPrimitive {
    const newPlanes = this._clipPlanes ? this._clipPlanes.clone() : undefined;
    const result = new ClipPrimitive(newPlanes, this._invisible);
    return result;
  }

  /**
   * * trigger (if needed)  computation of plane sets (if applicable) in the derived class.
   * * Base class is no op.
   * * In derived class, on first call create planes sets from defining data (e.g. swept shape).
   * * In derived class, if planes are present leave them alone.
   */
  public ensurePlaneSets() { }
  /** Return true if the point lies inside/on this polygon (or not inside/on if this polygon is a mask). Otherwise, return false.
   * * Note that a derived class may choose to (a) implement its own test using its defining data, or (b) accept this implementation using planes that it inserted in the base class.
   */
  public pointInside(point: Point3d, onTolerance: number = Geometry.smallMetricDistanceSquared): boolean {
    this.ensurePlaneSets();
    let inside = true;
    if (this._clipPlanes)
      inside = this._clipPlanes.isPointOnOrInside(point, onTolerance);
    if (this._invisible)
      inside = !inside;
    return inside;
  }

  /**
   * Multiply all ClipPlanes DPoint4d by matrix.
   * @param matrix matrix to apply.
   * @param invert if true, use in verse of the matrix.
   * @param transpose if true, use the transpose of the matrix (or inverse, per invert parameter)
   * * Note that if matrixA is applied to all of space, the matrix to send to this method to get a corresponding effect on the plane is the inverse transpose of matrixA
   * * Callers that will apply the same matrix to many planes should pre-invert the matrix for efficiency.
   * * Both params default to true to get the full effect of transforming space.
   * @param matrix matrix to apply
   */
  public multiplyPlanesByMatrix4d(matrix: Matrix4d, invert: boolean = true, transpose: boolean = true): boolean {
    if (invert) {  // form inverse once here, reuse for all planes
      const inverse = matrix.createInverse();
      if (!inverse)
        return false;
      return this.multiplyPlanesByMatrix4d(inverse, false, transpose);
    }

    if (this._clipPlanes)
      this._clipPlanes.multiplyPlanesByMatrix4d(matrix);
    return true;
  }

  /** Apply a transform to the clipper (e.g. transform all planes) */
  public transformInPlace(transform: Transform): boolean {
    if (this._clipPlanes)
      this._clipPlanes.transformInPlace(transform);

    return true;
  }

  /** Sets both the clip plane set and the mask set visibility */
  public setInvisible(invisible: boolean) {
    this._invisible = invisible;
  }

  /**
   * Return true if any plane of the primary clipPlanes has (a) non-zero z component in its normal vector and (b) finite distance from origin.
   */
  public containsZClip(): boolean {
    if (this.fetchClipPlanesRef() !== undefined)
      for (const convexSet of this._clipPlanes!.convexSets)
        for (const plane of convexSet.planes)
          if (Math.abs(plane.inwardNormalRef.z) > 1.0e-6 && Math.abs(plane.distance) !== Number.MAX_VALUE)
            return true;
    return false;
  }

  /**
   * Quick test of whether the given points fall completely inside or outside.
   * @param points points to test
   * @param ignoreInvisibleSetting if true, do the test with the clip planes and return that, ignoring the invisible setting.
   */
  public classifyPointContainment(points: Point3d[], ignoreInvisibleSetting: boolean): ClipPlaneContainment {
    this.ensurePlaneSets();
    const planes = this._clipPlanes;
    let inside = ClipPlaneContainment.StronglyInside;
    if (planes)
      inside = planes.classifyPointContainment(points, false);
    if (this._invisible && !ignoreInvisibleSetting)
      switch (inside) {
        case ClipPlaneContainment.StronglyInside:
          return ClipPlaneContainment.StronglyOutside;
        case ClipPlaneContainment.StronglyOutside:
          return ClipPlaneContainment.StronglyInside;
        case ClipPlaneContainment.Ambiguous:
          return ClipPlaneContainment.Ambiguous;
      }
    return inside;
  }

  public static fromJSON(json: any): ClipPrimitive | undefined {
    // try known derived classes first . . .
    const shape = ClipShape.fromClipShapeJSON(json);
    if (shape)
      return shape;
    const prim = ClipPrimitive.fromJSONClipPrimitive(json);
    if (prim)
      return prim;
    return undefined;
  }

  public static fromJSONClipPrimitive(json: any): ClipPrimitive | undefined {
    if (json && json.planes) {
      const planes = json.planes;
      const clipPlanes = planes.hasOwnProperty("clips") ? UnionOfConvexClipPlaneSets.fromJSON(planes.clips) : undefined;
      const invisible = planes.hasOwnProperty("invisible") ? planes.invisible : false;
      return new ClipPrimitive(clipPlanes, invisible);
    }
    return undefined;
  }
}

/** Internal helper class holding XYZ components that serves as a representation of polygon edges defined by clip planes */
class PolyEdge {
  public origin: Point3d;
  public next: Point3d;
  public normal: Vector2d;

  public constructor(origin: Point3d, next: Point3d, normal: Vector2d, z: number) {
    this.origin = Point3d.create(origin.x, origin.y, z);
    this.next = Point3d.create(next.x, next.y, z);
    this.normal = normal;
  }
}
/**
 * A clipping volume defined by a shape (an array of 3d points using only x and y dimensions).
 * May be given either a ClipPlaneSet to store directly, or an array of polygon points as well as other parameters
 * for parsing clipplanes from the shape later.
 * @public
 */
export class ClipShape extends ClipPrimitive {
  protected _polygon: Point3d[];
  protected _zLow?: number;
  protected _zHigh?: number;
  protected _isMask: boolean;
  protected _transformFromClip?: Transform;
  protected _transformToClip?: Transform;
  protected constructor(polygon: Point3d[] = [], zLow?: number, zHigh?: number, transform?: Transform, isMask: boolean = false, invisible: boolean = false) {
    super(undefined, invisible); // ClipPlaneSets will be set up later after storing points
    this._isMask = false;
    this._polygon = polygon;
    this.initSecondaryProps(isMask, zLow, zHigh, transform);
  }
  /** Returns true if this ClipShape is marked as invisible. */
  public get invisible(): boolean { return this._invisible; }
  /** Return this transformFromClip, which may be undefined. */
  public get transformFromClip(): Transform | undefined { return this._transformFromClip; }
  /** Return this transformToClip, which may be undefined. */
  public get transformToClip(): Transform | undefined { return this._transformToClip; }
  /** Returns true if this ClipShape's transforms are currently set. */
  public get transformValid(): boolean { return this.transformFromClip !== undefined; }
  /** Returns true if this ClipShape's lower z boundary is set. */
  public get zLowValid(): boolean { return this._zLow !== undefined; }
  /** Returns true if this ClipShape's upper z boundary is set. */
  public get zHighValid(): boolean { return this._zHigh !== undefined; }
  public get transformIsValid(): boolean { return this._transformFromClip !== undefined; }
  /** Return this zLow, which may be undefined. */
  public get zLow(): number | undefined { return this._zLow; }
  /** Return this zHigh, which may be undefined. */
  public get zHigh(): number | undefined { return this._zHigh; }
  /** Returns a reference to this ClipShape's polygon array. */
  public get polygon(): Point3d[] { return this._polygon; }
  /** Returns true if this ClipShape is a masking set. */
  public get isMask(): boolean { return this._isMask; }
  /** Sets the polygon points array of this ClipShape to the array given (by reference). */
  public setPolygon(polygon: Point3d[]) {
    // Add closure point
    if (!polygon[0].isAlmostEqual(polygon[polygon.length - 1]))
      polygon.push(polygon[0].clone());
    this._polygon = polygon;
  }
  /**
   * * If the ClipShape's associated `UnionOfConvexClipPlaneSets` is defined, do nohting.
   * * If the ClipShape's associated `UnionOfConvexClipPlaneSets` is undefined, generate it from the `ClipShape` and transform.
   */
  public ensurePlaneSets() {
    if (this._clipPlanes !== undefined)
      return;
    this._clipPlanes = UnionOfConvexClipPlaneSets.createEmpty();
    this.parseClipPlanes(this._clipPlanes);
    if (this._transformFromClip)
      this._clipPlanes!.transformInPlace(this._transformFromClip!);
  }
  /**
   * Initialize the members of the ClipShape class that may at times be undefined.
   * zLow and zHigh default to Number.MAX_VALUE, and the transform defaults to an identity transform
   */
  public initSecondaryProps(isMask: boolean, zLow?: number, zHigh?: number, transform?: Transform) {
    this._isMask = isMask;
    this._zLow = zLow;
    this._zHigh = zHigh;

    if (transform !== undefined) {
      this._transformFromClip = transform;
      this._transformToClip = transform.inverse(); // could be undefined
    } else {
      this._transformFromClip = Transform.createIdentity();
      this._transformToClip = Transform.createIdentity();
    }
  }
  public toJSON(): any {
    const val: any = {};
    val.shape = {};
    val.shape.points = [];
    for (const pt of this._polygon)
      val.shape.points.push(pt.toJSON());
    if (this.invisible)
      val.shape.invisible = true;
    if (this._transformFromClip && !this._transformFromClip.isIdentity)
      val.shape.trans = this._transformFromClip.toJSON();
    if (this.isMask)
      val.shape.mask = true;
    if (typeof (this.zLow) !== "undefined" && this.zLow !== -Number.MAX_VALUE)
      val.shape.zlow = this.zLow;
    if (typeof (this.zHigh) !== "undefined" && this.zHigh !== Number.MAX_VALUE)
      val.shape.zhigh = this.zHigh;
    return val;
  }
  public static fromClipShapeJSON(json: any, result?: ClipShape): ClipShape | undefined {
    if (!json.shape)
      return undefined;
    const points: Point3d[] = [];
    if (json.shape.points)
      for (const pt of json.shape.points)
        points.push(Point3d.fromJSON(pt));
    let trans: Transform | undefined;
    if (json.shape.trans)
      trans = Transform.fromJSON(json.shape.trans);
    let zLow: number | undefined;
    if (undefined !== json.shape.zlow)
      zLow = json.shape.zlow as number;
    let zHigh: number | undefined;
    if (undefined !== json.shape.zhigh)
      zHigh = json.shape.zhigh as number;
    let isMask = false;
    if (json.shape.mask)
      isMask = json.shape.mask as boolean;
    let invisible = false;
    if (json.shape.invisible)
      invisible = true;
    return ClipShape.createShape(points, zLow, zHigh, trans, isMask, invisible, result);
  }
  /** Returns a new ClipShape that is a deep copy of the ClipShape given */
  public static createFrom(other: ClipShape, result?: ClipShape): ClipShape {
    const retVal = ClipShape.createEmpty(false, false, undefined, result);
    retVal._invisible = other._invisible;
    for (const point of other._polygon) {
      retVal._polygon.push(point.clone());
    }
    retVal._isMask = other._isMask;
    retVal._zLow = other._zLow;
    retVal._zHigh = other._zHigh;
    retVal._transformToClip = other._transformToClip ? other._transformToClip.clone() : undefined;
    retVal._transformFromClip = other._transformFromClip ? other._transformFromClip.clone() : undefined;
    return retVal;
  }
  /** Create a new ClipShape from an array of points that make up a 2d shape (stores a deep copy of these points). */
  public static createShape(polygon: Point3d[] = [], zLow?: number, zHigh?: number, transform?: Transform, isMask: boolean = false, invisible: boolean = false, result?: ClipShape): ClipShape | undefined {
    if (polygon.length < 3)
      return undefined;
    const pPoints = polygon.slice(0);
    // Add closure point
    if (!pPoints[0].isExactEqual(pPoints[pPoints.length - 1]))
      pPoints.push(pPoints[0]);
    if (result) {
      result._clipPlanes = undefined; // Start as undefined
      result._invisible = invisible;
      result._polygon = pPoints;
      result.initSecondaryProps(isMask, zLow, zHigh, transform);
      return result;
    } else {
      return new ClipShape(pPoints, zLow, zHigh, transform, isMask, invisible);
    }
  }
  /**
   * Create a ClipShape that exists as a 3 dimensional box of the range given. Optionally choose to
   * also store this shape's zLow and zHigh members from the range through the use of a RangePlaneBitMask.
   */
  public static createBlock(extremities: Range3d, clipMask: ClipMaskXYZRangePlanes, isMask: boolean = false, invisible: boolean = false, transform?: Transform, result?: ClipShape): ClipShape {
    const low = extremities.low;
    const high = extremities.high;
    const blockPoints: Point3d[] = [];
    for (let i = 0; i < 5; i++)
      blockPoints.push(Point3d.create());
    blockPoints[0].x = blockPoints[3].x = blockPoints[4].x = low.x;
    blockPoints[1].x = blockPoints[2].x = high.x;
    blockPoints[0].y = blockPoints[1].y = blockPoints[4].y = low.y;
    blockPoints[2].y = blockPoints[3].y = high.y;
    return ClipShape.createShape(blockPoints, (ClipMaskXYZRangePlanes.None !== (clipMask & ClipMaskXYZRangePlanes.ZLow)) ? low.z : undefined, ClipMaskXYZRangePlanes.None !== (clipMask & ClipMaskXYZRangePlanes.ZHigh) ? high.z : undefined, transform, isMask, invisible, result)!;
  }
  /** Creates a new ClipShape with undefined members and a polygon points array of zero length. */
  public static createEmpty(isMask = false, invisible: boolean = false, transform?: Transform, result?: ClipShape): ClipShape {
    if (result) {
      result._clipPlanes = undefined;
      result._invisible = invisible;
      result._polygon.length = 0;
      result.initSecondaryProps(isMask, undefined, undefined, transform);
      return result;
    }
    return new ClipShape([], undefined, undefined, transform, isMask, invisible);
  }
  /** Checks to ensure that the member polygon has an area, and that the polygon is closed. */
  public get isValidPolygon(): boolean {
    if (this._polygon.length < 3)
      return false;
    if (!this._polygon[0].isExactEqual(this._polygon[this._polygon.length - 1]))
      return false;
    return true;
  }
  /** Returns a deep copy of this instance of ClipShape, storing in an optional result */
  public clone(result?: ClipShape): ClipShape {
    return ClipShape.createFrom(this, result);
  }
  /** Given the current polygon data, parses clip planes that together form an object, storing the result in the set given, either clipplanes or maskplanes. */
  private parseClipPlanes(set: UnionOfConvexClipPlaneSets) {
    const points = this._polygon;
    if (points.length === 3 && !this._isMask && points[0].isExactEqual(points[points.length - 1])) {
      this.parseLinearPlanes(set, this._polygon[0], this._polygon[1]);
      return true;
    }
    const direction = PolygonOps.testXYPolygonTurningDirections(points);
    if (0 !== direction) {
      this.parseConvexPolygonPlanes(set, this._polygon, direction);
      return true;
    } else {
      this.parseConcavePolygonPlanes(set, this._polygon);
      return false;
    }
  }
  /** Given a start and end point, populate the given UnionOfConvexClipPlaneSets with ConvexClipPlaneSets defining the bounded region of linear planes. Returns true if successful. */
  private parseLinearPlanes(set: UnionOfConvexClipPlaneSets, start: Point3d, end: Point3d, cameraFocalLength?: number): boolean {
    // Handles the degenerate case of 2 distinct points (used by select by line).
    const normal = start.vectorTo(end);
    if (normal.magnitude() === 0.0)
      return false;
    normal.normalize(normal);
    const convexSet = ConvexClipPlaneSet.createEmpty();
    if (cameraFocalLength === undefined) {
      const perpendicular = Vector2d.create(-normal.y, normal.x);
      convexSet.planes.push(ClipPlane.createNormalAndPoint(Vector3d.create(normal.x, normal.y), Point3d.createFrom(start), this._invisible)!);
      convexSet.planes.push(ClipPlane.createNormalAndPoint(Vector3d.create(-normal.x, -normal.y), Point3d.createFrom(end), this._invisible)!);
      convexSet.planes.push(ClipPlane.createNormalAndPoint(Vector3d.create(perpendicular.x, perpendicular.y), Point3d.createFrom(start), this._invisible)!);
      convexSet.planes.push(ClipPlane.createNormalAndPoint(Vector3d.create(-perpendicular.x, -perpendicular.y), Point3d.createFrom(start), this._invisible)!);
    } else {
      const start3d = Point3d.create(start.x, start.y, -cameraFocalLength);
      const end3d = Point3d.create(end.x, end.y, -cameraFocalLength);
      const vecEnd3d = Vector3d.createFrom(end3d);
      const perpendicular = vecEnd3d.crossProduct(Vector3d.createFrom(start3d)).normalize();
      let endNormal = Vector3d.createFrom(start3d).crossProduct(perpendicular!).normalize();
      convexSet.planes.push(ClipPlane.createNormalAndDistance(perpendicular!, 0.0, this._invisible)!);
      convexSet.planes.push(ClipPlane.createNormalAndDistance(endNormal!, 0.0, this._invisible)!);
      perpendicular!.negate();
      endNormal = vecEnd3d.crossProduct(perpendicular!).normalize();
      convexSet.planes.push(ClipPlane.createNormalAndDistance(perpendicular!, 0.0, this._invisible)!);
      convexSet.planes.push(ClipPlane.createNormalAndDistance(endNormal!, 0.0, this._invisible)!);
    }
    convexSet.addZClipPlanes(this._invisible, this._zLow, this._zHigh);
    set.addConvexSet(convexSet);
    return true;
  }
  /** Given a convex polygon defined as an array of points, populate the given UnionOfConvexClipPlaneSets with ConvexClipPlaneSets defining the bounded region. Returns true if successful. */
  private parseConvexPolygonPlanes(set: UnionOfConvexClipPlaneSets, polygon: Point3d[], direction: number, cameraFocalLength?: number): boolean {
    const samePointTolerance = 1.0e-8; // This could possibly be replaced with more widely used constants
    const edges: PolyEdge[] = [];
    const reverse = (direction < 0) !== this._isMask;
    for (let i = 0; i < polygon.length - 1; i++) {
      const z = (cameraFocalLength === undefined) ? 0.0 : -cameraFocalLength;
      const dir = Vector2d.createFrom((polygon[i + 1].minus(polygon[i])));
      const magnitude = dir.magnitude();
      dir.normalize(dir);
      if (magnitude > samePointTolerance) {
        const normal = Vector2d.create(reverse ? dir.y : -dir.y, reverse ? -dir.x : dir.x);
        edges.push(new PolyEdge(polygon[i], polygon[i + 1], normal, z));
      }
    }
    if (edges.length < 3) {
      return false;
    }
    if (this._isMask) {
      const last = edges.length - 1;
      for (let i = 0; i <= last; i++) {
        const edge = edges[i];
        const prevEdge = edges[i ? (i - 1) : last];
        const nextEdge = edges[(i === last) ? 0 : (i + 1)];
        const convexSet = ConvexClipPlaneSet.createEmpty();
        const prevNormal = edge.normal.minus(prevEdge.normal);
        const nextNormal = edge.normal.minus(nextEdge.normal);
        prevNormal.normalize(prevNormal);
        nextNormal.normalize(nextNormal);
        // Create three-sided fans from each edge.   Note we could define the correct region
        // with only two planes for edge, but cannot then designate the "interior" status of the edges accurately.
        convexSet.planes.push(ClipPlane.createNormalAndPoint(Vector3d.create(prevNormal.x, prevNormal.y), edge.origin, this._invisible, true)!);
        convexSet.planes.push(ClipPlane.createNormalAndPoint(Vector3d.create(edge.normal.x, edge.normal.y), edge.origin, this._invisible, false)!);
        convexSet.planes.push(ClipPlane.createNormalAndPoint(Vector3d.create(nextNormal.x, nextNormal.y), nextEdge.origin, this._invisible, true)!);
        convexSet.addZClipPlanes(this._invisible, this._zLow, this._zHigh);
        set.addConvexSet(convexSet);
      }
      set.addOutsideZClipSets(this._invisible, this._zLow, this._zHigh);
    } else {
      const convexSet = ConvexClipPlaneSet.createEmpty();
      if (cameraFocalLength === undefined) {
        for (const edge of edges)
          convexSet.planes.push(ClipPlane.createNormalAndPoint(Vector3d.create(edge.normal.x, edge.normal.y), edge.origin)!);
      } else {
        if (reverse)
          for (const edge of edges)
            convexSet.planes.push(ClipPlane.createNormalAndDistance(Vector3d.createFrom(edge.origin).crossProduct(Vector3d.createFrom(edge.next)).normalize()!, 0.0)!);
        else
          for (const edge of edges)
            convexSet.planes.push(ClipPlane.createNormalAndDistance(Vector3d.createFrom(edge.next).crossProduct(Vector3d.createFrom(edge.origin)).normalize()!, 0.0)!);
      }
      convexSet.addZClipPlanes(this._invisible, this._zLow, this._zHigh);
      set.addConvexSet(convexSet);
    }
    return true;
  }
  /** Given a concave polygon defined as an array of points, populate the given UnionOfConvexClipPlaneSets with multiple ConvexClipPlaneSets defining the bounded region. Returns true if successful. */
  private parseConcavePolygonPlanes(set: UnionOfConvexClipPlaneSets, polygon: Point3d[], cameraFocalLength?: number): boolean {
    const triangulatedPolygon = Triangulator.createTriangulatedGraphFromSingleLoop(polygon);
    Triangulator.flipTriangles(triangulatedPolygon);
    triangulatedPolygon.announceFaceLoops((_graph: HalfEdgeGraph, edge: HalfEdge): boolean => {
      if (!edge.isMaskSet(HalfEdgeMask.EXTERIOR)) {
        const convexFacetPoints = edge.collectAroundFace((node: HalfEdge): any => {
          if (!node.isMaskSet(HalfEdgeMask.EXTERIOR))
            return Point3d.create(node.x, node.y, 0);
        });
        // parseConvexPolygonPlanes expects a closed loop (pushing the reference doesn't matter)
        convexFacetPoints.push(convexFacetPoints[0]);
        const direction = PolygonOps.testXYPolygonTurningDirections(convexFacetPoints); // ###TODO: Can we expect a direction coming out of graph facet?
        this.parseConvexPolygonPlanes(set, convexFacetPoints, direction, cameraFocalLength);
      }
      return true;
    });
    return true;
  }
  /**
   * Multiply all ClipPlanes DPoint4d by matrix.
   * @param matrix matrix to apply.
   * @param invert if true, use in verse of the matrix.
   * @param transpose if true, use the transpose of the matrix (or inverse, per invert parameter)
   * * Note that if matrixA is applied to all of space, the matrix to send to this method to get a corresponding effect on the plane is the inverse transpose of matrixA
   * * Callers that will apply the same matrix to many planes should pre-invert the matrix for efficiency.
   * * Both params default to true to get the full effect of transforming space.
   * @param matrix matrix to apply
   */
  public multiplyPlanesByMatrix4d(matrix: Matrix4d, invert: boolean = true, transpose: boolean = true): boolean {
    this.ensurePlaneSets();
    return super.multiplyPlanesByMatrix4d(matrix, invert, transpose);
  }
  public transformInPlace(transform: Transform): boolean {
    if (transform.isIdentity)
      return true;
    super.transformInPlace(transform);
    if (this._transformFromClip)
      transform.multiplyTransformTransform(this._transformFromClip!, this._transformFromClip);
    else
      this._transformFromClip = transform;
    this._transformToClip = this._transformFromClip!.inverse(); // could be undefined
    return true;
  }
  public get isXYPolygon(): boolean {
    if (this._polygon.length === 0) // Note: This is a lenient check, as points array could also contain less than 3 points (not a polygon)
      return false;
    if (this._transformFromClip === undefined)
      return true;
    const testPoint = Vector3d.create(0.0, 0.0, 1.0);
    this._transformFromClip.multiplyVectorXYZ(testPoint.x, testPoint.y, testPoint.z, testPoint);
    return testPoint.magnitudeXY() < 1.0e-8;
  }
  /** Transform the input point using this instance's transformToClip member */
  public performTransformToClip(point: Point3d) {
    if (this._transformToClip !== undefined)
      this._transformToClip.multiplyPoint3d(point);
  }
  /** Transform the input point using this instance's transformFromClip member */
  public performTransformFromClip(point: Point3d) {
    if (this._transformFromClip !== undefined)
      this._transformFromClip.multiplyPoint3d(point);
  }
}
