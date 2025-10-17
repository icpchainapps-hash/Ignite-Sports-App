import OrderedMap "mo:base/OrderedMap";
import Text "mo:base/Text";
import Array "mo:base/Array";
import Principal "mo:base/Principal";
import Types "../domain/Types";
import Errors "../domain/Errors";
import Collections "../util/Collections";
import ClubRepo "../repos/ClubRepo";

module RoleAssignment {
  type UserRole = Types.UserRole;
  type TeamRoleAssignment = Types.TeamRoleAssignment;
  type ClubRoleAssignment = Types.ClubRoleAssignment;
  type UserProfile = Types.UserProfile;
  type Team = Types.Team;
  type Player = Types.Player;

  public func addRoleToUserProfile(userProfiles : OrderedMap.Map<Principal, UserProfile>, user : Principal, role : UserRole) : OrderedMap.Map<Principal, UserProfile> {
    let principalMap = OrderedMap.Make<Principal>(Principal.compare);
    switch (principalMap.get(userProfiles, user)) {
      case (null) { Errors.trapUserProfileNotFound() };
      case (?profile) {
        // Prevent adding duplicate roles
        let roleExists = Collections.find<UserRole>(profile.roles, func(r) { r == role });
        switch (roleExists) {
          case (?_) { Errors.trapRoleAlreadyExists() };
          case (null) {
            let updatedRoles = Array.append(profile.roles, [role]);
            let updatedProfile : UserProfile = {
              username = profile.username;
              displayName = profile.displayName;
              roles = updatedRoles;
              teamRoles = profile.teamRoles;
              clubRoles = profile.clubRoles;
            };
            return principalMap.put(userProfiles, user, updatedProfile);
          };
        };
      };
    };
  };

  public func removeRoleFromUserProfile(userProfiles : OrderedMap.Map<Principal, UserProfile>, user : Principal, role : UserRole) : OrderedMap.Map<Principal, UserProfile> {
    let principalMap = OrderedMap.Make<Principal>(Principal.compare);
    switch (principalMap.get(userProfiles, user)) {
      case (null) { Errors.trapUserProfileNotFound() };
      case (?profile) {
        let filteredRoles = Collections.filter<UserRole>(
          profile.roles,
          func(r) { r != role },
        );

        // Check if role was actually removed
        if (filteredRoles.size() == profile.roles.size()) {
          Errors.trapRoleNotFoundInProfile();
        };

        let updatedProfile : UserProfile = {
          username = profile.username;
          displayName = profile.displayName;
          roles = filteredRoles;
          teamRoles = profile.teamRoles;
          clubRoles = profile.clubRoles;
        };
        return principalMap.put(userProfiles, user, updatedProfile);
      };
    };
  };

  public func assignTeamRole(userProfiles : OrderedMap.Map<Principal, UserProfile>, teams : OrderedMap.Map<Text, Team>, user : Principal, role : UserRole, teamId : Text, clubId : ?Text) : OrderedMap.Map<Principal, UserProfile> {
    let principalMap = OrderedMap.Make<Principal>(Principal.compare);
    let textMap = OrderedMap.Make<Text>(Text.compare);
    switch (principalMap.get(userProfiles, user)) {
      case (null) { Errors.trapUserProfileNotFound() };
      case (?profile) {
        // Validate team existence
        switch (textMap.get(teams, teamId)) {
          case (null) { Errors.trapKeyNotFoundInMap() };
          case (?_) {
            // Prevent duplicate team role assignments
            let existingAssignment = Collections.find<TeamRoleAssignment>(
              profile.teamRoles,
              func(assignment) {
                assignment.role == role and assignment.teamId == teamId
              },
            );
            switch (existingAssignment) {
              case (?_) { Errors.trapRoleAlreadyExists() };
              case (null) {
                let newAssignment : TeamRoleAssignment = {
                  role;
                  teamId;
                  clubId;
                };
                let updatedTeamRoles = Array.append(profile.teamRoles, [newAssignment]);
                let updatedProfile : UserProfile = {
                  username = profile.username;
                  displayName = profile.displayName;
                  roles = profile.roles;
                  teamRoles = updatedTeamRoles;
                  clubRoles = profile.clubRoles;
                };
                return principalMap.put(userProfiles, user, updatedProfile);
              };
            };
          };
        };
      };
    };
  };

  public func removeTeamRole(userProfiles : OrderedMap.Map<Principal, UserProfile>, user : Principal, role : UserRole, teamId : Text) : OrderedMap.Map<Principal, UserProfile> {
    let principalMap = OrderedMap.Make<Principal>(Principal.compare);
    switch (principalMap.get(userProfiles, user)) {
      case (null) { Errors.trapUserProfileNotFound() };
      case (?profile) {
        let filteredTeamRoles = Collections.filter<TeamRoleAssignment>(
          profile.teamRoles,
          func(assignment) {
            not (assignment.role == role and assignment.teamId == teamId)
          },
        );

        // Check if team role was actually removed
        if (filteredTeamRoles.size() == profile.teamRoles.size()) {
          Errors.trapRoleNotFoundInProfile();
        };

        let updatedProfile : UserProfile = {
          username = profile.username;
          displayName = profile.displayName;
          roles = profile.roles;
          teamRoles = filteredTeamRoles;
          clubRoles = profile.clubRoles;
        };
        return principalMap.put(userProfiles, user, updatedProfile);
      };
    };
  };

  public func assignTeamAdminRole(userProfiles : OrderedMap.Map<Principal, UserProfile>, teams : OrderedMap.Map<Text, Team>, user : Principal, teamId : Text) : OrderedMap.Map<Principal, UserProfile> {
    let principalMap = OrderedMap.Make<Principal>(Principal.compare);
    let textMap = OrderedMap.Make<Text>(Text.compare);
    switch (principalMap.get(userProfiles, user)) {
      case (null) { Errors.trapUserProfileNotFound() };
      case (?profile) {
        // Validate team existence
        switch (textMap.get(teams, teamId)) {
          case (null) { Errors.trapKeyNotFoundInMap() };
          case (?_) {
            // Prevent duplicate team role assignments
            let existingAssignment = Collections.find<TeamRoleAssignment>(
              profile.teamRoles,
              func(assignment) {
                assignment.role == #teamAdmin and assignment.teamId == teamId
              },
            );
            switch (existingAssignment) {
              case (?_) { Errors.trapRoleAlreadyExists() };
              case (null) {
                let newAssignment : TeamRoleAssignment = {
                  role = #teamAdmin;
                  teamId;
                  clubId = null;
                };
                let updatedTeamRoles = Array.append(profile.teamRoles, [newAssignment]);
                let updatedProfile : UserProfile = {
                  username = profile.username;
                  displayName = profile.displayName;
                  roles = Array.append(profile.roles, [#teamAdmin]);
                  teamRoles = updatedTeamRoles;
                  clubRoles = profile.clubRoles;
                };
                return principalMap.put(userProfiles, user, updatedProfile);
              };
            };
          };
        };
      };
    };
  };

  public func addPlayerToTeam(teams : OrderedMap.Map<Text, Team>, caller : Principal, teamId : Text, player : Player) : OrderedMap.Map<Text, Team> {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    switch (textMap.get(teams, teamId)) {
      case (null) { Errors.trapKeyNotFoundInMap() };
      case (?team) {
        // Check if caller is team admin
        let isAdmin = Array.find<Principal>(team.admins, func(admin) { admin == caller });
        switch (isAdmin) {
          case (null) { Errors.trapUnauthorized() };
          case (?_) {
            let updatedPlayers = Array.append(team.players, [player]);
            let updatedTeam : Team = {
              id = team.id;
              name = team.name;
              clubId = team.clubId;
              createdAt = team.createdAt;
              admins = team.admins;
              players = updatedPlayers;
            };
            return textMap.put(teams, teamId, updatedTeam);
          };
        };
      };
    };
  };

  public func assignClubAdminRole(userProfiles : OrderedMap.Map<Principal, UserProfile>, clubRepo : ClubRepo.ClubRepo, user : Principal, clubId : Text) : OrderedMap.Map<Principal, UserProfile> {
    let principalMap = OrderedMap.Make<Principal>(Principal.compare);
    switch (principalMap.get(userProfiles, user)) {
      case (null) { Errors.trapUserProfileNotFound() };
      case (?profile) {
        // Validate club existence
        switch (ClubRepo.getClub(clubRepo, clubId)) {
          case (null) { Errors.trapKeyNotFoundInMap() };
          case (?_) {
            // Prevent duplicate club role assignments
            let existingAssignment = Collections.find<ClubRoleAssignment>(
              profile.clubRoles,
              func(assignment) {
                assignment.role == #clubAdmin and assignment.clubId == clubId
              },
            );
            switch (existingAssignment) {
              case (?_) { Errors.trapRoleAlreadyExists() };
              case (null) {
                let newAssignment : ClubRoleAssignment = {
                  role = #clubAdmin;
                  clubId;
                };
                let updatedClubRoles = Array.append(profile.clubRoles, [newAssignment]);
                let updatedProfile : UserProfile = {
                  username = profile.username;
                  displayName = profile.displayName;
                  roles = Array.append(profile.roles, [#clubAdmin]);
                  teamRoles = profile.teamRoles;
                  clubRoles = updatedClubRoles;
                };
                return principalMap.put(userProfiles, user, updatedProfile);
              };
            };
          };
        };
      };
    };
  };
};

