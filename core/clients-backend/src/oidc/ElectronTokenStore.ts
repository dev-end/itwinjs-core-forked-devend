/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Authentication */

import { TokenResponse, TokenResponseJson } from "@openid/appauth";
import * as OperatingSystemUserName from "username";
import { KeyChainStoreRenderer as KeyChainStore } from "./KeyChainStoreRenderer";

/**
 * Utility to store OIDC AppAuth in secure storage
 * @internal
 */
export class ElectronTokenStore {
  private _appStorageKey: string;
  public constructor(clientId: string) {
    this._appStorageKey = `Bentley.iModelJs.OidcTokenStore.${clientId}`;
  }

  private _userName?: string; // Cached user name
  private async getUserName(): Promise<string | undefined> {
    if (!this._userName)
      this._userName = await OperatingSystemUserName();
    return this._userName;
  }

  /** Load token if available */
  public async load(): Promise<TokenResponse | undefined> {
    const userName = await this.getUserName();
    if (!userName)
      return;

    const tokenResponseStr = await KeyChainStore.getPassword(this._appStorageKey, userName);
    if (!tokenResponseStr) {
      return undefined;
    }

    const tokenResponseJson = JSON.parse(tokenResponseStr) as TokenResponseJson;
    return new TokenResponse(tokenResponseJson);
  }

  /** Save token after signin */
  public async save(tokenResponse: TokenResponse): Promise<void> {
    const userName = await this.getUserName();
    if (!userName)
      return;

    const tokenResponseObj = new TokenResponse(tokenResponse.toJson()); // Workaround for 'stub received bad data' error on windows - see https://github.com/atom/node-keytar/issues/112
    tokenResponseObj.accessToken = "";
    tokenResponseObj.idToken = "";

    const tokenResponseStr = JSON.stringify(tokenResponseObj.toJson());
    await KeyChainStore.setPassword(this._appStorageKey, userName, tokenResponseStr);
  }

  /** Delete token after signout */
  public async delete(): Promise<void> {
    const userName = await this.getUserName();
    if (!userName)
      return;

    await KeyChainStore.deletePassword(this._appStorageKey, userName);
  }
}
