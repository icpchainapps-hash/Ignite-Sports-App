import OrderedMap "mo:base/OrderedMap";
import Text "mo:base/Text";
import Array "mo:base/Array";

module {
  public type UserRole = {
    #appAdmin;
    #coach;
    #player;
    #parent;
    #teamAdmin;
    #clubAdmin;
  };

  public type TeamRoleAssignment = {
    role : UserRole;
    teamId : Text;
    clubId : ?Text;
  };

  public type ClubRoleAssignment = {
    role : UserRole;
    clubId : Text;
  };

  public type UserProfile = {
    username : Text;
    displayName : Text;
    roles : [UserRole];
    teamRoles : [TeamRoleAssignment];
    clubRoles : [ClubRoleAssignment];
  };

  public type ClubMember = {
    userId : Text;
    displayName : Text;
    roles : [UserRole];
  };

  public type TeamMember = {
    userId : Text;
    displayName : Text;
    roles : [UserRole];
  };

  /// Updates the club members index.
  public func updateClubMembersIndex(
    clubMembersIndex : OrderedMap.Map<Text, [ClubMember]>,
    clubId : Text,
    userId : Text,
    displayName : Text,
    role : UserRole,
  ) : OrderedMap.Map<Text, [ClubMember]> {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    let existingMembers = switch (textMap.get(clubMembersIndex, clubId)) {
      case (null) { [] };
      case (?members) { members };
    };

    // Check if member already exists
    let memberExists = Array.find<ClubMember>(
      existingMembers,
      func(member) { member.userId == userId },
    );

    let updatedMembers = switch (memberExists) {
      case (null) {
        // Add new member
        Array.append(
          existingMembers,
          [
            {
              userId;
              displayName;
              roles = [role];
            },
          ],
        );
      };
      case (?existingMember) {
        // Update existing member roles
        let updatedRoles = Array.append(existingMember.roles, [role]);
        Array.map<ClubMember, ClubMember>(
          existingMembers,
          func(member) {
            if (member.userId == userId) {
              {
                userId = member.userId;
                displayName = member.displayName;
                roles = updatedRoles;
              };
            } else { member };
          },
        );
      };
    };

    textMap.put(clubMembersIndex, clubId, updatedMembers);
  };

  /// Updates the team members index.
  public func updateTeamMembersIndex(
    teamMembersIndex : OrderedMap.Map<Text, [TeamMember]>,
    teamId : Text,
    userId : Text,
    displayName : Text,
    role : UserRole,
  ) : OrderedMap.Map<Text, [TeamMember]> {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    let existingMembers = switch (textMap.get(teamMembersIndex, teamId)) {
      case (null) { [] };
      case (?members) { members };
    };

    // Check if member already exists
    let memberExists = Array.find<TeamMember>(
      existingMembers,
      func(member) { member.userId == userId },
    );

    let updatedMembers = switch (memberExists) {
      case (null) {
        // Add new member
        Array.append(
          existingMembers,
          [
            {
              userId;
              displayName;
              roles = [role];
            },
          ],
        );
      };
      case (?existingMember) {
        // Update existing member roles
        let updatedRoles = Array.append(existingMember.roles, [role]);
        Array.map<TeamMember, TeamMember>(
          existingMembers,
          func(member) {
            if (member.userId == userId) {
              {
                userId = member.userId;
                displayName = member.displayName;
                roles = updatedRoles;
              };
            } else { member };
          },
        );
      };
    };

    textMap.put(teamMembersIndex, teamId, updatedMembers);
  };

  /// Retrieves club members by club ID.
  public func getClubMembers(clubMembersIndex : OrderedMap.Map<Text, [ClubMember]>, clubId : Text) : [ClubMember] {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    switch (textMap.get(clubMembersIndex, clubId)) {
      case (null) { [] };
      case (?members) { members };
    };
  };

  /// Retrieves team members by team ID.
  public func getTeamMembers(teamMembersIndex : OrderedMap.Map<Text, [TeamMember]>, teamId : Text) : [TeamMember] {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    switch (textMap.get(teamMembersIndex, teamId)) {
      case (null) { [] };
      case (?members) { members };
    };
  };

  /// Removes a member from a club.
  public func removeClubMember(clubMembersIndex : OrderedMap.Map<Text, [ClubMember]>, clubId : Text, userId : Text) : OrderedMap.Map<Text, [ClubMember]> {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    let existingMembers = switch (textMap.get(clubMembersIndex, clubId)) {
      case (null) { [] };
      case (?members) { members };
    };

    let updatedMembers = Array.filter<ClubMember>(
      existingMembers,
      func(member) { member.userId != userId },
    );

    textMap.put(clubMembersIndex, clubId, updatedMembers);
  };

  /// Removes a member from a team.
  public func removeTeamMember(teamMembersIndex : OrderedMap.Map<Text, [TeamMember]>, teamId : Text, userId : Text) : OrderedMap.Map<Text, [TeamMember]> {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    let existingMembers = switch (textMap.get(teamMembersIndex, teamId)) {
      case (null) { [] };
      case (?members) { members };
    };

    let updatedMembers = Array.filter<TeamMember>(
      existingMembers,
      func(member) { member.userId != userId },
    );

    textMap.put(teamMembersIndex, teamId, updatedMembers);
  };

  /// Retrieves all club members.
  public func getAllClubMembers(clubMembersIndex : OrderedMap.Map<Text, [ClubMember]>) : [ClubMember] {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    var allMembers : [ClubMember] = [];
    for (members in textMap.vals(clubMembersIndex)) {
      allMembers := Array.append(allMembers, members);
    };
    allMembers;
  };

  /// Retrieves all team members.
  public func getAllTeamMembers(teamMembersIndex : OrderedMap.Map<Text, [TeamMember]>) : [TeamMember] {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    var allMembers : [TeamMember] = [];
    for (members in textMap.vals(teamMembersIndex)) {
      allMembers := Array.append(allMembers, members);
    };
    allMembers;
  };

  /// Checks if a club exists in the index.
  public func clubExists(clubMembersIndex : OrderedMap.Map<Text, [ClubMember]>, clubId : Text) : Bool {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    textMap.contains(clubMembersIndex, clubId);
  };

  /// Checks if a team exists in the index.
  public func teamExists(teamMembersIndex : OrderedMap.Map<Text, [TeamMember]>, teamId : Text) : Bool {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    textMap.contains(teamMembersIndex, teamId);
  };

  /// Clears all club members for a given club ID.
  public func clearClubMembers(clubMembersIndex : OrderedMap.Map<Text, [ClubMember]>, clubId : Text) : OrderedMap.Map<Text, [ClubMember]> {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    textMap.delete(clubMembersIndex, clubId);
  };

  /// Clears all team members for a given team ID.
  public func clearTeamMembers(teamMembersIndex : OrderedMap.Map<Text, [TeamMember]>, teamId : Text) : OrderedMap.Map<Text, [TeamMember]> {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    textMap.delete(teamMembersIndex, teamId);
  };

  /// Clears all club members index.
  public func clearAllClubMembers(_ : OrderedMap.Map<Text, [ClubMember]>) : OrderedMap.Map<Text, [ClubMember]> {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    textMap.empty();
  };

  /// Clears all team members index.
  public func clearAllTeamMembers(_ : OrderedMap.Map<Text, [TeamMember]>) : OrderedMap.Map<Text, [TeamMember]> {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    textMap.empty();
  };
};
