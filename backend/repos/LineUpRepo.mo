import HashMap "mo:base/HashMap";
import Text "mo:base/Text";
import Nat "mo:base/Nat";
import Iter "mo:base/Iter";
import Debug "mo:base/Debug";

module LineupRepo {
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

  type Formation = {
    #fourFourTwo;
    #fourThreeThree;
    #threeFiveTwo;
    #fourTwoThreeOne;
    #custom;
  };

  type Lineup = {
    id : Text;
    name : Text;
    formation : Formation;
    players : [Player];
    createdAt : Int;
    updatedAt : Int;
  };

  transient let textHash = HashMap.Make<Text>(Text.equal, Text.hash);

  /// Creates a new lineup.
  public func createLineup(id : Text, name : Text, formation : Formation) : Lineup {
    let now = Nat64.toInt(0);
    {
      id;
      name;
      formation;
      players = [];
      createdAt = now;
      updatedAt = now;
    };
  };

  /// Retrieves a lineup by ID.
  public func getLineup(lineups : HashMap.HashMap<Text, Lineup>, id : Text) : ?Lineup {
    textHash.get(lineups, id);
  };

  /// Updates an existing lineup.
  public func updateLineup(lineups : HashMap.HashMap<Text, Lineup>, id : Text, updatedLineup : Lineup) : HashMap.HashMap<Text, Lineup> {
    if (not textHash.contains(lineups, id)) {
      Debug.trap("Lineup not found");
    };
    textHash.put(lineups, id, updatedLineup);
  };

  /// Deletes a lineup.
  public func deleteLineup(lineups : HashMap.HashMap<Text, Lineup>, id : Text) : HashMap.HashMap<Text, Lineup> {
    if (not textHash.contains(lineups, id)) {
      Debug.trap("Lineup not found");
    };
    textHash.delete(lineups, id);
  };

  /// Retrieves all lineups.
  public func getAllLineups(lineups : HashMap.HashMap<Text, Lineup>) : [Lineup] {
    Iter.toArray(textHash.vals(lineups));
  };

  /// Checks if a lineup exists for a given ID.
  public func lineupExists(lineups : HashMap.HashMap<Text, Lineup>, id : Text) : Bool {
    textHash.contains(lineups, id);
  };

  /// Clears all lineups.
  public func clearAllLineups() : HashMap.HashMap<Text, Lineup> {
    textHash.empty();
  };

  /// Adds a player to a lineup.
  public func addPlayer(lineups : HashMap.HashMap<Text, Lineup>, lineupId : Text, player : Player) : HashMap.HashMap<Text, Lineup> {
    switch (textHash.get(lineups, lineupId)) {
      case (null) { Debug.trap("Lineup not found") };
      case (?lineup) {
        let updatedPlayers = Array.append(lineup.players, [player]);
        let updatedLineup : Lineup = {
          id = lineup.id;
          name = lineup.name;
          formation = lineup.formation;
          players = updatedPlayers;
          createdAt = lineup.createdAt;
          updatedAt = Nat64.toInt(0);
        };
        textHash.put(lineups, lineupId, updatedLineup);
      };
    };
  };

  /// Updates a player in a lineup.
  public func updatePlayer(lineups : HashMap.HashMap<Text, Lineup>, lineupId : Text, playerId : Text, updatedPlayer : Player) : HashMap.HashMap<Text, Lineup> {
    switch (textHash.get(lineups, lineupId)) {
      case (null) { Debug.trap("Lineup not found") };
      case (?lineup) {
        let updatedPlayers = Array.map<Player, Player>(
          lineup.players,
          func(p) {
            if (p.id == playerId) { updatedPlayer } else { p };
          },
        );
        let updatedLineup : Lineup = {
          id = lineup.id;
          name = lineup.name;
          formation = lineup.formation;
          players = updatedPlayers;
          createdAt = lineup.createdAt;
          updatedAt = Nat64.toInt(0);
        };
        textHash.put(lineups, lineupId, updatedLineup);
      };
    };
  };

  /// Removes a player from a lineup.
  public func removePlayer(lineups : HashMap.HashMap<Text, Lineup>, lineupId : Text, playerId : Text) : HashMap.HashMap<Text, Lineup> {
    switch (textHash.get(lineups, lineupId)) {
      case (null) { Debug.trap("Lineup not found") };
      case (?lineup) {
        let filteredPlayers = Array.filter<Player>(
          lineup.players,
          func(p) { p.id != playerId },
        );
        let updatedLineup : Lineup = {
          id = lineup.id;
          name = lineup.name;
          formation = lineup.formation;
          players = filteredPlayers;
          createdAt = lineup.createdAt;
          updatedAt = Nat64.toInt(0);
        };
        textHash.put(lineups, lineupId, updatedLineup);
      };
    };
  };
};

