import HashMap "mo:base/HashMap";
import Text "mo:base/Text";
import Nat "mo:base/Nat";
import Iter "mo:base/Iter";
import Debug "mo:base/Debug";

module MetricsRepo {
  type Metrics = {
    clubs : Nat;
    teams : Nat;
    logins : Nat;
    users : Nat;
    revenue : Float;
    year : Nat;
    month : Nat;
  };

  transient let textHash = HashMap.Make<Text>(Text.equal, Text.hash);

  /// Creates new metrics data.
  public func createMetrics(clubs : Nat, teams : Nat, logins : Nat, users : Nat, revenue : Float, year : Nat, month : Nat) : Metrics {
    {
      clubs;
      teams;
      logins;
      users;
      revenue;
      year;
      month;
    };
  };

  /// Retrieves metrics by year and month.
  public func getMetrics(metrics : HashMap.HashMap<Text, Metrics>, year : Nat, month : Nat) : ?Metrics {
    let key = Nat.toText(year) # "-" # Nat.toText(month);
    textHash.get(metrics, key);
  };

  /// Updates existing metrics.
  public func updateMetrics(metrics : HashMap.HashMap<Text, Metrics>, year : Nat, month : Nat, updatedMetrics : Metrics) : HashMap.HashMap<Text, Metrics> {
    let key = Nat.toText(year) # "-" # Nat.toText(month);
    if (not textHash.contains(metrics, key)) {
      Debug.trap("Metrics not found");
    };
    textHash.put(metrics, key, updatedMetrics);
  };

  /// Deletes metrics by year and month.
  public func deleteMetrics(metrics : HashMap.HashMap<Text, Metrics>, year : Nat, month : Nat) : HashMap.HashMap<Text, Metrics> {
    let key = Nat.toText(year) # "-" # Nat.toText(month);
    if (not textHash.contains(metrics, key)) {
      Debug.trap("Metrics not found");
    };
    textHash.delete(metrics, key);
  };

  /// Retrieves all metrics.
  public func getAllMetrics(metrics : HashMap.HashMap<Text, Metrics>) : [Metrics] {
    Iter.toArray(textHash.vals(metrics));
  };

  /// Checks if metrics exist for a given year and month.
  public func metricsExist(metrics : HashMap.HashMap<Text, Metrics>, year : Nat, month : Nat) : Bool {
    let key = Nat.toText(year) # "-" # Nat.toText(month);
    textHash.contains(metrics, key);
  };

  /// Clears all metrics.
  public func clearAllMetrics() : HashMap.HashMap<Text, Metrics> {
    textHash.empty();
  };
};
