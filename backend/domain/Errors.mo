import Debug "mo:base/Debug";

module {
  /// Traps with a "Lineup not found" error message.
  public func trapLineupNotFound() : None {
    Debug.trap("Lineup not found. Please create or select a valid lineup before generating a schedule.");
  };

  /// Traps with a "Player not found" error message.
  public func trapPlayerNotFound() : None {
    Debug.trap("Player not found. Please check the player ID and try again.");
  };

  /// Traps with an "Unauthorized" error message.
  public func trapUnauthorized() : None {
    Debug.trap("Unauthorized: You do not have permission to perform this action.");
  };

  /// Traps with an "Invalid input" error message.
  public func trapInvalidInput() : None {
    Debug.trap("Invalid input. Please check your data and try again.");
  };

  /// Traps with a "Schedule generation failed" error message.
  public func trapScheduleGenerationFailed() : None {
    Debug.trap("Schedule generation failed. Please check your lineup and try again.");
  };

  /// Traps with a "Substitution schedule not found" error message.
  public func trapSubstitutionScheduleNotFound() : None {
    Debug.trap("Substitution schedule not found. Please create a schedule first.");
  };

  /// Traps with a "No bench players available" error message.
  public func trapNoBenchPlayersAvailable() : None {
    Debug.trap("No bench players available for substitutions. Please add bench players to your lineup.");
  };

  /// Traps with a "No field players available" error message.
  public func trapNoFieldPlayersAvailable() : None {
    Debug.trap("No field players available. Please add field players to your lineup.");
  };

  /// Traps with a "Time per half out of range" error message.
  public func trapTimePerHalfOutOfRange() : None {
    Debug.trap("Time per half must be between 20 and 45 minutes.");
  };

  /// Traps with a "Max simultaneous substitutions out of range" error message.
  public func trapMaxSimultaneousSubsOutOfRange() : None {
    Debug.trap("Max simultaneous substitutions must be between 1 and 5.");
  };

  /// Traps with a "Position eligibility mismatch" error message.
  public func trapPositionEligibilityMismatch(requiredPosition : Text, eligiblePositions : Text) : None {
    Debug.trap("Bench player is not eligible for this position. Required position: " # requiredPosition # ". Eligible positions: " # eligiblePositions);
  };

  /// Traps with a "No substitution intervals provided" error message.
  public func trapNoSubstitutionIntervalsProvided() : None {
    Debug.trap("No substitution intervals provided. Please specify substitution times.");
  };

  /// Traps with a "Minimum required substitution rounds cannot be calculated" error message.
  public func trapMinRequiredRoundsCalculationFailed() : None {
    Debug.trap("Minimum required substitution rounds cannot be calculated. Please check your lineup and substitution settings.");
  };

  /// Traps with a "Unable to achieve fair distribution of bench events" error message.
  public func trapUnableToAchieveFairDistribution() : None {
    Debug.trap("Unable to achieve fair distribution of bench events. Please adjust your substitution settings.");
  };

  /// Traps with a "Stripe configuration not found" error message.
  public func trapStripeConfigNotFound() : None {
    Debug.trap("Stripe configuration not found. Please configure Stripe before proceeding.");
  };

  /// Traps with a "Metrics not found" error message.
  public func trapMetricsNotFound() : None {
    Debug.trap("Metrics not found. Please check the year and month and try again.");
  };

  /// Traps with a "User profile not found" error message.
  public func trapUserProfileNotFound() : None {
    Debug.trap("User profile not found. Please create a profile before proceeding.");
  };

  /// Traps with a "Role already exists in user profile" error message.
  public func trapRoleAlreadyExists() : None {
    Debug.trap("Role already exists in user profile. Please select a different role.");
  };

  /// Traps with a "Cannot remove appAdmin role from user profile" error message.
  public func trapCannotRemoveAppAdminRole() : None {
    Debug.trap("Cannot remove appAdmin role from user profile. This role is required for administrative access.");
  };

  /// Traps with a "Role not found in user profile" error message.
  public func trapRoleNotFoundInProfile() : None {
    Debug.trap("Role not found in user profile. Please check the role and try again.");
  };

  /// Traps with a "No players available in the lineup" error message.
  public func trapNoPlayersInLineup() : None {
    Debug.trap("No players available in the lineup. Please add players before proceeding.");
  };

  /// Traps with a "Minimum required substitution rounds cannot be zero" error message.
  public func trapMinRequiredRoundsZero() : None {
    Debug.trap("Minimum required substitution rounds cannot be zero. Please adjust your substitution settings.");
  };

  /// Traps with a "Invalid time format" error message.
  public func trapInvalidTimeFormat(expectedFormat : Text) : None {
    Debug.trap("Invalid time format. Expected " # expectedFormat);
  };

  /// Traps with a "End time cannot be earlier than start time" error message.
  public func trapEndTimeEarlierThanStart() : None {
    Debug.trap("End time cannot be earlier than start time. Please check your time intervals.");
  };

  /// Traps with a "Cannot calculate average of empty array" error message.
  public func trapEmptyArrayAverage() : None {
    Debug.trap("Cannot calculate average of empty array. Please provide valid data.");
  };

  /// Traps with a "Cannot calculate percentage with total of 0" error message.
  public func trapPercentageTotalZero() : None {
    Debug.trap("Cannot calculate percentage with total of 0. Please provide a valid total value.");
  };

  /// Traps with a "Cannot calculate percentage difference with base value of 0" error message.
  public func trapPercentageDifferenceBaseZero() : None {
    Debug.trap("Cannot calculate percentage difference with base value of 0. Please provide a valid base value.");
  };

  /// Traps with a "Key not found in map" error message.
  public func trapKeyNotFoundInMap() : None {
    Debug.trap("Key not found in map. Please check the key and try again.");
  };
};

