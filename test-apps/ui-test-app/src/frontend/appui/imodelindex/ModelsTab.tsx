/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./ModelsTab.scss";
import * as React from "react";
import { Id64String } from "@itwin/core-bentley";
import { ModelProps, ModelQueryParams, QueryRowFormat } from "@itwin/core-common";
import { IModelApp, IModelConnection, SpatialModelState } from "@itwin/core-frontend";
import { RegisteredRuleset } from "@itwin/presentation-common";
import { PresentationTreeDataProvider } from "@itwin/presentation-components";
import { Presentation } from "@itwin/presentation-frontend";
import { DelayLoadedTreeNodeItem, TreeNodeItem } from "@itwin/components-react";
import { CheckBoxState, CheckListBox, CheckListBoxItem, LoadingSpinner } from "@itwin/core-react";
import { Button, Checkbox } from "@itwin/itwinui-react";

interface ModelInfo {
  name: string;
  checked: boolean;
  modelProps?: ModelProps;
}

interface DocumentCode {
  name: string;
  desc?: string;
  value: string;
}

class ValueDescPair {
  public value: string;
  public desc: string;
  public displayValue: string;
  public checked: boolean;

  constructor(_value: string = "", _desc: string = "", _displayValue: string = "") {
    this.value = _value;
    this.desc = _desc;
    this.displayValue = _displayValue;
    this.checked = false;
  }

  public compare(valueDescPair: ValueDescPair) {
    if (this.displayValue.length === 0) {
      return this.value === valueDescPair.value; // < 0;
    }

    return this.displayValue === valueDescPair.displayValue; // < 0;
  }
}

class DocCodeCategory {
  public name: string = "";
  public values: ValueDescPair[] = [];
  public checked: boolean = false;
}

class DocumentProperty {
  public modelId: string;
  public name: string;
  public desc: string;
  public docCodes: Map<number, DocumentCode> | undefined;
  public isPhysical: boolean;

  constructor(_modelId: string, _name: string, _desc: string, _attributes: any, _isPhysical: boolean) {
    this.modelId = _modelId;
    this.name = _name;
    this.desc = _desc;
    this.isPhysical = _isPhysical;

    const jsonProperties = JSON.parse(_attributes);
    const documentProperties = jsonProperties.DocumentProperties;
    if (!documentProperties)
      return;

    const attrs = documentProperties.attributes;
    if (!attrs)
      return;

    const isDocCodeDefined = attrs.IsDocCodeDefined;
    if (!isDocCodeDefined)
      return;

    const moreAttrs = attrs.Attributes;
    if (!moreAttrs)
      return;

    this.docCodes = new Map();

    let index = 128;
    for (const currAttr of moreAttrs) {
      const docCodeOrderNumber = currAttr.DocCodeOrderNumber;
      this.docCodes.set((docCodeOrderNumber) ? docCodeOrderNumber : index++, { name: currAttr.Name, value: currAttr.Value });
    }
  }
}

/** @internal */
export interface ModelsProps {
  /** IModelConnection */
  iModelConnection: IModelConnection;
  /** Callback to display "loading" when entering an imodel */
  onEnter?: (viewIds: Id64String[]) => void;
  /** Show the toast message or not */
  showToast: boolean;
}

interface ModelsState {
  initialized: boolean;
  showToast: boolean;
  models: ModelInfo[];
  docCodes: DocCodeCategory[] | undefined;
  selectedNodes: TreeNodeItem[];
}

/** @internal */
export class ModelsTab extends React.Component<ModelsProps, ModelsState> {
  private _models: DocumentProperty[] = [];
  private _ruleset?: RegisteredRuleset;
  private _isMounted = false;
  private _dataProvider: PresentationTreeDataProvider | undefined = undefined;

  constructor(props?: any, context?: any) {
    super(props, context);

    this.state = { initialized: false, models: [], docCodes: undefined, showToast: this.props.showToast, selectedNodes: [] };
  }

  /** Load document codes when we mount */
  public override async componentDidMount() {

    this._isMounted = true;

    if (!this.props.iModelConnection) {
      return;
    }

    // read the doc codes
    await this.readDataFromDb();

    const _models: ModelInfo[] = [];

    // if doc codes do not exist, load models
    if (!this.state.docCodes) {

      // load model presentation rules
      await this.loadModelsFromPresentationRules();

      const modelQueryParams: ModelQueryParams = { from: SpatialModelState.classFullName, wantPrivate: false };
      const currentModelProps = await this.props.iModelConnection.models.queryProps(modelQueryParams);
      for (const _modelProps of currentModelProps) {
        if (_modelProps.name && this.isUnique(_modelProps.name)) {
          _models.push({ modelProps: _modelProps, name: _modelProps.name, checked: false });
        }
      }
    }

    this.setState((prevState) => ({ initialized: true, models: _models, showToast: !prevState.docCodes }));
  }

  public override componentWillUnmount() {
    this._isMounted = false;

    if (this._ruleset)
      Presentation.presentation.rulesets().remove(this._ruleset); // eslint-disable-line @typescript-eslint/no-floating-promises
  }

  private async loadModelsFromPresentationRules() {
    await Presentation.presentation.rulesets().add(require("../../../assets/rulesets/Models")) // eslint-disable-line @typescript-eslint/no-var-requires
      .then((ruleset: RegisteredRuleset) => {
        if (!this._isMounted)
          return;
        this._ruleset = ruleset;
        const dataProvider = new PresentationTreeDataProvider({ imodel: this.props.iModelConnection, ruleset: this._ruleset.id });
        this.enableCheckboxes(dataProvider); // eslint-disable-line @typescript-eslint/no-floating-promises
        this._dataProvider = dataProvider;
      });
  }

  private async enableCheckboxes(_dataProvider: PresentationTreeDataProvider, parentNode?: TreeNodeItem) {
    const nodes = await _dataProvider.getNodes(parentNode);
    nodes.forEach((n: DelayLoadedTreeNodeItem) => {
      n.isCheckboxVisible = true;
      n.autoExpand = true;
      this.enableCheckboxes(_dataProvider, n); // eslint-disable-line @typescript-eslint/no-floating-promises
    });
  }

  private async readDataFromDb() {
    await this.readDocCodes();

    /* no doc codes */
    if (this._models.length === 0)
      return;

    /* compute unique values */
    const uniqueValues: Map<number, DocCodeCategory> = new Map<number, DocCodeCategory>();
    for (const model of this._models) {
      if (model.docCodes) {
        for (const entry of Array.from(model.docCodes.entries())) {
          const key = entry[0];
          const docCode = entry[1];
          const uniqueValue = uniqueValues.get(key);
          if (!uniqueValue || uniqueValue.name.length === 0) {
            uniqueValues.set(key, { name: docCode.name, values: [], checked: false });
          }
          if (uniqueValue && uniqueValue.name !== docCode.name) {
            return;
          }
          let alreadyExists: boolean = false;
          if (uniqueValue) {
            for (const value of uniqueValue.values) {
              if (value && value.value === docCode.value) {
                alreadyExists = true;
                break;
              }
            }
          }
          if (!alreadyExists) {
            uniqueValues.get(key)!.values.push(new ValueDescPair(docCode.value, docCode.desc, ""));
          }
        }
      }
    }

    if (uniqueValues.size !== 0) {
      const _docCodes: DocCodeCategory[] = [];
      for (const entry of Array.from(uniqueValues.entries())) {
        const currentvalues = entry[1];

        /* SORT THE VALUES */

        const _values: ValueDescPair[] = [];
        for (const _value of currentvalues.values) {
          _values.push(new ValueDescPair(_value.value, _value.desc, _value.displayValue));
        }
        _docCodes.push({ name: currentvalues.name, values: _values, checked: false });
      }

      this.setState({ docCodes: _docCodes });
    }
  }

  private async readDocCodes() {
    // Query categories and add them to state
    const ecsql = "SELECT c.ecinstanceid FROM meta.ECClassDef c WHERE c.Name='PhysicalPartition'";
    const rows = [];
    for await (const row of this.props.iModelConnection.query(ecsql, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
      rows.push(row);
    }
    if (rows.length !== 1)
      return;

    const physicalClassId = rows[0].id as string;

    const ecsql2 = "SELECT me.ecinstanceid, me.codevalue as codevalue, me.ecclassid as classid, l.userlabel as userlabel, l.jsonproperties as jsonproperties FROM bis.InformationContentElement me JOIN bis.repositorylink l USING bis.ElementHasLinks";
    for await (const model of this.props.iModelConnection.query(ecsql2, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
      const name: string = model.codevalue ? model.codevalue as string : "";
      const description: string = model.userlabel ? model.userlabel as string : "";
      const attributes = model.jsonproperties;
      const isPhysical: boolean = model.classid === physicalClassId;
      const documentProp = new DocumentProperty(model.id, name, description, attributes, isPhysical);
      this._models.push(documentProp);
    }
  }

  private isUnique(name: string) {
    const filter = this.state.models.filter((item: ModelInfo) => item.name !== name);
    return (filter.length === 0);
  }

  private _onModelCheckboxClick(model: ModelInfo) {
    model.checked = !model.checked;
    const _models = this.state.models.slice();
    this.setState({ models: _models });
  }

  private _onDocCodeCheckboxClick(vp: ValueDescPair) {
    vp.checked = !vp.checked;
    this.Refresh();
  }

  private _onDocCodeCheckedStatesChanged(pair: DocCodeCategory) {
    pair.checked = !pair.checked;
    pair.values.forEach((vp: ValueDescPair) => (vp.checked = pair.checked));
    this.Refresh();
  }

  /* update the doccodes and enable the ok button */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  private Refresh() {
    const _docCodes = this.state.docCodes!.slice();
    this.setState({ docCodes: _docCodes });
  }

  /** Gets the model Ids that we want to view based on doc codes */
  private _getModelsFromDocCodes(): Id64String[] {
    const selectedDocCodes: Map<string, ValueDescPair[]> = new Map<string, ValueDescPair[]>();
    this.state.docCodes!.forEach((pair: DocCodeCategory) => {
      pair.values.forEach((vp: ValueDescPair) => {
        if (vp.checked) {
          if (selectedDocCodes.has(pair.name))
            selectedDocCodes.get(pair.name)!.push(vp);
          else
            selectedDocCodes.set(pair.name, [vp]);
        }
      });
    });

    // Checks if a DocumentProperty contains the desired doc code
    const modelHasDocCode = (docName: string, vdp: ValueDescPair, modelData: DocumentProperty) => {
      let result = false;
      if (modelData.docCodes) {
        modelData.docCodes.forEach((modelDocCode: DocumentCode) => {
          if (modelDocCode.name === docName && modelDocCode.value === vdp.value)
            result = true;
        });
      }

      return result;
    };

    // Check if the model has at least one of the described values
    const modelHasAtLeastOneValue = (name: string, vdps: ValueDescPair[], modelData: DocumentProperty) => {
      for (const vdp of vdps) {
        if (modelHasDocCode(name, vdp, modelData))
          return true;
      }

      return false;
    };

    // Check if the model matches with the doc codes
    const modelMatchesDocCodes = (docCodes: Map<string, ValueDescPair[]>, modelData: DocumentProperty) => {
      let attributes = 0;
      docCodes.forEach((vdps: ValueDescPair[], name: string) => {
        if (modelHasAtLeastOneValue(name, vdps, modelData))
          attributes++;
      });

      return (attributes === docCodes.size);
    };

    const viewedModelIds: Id64String[] = [];
    this._models.forEach((docProperty: DocumentProperty) => {
      if (modelMatchesDocCodes(selectedDocCodes, docProperty))
        viewedModelIds.push(docProperty.modelId);
    });

    return viewedModelIds;
  }

  /* enter iModel has been clicked */
  private async _onOpen() {
    this.setState({ showToast: false });

    let viewedModels: Id64String[] = [];
    if (this.state.docCodes) {
      viewedModels = this._getModelsFromDocCodes();
    } else {
      this.state.models.forEach((model: ModelInfo) => {
        if (model.checked && model.modelProps) {
          viewedModels.push(model.modelProps.id!);
        }
      });
    }

    if (this.props.onEnter)
      this.props.onEnter(viewedModels);
  }

  /* close the toast message */
  private _onCloseToast = () => {
    this.setState({ showToast: false });
  };

  /* determine if the Ok button should be enabled or disabled */
  private _isOkButtonEnabled(): boolean {
    let count = 0;
    if (this.state.docCodes) {
      this.state.docCodes.forEach((pair: DocCodeCategory) => {
        pair.values.forEach((vp: ValueDescPair) => {
          if (vp.checked) {
            ++count;
          }
        });
      });
    } else {
      count = this.state.models.filter((model: ModelInfo) => model.checked).length;
    }
    return count > 0;
  }

  /** Set item state for selected node and recursive change children if needed */
  private _onNodesSelected = async (_selectedNodes: TreeNodeItem[], node: TreeNodeItem, state: CheckBoxState) => {
    // set the state for this node
    node.checkBoxState = state;

    // add or remove it from the selected nodes list
    if (state === CheckBoxState.On) {
      const index = _selectedNodes.indexOf(node);
      if (index === -1)
        _selectedNodes.push(node);
    } else {
      const index = _selectedNodes.indexOf(node);
      if (index !== -1)
        _selectedNodes.splice(index, 1);
    }

    // recursively process the children of this node
    const childNodes = await this._dataProvider!.getNodes(node);
    for (const childNode of childNodes) {
      await this._onNodesSelected(_selectedNodes, childNode, state);
    }

    return true;
  };

  private renderContent() {
    if (!this.state.initialized) {
      return (
        <div className="view-loading">
          <LoadingSpinner />
        </div>
      );
    } else if (this.state.docCodes) {
      return (
        <div className="documentcode-container">
          {this.state.docCodes.map((pair: DocCodeCategory) => (
            // eslint-disable-next-line react/jsx-key
            <div className="dc-table" >
              <div className="dc-table-header">
                <Checkbox checked={pair.checked} onClick={this._onDocCodeCheckedStatesChanged.bind(this, pair)} />
                <span className="dc-table-title">{pair.name}</span>
              </div>
              <div className="dc-table-content">
                <CheckListBox>
                  {pair.values.map((vp: ValueDescPair, i: number) => (
                    <CheckListBoxItem key={i} label={vp.value} checked={vp.checked} onClick={this._onDocCodeCheckboxClick.bind(this, vp)} />
                  ))}
                </CheckListBox>
              </div>
            </div>
          ))}
        </div>
      );
    } else {
      return (
        <div className="models-list-container">
          <CheckListBox>
            {this.state.models.map((model: ModelInfo, i: number) => (
              <CheckListBoxItem key={i} label={model.name} checked={model.checked} onClick={() => this._onModelCheckboxClick(model)} />
            ))}
          </CheckListBox>
        </div>
      );
    }
  }

  private renderToastMessage() {
    const toastTitle = IModelApp.localization.getLocalizedString("SampleApp:iModelIndex.toastTitle");
    const toastMessage = IModelApp.localization.getLocalizedString("SampleApp:iModelIndex.toastMessage");
    return (
      <div className="toast slide">
        <div className="toast-image"><span className="icon icon-info-hollow"></span></div>
        <div className="toast-message">
          <span>{toastTitle}</span>
          <span>{toastMessage}</span>
        </div>
        <a target="_blank" rel="noopener noreferrer" href="https://docs.bentley.com/LiveContent/web/ProjectWise%20Explorer%20Help-v9/en/GUID-7D468087-663C-96F6-A664-E204EC65484B.html">{IModelApp.localization.getLocalizedString("SampleApp:iModelIndex.learnMore")}</a>
        <span className="close" onClick={this._onCloseToast}>&times;</span>
      </div>
    );
  }

  public override render() {
    return (
      <div className="modelstab-container">
        {this.renderContent()}
        {this.state.initialized && <Button className="open-button" styleType="high-visibility" disabled={!this._isOkButtonEnabled()} onClick={this._onOpen.bind(this)}>{IModelApp.localization.getLocalizedString("SampleApp:iModelIndex.enteriModel")}</Button>}
        {this.state.showToast && this.renderToastMessage()}
      </div>
    );
  }
}
