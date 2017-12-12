/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { EntityProps } from "./EntityProps";
import { XAndY } from "@bentley/geometry-core/lib/PointVector";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";

export interface ModelProps extends EntityProps {
  modeledElement: Id64 | string;
  isPrivate?: boolean;
  isTemplate?: boolean;
  jsonProperties?: any;
}

export interface GeometricModel2dProps extends ModelProps {
  globalOrigin?: XAndY | string;
}
