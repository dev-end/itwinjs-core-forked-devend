/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { AsyncMethodsOf, BeEvent, Logger, PromiseReturnType } from "@itwin/core-bentley";
import { IModelReadRpcInterface, IModelTileRpcInterface, IpcWebSocketFrontend } from "@itwin/core-common";
import { IpcApp, NativeApp, NativeAppOpts, NotificationHandler } from "@itwin/core-frontend";
import { mobileAppChannel, mobileAppNotify } from "../common/MobileAppChannel";
import { MobileAppFunctions, MobileNotifications } from "../common/MobileAppProps";
import { MobileRpcManager } from "../common/MobileRpcManager";

/** receive notifications from backend */
class MobileAppNotifyHandler extends NotificationHandler implements MobileNotifications {
  public get channelName() { return mobileAppNotify; }

  public notifyMemoryWarning() {
    Logger.logWarning("mobileApp", "Low memory warning");
    if (MobileApp.onMemoryWarning.numberOfListeners === 0) {
      alert("Low memory warning");
    }
    MobileApp.onMemoryWarning.raiseEvent();
  }
  public notifyOrientationChanged() { MobileApp.onOrientationChanged.raiseEvent(); }
  public notifyEnterForeground() { MobileApp.onEnterBackground.raiseEvent(); }
  public notifyEnterBackground() { MobileApp.onEnterBackground.raiseEvent(); }
  public notifyWillTerminate() { MobileApp.onWillTerminate.raiseEvent(); }
}

/** @beta */
export class MobileApp {
  public static onMemoryWarning = new BeEvent<() => void>();
  public static onOrientationChanged = new BeEvent<() => void>();
  public static onEnterForeground = new BeEvent<() => void>();
  public static onEnterBackground = new BeEvent<() => void>();
  public static onWillTerminate = new BeEvent<() => void>();
  public static async callBackend<T extends AsyncMethodsOf<MobileAppFunctions>>(methodName: T, ...args: Parameters<MobileAppFunctions[T]>) {
    return IpcApp.callIpcChannel(mobileAppChannel, methodName, ...args) as PromiseReturnType<MobileAppFunctions[T]>;
  }

  private static _isValid = false;
  public static get isValid() { return this._isValid; }
  /**
   * This is called by either AndroidApp.startup or IOSApp.startup - it should not be called directly
   * @internal
   */
  public static async startup(opts?: NativeAppOpts) {
    if (!this._isValid) {
      const rpcInterfaces = opts?.iModelApp?.rpcInterfaces ?? [IModelReadRpcInterface, IModelTileRpcInterface];
      MobileRpcManager.initializeClient(rpcInterfaces);
      this._isValid = true;
    }
    const socket = new IpcWebSocketFrontend(); // needs work
    await NativeApp.startup(socket, opts);

    MobileAppNotifyHandler.register(); // receives notifications from backend
  }
}
