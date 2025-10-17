import Array "mo:base/Array";
import Iter "mo:base/Iter";
import OrderedMap "mo:base/OrderedMap";
import Nat "mo:base/Nat";
import Debug "mo:base/Debug";
import Float "mo:base/Float";

module {
  /// Maps an array to a new array using a transformation function.
  public func map<A, B>(array : [A], f : A -> B) : [B] {
    Array.map<A, B>(array, f);
  };

  /// Filters an array based on a predicate function.
  public func filter<A>(array : [A], predicate : A -> Bool) : [A] {
    Array.filter<A>(array, predicate);
  };

  /// Reduces an array to a single value using a reducer function.
  public func reduce<A, B>(array : [A], initial : B, reducer : (B, A) -> B) : B {
    Array.foldLeft<A, B>(array, initial, reducer);
  };

  /// Finds the first element in an array that matches a predicate.
  public func find<A>(array : [A], predicate : A -> Bool) : ?A {
    Array.find<A>(array, predicate);
  };

  /// Checks if an array contains a value using a custom equality function.
  public func contains<A>(array : [A], value : A, equals : (A, A) -> Bool) : Bool {
    for (item in array.vals()) {
      if (equals(item, value)) {
        return true;
      };
    };
    false;
  };

  /// Flattens an array of arrays into a single array.
  public func flatten<A>(arrayOfArrays : [[A]]) : [A] {
    var result : [A] = [];
    for (array in arrayOfArrays.vals()) {
      result := Array.append(result, array);
    };
    result;
  };

  /// Maps and flattens an array using a transformation function.
  public func flatMap<A, B>(array : [A], f : A -> [B]) : [B] {
    var result : [B] = [];
    for (item in array.vals()) {
      result := Array.append(result, f(item));
    };
    result;
  };

  /// Returns the first n elements of an array.
  public func take<A>(array : [A], n : Nat) : [A] {
    if (n >= array.size()) {
      return array;
    };
    Array.tabulate<A>(n, func(i) { array[i] });
  };

  /// Drops the first n elements of an array.
  public func drop<A>(array : [A], n : Nat) : [A] {
    if (n >= array.size()) {
      return [];
    };
    Array.tabulate<A>(array.size() - n, func(i) { array[n + i] });
  };

  /// Returns a slice of an array from start (inclusive) to end (exclusive).
  public func slice<A>(array : [A], start : Nat, end : Nat) : [A] {
    if (start >= array.size() or end > array.size() or start >= end) {
      return [];
    };
    Array.tabulate<A>(end - start, func(i) { array[start + i] });
  };

  /// Reverses an array.
  public func reverse<A>(array : [A]) : [A] {
    Array.reverse<A>(array);
  };

  /// Sorts an array using a comparison function.
  public func sort<A>(array : [A], compare : (A, A) -> { #less; #equal; #greater }) : [A] {
    Array.sort<A>(array, compare);
  };

  /// Finds the index of the first element that matches a predicate.
  public func findIndex<A>(array : [A], predicate : A -> Bool) : ?Nat {
    var i = 0;
    for (item in array.vals()) {
      if (predicate(item)) {
        return ?i;
      };
      i += 1;
    };
    null;
  };

  /// Finds the index of the first occurrence of a value using a custom equality function.
  public func indexOf<A>(array : [A], value : A, equals : (A, A) -> Bool) : ?Nat {
    var i = 0;
    for (item in array.vals()) {
      if (equals(item, value)) {
        return ?i;
      };
      i += 1;
    };
    null;
  };

  /// Checks if all elements in an array satisfy a predicate.
  public func all<A>(array : [A], predicate : A -> Bool) : Bool {
    for (item in array.vals()) {
      if (not predicate(item)) {
        return false;
      };
    };
    true;
  };

  /// Checks if any element in an array satisfies a predicate.
  public func any<A>(array : [A], predicate : A -> Bool) : Bool {
    for (item in array.vals()) {
      if (predicate(item)) {
        return true;
      };
    };
    false;
  };

  /// Finds the minimum value in an array using a comparison function.
  public func min<A>(array : [A], compare : (A, A) -> { #less; #equal; #greater }) : ?A {
    if (array.size() == 0) {
      return null;
    };
    var minValue = array[0];
    for (item in array.vals()) {
      if (compare(item, minValue) == #less) {
        minValue := item;
      };
    };
    ?minValue;
  };

  /// Finds the maximum value in an array using a comparison function.
  public func max<A>(array : [A], compare : (A, A) -> { #less; #equal; #greater }) : ?A {
    if (array.size() == 0) {
      return null;
    };
    var maxValue = array[0];
    for (item in array.vals()) {
      if (compare(item, maxValue) == #greater) {
        maxValue := item;
      };
    };
    ?maxValue;
  };

  /// Sums the values in an array using a sum function.
  public func sum<A, B>(array : [A], sumFunc : (B, A) -> B, initial : B) : B {
    var result = initial;
    for (item in array.vals()) {
      result := sumFunc(result, item);
    };
    result;
  };

  /// Calculates the average of an array of floats.
  public func average(array : [Float]) : Float {
    if (array.size() == 0) {
      Debug.trap("Cannot calculate average of empty array");
    };
    var sum : Float = 0.0;
    for (value in array.vals()) {
      sum += value;
    };
    sum / Float.fromInt(array.size());
  };

  /// Groups an array into a map based on a key function.
  public func groupBy<A, K>(array : [A], keyFunc : A -> K, compare : (K, K) -> { #less; #equal; #greater }) : OrderedMap.Map<K, [A]> {
    let map = OrderedMap.Make<K>(compare);
    var result = map.empty<[A]>();
    for (item in array.vals()) {
      let key = keyFunc(item);
      let existing = switch (map.get(result, key)) {
        case (null) { [] };
        case (?items) { items };
      };
      result := map.put(result, key, Array.append(existing, [item]));
    };
    result;
  };

  /// Flattens a map of arrays into a single array.
  public func flattenMap<K, V>(map : OrderedMap.Map<K, [V]>, compare : (K, K) -> { #less; #equal; #greater }) : [V] {
    let orderedMap = OrderedMap.Make<K>(compare);
    var result : [V] = [];
    for (array in orderedMap.vals(map)) {
      result := Array.append(result, array);
    };
    result;
  };

  /// Looks up a value in a map with error handling.
  public func lookup<K, V>(map : OrderedMap.Map<K, V>, key : K, compare : (K, K) -> { #less; #equal; #greater }) : V {
    let orderedMap = OrderedMap.Make<K>(compare);
    switch (orderedMap.get(map, key)) {
      case (null) {
        Debug.trap("Key not found in map");
      };
      case (?value) { value };
    };
  };

  /// Checks if a map contains a key.
  public func containsKey<K, V>(map : OrderedMap.Map<K, V>, key : K, compare : (K, K) -> { #less; #equal; #greater }) : Bool {
    let orderedMap = OrderedMap.Make<K>(compare);
    orderedMap.contains(map, key);
  };

  /// Returns the size of a map.
  public func mapSize<K, V>(map : OrderedMap.Map<K, V>, compare : (K, K) -> { #less; #equal; #greater }) : Nat {
    let orderedMap = OrderedMap.Make<K>(compare);
    orderedMap.size(map);
  };

  /// Converts a map to an array of key-value pairs.
  public func mapToArray<K, V>(map : OrderedMap.Map<K, V>, compare : (K, K) -> { #less; #equal; #greater }) : [(K, V)] {
    let orderedMap = OrderedMap.Make<K>(compare);
    Iter.toArray(orderedMap.entries(map));
  };

  /// Converts an array of key-value pairs to a map.
  public func arrayToMap<K, V>(array : [(K, V)], compare : (K, K) -> { #less; #equal; #greater }) : OrderedMap.Map<K, V> {
    let map = OrderedMap.Make<K>(compare);
    var result = map.empty<V>();
    for ((key, value) in array.vals()) {
      result := map.put(result, key, value);
    };
    result;
  };

  /// Merges two maps into one.
  public func mergeMaps<K, V>(map1 : OrderedMap.Map<K, V>, map2 : OrderedMap.Map<K, V>, compare : (K, K) -> { #less; #equal; #greater }) : OrderedMap.Map<K, V> {
    let map = OrderedMap.Make<K>(compare);
    var result = map1;
    for ((key, value) in map.entries(map2)) {
      result := map.put(result, key, value);
    };
    result;
  };

  /// Returns the keys of a map as an array.
  public func mapKeys<K, V>(map : OrderedMap.Map<K, V>, compare : (K, K) -> { #less; #equal; #greater }) : [K] {
    let orderedMap = OrderedMap.Make<K>(compare);
    Iter.toArray(orderedMap.keys(map));
  };

  /// Returns the values of a map as an array.
  public func mapValues<K, V>(map : OrderedMap.Map<K, V>, compare : (K, K) -> { #less; #equal; #greater }) : [V] {
    let orderedMap = OrderedMap.Make<K>(compare);
    Iter.toArray(orderedMap.vals(map));
  };

  /// Finds the first value in a map that matches a predicate.
  public func findInMap<K, V>(map : OrderedMap.Map<K, V>, predicate : V -> Bool, compare : (K, K) -> { #less; #equal; #greater }) : ?V {
    let orderedMap = OrderedMap.Make<K>(compare);
    for (value in orderedMap.vals(map)) {
      if (predicate(value)) {
        return ?value;
      };
    };
    null;
  };

  /// Finds the first key-value pair in a map that matches a predicate.
  public func findEntryInMap<K, V>(map : OrderedMap.Map<K, V>, predicate : (K, V) -> Bool, compare : (K, K) -> { #less; #equal; #greater }) : ?(K, V) {
    let orderedMap = OrderedMap.Make<K>(compare);
    for (entry in orderedMap.entries(map)) {
      if (predicate(entry.0, entry.1)) {
        return ?entry;
      };
    };
    null;
  };

  /// Updates a value in a map using an update function.
  public func updateInMap<K, V>(map : OrderedMap.Map<K, V>, key : K, updateFunc : V -> V, compare : (K, K) -> { #less; #equal; #greater }) : OrderedMap.Map<K, V> {
    let orderedMap = OrderedMap.Make<K>(compare);
    switch (orderedMap.get(map, key)) {
      case (null) {
        Debug.trap("Key not found in map");
      };
      case (?value) {
        orderedMap.put(map, key, updateFunc(value));
      };
    };
  };

  /// Removes a key from a map.
  public func removeFromMap<K, V>(map : OrderedMap.Map<K, V>, key : K, compare : (K, K) -> { #less; #equal; #greater }) : OrderedMap.Map<K, V> {
    let orderedMap = OrderedMap.Make<K>(compare);
    orderedMap.delete(map, key);
  };

  /// Clears a map.
  public func clearMap<K, V>(_ : OrderedMap.Map<K, V>, compare : (K, K) -> { #less; #equal; #greater }) : OrderedMap.Map<K, V> {
    let orderedMap = OrderedMap.Make<K>(compare);
    orderedMap.empty();
  };

  /// Returns the first n entries of a map as an array.
  public func takeFromMap<K, V>(map : OrderedMap.Map<K, V>, n : Nat, compare : (K, K) -> { #less; #equal; #greater }) : [(K, V)] {
    let orderedMap = OrderedMap.Make<K>(compare);
    let entries = Iter.toArray(orderedMap.entries(map));
    if (n >= entries.size()) {
      return entries;
    };
    Array.tabulate<(K, V)>(n, func(i) { entries[i] });
  };

  /// Drops the first n entries of a map and returns the remaining entries as an array.
  public func dropFromMap<K, V>(map : OrderedMap.Map<K, V>, n : Nat, compare : (K, K) -> { #less; #equal; #greater }) : [(K, V)] {
    let orderedMap = OrderedMap.Make<K>(compare);
    let entries = Iter.toArray(orderedMap.entries(map));
    if (n >= entries.size()) {
      return [];
    };
    Array.tabulate<(K, V)>(entries.size() - n, func(i) { entries[n + i] });
  };

  /// Returns a slice of a map's entries as an array.
  public func sliceMap<K, V>(map : OrderedMap.Map<K, V>, start : Nat, end : Nat, compare : (K, K) -> { #less; #equal; #greater }) : [(K, V)] {
    let orderedMap = OrderedMap.Make<K>(compare);
    let entries = Iter.toArray(orderedMap.entries(map));
    if (start >= entries.size() or end > entries.size() or start >= end) {
      return [];
    };
    Array.tabulate<(K, V)>(end - start, func(i) { entries[start + i] });
  };

  /// Reverses the entries of a map and returns them as an array.
  public func reverseMap<K, V>(map : OrderedMap.Map<K, V>, compare : (K, K) -> { #less; #equal; #greater }) : [(K, V)] {
    let orderedMap = OrderedMap.Make<K>(compare);
    Array.reverse<(K, V)>(Iter.toArray(orderedMap.entries(map)));
  };

  /// Sorts the entries of a map and returns them as an array.
  public func sortMap<K, V>(map : OrderedMap.Map<K, V>, compare : (K, K) -> { #less; #equal; #greater }, entryCompare : ((K, V), (K, V)) -> { #less; #equal; #greater }) : [(K, V)] {
    let orderedMap = OrderedMap.Make<K>(compare);
    Array.sort<(K, V)>(Iter.toArray(orderedMap.entries(map)), entryCompare);
  };

  /// Finds the index of the first entry in a map that matches a predicate.
  public func findIndexInMap<K, V>(map : OrderedMap.Map<K, V>, predicate : (K, V) -> Bool, compare : (K, K) -> { #less; #equal; #greater }) : ?Nat {
    let orderedMap = OrderedMap.Make<K>(compare);
    let entries = Iter.toArray(orderedMap.entries(map));
    var i = 0;
    for (entry in entries.vals()) {
      if (predicate(entry.0, entry.1)) {
        return ?i;
      };
      i += 1;
    };
    null;
  };

  /// Checks if all entries in a map satisfy a predicate.
  public func allInMap<K, V>(map : OrderedMap.Map<K, V>, predicate : (K, V) -> Bool, compare : (K, K) -> { #less; #equal; #greater }) : Bool {
    let orderedMap = OrderedMap.Make<K>(compare);
    for (entry in orderedMap.entries(map)) {
      if (not predicate(entry.0, entry.1)) {
        return false;
      };
    };
    true;
  };

  /// Checks if any entry in a map satisfies a predicate.
  public func anyInMap<K, V>(map : OrderedMap.Map<K, V>, predicate : (K, V) -> Bool, compare : (K, K) -> { #less; #equal; #greater }) : Bool {
    let orderedMap = OrderedMap.Make<K>(compare);
    for (entry in orderedMap.entries(map)) {
      if (predicate(entry.0, entry.1)) {
        return true;
      };
    };
    false;
  };

  /// Finds the minimum entry in a map using a comparison function.
  public func minInMap<K, V>(map : OrderedMap.Map<K, V>, compare : (K, K) -> { #less; #equal; #greater }, entryCompare : ((K, V), (K, V)) -> { #less; #equal; #greater }) : ?(K, V) {
    let orderedMap = OrderedMap.Make<K>(compare);
    let entries = Iter.toArray(orderedMap.entries(map));
    if (entries.size() == 0) {
      return null;
    };
    var minValue = entries[0];
    for (entry in entries.vals()) {
      if (entryCompare(entry, minValue) == #less) {
        minValue := entry;
      };
    };
    ?minValue;
  };

  /// Finds the maximum entry in a map using a comparison function.
  public func maxInMap<K, V>(map : OrderedMap.Map<K, V>, compare : (K, K) -> { #less; #equal; #greater }, entryCompare : ((K, V), (K, V)) -> { #less; #equal; #greater }) : ?(K, V) {
    let orderedMap = OrderedMap.Make<K>(compare);
    let entries = Iter.toArray(orderedMap.entries(map));
    if (entries.size() == 0) {
      return null;
    };
    var maxValue = entries[0];
    for (entry in entries.vals()) {
      if (entryCompare(entry, maxValue) == #greater) {
        maxValue := entry;
      };
    };
    ?maxValue;
  };
};

