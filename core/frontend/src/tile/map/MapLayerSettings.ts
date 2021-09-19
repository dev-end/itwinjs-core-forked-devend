/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { MapLayerSource } from "../internal";
import { IModelApp } from "../../IModelApp";
import { NotifyMessageDetails, OutputMessagePriority } from "../../NotificationManager";
import { BeEvent, GuidString } from "@bentley/bentleyjs-core";

/** @internal */
export interface MapLayerSetting {
  url: string;
  name: string;
  formatId: string;
  transparentBackground: boolean | undefined;
}

/** @internal */
export enum MapLayerSourceChangeType {
  Added = 0,
  Removed = 1,
  Replaced = 2,
}

/** @internal */
export interface MapLayerSourceArg {
  readonly source: MapLayerSource;
  readonly iTwinId: GuidString;
  readonly iModelId: GuidString;
}

/** A wrapper around user preferences to provide a way to store [[MapLayerSettings]].
 *
 * Note: This is currently internal only and used directly by the MapLayersExtension. It makes use of the IModelApp.authorizationClient if it exists.
 *
 * @internal
 */
export class MapLayerSettingsService {
  /** Event raised whenever a source is added, replaced or removed:
   *    changeType : Type of changed occurred.
   *    oldSource : Source that was removed or replaced.
   *    newSource : Source that was added or replacement of oldSource.
   *
   * @see [[MapLayerSourceChangeType]]
   */
  public static readonly onLayerSourceChanged = new BeEvent<(changeType: MapLayerSourceChangeType, oldSource?: MapLayerSource, newSource?: MapLayerSource) => void>(); // Used to notify the frontend that it needs to update its list of available layers

  /** Store the Map Layer source preference. If the same setting exists at a higher level, an error will be thrown and the setting will not be updated.
   *
   * Returns false if the settings object would override some other settings object in a larger scope i.e. storing settings on model when
   * a project setting exists with same name or map layer url.
   * @param source source to be stored on the setting service
   * @param storeOnIModel if true store the settings object on the model, if false store it on the project
   */
  public static async storeSource(source: MapLayerSource, storeOnIModel: boolean, iTwinId: GuidString, iModelId: GuidString): Promise<boolean> {
    if (undefined === IModelApp.authorizationClient)
      return false;

    const sourceJSON = source.toJSON();
    const mapLayerSetting: MapLayerSetting = {
      url: sourceJSON.url,
      name: sourceJSON.name,
      formatId: sourceJSON.formatId,
      transparentBackground: sourceJSON.transparentBackground,
    };

    const result: boolean = await MapLayerSettingsService.delete(sourceJSON.url, sourceJSON.name, iTwinId, iModelId, storeOnIModel);
    if (result) {
      await IModelApp.userPreferences.save({
        token: () => IModelApp.authorizationClient!.getAccessToken(),
        content: mapLayerSetting,
        key: `${MapLayerSettingsService._preferenceKey}.${sourceJSON.name}`,
        iTwinId,
        iModelId: storeOnIModel ? iModelId : undefined
      });
      MapLayerSettingsService.onLayerSourceChanged.raiseEvent(MapLayerSourceChangeType.Added, undefined, MapLayerSource.fromJSON(mapLayerSetting));
      return true;
    } else {
      return false;
    }
  }

  /** Replace the old map layer source with a new map layer source.
   *
   * The source is replaced at the same level that the original source is defined. (i.e. if the old source is defined at a project level, the new source will also be defined there.)
   *
   * @param oldSource
   * @param newSource
   * @param projectId
   * @param iModelId
   */
  public static async replaceSource(oldSource: MapLayerSource, newSource: MapLayerSource, projectId: GuidString, iModelId: GuidString): Promise<void> {
    if (undefined === IModelApp.authorizationClient)
      return;

    let storeOnIModel = false;
    try {
      await IModelApp.userPreferences.delete({
        token: () => IModelApp.authorizationClient!.getAccessToken(),
        key: `${MapLayerSettingsService._preferenceKey}.${oldSource.name}`,
        iTwinId: projectId,
        iModelId
      });
    } catch (_err) {
      await IModelApp.userPreferences.delete({
        token: () => IModelApp.authorizationClient!.getAccessToken(),
        key: `${MapLayerSettingsService._preferenceKey}.${oldSource.name}`,
        iTwinId: projectId
      });
      storeOnIModel = true;
    }

    const mapLayerSetting: MapLayerSetting = {
      url: newSource.url,
      name: newSource.name,
      formatId: newSource.formatId,
      transparentBackground: newSource.transparentBackground,
    };

    await IModelApp.userPreferences.save({
      token: () => IModelApp.authorizationClient!.getAccessToken(),
      key: `${MapLayerSettingsService._preferenceKey}.${newSource.name}`,
      iTwinId: projectId,
      iModelId: storeOnIModel ? iModelId : undefined,
      content: mapLayerSetting
    })

    MapLayerSettingsService.onLayerSourceChanged.raiseEvent(MapLayerSourceChangeType.Replaced, oldSource, newSource);
  }

  /** Deletes the provided MapLayerSource by name from both the iTwin or iModel level.
   *
   * @param source The source to delete. The name is used to identify the source.
   * @param iTwinId
   * @param iModelId
   */
  public static async deleteByName(source: MapLayerSource, iTwinId: GuidString, iModelId: GuidString): Promise<void> {
    const token = undefined !== IModelApp.authorizationClient ? IModelApp.authorizationClient.getAccessToken : undefined;

    try {
      await IModelApp.userPreferences.delete({
        token,
        key: `${MapLayerSettingsService._preferenceKey}.${source.name}`,
        iTwinId,
        iModelId
      });
    } catch (_err) {
      // failed to store based on iModelId, attempt using iTwinId
      await IModelApp.userPreferences.delete({
        token,
        key: `${MapLayerSettingsService._preferenceKey}.${source.name}`,
        iTwinId,
      });
    }

    MapLayerSettingsService.onLayerSourceChanged.raiseEvent(MapLayerSourceChangeType.Removed, source, undefined);
  }

  /** Deletes the current setting with the provided key if it is defined at the same preference level.
   *
   * If the preference is defined within a different level, false will be returned indicating the setting should not be overriden.
   *
   * The two potential preference levels are iTwin and iModel.
   *
   * @param url
   * @param name
   * @param projectId
   * @param iModelId
   * @param storeOnIModel
   */
  private static async delete(url: string, name: string, projectId: GuidString, iModelId: GuidString, storeOnIModel: boolean): Promise<boolean> {
    const token = undefined !== IModelApp.authorizationClient ? IModelApp.authorizationClient.getAccessToken : undefined;

    if (undefined === IModelApp.authorizationClient)
      return false;

    const itwinPrefernceByName = await IModelApp.userPreferences.get({
      token,
      key: `${MapLayerSettingsService._preferenceKey}.${name}`,
      iTwinId: projectId,
    });

    if (undefined !== itwinPrefernceByName && storeOnIModel) {
      const errorMessage = IModelApp.i18n.translate("mapLayers:CustomAttach.LayerExistsAsProjectSetting", { layer: itwinPrefernceByName.setting.name });
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, errorMessage));
      return false;
    } else if (itwinPrefernceByName.setting) {
      const infoMessage = IModelApp.i18n.translate("mapLayers:CustomAttach.LayerExistsOverwriting", { layer: itwinPrefernceByName.setting.name });
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, infoMessage));
      await IModelApp.userPreferences.delete({
        token,
        key: `${MapLayerSettingsService._preferenceKey}.${itwinPrefernceByName.setting.name}`,
        iTwinId: projectId,
      });
    }

    // check if setting with url already exists, if it does, delete it
    const settingFromUrl = await MapLayerSettingsService.getByUrl(url, projectId, undefined);
    if (settingFromUrl && storeOnIModel) {
      const errorMessage = IModelApp.i18n.translate("mapLayers:CustomAttach.LayerWithUrlExistsAsProjectSetting", { url: settingFromUrl.url, name: settingFromUrl.name });
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, errorMessage));
      return false;
    } else if (settingFromUrl) {
      const infoMessage = IModelApp.i18n.translate("mapLayers:CustomAttach.LayerWithUrlExistsOverwriting", { url: settingFromUrl.url, oldName: settingFromUrl.name, newName: name });
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, infoMessage));
      await IModelApp.userPreferences.delete({
        token,
        key: `${MapLayerSettingsService._preferenceKey}.${settingFromUrl.name}`,
        iTwinId: projectId,
      });
    }

    if (iModelId) { // delete any settings on model so user can update them if theres collisions
      const settingOnIModelFromName = await IModelApp.userPreferences.get({
        token,
        key: `${MapLayerSettingsService._preferenceKey}.${name}`,
        iTwinId: projectId,
        iModelId,
      });
      const settingFromUrlOnIModel = await MapLayerSettingsService.getByUrl(url, projectId, iModelId);
      if (settingOnIModelFromName.setting) {
        const infoMessage = IModelApp.i18n.translate("mapLayers:CustomAttach.LayerExistsOverwriting", { layer: settingOnIModelFromName.setting.name });
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, infoMessage));
        await IModelApp.userPreferences.delete({
          token,
          key: `${MapLayerSettingsService._preferenceKey}.${settingOnIModelFromName.setting.name}`,
          iTwinId: projectId,
          iModelId
        });
      }
      if (settingFromUrlOnIModel) {
        const infoMessage = IModelApp.i18n.translate("mapLayers:CustomAttach.LayerWithUrlExistsOverwriting", { url: settingFromUrlOnIModel.url, oldName: settingFromUrlOnIModel.name, newName: name });
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, infoMessage));
        await IModelApp.userPreferences.delete({
          token,
          key: `${MapLayerSettingsService._preferenceKey}.${settingFromUrlOnIModel.name}`,
          iTwinId: projectId,
          iModelId
        });
      }
    }
    return true;
  }

  /** Attempts to get a map layer based off a specific url.
   * @param url
   * @param projectId
   * @param iModelId
   */
  public static async getByUrl(url: string, projectId: string, iModelId?: string): Promise<MapLayerSetting | undefined> {
    const token = undefined !== IModelApp.authorizationClient ? IModelApp.authorizationClient.getAccessToken : undefined;

    const settingResponse = await IModelApp.userPreferences.get({
      token,
      key: MapLayerSettingsService._preferenceKey,
      iTwinId: projectId,
      iModelId,
    });

    if (undefined === settingResponse)
      return undefined;

    let savedMapLayer;
    settingResponse.settingsMap?.forEach((savedLayer: any) => {
      if (savedLayer.url === url) {
        savedMapLayer = savedLayer;
      }
    });
    return savedMapLayer;
  }

  /** Get all MapLayerSources from the user's preferences, iTwin setting and iModel settings.
   * @param projectId id of the project
   * @param iModelId id of the iModel
   * @throws if any of the calls to grab settings fail.
   */
  public static async getSources(projectId: GuidString, iModelId: GuidString): Promise<MapLayerSource[]> {
    const token = undefined !== IModelApp.authorizationClient ? IModelApp.authorizationClient.getAccessToken : undefined;

    let userResultByProject;
    try {
      userResultByProject = await IModelApp.userPreferences.get({
        token,
        key: MapLayerSettingsService._preferenceKey,
        iTwinId: projectId,
      });
    } catch (err: any) {
      throw new Error(IModelApp.i18n.translate("mapLayers:CustomAttach.ErrorRetrieveUserProject", { errorMessage: err }));
    }

    let userResultByImodel;
    try {
      userResultByImodel = IModelApp.userPreferences.get({
        token,
        key: MapLayerSettingsService._preferenceKey,
        iTwinId: projectId,
        iModelId,
      });
    } catch (err: any) {
      throw new Error(IModelApp.i18n.translate("mapLayers:CustomAttach.ErrorRetrieveUserProject", { errorMessage: err }));
    }

    const mapLayerList = [userResultByProject, userResultByImodel];

    const savedMapLayerSources: MapLayerSource[] = [];
    for (const settingsMapResult of mapLayerList) {
      settingsMapResult.settingsMap!.forEach((savedLayer: any) => {
        const mapLayerSource = MapLayerSource.fromJSON(savedLayer as MapLayerSetting);
        if (mapLayerSource)
          savedMapLayerSources.push(mapLayerSource);
      });
    }
    return savedMapLayerSources;
  }

  private static get _preferenceKey() {
    return "MapLayerSource-SettingsService";
  }
}
