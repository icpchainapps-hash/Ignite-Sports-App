import OrderedMap "mo:base/OrderedMap";
import Text "mo:base/Text";
import Principal "mo:base/Principal";
import Array "mo:base/Array";
import Types "../domain/Types";

module JoinRequestService {
  type JoinRequest = Types.JoinRequest;
  type Team = Types.Team;
  type Player = Types.Player;

  public func submitJoinRequest(joinRequests : OrderedMap.Map<Text, JoinRequest>, joinRequest : JoinRequest) : OrderedMap.Map<Text, JoinRequest> {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    textMap.put(joinRequests, joinRequest.id, joinRequest);
  };

  public func getJoinRequestsByTeam(joinRequests : OrderedMap.Map<Text, JoinRequest>, teamId : Text) : [JoinRequest] {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    let teamRequests = textMap.vals(joinRequests);
    var result : [JoinRequest] = [];
    for (request in teamRequests) {
      if (request.teamId == teamId) {
        result := Array.append(result, [request]);
      };
    };
    result;
  };

  public func getJoinRequestsByUser(joinRequests : OrderedMap.Map<Text, JoinRequest>, userId : Principal) : [JoinRequest] {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    let userRequests = textMap.vals(joinRequests);
    var result : [JoinRequest] = [];
    for (request in userRequests) {
      if (request.userId == userId) {
        result := Array.append(result, [request]);
      };
    };
    result;
  };

  public func approveJoinRequest(joinRequests : OrderedMap.Map<Text, JoinRequest>, requestId : Text) : (OrderedMap.Map<Text, JoinRequest>, ?JoinRequest) {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    switch (textMap.get(joinRequests, requestId)) {
      case (null) { (joinRequests, null) };
      case (?request) {
        let updatedRequest : JoinRequest = {
          id = request.id;
          userId = request.userId;
          teamId = request.teamId;
          requestedRole = request.requestedRole;
          status = #approved;
          timestamp = request.timestamp;
        };
        (textMap.put(joinRequests, requestId, updatedRequest), ?updatedRequest);
      };
    };
  };

  public func rejectJoinRequest(joinRequests : OrderedMap.Map<Text, JoinRequest>, requestId : Text) : OrderedMap.Map<Text, JoinRequest> {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    textMap.delete(joinRequests, requestId);
  };

  public func getTeamAdmins(teams : OrderedMap.Map<Text, Team>, teamId : Text) : [Principal] {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    switch (textMap.get(teams, teamId)) {
      case (null) { [] };
      case (?team) { team.admins };
    };
  };
};

