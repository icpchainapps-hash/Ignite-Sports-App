import OrderedMap "mo:base/OrderedMap";
import Text "mo:base/Text";
import Iter "mo:base/Iter";
import Nat "mo:base/Nat";
import Int "mo:base/Int";
import Time "mo:base/Time";
import Principal "mo:base/Principal";
import Types "../domain/Types";

module MetricsService {
  type Metrics = Types.Metrics;

  public type MetricsRepo = {
    metrics : OrderedMap.Map<Text, Metrics>;
  };

  public func init() : MetricsRepo {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    {
      metrics = textMap.empty<Metrics>();
    };
  };

  public func add(repo : MetricsRepo, _ : Principal, m : Metrics) : MetricsRepo {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    let key = Nat.toText(m.year) # "-" # Nat.toText(m.month);
    {
      metrics = textMap.put(repo.metrics, key, m);
    };
  };

  public func get(repo : MetricsRepo, year : Nat, month : Nat) : ?Metrics {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    let key = Nat.toText(year) # "-" # Nat.toText(month);
    textMap.get(repo.metrics, key);
  };

  public func all(repo : MetricsRepo) : [Metrics] {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    Iter.toArray(textMap.vals(repo.metrics));
  };

  public func update(repo : MetricsRepo, _ : Principal, year : Nat, month : Nat, m : Metrics) : MetricsRepo {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    let key = Nat.toText(year) # "-" # Nat.toText(month);
    {
      metrics = textMap.put(repo.metrics, key, m);
    };
  };

  public func remove(repo : MetricsRepo, _ : Principal, year : Nat, month : Nat) : MetricsRepo {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    let key = Nat.toText(year) # "-" # Nat.toText(month);
    {
      metrics = textMap.delete(repo.metrics, key);
    };
  };

  public func trackLogin(repo : MetricsRepo) : MetricsRepo {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    let now = Time.now();
    let year = Int.abs(now / 1_000_000_000 / 60 / 60 / 24 / 365) + 1970;
    let month = Int.abs(now / 1_000_000_000 / 60 / 60 / 24 / 30) % 12 + 1;
    let key = Nat.toText(year) # "-" # Nat.toText(month);

    switch (textMap.get(repo.metrics, key)) {
      case (null) {
        let newMetrics : Metrics = {
          clubs = 0;
          teams = 0;
          logins = 1;
          users = 0;
          revenue = 0.0;
          year;
          month;
        };
        {
          metrics = textMap.put(repo.metrics, key, newMetrics);
        };
      };
      case (?existingMetrics) {
        let updatedMetrics : Metrics = {
          clubs = existingMetrics.clubs;
          teams = existingMetrics.teams;
          logins = existingMetrics.logins + 1;
          users = existingMetrics.users;
          revenue = existingMetrics.revenue;
          year = existingMetrics.year;
          month = existingMetrics.month;
        };
        {
          metrics = textMap.put(repo.metrics, key, updatedMetrics);
        };
      };
    };
  };
};

