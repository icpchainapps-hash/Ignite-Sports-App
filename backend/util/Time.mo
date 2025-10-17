import Float "mo:base/Float";
import Int "mo:base/Int";
import Nat "mo:base/Nat";
import Debug "mo:base/Debug";

module {
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

  /// Formats a time value in seconds as MM:SS string.
  public func formatTimeMMSS(seconds : Nat) : Text {
    let minutes = seconds / 60;
    let remainingSeconds = seconds % 60;
    Int.toText(minutes) # ":" # (if (remainingSeconds < 10) { "0" } else { "" }) # Int.toText(remainingSeconds);
  };

  /// Formats a time value in seconds as HH:MM:SS string.
  public func formatTimeHHMMSS(seconds : Nat) : Text {
    let hours = seconds / 3600;
    let minutes = (seconds % 3600) / 60;
    let remainingSeconds = seconds % 60;
    Int.toText(hours) # ":" # (if (minutes < 10) { "0" } else { "" }) # Int.toText(minutes) # ":" # (if (remainingSeconds < 10) { "0" } else { "" }) # Int.toText(remainingSeconds);
  };

  /// Formats a time value in seconds as MM:SS string with leading zeros.
  public func formatTimeMMSSWithLeadingZeros(seconds : Nat) : Text {
    let minutes = seconds / 60;
    let remainingSeconds = seconds % 60;
    (if (minutes < 10) { "0" } else { "" }) # Int.toText(minutes) # ":" # (if (remainingSeconds < 10) { "0" } else { "" }) # Int.toText(remainingSeconds);
  };

  /// Formats a time value in seconds as HH:MM:SS string with leading zeros.
  public func formatTimeHHMMSSWithLeadingZeros(seconds : Nat) : Text {
    let hours = seconds / 3600;
    let minutes = (seconds % 3600) / 60;
    let remainingSeconds = seconds % 60;
    (if (hours < 10) { "0" } else { "" }) # Int.toText(hours) # ":" # (if (minutes < 10) { "0" } else { "" }) # Int.toText(minutes) # ":" # (if (remainingSeconds < 10) { "0" } else { "" }) # Int.toText(remainingSeconds);
  };

  /// Parses a time string in MM:SS format to seconds.
  public func parseTimeMMSS(timeString : Text) : Nat {
    let parts = Text.split(timeString, #char ':');
    if (parts.size() != 2) {
      Debug.trap("Invalid time format. Expected MM:SS");
    };
    let minutes = Int.abs(Int.fromText(parts[0]));
    let seconds = Int.abs(Int.fromText(parts[1]));
    (minutes * 60) + seconds;
  };

  /// Parses a time string in HH:MM:SS format to seconds.
  public func parseTimeHHMMSS(timeString : Text) : Nat {
    let parts = Text.split(timeString, #char ':');
    if (parts.size() != 3) {
      Debug.trap("Invalid time format. Expected HH:MM:SS");
    };
    let hours = Int.abs(Int.fromText(parts[0]));
    let minutes = Int.abs(Int.fromText(parts[1]));
    let seconds = Int.abs(Int.fromText(parts[2]));
    (hours * 3600) + (minutes * 60) + seconds;
  };

  /// Converts a float value representing minutes to MM:SS string.
  public func floatToMMSS(value : Float) : Text {
    let totalSeconds = Float.toInt(Float.round(value * 60.0));
    formatTimeMMSS(Int.abs(totalSeconds));
  };

  /// Converts a float value representing minutes to HH:MM:SS string.
  public func floatToHHMMSS(value : Float) : Text {
    let totalSeconds = Float.toInt(Float.round(value * 60.0));
    formatTimeHHMMSS(Int.abs(totalSeconds));
  };

  /// Converts a float value representing minutes to MM:SS string with leading zeros.
  public func floatToMMSSWithLeadingZeros(value : Float) : Text {
    let totalSeconds = Float.toInt(Float.round(value * 60.0));
    formatTimeMMSSWithLeadingZeros(Int.abs(totalSeconds));
  };

  /// Converts a float value representing minutes to HH:MM:SS string with leading zeros.
  public func floatToHHMMSSWithLeadingZeros(value : Float) : Text {
    let totalSeconds = Float.toInt(Float.round(value * 60.0));
    formatTimeHHMMSSWithLeadingZeros(Int.abs(totalSeconds));
  };

  /// Calculates the difference between two time values in seconds.
  public func timeDifferenceInSeconds(startTime : Nat, endTime : Nat) : Nat {
    if (endTime < startTime) {
      Debug.trap("End time cannot be earlier than start time");
    };
    endTime - startTime;
  };

  /// Calculates the total time in seconds from an array of time intervals.
  public func calculateTotalTime(intervals : [(Nat, Nat)]) : Nat {
    var total = 0;
    for (interval in intervals.vals()) {
      if (interval.1 < interval.0) {
        Debug.trap("End time cannot be earlier than start time");
      };
      total += interval.1 - interval.0;
    };
    total;
  };

  /// Converts a time value in seconds to a float representing minutes.
  public func secondsToFloatMinutes(seconds : Nat) : Float {
    Float.fromInt(seconds) / 60.0;
  };

  /// Converts a time value in minutes to a float representing hours.
  public func minutesToFloatHours(minutes : Nat) : Float {
    Float.fromInt(minutes) / 60.0;
  };

  /// Converts a time value in hours to a float representing minutes.
  public func hoursToFloatMinutes(hours : Nat) : Float {
    Float.fromInt(hours) * 60.0;
  };

  /// Converts a time value in hours to a float representing seconds.
  public func hoursToFloatSeconds(hours : Nat) : Float {
    Float.fromInt(hours) * 3600.0;
  };

  /// Converts a time value in minutes to a float representing seconds.
  public func minutesToFloatSeconds(minutes : Nat) : Float {
    Float.fromInt(minutes) * 60.0;
  };

  /// Converts a time value in seconds to a float representing hours.
  public func secondsToFloatHours(seconds : Nat) : Float {
    Float.fromInt(seconds) / 3600.0;
  };
};
