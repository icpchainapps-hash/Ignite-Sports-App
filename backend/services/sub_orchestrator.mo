import OrderedMap "mo:base/OrderedMap";
import Text "mo:base/Text";
import Array "mo:base/Array";
import Int "mo:base/Int";
import Float "mo:base/Float";
import List "mo:base/List";
import Types "../domain/Types";
import Collections "../util/Collections";
import Errors "../domain/Errors";
import Validation "../domain/Validation";

module SubsOrchestrator {
  type PlayerRole = Types.PlayerRole;
  type Player = Types.Player;
  type Lineup = Types.Lineup;
  type Substitution = Types.Substitution;
  type SubstitutionSchedule = Types.SubstitutionSchedule;
  type MinSubRoundsResult = Types.MinSubRoundsResult;
  type PlayerGameTime = Types.PlayerGameTime;
  type BenchEventCount = Types.BenchEventCount;
  type FairnessMetrics = Types.FairnessMetrics;

  public func computeMinSubRounds(
    totalPlayers : Nat,
    onField : Nat,
    gameMinutes : Nat,
    maxSubsPerRound : Nat,
    targetMinutesPerPlayer : ?Float,
    lockedOnFieldCount : ?Nat,
    lockedOffFieldCount : ?Nat,
  ) : MinSubRoundsResult {
    let lockedOn = switch (lockedOnFieldCount) {
      case (null) { 0 };
      case (?count) { count };
    };

    let lockedOff = switch (lockedOffFieldCount) {
      case (null) { 0 };
      case (?count) { count };
    };

    let benchSize = if (totalPlayers > onField) { totalPlayers - onField } else { 0 };
    let totalFieldMinutes = gameMinutes * onField;
    let totalBenchMinutes = gameMinutes * benchSize;
    let targetMinutes = switch (targetMinutesPerPlayer) {
      case (null) {
        if (totalPlayers != 0) {
          Float.fromInt(gameMinutes) * Float.fromInt(onField) / Float.fromInt(totalPlayers);
        } else { 0.0 };
      };
      case (?minutes) { minutes };
    };

    // Calculate minimum rounds based on total players and maxSubsPerRound
    let minRounds = if (maxSubsPerRound != 0) {
      if (totalPlayers != 0) {
        if (totalPlayers > maxSubsPerRound) {
          Int.abs(Float.toInt(Float.fromInt(totalPlayers) / Float.fromInt(maxSubsPerRound)));
        } else { 1 };
      } else { 0 };
    } else { 0 };

    let minStintMinutes = if (minRounds != 0) {
      Float.fromInt(gameMinutes) / Float.fromInt(minRounds);
    } else { 0.0 };

    var isFeasible = true;
    var errorMessage : ?Text = null;

    if (totalPlayers < onField) {
      isFeasible := false;
      errorMessage := ?"Total players cannot be less than on-field players";
    } else if (onField == 0) {
      isFeasible := false;
      errorMessage := ?"Number of on-field players must be greater than 0";
    } else if (gameMinutes == 0) {
      isFeasible := false;
      errorMessage := ?"Game minutes must be greater than 0";
    } else if (maxSubsPerRound == 0) {
      isFeasible := false;
      errorMessage := ?"Max substitutions per round must be greater than 0";
    } else if (lockedOn > onField) {
      isFeasible := false;
      errorMessage := ?"Locked on-field players cannot exceed total on-field players";
    } else if (lockedOff > benchSize) {
      isFeasible := false;
      errorMessage := ?"Locked off-field players cannot exceed bench size";
    } else if (benchSize != 0 and minRounds == 0) {
      isFeasible := false;
      errorMessage := ?"Minimum rounds cannot be 0 when bench size is greater than 0";
    } else if (minStintMinutes > Float.fromInt(gameMinutes)) {
      isFeasible := false;
      errorMessage := ?"Minimum stint minutes cannot exceed game minutes";
    };

    let result : MinSubRoundsResult = {
      R = minRounds;
      stintMinutes = minStintMinutes;
      details = {
        totalPlayers;
        onField;
        gameMinutes;
        maxSubsPerRound;
        targetMinutesPerPlayer = targetMinutes;
        lockedOnFieldCount = lockedOn;
        lockedOffFieldCount = lockedOff;
        benchSize;
        totalFieldMinutes;
        totalBenchMinutes;
        minRounds;
        minStintMinutes;
        isFeasible;
        errorMessage;
      };
    };

    result;
  };

  public func generateStrictFifoRotationSchedule(
    lineupId : Text,
    substitutionIntervals : [Nat],
    lineups : OrderedMap.Map<Text, Lineup>,
    maxSimultaneousSubs : Nat,
    substitutionSchedules : OrderedMap.Map<Text, SubstitutionSchedule>,
    putSchedule : (OrderedMap.Map<Text, SubstitutionSchedule>, Text, SubstitutionSchedule) -> OrderedMap.Map<Text, SubstitutionSchedule>,
  ) : SubstitutionSchedule {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    switch (textMap.get(lineups, lineupId)) {
      case (null) { Errors.trapLineupNotFound() };
      case (?lineup) {
        let benchPlayers = Collections.filter<Player>(
          lineup.players,
          func(p) { not p.isOnField },
        );

        let fieldPlayers = Collections.filter<Player>(
          lineup.players,
          func(p) { p.isOnField },
        );

        let numBenchPlayers = Array.size(benchPlayers);
        let numFieldPlayers = Array.size(fieldPlayers);

        Validation.validateNotEmpty(benchPlayers, "No bench players available for substitutions. Please add bench players to your lineup.");
        Validation.validateNotEmpty(fieldPlayers, "No field players available. Please add field players to your lineup.");
        Validation.validateSubstitutionIntervalsProvided(substitutionIntervals);

        // Initialize FIFO queue with current bench players
        var fifoQueue = List.fromArray<Player>(benchPlayers);

        var substitutions : [Substitution] = [];
        var round = 0;

        while (round < Array.size(substitutionIntervals)) {
          let currentTime = substitutionIntervals[round];
          var subCount = 0;

          // Perform substitutions using FIFO queue
          var i = 0;
          while (i < maxSimultaneousSubs and i < numBenchPlayers and i < numFieldPlayers) {
            let fieldPlayer = fieldPlayers[i];

            // Dequeue next bench player from FIFO queue
            let (maybeBenchPlayer, newQueue) = List.pop(fifoQueue);
            switch (maybeBenchPlayer) {
              case (null) { Errors.trapNoBenchPlayersAvailable() };
              case (?benchPlayer) {
                fifoQueue := newQueue;

                let substitution : Substitution = {
                  time = currentTime;
                  fieldPlayerId = fieldPlayer.id;
                  benchPlayerId = benchPlayer.id;
                };

                substitutions := Array.append(substitutions, [substitution]);

                // Enqueue field player to end of FIFO queue
                fifoQueue := List.push(fieldPlayer, fifoQueue);

                subCount += 1;
                i += 1;
              };
            };
          };

          round += 1;
        };

        let now = Int.abs(0);
        let schedule : SubstitutionSchedule = {
          lineupId;
          substitutions;
          createdAt = now;
          updatedAt = now;
        };

        ignore putSchedule(substitutionSchedules, lineupId, schedule);
        schedule;
      };
    };
  };

  public func calculateProjectedGameTime(
    lineupId : Text,
    _substitutionIntervals : [Nat],
    lineups : OrderedMap.Map<Text, Lineup>,
    timePerHalf : Nat,
    substitutionSchedules : OrderedMap.Map<Text, SubstitutionSchedule>,
    getSchedule : (OrderedMap.Map<Text, SubstitutionSchedule>, Text) -> ?SubstitutionSchedule,
  ) : [PlayerGameTime] {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    switch (textMap.get(lineups, lineupId)) {
      case (null) { Errors.trapLineupNotFound() };
      case (?lineup) {
        let totalMatchTime = timePerHalf * 2;
        let substitutions = switch (getSchedule(substitutionSchedules, lineupId)) {
          case (null) { [] };
          case (?schedule) { schedule.substitutions };
        };

        var playerGameTimeMap = textMap.empty<PlayerGameTime>();

        for (player in lineup.players.vals()) {
          var totalMinutes : Float = 0.0;
          var onFieldIntervals : [(Nat, Nat)] = [];
          var isOnField = player.isOnField;
          var lastSubTime : Nat = 0;
          var totalOffFieldTime : Float = 0.0;
          var benchEventCount = 0;

          for (sub in substitutions.vals()) {
            if (isOnField and sub.fieldPlayerId == player.id) {
              let interval = (lastSubTime, sub.time);
              onFieldIntervals := Array.append(onFieldIntervals, [interval]);
              totalMinutes += Float.fromInt(sub.time - lastSubTime);
              isOnField := false;
              lastSubTime := sub.time;
              benchEventCount += 1;
            } else if (not isOnField and sub.benchPlayerId == player.id) {
              totalOffFieldTime += Float.fromInt(sub.time - lastSubTime);
              lastSubTime := sub.time;
              isOnField := true;
            };
          };

          if (isOnField) {
            let interval = (lastSubTime, totalMatchTime);
            onFieldIntervals := Array.append(onFieldIntervals, [interval]);
            totalMinutes += Float.fromInt(totalMatchTime - lastSubTime);
          } else {
            totalOffFieldTime += Float.fromInt(totalMatchTime - lastSubTime);
          };

          let playerGameTime : PlayerGameTime = {
            playerId = player.id;
            playerName = player.name;
            totalMinutes;
            onFieldIntervals;
            totalIntervals = Array.size(onFieldIntervals);
            isOnField = player.isOnField;
            totalOffFieldTime;
            benchEventCount;
          };

          playerGameTimeMap := textMap.put(playerGameTimeMap, player.id, playerGameTime);
        };

        let result = Collections.map<Player, PlayerGameTime>(
          lineup.players,
          func(p) {
            switch (textMap.get(playerGameTimeMap, p.id)) {
              case (null) {
                {
                  playerId = p.id;
                  playerName = p.name;
                  totalMinutes = 0.0;
                  onFieldIntervals = [];
                  totalIntervals = 0;
                  isOnField = p.isOnField;
                  totalOffFieldTime = 0.0;
                  benchEventCount = 0;
                };
              };
              case (?gameTime) { gameTime };
            };
          },
        );
        result;
      };
    };
  };

  public func countBenchEvents(
    lineupId : Text,
    lineups : OrderedMap.Map<Text, Lineup>,
    substitutionSchedules : OrderedMap.Map<Text, SubstitutionSchedule>,
    getSchedule : (OrderedMap.Map<Text, SubstitutionSchedule>, Text) -> ?SubstitutionSchedule,
  ) : [BenchEventCount] {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    switch (textMap.get(lineups, lineupId)) {
      case (null) { Errors.trapLineupNotFound() };
      case (?lineup) {
        let substitutions = switch (getSchedule(substitutionSchedules, lineupId)) {
          case (null) { [] };
          case (?schedule) { schedule.substitutions };
        };

        var benchEventMap = textMap.empty<Nat>();

        for (player in lineup.players.vals()) {
          var benchEvents = 0;

          for (sub in substitutions.vals()) {
            if (sub.fieldPlayerId == player.id) {
              benchEvents += 1;
            };
          };

          benchEventMap := textMap.put(benchEventMap, player.id, benchEvents);
        };

        let result = Collections.map<Player, BenchEventCount>(
          lineup.players,
          func(p) {
            let benchEvents = switch (textMap.get(benchEventMap, p.id)) {
              case (null) { 0 };
              case (?count) { count };
            };
            {
              playerId = p.id;
              playerName = p.name;
              benchEvents;
            };
          },
        );
        result;
      };
    };
  };

  public func adjustSubsPerRoundForFairness(
    lineupId : Text,
    initialSubsPerRound : Nat,
    lineups : OrderedMap.Map<Text, Lineup>,
  ) : Nat {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    switch (textMap.get(lineups, lineupId)) {
      case (null) { Errors.trapLineupNotFound() };
      case (?lineup) {
        let totalPlayers = Array.size(lineup.players);
        if (totalPlayers == 0) {
          Errors.trapNoPlayersInLineup();
        };

        var currentSubsPerRound = initialSubsPerRound;
        var isFair = false;

        while (currentSubsPerRound != 0 and not isFair) {
          let minRounds = if (currentSubsPerRound != 0) {
            if (totalPlayers != 0) {
              Int.abs(Float.toInt(Float.fromInt(totalPlayers) / Float.fromInt(currentSubsPerRound)));
            } else { 0 };
          } else { 0 };

          var maxBenchEvents = 0;
          var minBenchEvents = 9999;

          for (player in lineup.players.vals()) {
            var benchEvents = 0;
            var i = 0;
            while (i < minRounds) {
              if (i % currentSubsPerRound == 0) {
                benchEvents += 1;
              };
              i += 1;
            };
            if (benchEvents > maxBenchEvents) {
              maxBenchEvents := benchEvents;
            };
            if (benchEvents < minBenchEvents) {
              minBenchEvents := benchEvents;
            };
          };

          if (maxBenchEvents - minBenchEvents <= 1) {
            isFair := true;
          } else {
            currentSubsPerRound -= 1;
          };
        };

        if (currentSubsPerRound == 0) {
          Errors.trapUnableToAchieveFairDistribution();
        };

        currentSubsPerRound;
      };
    };
  };

  public func calculateFairnessMetrics(
    lineupId : Text,
    lineups : OrderedMap.Map<Text, Lineup>,
    timePerHalf : Nat,
    substitutionSchedules : OrderedMap.Map<Text, SubstitutionSchedule>,
    getSchedule : (OrderedMap.Map<Text, SubstitutionSchedule>, Text) -> ?SubstitutionSchedule,
  ) : [FairnessMetrics] {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    switch (textMap.get(lineups, lineupId)) {
      case (null) { Errors.trapLineupNotFound() };
      case (?lineup) {
        let totalMatchTime = timePerHalf * 2;
        let substitutions = switch (getSchedule(substitutionSchedules, lineupId)) {
          case (null) { [] };
          case (?schedule) { schedule.substitutions };
        };

        // Calculate target bench counts
        let numBenchPlayers = Array.size(Collections.filter<Player>(lineup.players, func(p) { not p.isOnField }));
        let intervals = if (numBenchPlayers != 0) { substitutions.size() / numBenchPlayers } else { 0 };
        let benchSlotsTotal = intervals * numBenchPlayers;
        let floorB = if (lineup.players.size() != 0) { benchSlotsTotal / lineup.players.size() } else { 0 };
        let extra = benchSlotsTotal - (floorB * lineup.players.size());

        var targetBenchCounts = textMap.empty<Nat>();
        var playerIndex = 0;
        for (player in lineup.players.vals()) {
          let targetCount = if (playerIndex < extra) { floorB + 1 } else { floorB };
          targetBenchCounts := textMap.put(targetBenchCounts, player.id, targetCount);
          playerIndex += 1;
        };

        // Calculate actual bench counts and minutes
        var benchCounts = textMap.empty<Nat>();
        var playerMinutes = textMap.empty<Float>();

        for (player in lineup.players.vals()) {
          var benchCount = 0;
          var totalMinutes : Float = 0.0;
          var isOnField = player.isOnField;
          var lastSubTime : Nat = 0;
          var offFieldMinutes : Float = 0.0;

          for (sub in substitutions.vals()) {
            if (isOnField and sub.fieldPlayerId == player.id) {
              totalMinutes += Float.fromInt(sub.time - lastSubTime);
              isOnField := false;
              lastSubTime := sub.time;
              benchCount += 1;
            } else if (not isOnField and sub.benchPlayerId == player.id) {
              offFieldMinutes += Float.fromInt(sub.time - lastSubTime);
              lastSubTime := sub.time;
              isOnField := true;
            };
          };

          if (isOnField) {
            totalMinutes += Float.fromInt(totalMatchTime - lastSubTime);
          } else {
            offFieldMinutes += Float.fromInt(totalMatchTime - lastSubTime);
          };

          benchCounts := textMap.put(benchCounts, player.id, benchCount);
          playerMinutes := textMap.put(playerMinutes, player.id, totalMinutes);
        };

        // Calculate fairness metrics
        var fairnessMetrics : [FairnessMetrics] = [];
        for (player in lineup.players.vals()) {
          let targetCount = switch (textMap.get(targetBenchCounts, player.id)) {
            case (null) { 0 };
            case (?count) { count };
          };
          let actualCount = switch (textMap.get(benchCounts, player.id)) {
            case (null) { 0 };
            case (?count) { count };
          };
          let totalMinutes = switch (textMap.get(playerMinutes, player.id)) {
            case (null) { 0.0 };
            case (?minutes) { minutes };
          };
          let deviation = Float.abs(Float.fromInt(actualCount - targetCount));

          let metrics : FairnessMetrics = {
            playerId = player.id;
            playerName = player.name;
            targetBenchCount = targetCount;
            actualBenchCount = actualCount;
            totalMinutes;
            offFieldMinutes = 0.0; // Calculate if needed
            deviationFromTarget = deviation;
          };

          fairnessMetrics := Array.append(fairnessMetrics, [metrics]);
        };

        fairnessMetrics;
      };
    };
  };
};

