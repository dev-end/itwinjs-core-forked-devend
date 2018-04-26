/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Logger } from "@bentley/bentleyjs-core";
import { IModelToken, IModelError, IModelStatus } from "@bentley/imodeljs-common";
import { IModelDb, NativePlatformRegistry } from "@bentley/imodeljs-backend";
import { ECPresentationManager as ECPresentationManagerDefinition } from "@bentley/ecpresentation-common";
import { NodeKey, Node } from "@bentley/ecpresentation-common";
import { SelectionInfo, Content, Descriptor } from "@bentley/ecpresentation-common";
import { PageOptions, KeySet } from "@bentley/ecpresentation-common";

export interface Props {
  /** @hidden */
  addon?: NodeAddonDefinition;
  rulesetDirectories?: string[];
}

export default class ECPresentationManager implements ECPresentationManagerDefinition {

  private _addon?: NodeAddonDefinition;

  constructor(props?: Props) {
    if (props && props.addon)
      this._addon = props.addon;
    if (props && props.rulesetDirectories)
      this.getNativePlatform().setupRulesetDirectories(props.rulesetDirectories);
  }

  /** @hidden */
  public getNativePlatform(): NodeAddonDefinition {
    if (!this._addon) {
      const addonImpl = createAddonImpl();
      this._addon = new addonImpl();
    }
    return this._addon!;
  }

  public async getRootNodes(token: Readonly<IModelToken>, pageOptions: Readonly<PageOptions> | undefined, options: object): Promise<ReadonlyArray<Readonly<Node>>> {
    const params = this.createRequestParams(NodeAddonRequestTypes.GetRootNodes, {
      pageOptions,
      options,
    });
    return this.request(token, params);
  }

  public async getRootNodesCount(token: Readonly<IModelToken>, options: object): Promise<number> {
    const params = this.createRequestParams(NodeAddonRequestTypes.GetRootNodesCount, {
      options,
    });
    return this.request(token, params);
  }

  public async getChildren(token: Readonly<IModelToken>, parentKey: Readonly<NodeKey>, pageOptions: Readonly<PageOptions> | undefined, options: object): Promise<ReadonlyArray<Readonly<Node>>> {
    const params = this.createRequestParams(NodeAddonRequestTypes.GetChildren, {
      nodeKey: parentKey,
      pageOptions,
      options,
    });
    return this.request(token, params);
  }

  public async getChildrenCount(token: Readonly<IModelToken>, parentKey: Readonly<NodeKey>, options: object): Promise<number> {
    const params = this.createRequestParams(NodeAddonRequestTypes.GetChildrenCount, {
      nodeKey: parentKey,
      options,
    });
    return this.request(token, params);
  }

  public async getContentDescriptor(token: Readonly<IModelToken>, displayType: string, keys: Readonly<KeySet>, selection: Readonly<SelectionInfo> | undefined, options: object): Promise<Readonly<Descriptor>> {
    const params = this.createRequestParams(NodeAddonRequestTypes.GetContentDescriptor, {
      displayType,
      keys,
      selection,
      options,
    });
    return this.request(token, params, Descriptor.reviver);
  }

  public async getContentSetSize(token: Readonly<IModelToken>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>, options: object): Promise<number> {
    const params = this.createRequestParams(NodeAddonRequestTypes.GetContentSetSize, {
      keys,
      descriptorOverrides: descriptor.createDescriptorOverrides(),
      options,
    });
    return this.request(token, params);
  }

  public async getContent(token: Readonly<IModelToken>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>, pageOptions: Readonly<PageOptions> | undefined, options: object): Promise<Readonly<Content>> {
    const params = this.createRequestParams(NodeAddonRequestTypes.GetContent, {
      keys,
      descriptorOverrides: descriptor.createDescriptorOverrides(),
      pageOptions,
      options,
    });
    return this.request(token, params, Content.reviver);
  }

  private request(token: Readonly<IModelToken>, params: string, reviver?: (key: string, value: any) => any) {
    const imodelAddon = this.getNativePlatform().getImodelAddon(token);
    const serializedResponse = this.getNativePlatform().handleRequest(imodelAddon, params);
    if (!serializedResponse)
      throw new Error("Received invalid response from the addon: " + serializedResponse);
    return JSON.parse(serializedResponse, reviver);
  }

  private createRequestParams(requestId: string, requestParams: object): string {
    const request = {
      requestId,
      params: requestParams,
    };
    return JSON.stringify(request);
  }
}

/** @hidden */
export interface NodeAddonDefinition {
  handleRequest(db: any, options: string): string;
  setupRulesetDirectories(directories: string[]): void;
  getImodelAddon(token: IModelToken): any;
}

const createAddonImpl = () => {
  const nativeAddon = (NativePlatformRegistry.getNativePlatform()).NativeECPresentationManager;
  // note the implementation is constructed here to make ECPresentationManager
  // usable without loading the actual addon (if addon is set to something other)
  return class extends nativeAddon implements NodeAddonDefinition {
    public handleRequest(db: any, options: string): string {
      return super.handleRequest(db, options);
    }
    public setupRulesetDirectories(directories: string[]): void {
      return super.setupRulesetDirectories(directories);
    }
    public getImodelAddon(token: IModelToken): any {
      const imodel = IModelDb.find(token);
      if (!imodel || !imodel.nativeDb)
        throw new IModelError(IModelStatus.NotOpen, "IModelDb not open", Logger.logError, undefined, () => ({ iModelId: token.iModelId }));
      return imodel.nativeDb;
    }
  };
};

/** @hidden @internal */
export enum NodeAddonRequestTypes {
  GetRootNodes = "GetRootNodes",
  GetRootNodesCount = "GetRootNodesCount",
  GetChildren = "GetChildren",
  GetChildrenCount = "GetChildrenCount",
  GetFilteredNodesPaths = "GetFilteredNodesPaths",
  GetNodePaths = "GetNodePaths",
  GetContentDescriptor = "GetContentDescriptor",
  GetContentSetSize = "GetContentSetSize",
  GetContent = "GetContent",
  GetDistinctValues = "GetDistinctValues",
}
