/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelConnection
 */

import { BentleyStatus, GuidString, Logger } from "@bentley/bentleyjs-core";
import {
  IModelConnectionProps, IModelError, IModelReadRpcInterface, IModelRpcOpenProps, IModelVersion, RpcManager, RpcNotFoundResponse, RpcOperation,
  RpcRequest, RpcRequestEvent,
} from "@bentley/imodeljs-common";
import { FrontendLoggerCategory } from "./FrontendLoggerCategory";
import { AuthorizedFrontendRequestContext } from "./FrontendRequestContext";
import { IModelApp } from "./IModelApp";
import { IModelConnection } from "./IModelConnection";
import { IModelRoutingContext } from "./IModelRoutingContext";

const loggerCategory: string = FrontendLoggerCategory.IModelConnection;

/**
 * An IModelConnection to a checkpoint of an iModel, hosted on a remote backend over RPC.
 * Due to the nature of RPC requests, the backend servicing this connection may change over time, and there may even be more than one backend
 * at servicing requests at the same time. For this reason, this type of connection may only be used with Checkpoint iModels that are
 * guaranteed to be the same on every backend. Obviously Checkpoint iModels only allow readonly access.
 * @public
 */
export class CheckpointConnection extends IModelConnection {
  /** The Guid that identifies the *context* that owns this iModel. */
  public override get iTwinId(): GuidString { return super.iTwinId!; } // GuidString | undefined for the superclass, but required for BriefcaseConnection
  /** The Guid that identifies this iModel. */
  public override get iModelId(): GuidString { return super.iModelId!; } // GuidString | undefined for the superclass, but required for BriefcaseConnection

  /** Returns `true` if [[close]] has already been called. */
  public get isClosed(): boolean { return this._isClosed ? true : false; }
  protected _isClosed?: boolean;

  /** Type guard for instanceof [[CheckpointConnection]] */
  public override isCheckpointConnection(): this is CheckpointConnection { return true; }

  /**
   * Open a readonly IModelConnection to an iModel over RPC.
   */
  public static async openRemote(iTwinId: string, iModelId: string, version: IModelVersion = IModelVersion.latest()): Promise<CheckpointConnection> {
    const routingContext = IModelRoutingContext.current || IModelRoutingContext.default;

    const requestContext = await AuthorizedFrontendRequestContext.create();
    requestContext.enter();

    const changeset = { id: await IModelApp.hubAccess.getChangesetIdFromVersion({ requestContext, iModelId, version }) };
    requestContext.enter();

    const iModelRpcProps: IModelRpcOpenProps = { iTwinId, iModelId, changeset };
    const openResponse = await this.callOpen(requestContext, iModelRpcProps, routingContext);
    requestContext.enter();

    const connection = new this(openResponse);
    RpcManager.setIModel(connection);
    connection.routingContext = routingContext;
    RpcRequest.notFoundHandlers.addListener(connection._reopenConnectionHandler);

    IModelConnection.onOpen.raiseEvent(connection);
    return connection;
  }

  private static async callOpen(requestContext: AuthorizedFrontendRequestContext, iModelToken: IModelRpcOpenProps, routingContext: IModelRoutingContext): Promise<IModelConnectionProps> {
    requestContext.enter();

    // Try opening the iModel repeatedly accommodating any pending responses from the backend.
    // Waits for an increasing amount of time (but within a range) before checking on the pending request again.
    const connectionRetryIntervalRange = { min: 100, max: 5000 }; // in milliseconds
    let connectionRetryInterval = Math.min(connectionRetryIntervalRange.min, IModelConnection.connectionTimeout);

    const openForReadOperation = RpcOperation.lookup(IModelReadRpcInterface, "openForRead");
    if (!openForReadOperation)
      throw new IModelError(BentleyStatus.ERROR, "IModelReadRpcInterface.openForRead() is not available");
    openForReadOperation.policy.retryInterval = () => connectionRetryInterval;

    Logger.logTrace(loggerCategory, `Received open request in IModelConnection.open`, () => iModelToken);
    Logger.logTrace(loggerCategory, `Setting retry interval in IModelConnection.open`, () => ({ ...iModelToken, connectionRetryInterval }));

    const startTime = Date.now();

    const removeListener = RpcRequest.events.addListener((type: RpcRequestEvent, request: RpcRequest) => {
      if (type !== RpcRequestEvent.PendingUpdateReceived)
        return;
      if (!(openForReadOperation && request.operation === openForReadOperation))
        return;

      requestContext.enter();
      Logger.logTrace(loggerCategory, "Received pending open notification in IModelConnection.open", () => iModelToken);

      const connectionTimeElapsed = Date.now() - startTime;
      if (connectionTimeElapsed > IModelConnection.connectionTimeout) {
        Logger.logError(loggerCategory, `Timed out opening connection in IModelConnection.open (took longer than ${IModelConnection.connectionTimeout} milliseconds)`, () => iModelToken);
        throw new IModelError(BentleyStatus.ERROR, "Opening a connection was timed out"); // NEEDS_WORK: More specific error status
      }

      connectionRetryInterval = Math.min(connectionRetryIntervalRange.max, connectionRetryInterval * 2, IModelConnection.connectionTimeout - connectionTimeElapsed);
      if (request.retryInterval !== connectionRetryInterval) {
        request.retryInterval = connectionRetryInterval;
        Logger.logTrace(loggerCategory, `Adjusted open connection retry interval to ${request.retryInterval} milliseconds in IModelConnection.open`, () => iModelToken);
      }
    });

    requestContext.useContextForRpc = true;
    const openPromise = IModelReadRpcInterface.getClientForRouting(routingContext.token).openForRead(iModelToken);

    let openResponse: IModelConnectionProps;
    try {
      openResponse = await openPromise;
    } finally {
      requestContext.enter();
      Logger.logTrace(loggerCategory, "Completed open request in IModelConnection.open", () => iModelToken);
      removeListener();
    }

    return openResponse;
  }

  private _reopenConnectionHandler = async (request: RpcRequest<RpcNotFoundResponse>, response: any, resubmit: () => void, reject: (reason: any) => void) => {
    if (!response.hasOwnProperty("isIModelNotFoundResponse"))
      return;

    const iModelRpcProps = request.parameters[0];
    if (this._fileKey !== iModelRpcProps.key)
      return; // The handler is called for a different connection than this

    const requestContext: AuthorizedFrontendRequestContext = await AuthorizedFrontendRequestContext.create(request.id); // Reuse activityId
    requestContext.enter();

    Logger.logTrace(loggerCategory, "Attempting to reopen connection", () => iModelRpcProps);

    try {
      const openResponse = await CheckpointConnection.callOpen(requestContext, iModelRpcProps, this.routingContext);
      // The new/reopened connection may have a new rpcKey and/or changeSetId, but the other IModelRpcTokenProps should be the same
      this._fileKey = openResponse.key;
      this.changeset = openResponse.changeset!;

    } catch (error) {
      reject(error.message);
    } finally {
      requestContext.enter();
    }

    Logger.logTrace(loggerCategory, "Resubmitting original request after reopening connection", () => iModelRpcProps);
    request.parameters[0] = this.getRpcProps(); // Modify the token of the original request before resubmitting it.
    resubmit();
  };

  /** Close this CheckpointConnection */
  public async close(): Promise<void> {
    if (this.isClosed)
      return;

    this.beforeClose();
    const requestContext = await AuthorizedFrontendRequestContext.create();
    requestContext.enter();

    RpcRequest.notFoundHandlers.removeListener(this._reopenConnectionHandler);
    requestContext.useContextForRpc = true;

    const closePromise: Promise<boolean> = IModelReadRpcInterface.getClientForRouting(this.routingContext.token).close(this.getRpcProps()); // Ensure the method isn't awaited right away.
    try {
      await closePromise;
    } finally {
      requestContext.enter();
      this._isClosed = true;
    }
  }
}
