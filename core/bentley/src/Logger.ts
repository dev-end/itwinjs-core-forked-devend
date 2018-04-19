/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Logging */

import { GetMetaDataFunction, IModelStatus, BentleyError } from "./BentleyError";
import { IDisposable } from "./Disposable";

/** Defines the *signature* for a log function. */
export type LogFunction = (category: string, message: string, metaData?: GetMetaDataFunction) => void;

export enum LogLevel {
  /** Tracing and debugging - low level */
  Trace,
  /** Information - mid level */
  Info,
  /** Warnings - high level */
  Warning,
  /** Errors - highest level */
  Error,
  /** Higher than any real logging level. This is used to turn a category off. */
  None,
}

/** Identifies a logging category and the LogLevel that should be used for it. The LogLevel is specified by its string name. */
export interface LoggerCategoryAndLevel {
  category: string;
  logLevel: string;
}

/** Specifies logging levels, including the default logging level and a set of categories and levels for them. */
export interface LoggerLevelsConfig {
  defaultLevel?: string;
  categoryLevels?: LoggerCategoryAndLevel[];
}

/** Class for configuring logging messages generated from this framework.
 * # Log Streams
 * The app controls how to handle log messages by supplying to [[Logger.initialize]] the functions that handle messages for each log level. These functions are called "streams".
 * See the convenience method [[Logger.initializeToConsole]] for a simple way to direct
 * logging output to the console.
 * See [[BunyanLoggerConfig]] for an example of how to direct logging to the Bunyan logging system.
 * See [[SeqLoggerConfig]] for an example of how to direct logging to the seq logging server.
 * # Filtering messages by level
 * The simplest way to turn off logging at some log level is for the app simply not to supply a stream for that level.
 * Or, the app can supply a stream that does its own internal filtering.
 * Another way is for the app to call [[Logger.setLevel]] and set minimum levels by category.
 * # Working with categories.
 * You supply a category name for each message that you log. The category name appears in the log output.
 * You also supply a [[LogLevel]] for each message that you log.
 * Logging messages can be filtered out by category and by level.
 * There are two filtering strategies.
 * ## 1. Turn all categories on by default. Then turn off the ones you don't want.
 * ```
 * Logger.initializeToConsole();
 * Logger.setLevelDefault(LogLevel.Error);
 * Logger.setLevel("Diagnostics", LogLevel.None);
 * ```
 * This approach is mainly useful when you are just trying to find out what is happening, for example, to debug a problem when you don't have much data.
 * This can produce a lot of logging output.
 * ## 2. Leave most categories off by default. Then turn on the ones you do want.
 * ```
 * Logger.initializeToConsole();
 * Logger.setLevel("MyCategory", LogLevel.Info);
 * ```
 * This approach is useful when you want to monitor the activity in a small number of known modules, where you already know the names of the categories that they use.
 * ## Parent and Child Categories
 * If a category name has a "." in it, then the part to the left is interpreted as the parent category and the part to the right as the child.
 * If you pass a parent category to [[setLevel]], then the specified level filter will be applied to all children of that level.
 * If you call [[setLevel]] on a specific child category, then the level you specify will apply to  that child, while the parent's level will apply to all other children.
 */
export class Logger {
  private static _logError: LogFunction | undefined;
  private static _logWarning: LogFunction | undefined;
  private static _logInfo: LogFunction | undefined;
  private static _logTrace: LogFunction | undefined;
  private static _categoryFilter: Map<string, LogLevel> = new Map<string, LogLevel>();
  private static _minLevel: LogLevel | undefined = undefined;

  /** Initialize the logger streams. Should be called at application initialization time. */
  public static initialize(logError: LogFunction | undefined, logWarning?: LogFunction | undefined, logInfo?: LogFunction | undefined, logTrace?: LogFunction | undefined): void {
    Logger._logError = logError;
    Logger._logWarning = logWarning;
    Logger._logInfo = logInfo;
    Logger._logTrace = logTrace;
    Logger.turnOffLevelDefault();
    Logger.turnOffCategories();
  }

  /** Initialize the logger streams to the console. Should be called at application initialization time. */
  public static initializeToConsole(): void {
    // tslint:disable:no-console
    Logger.initialize((category: string, message: string, getMetaData?: GetMetaDataFunction): void => console.log("Error   |" + category + "| " + message + (getMetaData ? " " + JSON.stringify(getMetaData()) : "")),
      (category: string, message: string, getMetaData?: GetMetaDataFunction): void => console.log("Warning |" + category + "| " + message + (getMetaData ? " " + JSON.stringify(getMetaData()) : "")),
      (category: string, message: string, getMetaData?: GetMetaDataFunction): void => console.log("Info    |" + category + "| " + message + (getMetaData ? " " + JSON.stringify(getMetaData()) : "")),
      (category: string, message: string, getMetaData?: GetMetaDataFunction): void => console.log("Trace   |" + category + "| " + message + (getMetaData ? " " + JSON.stringify(getMetaData()) : "")));
  }

  /** Set the least severe level at which messages should be displayed by default. Call setLevel to override this default setting for specific categories. */
  public static setLevelDefault(minLevel: LogLevel): void {
    Logger._minLevel = minLevel;
  }

  /** Set the minimum logging level for the specified category. The minimum level is least severe level at which messages in the
   * specified category should be displayed.
   */
  public static setLevel(category: string, minLevel: LogLevel) {
    Logger._categoryFilter.set(category, minLevel);
  }

  /** Interpret a string as the name of a LogLevel */
  public static ParseLogLevel(str: string): LogLevel {
    switch (str.toUpperCase()) {
      case "EXCEPTION": return LogLevel.Error;
      case "FATAL": return LogLevel.Error;
      case "ERROR": return LogLevel.Error;
      case "WARNING": return LogLevel.Warning;
      case "INFO": return LogLevel.Info;
      case "TRACE": return LogLevel.Trace;
      case "DEBUG": return LogLevel.Trace;
    }
    return LogLevel.None;
  }

  /** Set levels */
  public static configureLevels(cfg: LoggerLevelsConfig) {
    Logger.validateProps(cfg);
    if (cfg.defaultLevel !== undefined) {
      this.setLevelDefault(Logger.ParseLogLevel(cfg.defaultLevel));
    }
    if (cfg.categoryLevels !== undefined) {
      for (const cl of cfg.categoryLevels) {
        this.setLevel(cl.category, Logger.ParseLogLevel(cl.logLevel));
      }
    }
  }

  private static isLogLevel(v: any) {
    return LogLevel.hasOwnProperty(v);
  }

  /** Check that the specified object is a valid LoggerLevelsConfig. This is useful when reading a config from a .json file. */
  public static validateProps(config: any) {
    const validProps = ["defaultLevel", "categoryLevels"];
    for (const prop of Object.keys(config)) {
      if (!validProps.includes(prop))
        throw new BentleyError(IModelStatus.BadArg, "LoggerLevelsConfig - unrecognized property: " + prop);
      if (prop === "defaultLevel") {
        if (!Logger.isLogLevel(config.defaultLevel))
          throw new BentleyError(IModelStatus.BadArg, "LoggerLevelsConfig.defaultLevel must be a LogLevel. Invalid value: " + JSON.stringify(config.defaultLevel));
      } else if (prop === "categoryLevels") {
        const value = config[prop];
        if (!Array.isArray(value))
          throw new BentleyError(IModelStatus.BadArg, "LoggerLevelsConfig.categoryLevels must be an array. Invalid value: " + JSON.stringify(value));
        for (const item of config[prop]) {
          if (!item.hasOwnProperty("category") || !item.hasOwnProperty("logLevel"))
            throw new BentleyError(IModelStatus.BadArg, "LoggerLevelsConfig.categoryLevels - each item must be a LoggerCategoryAndLevel {category: logLevel:}. Invalid value: " + JSON.stringify(item));
          if (!Logger.isLogLevel(item.logLevel))
            throw new BentleyError(IModelStatus.BadArg, "LoggerLevelsConfig.categoryLevels - each item's logLevel property must be a LogLevel. Invalid value: " + JSON.stringify(item.logLevel));
        }
      }
    }
  }

  /** Get the minimum logging level for the specified category. */
  public static getLevel(category: string): LogLevel | undefined {
    // Prefer the level set for this category specifically
    const minLevelForThisCategory = Logger._categoryFilter.get(category);
    if (minLevelForThisCategory !== undefined)
      return minLevelForThisCategory;

    // Fall back on the level set for the parent of this category.
    const parent = category.lastIndexOf(".");
    if ((parent !== undefined) && (parent !== -1))
      return Logger.getLevel(category.slice(0, parent));

    // Fall back on the default level.
    return Logger._minLevel;
  }

  /** Turns off the least severe level at which messages should be displayed by default.
   * This turns off logging for all messages for which no category minimum level is defined.
   */
  public static turnOffLevelDefault(): void {
    Logger._minLevel = undefined;
  }

  /** Turns off all category level filters previously defined with [[Logger.setLevel]].
   */
  public static turnOffCategories(): void {
    Logger._categoryFilter.clear();
  }

  /** Check if messages in the specified category should be displayed at this level of severity. */
  public static isEnabled(category: string, level: LogLevel): boolean {
    const minLevel = Logger.getLevel(category);
    return (minLevel !== undefined) && (level >= minLevel);
  }

  /** Log the specified message to the **error** stream.
   * @param category  The category of the message.
   * @param message  The message.
   * @param metaData  Optional data for the message
   */
  public static logError(category: string, message: string, metaData?: GetMetaDataFunction): void {
    if (Logger._logError && Logger.isEnabled(category, LogLevel.Error))
      Logger._logError(category, message, metaData);
  }

  /** Log the specified message to the **warning** stream.
   * @param category  The category of the message.
   * @param message  The message.
   * @param metaData  Optional data for the message
   */
  public static logWarning(category: string, message: string, metaData?: GetMetaDataFunction): void {
    if (Logger._logWarning && Logger.isEnabled(category, LogLevel.Warning))
      Logger._logWarning(category, message, metaData);
  }

  /** Log the specified message to the **info** stream.
   * @param category  The category of the message.
   * @param message  The message.
   * @param metaData  Optional data for the message
   */
  public static logInfo(category: string, message: string, metaData?: GetMetaDataFunction): void {
    if (Logger._logInfo && Logger.isEnabled(category, LogLevel.Info))
      Logger._logInfo(category, message, metaData);
  }

  /** Log the specified message to the **trace** stream.
   * @param category  The category of the message.
   * @param message  The message.
   * @param metaData  Optional data for the message
   */
  public static logTrace(category: string, message: string, metaData?: GetMetaDataFunction): void {
    if (Logger._logTrace && Logger.isEnabled(category, LogLevel.Trace))
      Logger._logTrace(category, message, metaData);
  }
}

/** Simple performance diagnostics utility.
 * It measures the time from construction to disposal. On disposal it logs the routine name along with
 * the duration in milliseconds.
 * It also logs the routine name at construction time so that nested calls can be disambiguated.
 *
 * The timings are logged using the log category **Performance** and log severity [[LogLevel.INFO]].
 * Enable those, if you want to capture timings.
 */
export class PerfLogger implements IDisposable {
  private static _loggerName: string = "Performance";
  private static _severity: LogLevel = LogLevel.Info;

  private _routine: string;
  private _startTimeStamp: number;

  public constructor(routine: string) {
    this._routine = routine;

    if (!Logger.isEnabled(PerfLogger._loggerName, PerfLogger._severity)) {
      this._startTimeStamp = 0;
      return;
    }

    Logger.logInfo(PerfLogger._loggerName, `${this._routine},START`);
    this._startTimeStamp = new Date().getTime(); // take timestamp
  }

  public dispose(): void {
    const endTimeStamp: number = new Date().getTime();
    if (!Logger.isEnabled(PerfLogger._loggerName, PerfLogger._severity))
      return;

    Logger.logInfo(PerfLogger._loggerName, `${this._routine},END,${endTimeStamp - this._startTimeStamp} ms`);
  }
}

/** Helps with macro-substitution */
export class EnvMacroSubst {
  /** Replace macros delimited by ${} assuming that they refer to environment variables. */
  public static replace(str: string, defaultValues?: any): string {
    let startMacro;
    let startNext = 0;
    // tslint:disable-next-line:no-conditional-assignment
    while ((startMacro = str.indexOf("${", startNext)) !== -1) {
      const endMacro = str.indexOf("}", startMacro + 2);
      if (endMacro === -1) {
        startNext = startMacro + 2;
        continue;
      }
      const envvar = str.slice(startMacro + 2, endMacro);

      let subst = process.env[envvar];

      if (subst === undefined) {
        if ((defaultValues === undefined) || !defaultValues.hasOwnProperty(envvar)) {
          startNext = endMacro + 1;
          continue;
        }
        subst = defaultValues[envvar];
      }
      str = str.slice(0, startMacro) + subst + str.slice(endMacro + 1);
      startNext += startMacro + subst!.length;
    }
    return str;
  }

  /** Check if the string contains ${}, indicating the presence of a macro. */
  public static containsEnvvars(str: string): boolean {
    return str.includes("${") && str.includes("}");
  }

  /** Replace macros delimited by ${} that are found in any of the object's properties */
  public static replaceInProperties(obj: any, recurse: boolean, defaultValues?: any): void {
    for (const prop of Object.keys(obj)) {
      if (typeof obj[prop] === "string") {
        if (EnvMacroSubst.containsEnvvars(obj[prop]))
          obj[prop] = EnvMacroSubst.replace(obj[prop], defaultValues);
      } else if (recurse && (typeof obj[prop] === "object")) {
        EnvMacroSubst.replaceInProperties(obj[prop], true, defaultValues);
      }
    }
  }

  /** Check if the string contains ${}, indicating the presence of a macro. */
  public static anyPropertyContainsEnvvars(obj: any, recurse: boolean): boolean {
    for (const prop of Object.keys(obj)) {
      if (typeof obj[prop] === "string") {
        if (EnvMacroSubst.containsEnvvars(obj[prop]))
          return true;
      } else if (recurse && (typeof obj[prop] === "object")) {
        if (EnvMacroSubst.anyPropertyContainsEnvvars(obj[prop], true))
          return true;
      }
    }
    return false;
  }
}
