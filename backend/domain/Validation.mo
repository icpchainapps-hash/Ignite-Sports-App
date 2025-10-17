import Text "mo:base/Text";
import Array "mo:base/Array";
import Debug "mo:base/Debug";

module {
  /// Validates that a value exists.
  public func validateExists<T>(value : ?T, errorMessage : Text) : T {
    switch (value) {
      case (null) { Debug.trap(errorMessage) };
      case (?v) { v };
    };
  };

  /// Validates that a user is authorized.
  public func validateAuthorized(isAuthorized : Bool) : () {
    if (not isAuthorized) {
      Debug.trap("Unauthorized: You do not have permission to perform this action.");
    };
  };

  /// Validates input data.
  public func validateInput(isValid : Bool) : () {
    if (not isValid) {
      Debug.trap("Invalid input. Please check your data and try again.");
    };
  };

  /// Validates that a collection is not empty.
  public func validateNotEmpty<T>(collection : [T], errorMessage : Text) : () {
    if (Array.size(collection) == 0) {
      Debug.trap(errorMessage);
    };
  };

  /// Validates that the time per half is within the allowed range.
  public func validateTimePerHalf(time : Nat) : () {
    if (time < 20 or time > 45) {
      Debug.trap("Time per half must be between 20 and 45 minutes.");
    };
  };

  /// Validates that the max simultaneous substitutions are within the allowed range.
  public func validateMaxSimultaneousSubs(maxSubs : Nat) : () {
    if (maxSubs < 1 or maxSubs > 5) {
      Debug.trap("Max simultaneous substitutions must be between 1 and 5.");
    };
  };

  /// Validates that a bench player is eligible for a required position.
  public func validatePositionEligibility(isEligible : Bool, requiredPosition : Text, eligiblePositionsText : Text) : () {
    if (not isEligible) {
      Debug.trap("Bench player is not eligible for this position. Required position: " # requiredPosition # ". Eligible positions: " # eligiblePositionsText);
    };
  };

  /// Validates that substitution intervals are provided.
  public func validateSubstitutionIntervalsProvided(intervals : [Nat]) : () {
    if (Array.size(intervals) == 0) {
      Debug.trap("No substitution intervals provided. Please specify substitution times.");
    };
  };

  /// Validates that minimum required substitution rounds can be calculated.
  public func validateMinRequiredRoundsCalculation(minRounds : Nat) : () {
    if (minRounds == 0) {
      Debug.trap("Minimum required substitution rounds cannot be calculated. Please check your lineup and substitution settings.");
    };
  };

  /// Validates that a fair distribution of bench events can be achieved.
  public func validateFairDistributionAchievable(isAchievable : Bool) : () {
    if (not isAchievable) {
      Debug.trap("Unable to achieve fair distribution of bench events. Please adjust your substitution settings.");
    };
  };

  /// Validates that a value exists.
  public func validateValueExists<T>(value : ?T, errorMessage : Text) : T {
    switch (value) {
      case (null) { Debug.trap(errorMessage) };
      case (?v) { v };
    };
  };

  /// Validates that a role does not already exist in a user profile.
  public func validateRoleNotExistsInProfile(roleExists : Bool) : () {
    if (roleExists) {
      Debug.trap("Role already exists in user profile. Please select a different role.");
    };
  };

  /// Validates that the appAdmin role cannot be removed from a user profile.
  public func validateCannotRemoveAppAdminRole(isAppAdmin : Bool) : () {
    if (isAppAdmin) {
      Debug.trap("Cannot remove appAdmin role from user profile. This role is required for administrative access.");
    };
  };

  /// Validates that a role exists in a user profile.
  public func validateRoleExistsInProfile(roleExists : Bool) : () {
    if (not roleExists) {
      Debug.trap("Role not found in user profile. Please check the role and try again.");
    };
  };

  /// Validates that minimum required substitution rounds are not zero.
  public func validateMinRequiredRoundsNotZero(minRounds : Nat) : () {
    if (minRounds == 0) {
      Debug.trap("Minimum required substitution rounds cannot be zero. Please adjust your substitution settings.");
    };
  };

  /// Validates that a time string is in the expected format.
  public func validateTimeFormat(isValid : Bool, expectedFormat : Text) : () {
    if (not isValid) {
      Debug.trap("Invalid time format. Expected " # expectedFormat);
    };
  };

  /// Validates that the end time is not earlier than the start time.
  public func validateEndTimeNotEarlierThanStart(isValid : Bool) : () {
    if (not isValid) {
      Debug.trap("End time cannot be earlier than start time. Please check your time intervals.");
    };
  };

  /// Validates that an array is not empty when calculating the average.
  public func validateNonEmptyArrayForAverage(isEmpty : Bool) : () {
    if (isEmpty) {
      Debug.trap("Cannot calculate average of empty array. Please provide valid data.");
    };
  };

  /// Validates that the total is not zero when calculating a percentage.
  public func validatePercentageTotalNotZero(isZero : Bool) : () {
    if (isZero) {
      Debug.trap("Cannot calculate percentage with total of 0. Please provide a valid total value.");
    };
  };

  /// Validates that the base value is not zero when calculating a percentage difference.
  public func validatePercentageDifferenceBaseNotZero(isZero : Bool) : () {
    if (isZero) {
      Debug.trap("Cannot calculate percentage difference with base value of 0. Please provide a valid base value.");
    };
  };

  /// Validates that a key exists in a map.
  public func validateKeyExistsInMap(keyExists : Bool) : () {
    if (not keyExists) {
      Debug.trap("Key not found in map. Please check the key and try again.");
    };
  };
};
