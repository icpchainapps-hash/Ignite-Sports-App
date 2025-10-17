import OrderedMap "mo:base/OrderedMap";
import Text "mo:base/Text";
import Iter "mo:base/Iter";

module Substitutions {
  type SubstitutionSchedule = {
    lineupId : Text;
    substitutions : [Substitution];
    createdAt : Int;
    updatedAt : Int;
  };

  type Substitution = {
    time : Nat;
    fieldPlayerId : Text;
    benchPlayerId : Text;
  };

  /// Stores a substitution schedule.
  public func putSchedule(schedules : OrderedMap.Map<Text, SubstitutionSchedule>, lineupId : Text, schedule : SubstitutionSchedule) : OrderedMap.Map<Text, SubstitutionSchedule> {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    textMap.put(schedules, lineupId, schedule);
  };

  /// Retrieves a substitution schedule by lineup ID.
  public func getSchedule(schedules : OrderedMap.Map<Text, SubstitutionSchedule>, lineupId : Text) : ?SubstitutionSchedule {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    textMap.get(schedules, lineupId);
  };

  /// Deletes a substitution schedule.
  public func deleteSchedule(schedules : OrderedMap.Map<Text, SubstitutionSchedule>, lineupId : Text) : OrderedMap.Map<Text, SubstitutionSchedule> {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    textMap.delete(schedules, lineupId);
  };

  /// Retrieves all substitution schedules.
  public func getAllSchedules(schedules : OrderedMap.Map<Text, SubstitutionSchedule>) : [SubstitutionSchedule] {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    Iter.toArray(textMap.vals(schedules));
  };

  /// Checks if a schedule exists for a given lineup ID.
  public func scheduleExists(schedules : OrderedMap.Map<Text, SubstitutionSchedule>, lineupId : Text) : Bool {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    textMap.contains(schedules, lineupId);
  };

  /// Clears all substitution schedules.
  public func clearAllSchedules() : OrderedMap.Map<Text, SubstitutionSchedule> {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    textMap.empty();
  };
};
