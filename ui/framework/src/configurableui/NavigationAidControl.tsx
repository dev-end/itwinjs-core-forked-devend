/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module NavigationAids */

import { ConfigurableCreateInfo, ConfigurableUIControl, ConfigurableUIControlType } from "./ConfigurableUIControl";

// -----------------------------------------------------------------------------
// Configurable Ui Navigation Aid Control
// -----------------------------------------------------------------------------

/** The base class for Navigation Aid controls.
 */
export class NavigationAidControl extends ConfigurableUIControl {
  private _reactElement: React.ReactNode;

  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
  }

  public get reactElement(): React.ReactNode { return this._reactElement; }
  public set reactElement(r: React.ReactNode) { this._reactElement = r; }

  /** Default size is "64px". Override to set a different size. */
  public getSize(): string | undefined { return undefined; }

  public getType(): ConfigurableUIControlType { return ConfigurableUIControlType.NavigationAid; }
}
