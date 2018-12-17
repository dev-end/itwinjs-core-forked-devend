/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Collections */

import { CloneFunction, shallowClone, lowerBound } from "./SortedArray";
import { OrderedComparator } from "./Compare";

/**
 * Maintains a mapping of keys to values.
 * Unlike the standard Map<K, V>, a Dictionary<K, V> supports custom comparison logic for keys of object type (and for any other type).
 * The user supplies a key comparison function to the constructor, that must meet the following criteria given 'lhs' and 'rhs' of type K:
 *  - If lhs is equal to rhs, returns 0
 *  - If lhs is less than rhs, returns a negative value
 *  - If lhs is greater than rhs, returns a positive value
 *  - If compare(lhs, rhs) returns 0, then compare(rhs, lhs) must also return 0
 *  - If compare(lhs, rhs) returns a negative value, then compare(rhs, lhs) must return a positive value, and vice versa.
 *
 * Modifying a key in a way that affects the comparison function will produce unpredictable results, the
 * most likely of which is that keys will cease to map to the values with which they were initially inserted.
 */
export class Dictionary<K, V> {
  protected _keys: K[] = [];
  protected readonly _compareKeys: OrderedComparator<K>;
  protected readonly _cloneKey: CloneFunction<K>;
  protected _values: V[] = [];
  protected readonly _cloneValue: CloneFunction<V>;

  /**
   * Construct a new Dictionary<K, V>.
   * @param compareKeys The function used to compare keys within the dictionary.
   * @param cloneKey The function invoked to clone a key for insertion into the dictionary. The default implementation simply returns its input.
   * @param cloneValue The function invoked to clone a value for insertion into the dictionary. The default implementation simply returns its input.
   */
  public constructor(compareKeys: OrderedComparator<K>, cloneKey: CloneFunction<K> = shallowClone, cloneValue: CloneFunction<V> = shallowClone) {
    this._compareKeys = compareKeys;
    this._cloneKey = cloneKey;
    this._cloneValue = cloneValue;
  }

  /** The number of entries in the dictionary. */
  public get length(): number { return this._keys.length; }

  /** Removes all entries from this dictionary */
  public clear(): void {
    this._keys = [];
    this._values = [];
  }

  /**
   * Looks up a value by its key.
   * @param key The key to search for
   * @returns the value associated with the key, or undefined if the key is not present in the dictionary.
   */
  public get(key: K): V | undefined {
    const bound = this.lowerBound(key);
    return bound.equal ? this._values[bound.index] : undefined;
  }

  /**
   * Deletes a value using its key.
   * @param key The key to delete
   * @returns true if the key was found and deleted.
   */
  public delete(key: K): boolean {
    const bound = this.lowerBound(key);
    if (bound.equal) {
      this._values.splice(bound.index, 1);
      this._keys.splice(bound.index, 1);
      return true;
    } else {
      return false;
    }
  }

  /**
   * Attempts to insert a new entry into the dictionary. If an entry with an equivalent key exists, the dictionary is unmodified.
   * If the new entry is in fact inserted, both the key and value will be cloned using the functions supplied to the dictionary's constructor.
   * @param key The key to associate with the value
   * @param value The value to associate with the key
   * @returns true if the new entry was inserted, false if an entry with an equivalent key already exists.
   */
  public insert(key: K, value: V): boolean {
    const bound = this.lowerBound(key);
    if (!bound.equal) {
      this._keys.splice(bound.index, 0, this._cloneKey(key));
      this._values.splice(bound.index, 0, this._cloneValue(value));
    }

    return !bound.equal;
  }

  /**
   * Sets the value associated with the specified key in the dictionary.
   * If no such key already exists, this is equivalent to insert(key, value); otherwise, the existing value associated with the key is replaced.
   * In either case, the value will be cloned using the function supplied to the dictionary's constructor.
   */
  public set(key: K, value: V): void {
    value = this._cloneValue(value);
    const bound = this.lowerBound(key);
    if (bound.equal) {
      this._values[bound.index] = value;
    } else {
      this._keys.splice(bound.index, 0, this._cloneKey(key));
      this._values.splice(bound.index, 0, value);
    }
  }

  /**
   * Extracts the contents of this dictionary as an array of { key, value } pairs, and empties this dictionary.
   * @returns An array of { key, value } pairs sorted by key.
   */
  public extractPairs(): Array<{ key: K, value: V }> {
    const pairs: Array<{ key: K, value: V }> = [];
    for (let i = 0; i < this.length; i++)
      pairs.push({ key: this._keys[i], value: this._values[i] });

    this.clear();
    return pairs;
  }

  /**
   * Extracts the contents of this dictionary as a pair of { keys, values } arrays, and empties this dictionary.
   * The array of keys is sorted according to the comparison criterion.
   * The position of each value in the array of values corresponds the the position of the corresponding key in the array of keys.
   * @returns a pair of { keys, values } arrays in which key[i] corresponds to value[i] in this dictionary and the keys are in sorted order.
   */
  public extractArrays(): { keys: K[], values: V[] } {
    const result = { keys: this._keys, values: this._values };
    this.clear();
    return result;
  }

  /** Apply a function to each (key, value) pair in the dictionary, in sorted order.
   * @param func The function to be applied.
   */
  public forEach(func: (key: K, value: V) => void): void {
    for (let i = 0; i < this.length; i++)
      func(this._keys[i], this._values[i]);
  }

  /**
   * Computes the position at which the specified key should be inserted to maintain sorted order.
   * @param key The key whose position is to be computed.
   * @returns an object with 'index' corresponding to the computed position and 'equal' set to true if an equivalent key already exists at that index.
   */
  protected lowerBound(key: K): { index: number, equal: boolean } { return lowerBound(key, this._keys, this._compareKeys); }
}
