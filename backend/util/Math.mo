import Float "mo:base/Float";
import Int "mo:base/Int";
import Nat "mo:base/Nat";
import Debug "mo:base/Debug";
import Text "mo:base/Text";

module {
  /// Helper function to calculate 10^n as a Float.
  func pow10(n : Nat) : Float {
    var result : Float = 1.0;
    var i = 0;
    while (i < n) {
      result *= 10.0;
      i += 1;
    };
    result;
  };

  /// Rounds a float to the nearest integer using half-up rounding.
  public func round(value : Float) : Int {
    if (value >= 0.0) {
      Float.toInt(value + 0.5);
    } else {
      Float.toInt(value - 0.5);
    };
  };

  /// Rounds a float to a specified number of decimal places using half-up rounding.
  public func roundToDecimalPlaces(value : Float, decimalPlaces : Nat) : Float {
    let factor = pow10(decimalPlaces);
    if (value >= 0.0) {
      Float.fromInt(Float.toInt(value * factor + 0.5)) / factor;
    } else {
      Float.fromInt(Float.toInt(value * factor - 0.5)) / factor;
    };
  };

  /// Returns the minimum of two floats.
  public func min(a : Float, b : Float) : Float {
    if (a < b) { a } else { b };
  };

  /// Returns the maximum of two floats.
  public func max(a : Float, b : Float) : Float {
    if (a > b) { a } else { b };
  };

  /// Clamps a float value between a minimum and maximum.
  public func clamp(value : Float, minValue : Float, maxValue : Float) : Float {
    if (value < minValue) { minValue } else if (value > maxValue) { maxValue } else {
      value;
    };
  };

  /// Calculates the average of an array of floats.
  public func average(values : [Float]) : Float {
    if (values.size() == 0) {
      Debug.trap("Cannot calculate average of empty array");
    };
    var sum : Float = 0.0;
    for (value in values.vals()) {
      sum += value;
    };
    sum / Float.fromInt(values.size());
  };

  /// Calculates the sum of an array of floats.
  public func sum(values : [Float]) : Float {
    var total : Float = 0.0;
    for (value in values.vals()) {
      total += value;
    };
    total;
  };

  /// Calculates the variance of an array of floats.
  public func variance(values : [Float]) : Float {
    if (values.size() == 0) {
      Debug.trap("Cannot calculate variance of empty array");
    };
    let mean = average(values);
    var sumOfSquares : Float = 0.0;
    for (value in values.vals()) {
      let diff = value - mean;
      sumOfSquares += diff * diff;
    };
    sumOfSquares / Float.fromInt(values.size());
  };

  /// Calculates the standard deviation of an array of floats.
  public func standardDeviation(values : [Float]) : Float {
    Float.sqrt(variance(values));
  };

  /// Converts minutes to seconds.
  public func minutesToSeconds(minutes : Nat) : Nat {
    minutes * 60;
  };

  /// Converts seconds to minutes.
  public func secondsToMinutes(seconds : Nat) : Float {
    Float.fromInt(seconds) / 60.0;
  };

  /// Converts minutes to milliseconds.
  public func minutesToMilliseconds(minutes : Nat) : Nat {
    minutes * 60 * 1000;
  };

  /// Converts milliseconds to minutes.
  public func millisecondsToMinutes(milliseconds : Nat) : Float {
    Float.fromInt(milliseconds) / 60000.0;
  };

  /// Converts seconds to milliseconds.
  public func secondsToMilliseconds(seconds : Nat) : Nat {
    seconds * 1000;
  };

  /// Converts milliseconds to seconds.
  public func millisecondsToSeconds(milliseconds : Nat) : Float {
    Float.fromInt(milliseconds) / 1000.0;
  };

  /// Calculates the percentage of a value relative to a total.
  public func percentage(value : Float, total : Float) : Float {
    if (total == 0.0) {
      Debug.trap("Cannot calculate percentage with total of 0");
    };
    (value / total) * 100.0;
  };

  /// Calculates the difference between two values as a percentage of the first value.
  public func percentageDifference(a : Float, b : Float) : Float {
    if (a == 0.0) {
      Debug.trap("Cannot calculate percentage difference with base value of 0");
    };
    ((b - a) / a) * 100.0;
  };

  /// Converts a float to a percentage string with specified decimal places.
  public func toPercentageString(value : Float, decimalPlaces : Nat) : Text {
    let percentageValue = value * 100.0;
    let roundedValue = roundToDecimalPlaces(percentageValue, decimalPlaces);
    Float.toText(roundedValue) # "%";
  };

  /// Converts a float to a time string in MM:SS format.
  public func toTimeString(value : Float) : Text {
    let totalSeconds = Int.abs(Float.toInt(value * 60.0));
    let minutes = totalSeconds / 60;
    let seconds = totalSeconds % 60;
    Int.toText(minutes) # ":" # (if (seconds < 10) { "0" } else { "" }) # Int.toText(seconds);
  };

  /// Converts a float to a time string in HH:MM:SS format.
  public func toHourTimeString(value : Float) : Text {
    let totalSeconds = Int.abs(Float.toInt(value * 60.0));
    let hours = totalSeconds / 3600;
    let minutes = (totalSeconds % 3600) / 60;
    let seconds = totalSeconds % 60;
    Int.toText(hours) # ":" # (if (minutes < 10) { "0" } else { "" }) # Int.toText(minutes) # ":" # (if (seconds < 10) { "0" } else { "" }) # Int.toText(seconds);
  };

  /// Converts a float to a time string in MM:SS format with leading zeros.
  public func toTimeStringWithLeadingZeros(value : Float) : Text {
    let totalSeconds = Int.abs(Float.toInt(value * 60.0));
    let minutes = totalSeconds / 60;
    let seconds = totalSeconds % 60;
    (if (minutes < 10) { "0" } else { "" }) # Int.toText(minutes) # ":" # (if (seconds < 10) { "0" } else { "" }) # Int.toText(seconds);
  };

  /// Converts a float to a time string in HH:MM:SS format with leading zeros.
  public func toHourTimeStringWithLeadingZeros(value : Float) : Text {
    let totalSeconds = Int.abs(Float.toInt(value * 60.0));
    let hours = totalSeconds / 3600;
    let minutes = (totalSeconds % 3600) / 60;
    let seconds = totalSeconds % 60;
    (if (hours < 10) { "0" } else { "" }) # Int.toText(hours) # ":" # (if (minutes < 10) { "0" } else { "" }) # Int.toText(minutes) # ":" # (if (seconds < 10) { "0" } else { "" }) # Int.toText(seconds);
  };
};
