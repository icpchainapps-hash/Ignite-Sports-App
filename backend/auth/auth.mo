import AccessControl "../authorization/access-control";
import Types "../domain/Types";
import Errors "../domain/Errors";
import OrderedMap "mo:base/OrderedMap";
import Principal "mo:base/Principal";
import Array "mo:base/Array";

module {
  type UserProfile = Types.UserProfile;
  type TeamRoleAssignment = Types.TeamRoleAssignment;

  public func requireAdmin(accessControlState : AccessControl.AccessControlState, caller : Principal) : () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Errors.trapUnauthorized();
    };
  };

  public func requireTeamAdmin(userProfiles : OrderedMap.Map<Principal, UserProfile>, caller : Principal, teamId : Text) : () {
    let principalMap = OrderedMap.Make<Principal>(Principal.compare);
    switch (principalMap.get(userProfiles, caller)) {
      case (null) { Errors.trapUnauthorized() };
      case (?profile) {
        let isTeamAdmin = Array.find<TeamRoleAssignment>(
          profile.teamRoles,
          func(assignment) {
            assignment.role == #teamAdmin and assignment.teamId == teamId
          },
        );
        switch (isTeamAdmin) {
          case (null) { Errors.trapUnauthorized() };
          case (?_) {};
        };
      };
    };
  };
};
