/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

export interface GLDisposable {
  dispose(): void;
}

export function usingGL<TResult>(disposable: GLDisposable, func: () => TResult): TResult {
  try {
    return func();
  } finally {
    disposable.dispose();
  }
}
