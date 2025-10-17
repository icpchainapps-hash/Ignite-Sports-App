import HashMap "mo:base/HashMap";
import Text "mo:base/Text";
import Nat "mo:base/Nat";
import Iter "mo:base/Iter";
import Debug "mo:base/Debug";

module ScheduleRepo {
  type PlayerRole = {
    #goalkeeper;
    #defender;
    #midfielder;
    #forward;
  };

  type PositionEligibility = {
    goalkeeper : Bool;
    defender : Bool;
    midfielder : Bool;
    forward : Bool;
  };

  type Player = {
    id : Text;
    name : Text;
    number : Nat;
    role : PlayerRole;
    position : {
      x : Float;
      y : Float;
    };
    isOnField : Bool;
    positionEligibility : PositionEligibility;
  };

  type Substitution = {
    time : Nat;
    fieldPlayerId : Text;
    benchPlayerId : Text;
  };

  type SubstitutionSchedule = {
    lineupId : Text;
    substitutions : [Substitution];
    createdAt : Int;
    updatedAt : Int;
  };

  transient let textHash = HashMap.Make<Text>(Text.equal, Text.hash);

  /// Creates a new substitution schedule.
  public func createSchedule(lineupId : Text, substitutions : [Substitution]) : SubstitutionSchedule {
    let now = Nat64.toInt(0);
    {
      lineupId;
      substitutions;
      createdAt = now;
      updatedAt = now;
    };
  };

  /// Retrieves a substitution schedule by lineup ID.
  public func getSchedule(schedules : HashMap.HashMap<Text, SubstitutionSchedule>, lineupId : Text) : ?SubstitutionSchedule {
    textHash.get(schedules, lineupId);
  };

  /// Updates an existing substitution schedule.
  public func updateSchedule(schedules : HashMap.HashMap<Text, SubstitutionSchedule>, lineupId : Text, substitutions : [Substitution]) : HashMap.HashMap<Text, SubstitutionSchedule> {
    switch (textHash.get(schedules, lineupId)) {
      case (null) { Debug.trap("Substitution schedule not found") };
      case (?schedule) {
        let updatedSchedule : SubstitutionSchedule = {
          lineupId = schedule.lineupId;
          substitutions;
          createdAt = schedule.createdAt;
          updatedAt = Nat64.toInt(0);
        };
        textHash.put(schedules, lineupId, updatedSchedule);
      };
    };
  };

  /// Deletes a substitution schedule.
  public func deleteSchedule(schedules : HashMap.HashMap<Text, SubstitutionSchedule>, lineupId : Text) : HashMap.HashMap<Text, SubstitutionSchedule> {
    if (not textHash.contains(schedules, lineupId)) {
      Debug.trap("Substitution schedule not found");
    };
    textHash.delete(schedules, lineupId);
  };

  /// Retrieves all substitution schedules.
  public func getAllSchedules(schedules : HashMap.HashMap<Text, SubstitutionSchedule>) : [SubstitutionSchedule] {
    Iter.toArray(textHash.vals(schedules));
  };

  /// Checks if a schedule exists for a given lineup ID.
  public func scheduleExists(schedules : HashMap.HashMap<Text, SubstitutionSchedule>, lineupId : Text) : Bool {
    textHash.contains(schedules, lineupId);
  };

  /// Clears all substitution schedules.
  public func clearAllSchedules() : HashMap.HashMap<Text, SubstitutionSchedule> {
    textHash.empty();
  };
};
