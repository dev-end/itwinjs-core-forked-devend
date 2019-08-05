/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Curve */
import { Point3d } from "../geometry3d/Point3dVector3d";
import { UVSurface } from "../geometry3d/GeometryHandler";
import { Point2d } from "../geometry3d/Point2dVector2d";
import { CurveLocationDetail } from "../curve/CurveLocationDetail";
/**
 * CurveLocationDetail carries point and paramter data about a point evaluated on a curve.
 * * These are returned by a variety of queries.
 * * Particular contents can vary among the queries.
 * @public
 */
export class UVSurfaceLocationDetail {
  /** The surface being evaluated */
  public surface?: UVSurface;
  /** uv coordinates in the surface */
  public uv: Point2d;
  /** The point on the surface */
  public point: Point3d;
  /** A context-specific numeric value.  (E.g. a distance) */
  public a: number;
  /** Construct with empty data. */
  public constructor(surface?: UVSurface, uv?: Point2d, point?: Point3d) {
    this.surface = surface;
    this.point = point ? point : Point3d.createZero();
    this.uv = uv ? uv : Point2d.createZero();
    this.a = 0.0;
  }
  /**
   * Create a new detail structure.
   * @param surface
   * @param uv coordinates to copy (not capture) into the `detail.uv`
   * @param point coordinates to copy (not capture) into the `detail.point`
   */
  public static createSurfaceUVPoint(surface: UVSurface | undefined, uv: Point2d, point: Point3d): UVSurfaceLocationDetail {
    const detail = new UVSurfaceLocationDetail(surface);
    if (uv)
      detail.uv.setFrom(uv);
    detail.point.setFromPoint3d(point);
    return detail;
  }
}
/**
 * Carrier for both curve and surface data, e.g. from intersection calculations.
 * @public
 */
export class CurveAndSurfaceLocationDetail {
  /** detailed location on the curve */
  public curveDetail: CurveLocationDetail;
  /** detailed location on the surface */
  public surfaceDetail: UVSurfaceLocationDetail;
  /** CAPTURE both details . . */
  public constructor(curveDetail: CurveLocationDetail, surfaceDetail: UVSurfaceLocationDetail) {
    this.curveDetail = curveDetail;
    this.surfaceDetail = surfaceDetail;
  }
}
