import OrderedMap "mo:base/OrderedMap";
import Text "mo:base/Text";
import Iter "mo:base/Iter";
import Debug "mo:base/Debug";
import Types "../domain/Types";

module ClubRepo {
  type Club = Types.Club;

  public type ClubRepo = {
    clubs : OrderedMap.Map<Text, Club>;
  };

  public func init() : ClubRepo {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    {
      clubs = textMap.empty<Club>();
    };
  };

  public func createClub(repo : ClubRepo, clubId : Text, club : Club) : ClubRepo {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    if (textMap.contains(repo.clubs, clubId)) {
      Debug.trap("Club already exists");
    };
    {
      clubs = textMap.put(repo.clubs, clubId, club);
    };
  };

  public func getClub(repo : ClubRepo, clubId : Text) : ?Club {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    textMap.get(repo.clubs, clubId);
  };

  public func updateClub(repo : ClubRepo, clubId : Text, updatedClub : Club) : ClubRepo {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    if (not textMap.contains(repo.clubs, clubId)) {
      Debug.trap("Club not found");
    };
    {
      clubs = textMap.put(repo.clubs, clubId, updatedClub);
    };
  };

  public func deleteClub(repo : ClubRepo, clubId : Text) : ClubRepo {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    if (not textMap.contains(repo.clubs, clubId)) {
      Debug.trap("Club not found");
    };
    {
      clubs = textMap.delete(repo.clubs, clubId);
    };
  };

  public func getAllClubs(repo : ClubRepo) : [Club] {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    Iter.toArray(textMap.vals(repo.clubs));
  };

  public func clubExists(repo : ClubRepo, clubId : Text) : Bool {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    textMap.contains(repo.clubs, clubId);
  };

  public func clearAllClubs(_ : ClubRepo) : ClubRepo {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    {
      clubs = textMap.empty<Club>();
    };
  };
};

