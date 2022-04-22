/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module MapLayers
 */

import { ImageMapLayerSettings } from "@itwin/core-common";
import { RequestBasicCredentials } from "../../request/Request";

/** @beta */
export enum MapLayerAuthType {
  None = 1,
  Basic = 2,
  EsriToken = 3,
  EsriOAuth2 = 4,
}
/** @internal */
export interface MapLayerTokenEndpoint {
  getLoginUrl(stateData?: string): string|undefined;
  getUrl(): string;
}

/** @internal */
export interface MapLayerAuthenticationInfo {
  authMethod: MapLayerAuthType;
  tokenEndpoint?: MapLayerTokenEndpoint;
}

/** @alpha */
export interface MapLayerAccessToken {
  // The generated token.
  token: string;
}

/** @alpha */
export interface MapLayerAccessTokenParams {
  mapLayerUrl: URL;

  // credentials are used to generate non-oauth tokens (i.e ArcGIS legacy tokens)
  userName?: string;
  password?: string;
}

/** @alpha */
export interface MapLayerAccessClient {
  getAccessToken(params: MapLayerAccessTokenParams): Promise<MapLayerAccessToken|undefined>;
  getTokenServiceEndPoint?(mapLayerUrl: string): Promise<MapLayerTokenEndpoint | undefined>;
  invalidateToken?(token: MapLayerAccessToken): boolean;
}

