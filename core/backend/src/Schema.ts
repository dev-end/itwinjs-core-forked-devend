/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Schema */

import { Logger } from "@bentley/bentleyjs-core";
import { IModelError, IModelStatus } from "@bentley/imodeljs-common";
import { ClassRegistry } from "./ClassRegistry";
import { Entity } from "./Entity";
import { IModelDb } from "./IModelDb";
import { BackendLoggerCategory } from "./BackendLoggerCategory";

const loggerCategory: string = BackendLoggerCategory.Schemas;

/** Base class for all schema classes - see [working with schemas and elements in TypeScript]($docs/learning/backend/SchemasAndElementsInTypeScript.md).
 * @public
 */
export class Schema {
  /** The name of the BIS schema handled by this Schema.
   * @note Every subclass of Schema ** MUST ** override this method to identify its BIS schema.
   * Failure to do so will ordinarily result in an error when the schema is registered, since there may only
   * be one JavaScript class for a given BIS schema (usually the errant schema will collide with its superclass.)
   */
  public static get schemaName(): string { throw new Error("you must override static schemaName in " + this.name); }

  /** Schemas may not be instantiated. The method is not private only because that precludes subclassing. It throws an
   * error if it is ever called.
   * @internal
   */
  protected constructor() { throw new Error("cannot create an instance of a Schema " + this.constructor.name); }

  /** Get the Entity class for the specified class name
   * @param className The name of the Entity
   * @param iModel The IModel that contains the class definitions
   * @returns The corresponding entity class
   */
  public static getClass(className: string, iModel: IModelDb): typeof Entity | undefined { return ClassRegistry.getClass(this.schemaName + ":" + className, iModel); }
}

/** Manages registered schemas
 * @public
 */
export class Schemas {
  private static readonly _registeredSchemas = new Map<string, typeof Schema>();

  /** Register a schema prior to using it.
   * @throws [[IModelError]] if a schema of the same name is already registered.
   */
  public static registerSchema(schema: typeof Schema) {
    const key = schema.schemaName.toLowerCase();
    if (this.getRegisteredSchema(key))
      throw new IModelError(IModelStatus.DuplicateName, "Schema \"" + schema.schemaName + "\" is already registered", Logger.logWarning, loggerCategory);
    this._registeredSchemas.set(key, schema);
  }

  /** Unregister a schema, by name, if one is already registered.
   * This function is not normally needed, but is useful for cases where a generated *proxy* schema needs to be replaced by the *real* schema.
   * @param schemaName Name of the schema to unregister
   * @return true if the schema was unregistered
   * @internal
   */
  public static unregisterSchema(schemaName: string): boolean { return this._registeredSchemas.delete(schemaName.toLowerCase()); }

  /** Look up a previously registered schema
   * @param schemaName The name of the schema
   * @returns the previously registered schema or undefined if not registered.
   */
  public static getRegisteredSchema(schemaName: string): typeof Schema | undefined { return this._registeredSchemas.get(schemaName.toLowerCase()); }
}
