import OrderedMap "mo:base/OrderedMap";
import Text "mo:base/Text";
import Iter "mo:base/Iter";
import Array "mo:base/Array";
import Nat "mo:base/Nat";
import Debug "mo:base/Debug";
import Int "mo:base/Int";
import Principal "mo:base/Principal";
import Time "mo:base/Time";
import Random "mo:base/Random";
import Float "mo:base/Float";

import AccessControl "authorization/access-control";
import Stripe "stripe/stripe";
import OutCall "http-outcalls/outcall";
import Registry "blob-storage/registry";
import InviteLinksModule "invite-links/invite-links-module";
import Validation "domain/Validation";
import Errors "domain/Errors";
import Types "domain/Types";
import Substitutions "services/Substitutions";
import ClubRepo "repos/ClubRepo";
import RoleAssignment "services/RoleAssignment";
import Guards "auth/guards";
import SubsOrchestrator "services/subs_orchestrator";
import MetricsService "services/metrics_service";
import JoinRequestService "services/join_request_service";
import UserApproval "user-approval/approval";
import Collections "util/Collections";
import MessagesRepo "repos/MessagesRepo";
import EventsRepo "repos/EventsRepo";
import NotificationsService "services/notifications_service";
import IndexesRepo "repos/IndexesRepo";

persistent actor LineUp {
  transient let textMap = OrderedMap.Make<Text>(Text.compare);
  transient let principalMap = OrderedMap.Make<Principal>(Principal.compare);

  type PlayerRole = Types.PlayerRole;
  type PositionEligibility = Types.PositionEligibility;
  type Player = Types.Player;
  type Formation = Types.Formation;
  type Lineup = Types.Lineup;
  type Substitution = Types.Substitution;
  type SubstitutionSchedule = Types.SubstitutionSchedule;
  type SubstitutionSpeedMode = Types.SubstitutionSpeedMode;
  type MinSubRoundsResult = Types.MinSubRoundsResult;
  type PlayerGameTime = Types.PlayerGameTime;
  type BenchEventCount = Types.BenchEventCount;
  type FairnessMetrics = Types.FairnessMetrics;
  type UserRole = Types.UserRole;
  type TeamRoleAssignment = Types.TeamRoleAssignment;
  type ClubRoleAssignment = Types.ClubRoleAssignment;
  type UserProfile = Types.UserProfile;
  type StripeConfiguration = Types.StripeConfiguration;
  type Metrics = Types.Metrics;
  type Team = Types.Team;
  type ChatThread = Types.ChatThread;
  type MessageType = Types.MessageType;
  type Address = Types.Address;
  type Coordinates = Types.Coordinates;
  type EventType = Types.EventType;
  type Event = Types.Event;
  type RSVPStatus = Types.RSVPStatus;
  type RSVP = Types.RSVP;
  type NotificationType = Types.NotificationType;
  type Notification = Types.Notification;
  type Club = Types.Club;
  type ClubMember = Types.ClubMember;
  type TeamMember = Types.TeamMember;
  type JoinRequest = Types.JoinRequest;
  type ChildProfile = {
    id : Text;
    name : Text;
    dateOfBirth : Text;
    clubId : Text;
    teamId : Text;
    parentId : Principal;
  };

  // Define Message type locally
  type Message = {
    id : Text;
    threadId : Text;
    sender : Principal;
    content : Text;
    timestamp : Int;
  };

  var lineups : OrderedMap.Map<Text, Lineup> = textMap.empty<Lineup>();
  var substitutionSchedules : OrderedMap.Map<Text, SubstitutionSchedule> = textMap.empty<SubstitutionSchedule>();
  var timePerHalf : Nat = 30;
  var substitutionSpeedMode : SubstitutionSpeedMode = #medium;
  var maxSimultaneousSubs : Nat = 2;
  var userProfiles : OrderedMap.Map<Principal, UserProfile> = principalMap.empty<UserProfile>();
  var stripeConfig : ?StripeConfiguration = null;
  var teams : OrderedMap.Map<Text, Team> = textMap.empty<Team>();
  var chatThreads : OrderedMap.Map<Text, ChatThread> = textMap.empty<ChatThread>();
  var clubRepo : ClubRepo.ClubRepo = ClubRepo.init();
  var metricsRepo : MetricsService.MetricsRepo = MetricsService.init();
  var joinRequests : OrderedMap.Map<Text, JoinRequest> = textMap.empty<JoinRequest>();
  var firstPrincipalId : ?Principal = null;
  var clubMembersIndex : OrderedMap.Map<Text, [ClubMember]> = textMap.empty<[ClubMember]>();
  var teamMembersIndex : OrderedMap.Map<Text, [TeamMember]> = textMap.empty<[TeamMember]>();
  var messagesRepo : MessagesRepo.MessagesRepo = MessagesRepo.init();
  var eventsRepo : EventsRepo.EventsRepo = EventsRepo.init();
  var childProfiles : OrderedMap.Map<Text, ChildProfile> = textMap.empty<ChildProfile>();
  var notificationsRepo : NotificationsService.NotificationsRepo = NotificationsService.init();

  let accessControlState = AccessControl.initState();
  let registry = Registry.new();
  let inviteState = InviteLinksModule.initState();
  let approvalState = UserApproval.initState(accessControlState);

  public query ({ caller }) func isCallerApproved() : async Bool {
    AccessControl.hasPermission(accessControlState, caller, #admin) or UserApproval.isApproved(approvalState, caller);
  };

  public shared ({ caller }) func requestApproval() : async () {
    UserApproval.requestApproval(approvalState, caller);
  };

  public shared ({ caller }) func setApproval(user : Principal, status : UserApproval.ApprovalStatus) : async () {
    UserApproval.setApproval(approvalState, user, status);
  };

  public query ({ caller }) func listApprovals() : async [UserApproval.UserApprovalInfo] {
    UserApproval.listApprovals(approvalState);
  };

  public shared ({ caller }) func initializeAccessControl() : async () {
    AccessControl.initialize(accessControlState, caller);
  };

  public query ({ caller }) func getCallerUserRole() : async AccessControl.UserRole {
    AccessControl.getUserRole(accessControlState, caller);
  };

  public shared ({ caller }) func assignCallerUserRole(user : Principal, role : AccessControl.UserRole) : async () {
    AccessControl.assignRole(accessControlState, caller, user, role);
  };

  public query ({ caller }) func isCallerAdmin() : async Bool {
    AccessControl.isAdmin(accessControlState, caller);
  };

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    principalMap.get(userProfiles, caller);
  };

  public query func getUserProfile(user : Principal) : async ?UserProfile {
    principalMap.get(userProfiles, user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    userProfiles := principalMap.put(userProfiles, caller, profile);
  };

  public shared ({ caller }) func createUserProfile(username : Text, displayName : Text, roles : [UserRole]) : async () {
    let isFirstUser = switch (firstPrincipalId) {
      case (null) {
        firstPrincipalId := ?caller;
        true;
      };
      case (?firstId) { firstId == caller };
    };

    let finalRoles = if (isFirstUser) {
      Array.append(roles, [#appAdmin]);
    } else {
      roles;
    };

    let profile : UserProfile = {
      username;
      displayName;
      roles = finalRoles;
      teamRoles = [];
      clubRoles = [];
    };
    userProfiles := principalMap.put(userProfiles, caller, profile);
  };

  public shared ({ caller }) func addRoleToUserProfile(role : UserRole) : async () {
    if (role == #appAdmin) {
      switch (firstPrincipalId) {
        case (null) { Errors.trapUnauthorized() };
        case (?firstId) {
          if (caller != firstId) {
            Errors.trapUnauthorized();
          };
        };
      };
    };
    userProfiles := RoleAssignment.addRoleToUserProfile(userProfiles, caller, role);
  };

  public shared ({ caller }) func removeRoleFromUserProfile(role : UserRole) : async () {
    userProfiles := RoleAssignment.removeRoleFromUserProfile(userProfiles, caller, role);
  };

  public shared ({ caller }) func assignTeamRole(role : UserRole, teamId : Text, clubId : ?Text) : async () {
    userProfiles := RoleAssignment.assignTeamRole(userProfiles, teams, caller, role, teamId, clubId);
  };

  public shared ({ caller }) func removeTeamRole(role : UserRole, teamId : Text) : async () {
    userProfiles := RoleAssignment.removeTeamRole(userProfiles, caller, role, teamId);
  };

  public shared ({ caller }) func createTeam(name : Text, clubId : Text) : async Text {
    let teamId = Text.concat(name, Int.toText(Time.now()));
    let team : Team = {
      id = teamId;
      name;
      clubId;
      createdAt = Time.now();
      admins = [caller];
      players = [];
    };
    teams := textMap.put(teams, teamId, team);

    // Assign teamAdmin role to creator
    userProfiles := RoleAssignment.assignTeamAdminRole(userProfiles, teams, caller, teamId);

    // Update team members index
    switch (principalMap.get(userProfiles, caller)) {
      case (null) {};
      case (?profile) {
        teamMembersIndex := IndexesRepo.updateTeamMembersIndex(teamMembersIndex, teamId, Principal.toText(caller), profile.displayName, #teamAdmin);
      };
    };

    teamId;
  };

  public shared ({ caller }) func addPlayerToTeam(teamId : Text, player : Player) : async () {
    teams := RoleAssignment.addPlayerToTeam(teams, caller, teamId, player);
  };

  public query ({ caller }) func getMyTeamsAndClubs() : async {
    teams : [Team];
    clubs : [Club];
  } {
    switch (principalMap.get(userProfiles, caller)) {
      case (null) {
        Debug.print("No user profile found for caller " # Principal.toText(caller));
        { teams = []; clubs = [] };
      };
      case (?profile) {
        let myTeamIds = Array.map<TeamRoleAssignment, Text>(
          profile.teamRoles,
          func(assignment) { assignment.teamId },
        );

        let myTeams = Array.filter<Team>(
          Iter.toArray(textMap.vals(teams)),
          func(team) {
            Collections.contains<Text>(myTeamIds, team.id, func(a, b) { a == b });
          },
        );

        // Extract unique club IDs from myTeams
        let myClubIds = Array.map<Team, Text>(
          myTeams,
          func(team) { team.clubId },
        );

        // Remove duplicate club IDs
        let uniqueClubIds = Array.foldLeft<Text, [Text]>(
          myClubIds,
          [],
          func(acc, clubId) {
            if (not Collections.contains<Text>(acc, clubId, func(a, b) { a == b })) {
              Array.append(acc, [clubId]);
            } else { acc };
          },
        );

        // Filter clubs where the user has a role or is a member
        let myClubs = Array.filter<Club>(
          ClubRepo.getAllClubs(clubRepo),
          func(club) {
            // Check if the club ID is in the user's unique club IDs
            let isInUserClubs = Collections.contains<Text>(uniqueClubIds, club.id, func(a, b) { a == b });

            // Check if the user has a role in the club
            let hasClubRole = Array.find<ClubRoleAssignment>(
              profile.clubRoles,
              func(assignment) { assignment.clubId == club.id },
            ) != null;

            // Check if the user is a member of the club
            let isClubMember = switch (textMap.get(clubMembersIndex, club.id)) {
              case (null) { false };
              case (?members) {
                Array.find<ClubMember>(
                  members,
                  func(member) { member.userId == Principal.toText(caller) },
                ) != null;
              };
            };

            // Only include clubs where the user has a role or is a member
            isInUserClubs or hasClubRole or isClubMember
          },
        );

        Debug.print("Returning " # Nat.toText(myTeams.size()) # " teams and " # Nat.toText(myClubs.size()) # " clubs for caller " # Principal.toText(caller));
        {
          teams = myTeams;
          clubs = myClubs;
        };
      };
    };
  };

  public query func getTeamsByUser(user : Principal) : async [Team] {
    let userTeams = Array.filter<Team>(
      Iter.toArray(textMap.vals(teams)),
      func(team) {
        Array.find<Principal>(team.admins, func(admin) { admin == user }) != null;
      },
    );
    userTeams;
  };

  public query func getAllTeams() : async [Team] {
    Iter.toArray(textMap.vals(teams));
  };

  public query ({ caller }) func getCallerTeamsWithClubs() : async [{
    team : Team;
    club : ?Club;
  }] {
    let userTeams = Array.filter<Team>(
      Iter.toArray(textMap.vals(teams)),
      func(team) {
        Array.find<Principal>(team.admins, func(admin) { admin == caller }) != null;
      },
    );

    let teamsWithClubs = Array.map<Team, { team : Team; club : ?Club }>(
      userTeams,
      func(team) {
        let club = ClubRepo.getClub(clubRepo, team.clubId);
        { team; club };
      },
    );

    teamsWithClubs;
  };

  public func createLineup(id : Text, name : Text, formation : Formation) : async () {
    if (textMap.contains(lineups, id)) {
      Errors.trapLineupNotFound();
    };

    let newLineup : Lineup = {
      id;
      name;
      formation;
      players = [];
      createdAt = 0;
      updatedAt = 0;
    };

    lineups := textMap.put(lineups, id, newLineup);
  };

  public func getLineup(id : Text) : async ?Lineup {
    textMap.get(lineups, id);
  };

  public func updateLineup(id : Text, updatedLineup : Lineup) : async () {
    if (not textMap.contains(lineups, id)) {
      Errors.trapLineupNotFound();
    };

    lineups := textMap.put(lineups, id, updatedLineup);
  };

  public func deleteLineup(id : Text) : async () {
    if (not textMap.contains(lineups, id)) {
      Errors.trapLineupNotFound();
    };

    lineups := textMap.delete(lineups, id);
  };

  public func getAllLineups() : async [Lineup] {
    Iter.toArray(textMap.vals(lineups));
  };

  public func addPlayer(lineupId : Text, player : Player) : async () {
    switch (textMap.get(lineups, lineupId)) {
      case (null) { Errors.trapLineupNotFound() };
      case (?lineup) {
        let updatedPlayers = Array.append(lineup.players, [player]);
        let updatedLineup : Lineup = {
          id = lineup.id;
          name = lineup.name;
          formation = lineup.formation;
          players = updatedPlayers;
          createdAt = lineup.createdAt;
          updatedAt = lineup.updatedAt;
        };
        lineups := textMap.put(lineups, lineupId, updatedLineup);
      };
    };
  };

  public func updatePlayer(lineupId : Text, playerId : Text, updatedPlayer : Player) : async () {
    switch (textMap.get(lineups, lineupId)) {
      case (null) { Errors.trapLineupNotFound() };
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
          updatedAt = lineup.updatedAt;
        };
        lineups := textMap.put(lineups, lineupId, updatedLineup);
      };
    };
  };

  public func removePlayer(lineupId : Text, playerId : Text) : async () {
    switch (textMap.get(lineups, lineupId)) {
      case (null) { Errors.trapLineupNotFound() };
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
          updatedAt = lineup.updatedAt;
        };
        lineups := textMap.put(lineups, lineupId, updatedLineup);
      };
    };
  };

  public func setTimePerHalf(newTime : Nat) : async Nat {
    Validation.validateTimePerHalf(newTime);
    timePerHalf := newTime;
    timePerHalf;
  };

  public query func getTimePerHalf() : async Nat {
    timePerHalf;
  };

  public func setSubstitutionSpeedMode(mode : SubstitutionSpeedMode) : async () {
    substitutionSpeedMode := mode;
  };

  public query func getSubstitutionSpeedMode() : async SubstitutionSpeedMode {
    substitutionSpeedMode;
  };

  public func setMaxSimultaneousSubs(maxSubs : Nat) : async () {
    Validation.validateMaxSimultaneousSubs(maxSubs);
    maxSimultaneousSubs := maxSubs;
  };

  public query func getMaxSimultaneousSubs() : async Nat {
    maxSimultaneousSubs;
  };

  public func updatePlayerPositionEligibility(lineupId : Text, playerId : Text, newEligibility : PositionEligibility) : async () {
    switch (textMap.get(lineups, lineupId)) {
      case (null) { Errors.trapLineupNotFound() };
      case (?lineup) {
        let updatedPlayers = Array.map<Player, Player>(
          lineup.players,
          func(p) {
            if (p.id == playerId) {
              {
                id = p.id;
                name = p.name;
                number = p.number;
                role = p.role;
                position = p.position;
                isOnField = p.isOnField;
                positionEligibility = newEligibility;
              };
            } else { p };
          },
        );
        let updatedLineup : Lineup = {
          id = lineup.id;
          name = lineup.name;
          formation = lineup.formation;
          players = updatedPlayers;
          createdAt = lineup.createdAt;
          updatedAt = lineup.updatedAt;
        };
        lineups := textMap.put(lineups, lineupId, updatedLineup);
      };
    };
  };

  public func getPlayerPositionEligibility(lineupId : Text, playerId : Text) : async PositionEligibility {
    switch (textMap.get(lineups, lineupId)) {
      case (null) { Errors.trapLineupNotFound() };
      case (?lineup) {
        let player = Array.find<Player>(
          lineup.players,
          func(p) { p.id == playerId },
        );
        switch (player) {
          case (null) { Errors.trapPlayerNotFound() };
          case (?p) { p.positionEligibility };
        };
      };
    };
  };

  public func substitutePlayer(lineupId : Text, fieldPlayerId : Text, benchPlayerId : Text) : async () {
    switch (textMap.get(lineups, lineupId)) {
      case (null) { Errors.trapLineupNotFound() };
      case (?lineup) {
        let fieldPlayerOpt = Array.find<Player>(
          lineup.players,
          func(p) { p.id == fieldPlayerId },
        );

        let benchPlayerOpt = Array.find<Player>(
          lineup.players,
          func(p) { p.id == benchPlayerId },
        );

        switch (fieldPlayerOpt, benchPlayerOpt) {
          case (null, _) { Errors.trapPlayerNotFound() };
          case (_, null) { Errors.trapPlayerNotFound() };
          case (?fieldPlayer, ?benchPlayer) {
            let requiredPosition = switch (fieldPlayer.role) {
              case (#goalkeeper) { "goalkeeper" };
              case (#defender) { "defender" };
              case (#midfielder) { "midfielder" };
              case (#forward) { "forward" };
            };

            let eligiblePositionsText = switch (benchPlayer.positionEligibility) {
              case ({ goalkeeper; defender; midfielder; forward }) {
                let pos1 = if (goalkeeper) { "goalkeeper" } else { "" };
                let pos2 = if (defender) {
                  if (pos1 == "") { "defender" } else { pos1 # ", defender" };
                } else { pos1 };
                let pos3 = if (midfielder) {
                  if (pos2 == "") { "midfielder" } else { pos2 # ", midfielder" };
                } else { pos2 };
                let pos4 = if (forward) {
                  if (pos3 == "") { "forward" } else { pos3 # ", forward" };
                } else { pos3 };
                pos4;
              };
            };

            let isEligible = switch (fieldPlayer.role) {
              case (#goalkeeper) { benchPlayer.positionEligibility.goalkeeper };
              case (#defender) { benchPlayer.positionEligibility.defender };
              case (#midfielder) { benchPlayer.positionEligibility.midfielder };
              case (#forward) { benchPlayer.positionEligibility.forward };
            };

            if (not isEligible) {
              Errors.trapPositionEligibilityMismatch(requiredPosition, eligiblePositionsText);
            };

            let updatedPlayers = Array.map<Player, Player>(
              lineup.players,
              func(p) {
                if (p.id == fieldPlayerId) {
                  {
                    id = p.id;
                    name = p.name;
                    number = p.number;
                    role = p.role;
                    position = p.position;
                    isOnField = false;
                    positionEligibility = p.positionEligibility;
                  };
                } else if (p.id == benchPlayerId) {
                  {
                    id = p.id;
                    name = p.name;
                    number = p.number;
                    role = p.role;
                    position = p.position;
                    isOnField = true;
                    positionEligibility = p.positionEligibility;
                  };
                } else { p };
              },
            );

            let updatedLineup : Lineup = {
              id = lineup.id;
              name = lineup.name;
              formation = lineup.formation;
              players = updatedPlayers;
              createdAt = lineup.createdAt;
              updatedAt = lineup.updatedAt;
            };
            lineups := textMap.put(lineups, lineupId, updatedLineup);
          };
        };
      };
    };
  };

  public func getEligibleBenchPlayers(lineupId : Text, requiredRole : PlayerRole) : async [Player] {
    switch (textMap.get(lineups, lineupId)) {
      case (null) { Errors.trapLineupNotFound() };
      case (?lineup) {
        let eligiblePlayers = Array.filter<Player>(
          lineup.players,
          func(p) {
            let isEligible = switch (requiredRole) {
              case (#goalkeeper) { p.positionEligibility.goalkeeper };
              case (#defender) { p.positionEligibility.defender };
              case (#midfielder) { p.positionEligibility.midfielder };
              case (#forward) { p.positionEligibility.forward };
            };
            not p.isOnField and isEligible
          },
        );
        eligiblePlayers;
      };
    };
  };

  public func createSubstitutionSchedule(lineupId : Text, substitutions : [Substitution]) : async () {
    let now = Int.abs(0);
    let schedule : SubstitutionSchedule = {
      lineupId;
      substitutions;
      createdAt = now;
      updatedAt = now;
    };
    substitutionSchedules := Substitutions.putSchedule(substitutionSchedules, lineupId, schedule);
  };

  public func getSubstitutionSchedule(lineupId : Text) : async ?SubstitutionSchedule {
    Substitutions.getSchedule(substitutionSchedules, lineupId);
  };

  public func updateSubstitutionSchedule(lineupId : Text, substitutions : [Substitution]) : async () {
    switch (Substitutions.getSchedule(substitutionSchedules, lineupId)) {
      case (null) { Errors.trapSubstitutionScheduleNotFound() };
      case (?schedule) {
        let updatedSchedule : SubstitutionSchedule = {
          lineupId = schedule.lineupId;
          substitutions;
          createdAt = schedule.createdAt;
          updatedAt = Int.abs(0);
        };
        substitutionSchedules := Substitutions.putSchedule(substitutionSchedules, lineupId, updatedSchedule);
      };
    };
  };

  public func deleteSubstitutionSchedule(lineupId : Text) : async () {
    if (not Substitutions.scheduleExists(substitutionSchedules, lineupId)) {
      Errors.trapSubstitutionScheduleNotFound();
    };
    substitutionSchedules := Substitutions.deleteSchedule(substitutionSchedules, lineupId);
  };

  public func getPlayerMinutesSummary(lineupId : Text) : async [(Text, Nat)] {
    switch (textMap.get(lineups, lineupId)) {
      case (null) { Errors.trapLineupNotFound() };
      case (?lineup) {
        let scheduleOpt = Substitutions.getSchedule(substitutionSchedules, lineupId);
        let totalMatchTime = timePerHalf * 2;

        // Initialize all players with 0 minutes
        var playerMinutesMap = textMap.empty<Nat>();
        for (player in lineup.players.vals()) {
          playerMinutesMap := textMap.put(playerMinutesMap, player.id, 0);
        };

        switch (scheduleOpt) {
          case (null) {
            // If no schedule, return all players with 0 minutes
            let result = Array.map<Player, (Text, Nat)>(
              lineup.players,
              func(p) { (p.id, 0) },
            );
            return result;
          };
          case (?schedule) {
            // Calculate minutes for each player
            for (player in lineup.players.vals()) {
              var minutes = 0;
              var isOnField = player.isOnField;
              var lastSubTime = 0;

              for (sub in schedule.substitutions.vals()) {
                if (isOnField and sub.fieldPlayerId == player.id) {
                  minutes += sub.time - lastSubTime;
                  isOnField := false;
                  lastSubTime := sub.time;
                } else if (not isOnField and sub.benchPlayerId == player.id) {
                  lastSubTime := sub.time;
                  isOnField := true;
                };
              };

              if (isOnField) {
                minutes += totalMatchTime - lastSubTime;
              };

              playerMinutesMap := textMap.put(playerMinutesMap, player.id, minutes);
            };

            // Convert map to array of tuples
            let result = Array.map<Player, (Text, Nat)>(
              lineup.players,
              func(p) {
                switch (textMap.get(playerMinutesMap, p.id)) {
                  case (null) { (p.id, 0) };
                  case (?minutes) { (p.id, minutes) };
                };
              },
            );
            return result;
          };
        };
      };
    };
  };

  // New function to clear substitution schedule
  public func clearSubstitutionSchedule(lineupId : Text) : async () {
    if (not Substitutions.scheduleExists(substitutionSchedules, lineupId)) {
      Errors.trapSubstitutionScheduleNotFound();
    };
    substitutionSchedules := Substitutions.deleteSchedule(substitutionSchedules, lineupId);
  };

  // Updated function to calculate minimum required substitutions based on total players
  public func calculateMinimumRequiredSubstitutions(lineupId : Text) : async Nat {
    switch (textMap.get(lineups, lineupId)) {
      case (null) { Errors.trapLineupNotFound() };
      case (?lineup) {
        let totalPlayers = Array.size(lineup.players);

        if (totalPlayers == 0) {
          Errors.trapNoPlayersInLineup();
        };

        // Calculate minimum required substitution rounds based on total players and max subs per round
        let minRequiredRounds = if (maxSimultaneousSubs != 0) {
          if (totalPlayers != 0) {
            Int.abs(Float.toInt(Float.fromInt(totalPlayers) / Float.fromInt(maxSimultaneousSubs)));
          } else { 0 };
        } else { 0 };

        if (minRequiredRounds == 0) {
          Errors.trapMinRequiredRoundsZero();
        };

        minRequiredRounds;
      };
    };
  };

  // Updated pure function to compute minimum substitution rounds based on total players
  public func computeMinSubRounds(
    totalPlayers : Nat,
    onField : Nat,
    gameMinutes : Nat,
    maxSubsPerRound : Nat,
    targetMinutesPerPlayer : ?Float,
    lockedOnFieldCount : ?Nat,
    lockedOffFieldCount : ?Nat,
  ) : async MinSubRoundsResult {
    SubsOrchestrator.computeMinSubRounds(
      totalPlayers,
      onField,
      gameMinutes,
      maxSubsPerRound,
      targetMinutesPerPlayer,
      lockedOnFieldCount,
      lockedOffFieldCount,
    );
  };

  // New function to generate strict FIFO rotation schedule
  public func generateStrictFifoRotationSchedule(
    lineupId : Text,
    substitutionIntervals : [Nat],
  ) : async SubstitutionSchedule {
    SubsOrchestrator.generateStrictFifoRotationSchedule(
      lineupId,
      substitutionIntervals,
      lineups,
      maxSimultaneousSubs,
      substitutionSchedules,
      Substitutions.putSchedule,
    );
  };

  // New function to check if a lineup exists
  public func lineupExists(id : Text) : async Bool {
    textMap.contains(lineups, id);
  };

  // New function to validate lineup existence and return error message if not found
  public func validateLineupExists(id : Text) : async () {
    if (not textMap.contains(lineups, id)) {
      Errors.trapLineupNotFound();
    };
  };

  // New function to get lineup with error handling
  public func getLineupWithValidation(id : Text) : async Lineup {
    switch (textMap.get(lineups, id)) {
      case (null) {
        Errors.trapLineupNotFound();
      };
      case (?lineup) { lineup };
    };
  };

  // New function to get all lineup IDs
  public func getAllLineupIds() : async [Text] {
    Iter.toArray(textMap.keys(lineups));
  };

  // Updated function to calculate projected game time per player with total off-field time and bench event count
  public func calculateProjectedGameTime(lineupId : Text, substitutionIntervals : [Nat]) : async [PlayerGameTime] {
    SubsOrchestrator.calculateProjectedGameTime(
      lineupId,
      substitutionIntervals,
      lineups,
      timePerHalf,
      substitutionSchedules,
      Substitutions.getSchedule,
    );
  };

  // New function to count bench events per player
  public func countBenchEvents(lineupId : Text) : async [BenchEventCount] {
    SubsOrchestrator.countBenchEvents(
      lineupId,
      lineups,
      substitutionSchedules,
      Substitutions.getSchedule,
    );
  };

  // New function to adjust subsPerRound for fairness
  public func adjustSubsPerRoundForFairness(lineupId : Text, initialSubsPerRound : Nat) : async Nat {
    SubsOrchestrator.adjustSubsPerRoundForFairness(
      lineupId,
      initialSubsPerRound,
      lineups,
    );
  };

  // New function to calculate fairness metrics for all players
  public func calculateFairnessMetrics(lineupId : Text) : async [FairnessMetrics] {
    SubsOrchestrator.calculateFairnessMetrics(
      lineupId,
      lineups,
      timePerHalf,
      substitutionSchedules,
      Substitutions.getSchedule,
    );
  };

  // Stripe configuration functions
  public shared ({ caller }) func setStripeConfiguration(config : Stripe.StripeConfiguration) : async () {
    Guards.requireAdmin(accessControlState, caller);
    stripeConfig := ?{
      publishableKey = config.secretKey;
      secretKey = config.secretKey;
      connected = true;
    };
  };

  public query func getStripeConfiguration() : async ?StripeConfiguration {
    stripeConfig;
  };

  public query func isStripeConfigured() : async Bool {
    switch (stripeConfig) {
      case (null) { false };
      case (?_) { true };
    };
  };

  public func getStripeSessionStatus(sessionId : Text) : async Stripe.StripeSessionStatus {
    switch (stripeConfig) {
      case (null) { Errors.trapStripeConfigNotFound() };
      case (?config) {
        let stripeConfig : Stripe.StripeConfiguration = {
          secretKey = config.secretKey;
          allowedCountries = ["US", "CA", "GB"];
        };
        await Stripe.getSessionStatus(stripeConfig, sessionId, transform);
      };
    };
  };

  public shared ({ caller }) func createCheckoutSession(items : [Stripe.ShoppingItem], successUrl : Text, cancelUrl : Text) : async Text {
    switch (stripeConfig) {
      case (null) { Errors.trapStripeConfigNotFound() };
      case (?config) {
        let stripeConfig : Stripe.StripeConfiguration = {
          secretKey = config.secretKey;
          allowedCountries = ["US", "CA", "GB"];
        };
        await Stripe.createCheckoutSession(stripeConfig, caller, items, successUrl, cancelUrl, transform);
      };
    };
  };

  public query func transform(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    OutCall.transform(input);
  };

  public query func isStripeConnected() : async Bool {
    switch (stripeConfig) {
      case (null) { false };
      case (?config) { config.connected };
    };
  };

  // Metrics functions
  public shared ({ caller }) func addMetrics(metricsData : Metrics) : async () {
    metricsRepo := MetricsService.add(metricsRepo, caller, metricsData);
  };

  public query func getMetrics(year : Nat, month : Nat) : async ?Metrics {
    MetricsService.get(metricsRepo, year, month);
  };

  public query func getAllMetrics() : async [Metrics] {
    MetricsService.all(metricsRepo);
  };

  public shared ({ caller }) func updateMetrics(year : Nat, month : Nat, updatedMetrics : Metrics) : async () {
    metricsRepo := MetricsService.update(metricsRepo, caller, year, month, updatedMetrics);
  };

  public shared ({ caller }) func deleteMetrics(year : Nat, month : Nat) : async () {
    metricsRepo := MetricsService.remove(metricsRepo, caller, year, month);
  };

  // Function to track logins
  public shared func trackLogin() : async () {
    metricsRepo := MetricsService.trackLogin(metricsRepo);
  };

  // File reference functions
  public shared ({ caller }) func registerFileReference(path : Text, hash : Text) : async () {
    Registry.add(registry, path, hash);
  };

  public query ({ caller }) func getFileReference(path : Text) : async Registry.FileReference {
    Registry.get(registry, path);
  };

  public query ({ caller }) func listFileReferences() : async [Registry.FileReference] {
    Registry.list(registry);
  };

  public shared ({ caller }) func dropFileReference(path : Text) : async () {
    Registry.remove(registry, path);
  };

  // New function to update a team
  public shared ({ caller }) func updateTeam(teamId : Text, updatedTeam : Team) : async () {
    Guards.requireTeamAdmin(userProfiles, caller, teamId);
    teams := textMap.put(teams, teamId, updatedTeam);
  };

  // New function to delete a team
  public shared ({ caller }) func deleteTeam(teamId : Text) : async () {
    Guards.requireTeamAdmin(userProfiles, caller, teamId);
    teams := textMap.delete(teams, teamId);
  };

  // Chat thread functions
  public shared ({ caller }) func createChatThread(title : Text, threadType : MessageType, clubId : ?Text, teamId : ?Text) : async Text {
    // Validate club admin for club threads
    switch (threadType) {
      case (#clubWide) {
        switch (clubId) {
          case (null) { Errors.trapKeyNotFoundInMap() };
          case (?_) {};
        };
      };
      case (#teamWide) {
        switch (teamId) {
          case (null) { Errors.trapKeyNotFoundInMap() };
          case (?tId) {
            Guards.requireTeamAdmin(userProfiles, caller, tId);
          };
        };
      };
      case (#broadcast) {
        Guards.requireAdmin(accessControlState, caller);
      };
    };

    let threadId = Text.concat(title, Int.toText(Time.now()));
    let thread : ChatThread = {
      id = threadId;
      title;
      creator = caller;
      createdAt = Time.now();
      clubId;
      teamId;
      threadType;
    };
    chatThreads := textMap.put(chatThreads, threadId, thread);
    threadId;
  };

  public query ({ caller }) func getChatThreadsByClub(clubId : Text) : async [ChatThread] {
    // Validate that the caller is a member of the club
    let isClubMember = switch (textMap.get(clubMembersIndex, clubId)) {
      case (null) { false };
      case (?members) {
        Array.find<ClubMember>(
          members,
          func(member) { member.userId == Principal.toText(caller) },
        ) != null;
      };
    };

    if (not isClubMember) {
      Debug.trap("Unauthorized: You are not a member of this club");
    };

    let clubThreads = Array.filter<ChatThread>(
      Iter.toArray(textMap.vals(chatThreads)),
      func(thread) {
        switch (thread.clubId) {
          case (?cId) { cId == clubId };
          case (null) { false };
        };
      },
    );
    clubThreads;
  };

  public query ({ caller }) func getChatThreadsByTeam(teamId : Text) : async [ChatThread] {
    // Validate that the caller is a member of the team
    let isTeamMember = switch (textMap.get(teamMembersIndex, teamId)) {
      case (null) { false };
      case (?members) {
        Array.find<TeamMember>(
          members,
          func(member) { member.userId == Principal.toText(caller) },
        ) != null;
      };
    };

    if (not isTeamMember) {
      Debug.trap("Unauthorized: You are not a member of this team");
    };

    let teamThreads = Array.filter<ChatThread>(
      Iter.toArray(textMap.vals(chatThreads)),
      func(thread) {
        switch (thread.teamId) {
          case (?tId) { tId == teamId };
          case (null) { false };
        };
      },
    );
    teamThreads;
  };

  public query ({ caller }) func getAllChatThreads() : async [ChatThread] {
    // Return only threads where the caller is a member of the corresponding team or club
    let allThreads = Iter.toArray(textMap.vals(chatThreads));
    let authorizedThreads = Array.filter<ChatThread>(
      allThreads,
      func(thread) {
        switch (thread.threadType) {
          case (#clubWide) {
            switch (thread.clubId) {
              case (null) { false };
              case (?clubId) {
                let isClubMember = switch (textMap.get(clubMembersIndex, clubId)) {
                  case (null) { false };
                  case (?members) {
                    Array.find<ClubMember>(
                      members,
                      func(member) { member.userId == Principal.toText(caller) },
                    ) != null;
                  };
                };
                isClubMember;
              };
            };
          };
          case (#teamWide) {
            switch (thread.teamId) {
              case (null) { false };
              case (?teamId) {
                let isTeamMember = switch (textMap.get(teamMembersIndex, teamId)) {
                  case (null) { false };
                  case (?members) {
                    Array.find<TeamMember>(
                      members,
                      func(member) { member.userId == Principal.toText(caller) },
                    ) != null;
                  };
                };
                isTeamMember;
              };
            };
          };
          case (#broadcast) { true };
        };
      },
    );
    authorizedThreads;
  };

  public shared ({ caller }) func deleteChatThread(threadId : Text) : async () {
    switch (textMap.get(chatThreads, threadId)) {
      case (null) { Errors.trapKeyNotFoundInMap() };
      case (?thread) {
        // Only creator can delete the thread
        if (thread.creator != caller) {
          Errors.trapUnauthorized();
        };
        chatThreads := textMap.delete(chatThreads, threadId);
      };
    };
  };

  // Message functions
  public shared ({ caller }) func sendMessage(threadId : Text, content : Text) : async () {
    // Validate that the caller is authorized to send messages in the thread
    switch (textMap.get(chatThreads, threadId)) {
      case (null) { Errors.trapKeyNotFoundInMap() };
      case (?thread) {
        let isAuthorized = switch (thread.threadType) {
          case (#clubWide) {
            switch (thread.clubId) {
              case (null) { false };
              case (?clubId) {
                let isClubMember = switch (textMap.get(clubMembersIndex, clubId)) {
                  case (null) { false };
                  case (?members) {
                    Array.find<ClubMember>(
                      members,
                      func(member) { member.userId == Principal.toText(caller) },
                    ) != null;
                  };
                };
                isClubMember;
              };
            };
          };
          case (#teamWide) {
            switch (thread.teamId) {
              case (null) { false };
              case (?teamId) {
                let isTeamMember = switch (textMap.get(teamMembersIndex, teamId)) {
                  case (null) { false };
                  case (?members) {
                    Array.find<TeamMember>(
                      members,
                      func(member) { member.userId == Principal.toText(caller) },
                    ) != null;
                  };
                };
                isTeamMember;
              };
            };
          };
          case (#broadcast) { true };
        };

        if (not isAuthorized) {
          Debug.trap("Unauthorized: You are not authorized to send messages in this thread");
        };

        let messageId = Text.concat(threadId, Int.toText(Time.now()));
        let message : Message = {
          id = messageId;
          threadId;
          sender = caller;
          content;
          timestamp = Time.now();
        };
        messagesRepo := MessagesRepo.addMessage(messagesRepo, message);

        // Create message notifications for all thread members except the sender
        let threadMembers = switch (thread.threadType) {
          case (#clubWide) {
            switch (thread.clubId) {
              case (null) { [] };
              case (?clubId) {
                switch (textMap.get(clubMembersIndex, clubId)) {
                  case (null) { [] };
                  case (?members) { members };
                };
              };
            };
          };
          case (#teamWide) {
            switch (thread.teamId) {
              case (null) { [] };
              case (?teamId) {
                switch (textMap.get(teamMembersIndex, teamId)) {
                  case (null) { [] };
                  case (?members) {
                    Array.map<TeamMember, ClubMember>(
                      members,
                      func(member) {
                        {
                          userId = member.userId;
                          displayName = member.displayName;
                          roles = member.roles;
                        };
                      },
                    );
                  };
                };
              };
            };
          };
          case (#broadcast) { [] };
        };

        // Fetch sender's display name
        let senderDisplayName = switch (principalMap.get(userProfiles, caller)) {
          case (null) { Principal.toText(caller) };
          case (?profile) { profile.displayName };
        };

        for (member in threadMembers.vals()) {
          if (member.userId != Principal.toText(caller)) {
            notificationsRepo := NotificationsService.createMessageNotification(notificationsRepo, Principal.fromText(member.userId), threadId, senderDisplayName # " has sent you a message");
          };
        };
      };
    };
  };

  public query ({ caller }) func getMessagesByThread(threadId : Text) : async [Message] {
    // Validate that the caller is authorized to view messages in the thread
    switch (textMap.get(chatThreads, threadId)) {
      case (null) { Errors.trapKeyNotFoundInMap() };
      case (?thread) {
        let isAuthorized = switch (thread.threadType) {
          case (#clubWide) {
            switch (thread.clubId) {
              case (null) { false };
              case (?clubId) {
                let isClubMember = switch (textMap.get(clubMembersIndex, clubId)) {
                  case (null) { false };
                  case (?members) {
                    Array.find<ClubMember>(
                      members,
                      func(member) { member.userId == Principal.toText(caller) },
                    ) != null;
                  };
                };
                isClubMember;
              };
            };
          };
          case (#teamWide) {
            switch (thread.teamId) {
              case (null) { false };
              case (?teamId) {
                let isTeamMember = switch (textMap.get(teamMembersIndex, teamId)) {
                  case (null) { false };
                  case (?members) {
                    Array.find<TeamMember>(
                      members,
                      func(member) { member.userId == Principal.toText(caller) },
                    ) != null;
                  };
                };
                isTeamMember;
              };
            };
          };
          case (#broadcast) { true };
        };

        if (not isAuthorized) {
          Debug.trap("Unauthorized: You are not authorized to view messages in this thread");
        };

        MessagesRepo.getMessagesByThread(messagesRepo, threadId);
      };
    };
  };

  public query ({ caller }) func getAllMessages() : async [Message] {
    // Return only messages from threads where the caller is authorized
    let allMessages = MessagesRepo.getAllMessages(messagesRepo);
    let authorizedMessages = Array.filter<Message>(
      allMessages,
      func(message) {
        switch (textMap.get(chatThreads, message.threadId)) {
          case (null) { false };
          case (?thread) {
            switch (thread.threadType) {
              case (#clubWide) {
                switch (thread.clubId) {
                  case (null) { false };
                  case (?clubId) {
                    let isClubMember = switch (textMap.get(clubMembersIndex, clubId)) {
                      case (null) { false };
                      case (?members) {
                        Array.find<ClubMember>(
                          members,
                          func(member) { member.userId == Principal.toText(caller) },
                        ) != null;
                      };
                    };
                    isClubMember;
                  };
                };
              };
              case (#teamWide) {
                switch (thread.teamId) {
                  case (null) { false };
                  case (?teamId) {
                    let isTeamMember = switch (textMap.get(teamMembersIndex, teamId)) {
                      case (null) { false };
                      case (?members) {
                        Array.find<TeamMember>(
                          members,
                          func(member) { member.userId == Principal.toText(caller) },
                        ) != null;
                      };
                    };
                    isTeamMember;
                  };
                };
              };
              case (#broadcast) { true };
            };
          };
        };
      },
    );
    authorizedMessages;
  };

  // Invite links and RSVP system functions
  public shared ({ caller }) func generateInviteCode() : async Text {
    Guards.requireAdmin(accessControlState, caller);
    let blob = await Random.blob();
    let code = InviteLinksModule.generateUUID(blob);
    InviteLinksModule.generateInviteCode(inviteState, code);
    code;
  };

  public func submitRSVP(name : Text, attending : Bool, inviteCode : Text) : async () {
    InviteLinksModule.submitRSVP(inviteState, name, attending, inviteCode);
  };

  public query ({ caller }) func getAllRSVPs() : async [InviteLinksModule.RSVP] {
    Guards.requireAdmin(accessControlState, caller);
    InviteLinksModule.getAllRSVPs(inviteState);
  };

  public query ({ caller }) func getInviteCodes() : async [InviteLinksModule.InviteCode] {
    Guards.requireAdmin(accessControlState, caller);
    InviteLinksModule.getInviteCodes(inviteState);
  };

  // Event management functions
  public shared ({ caller }) func createEvent(
    title : Text,
    eventType : EventType,
    dateTime : Int,
    location : Address,
    coordinates : Coordinates,
    description : Text,
    teamId : Text,
  ) : async Text {
    // Create the event
    eventsRepo := EventsRepo.createEvent(eventsRepo, title, eventType, dateTime, location, coordinates, description, teamId, caller);
    let eventId = Text.concat(title, Int.toText(dateTime));

    // Fetch team members
    let teamMembers = IndexesRepo.getTeamMembers(teamMembersIndex, teamId);

    // Create RSVP entries for each team member
    for (member in teamMembers.vals()) {
      let rsvp : RSVP = {
        eventId;
        userId = Principal.fromText(member.userId);
        status = #notResponded;
        timestamp = Time.now();
      };
      eventsRepo := EventsRepo.addRSVP(eventsRepo, rsvp);

      // Create event invitation notification for each member
      notificationsRepo := NotificationsService.createEventInvitationNotification(notificationsRepo, Principal.fromText(member.userId), eventId, teamId, "You have been invited to event " # title # " for team " # teamId);
    };

    // Fetch child profiles associated with the team
    let childProfilesForTeam = Array.filter<ChildProfile>(
      Iter.toArray(textMap.vals(childProfiles)),
      func(child) { child.teamId == teamId },
    );

    // Create RSVP entries for each child profile
    for (child in childProfilesForTeam.vals()) {
      let rsvp : RSVP = {
        eventId;
        userId = child.parentId; // Parent manages RSVP for child
        status = #notResponded;
        timestamp = Time.now();
      };
      eventsRepo := EventsRepo.addRSVP(eventsRepo, rsvp);

      // Create event invitation notification for each parent
      notificationsRepo := NotificationsService.createEventInvitationNotification(notificationsRepo, child.parentId, eventId, teamId, "Your child " # child.name # " has been invited to event " # title # " for team " # teamId);
    };

    eventId;
  };

  public query func getEventsByTeam(teamId : Text) : async [Event] {
    EventsRepo.getEventsByTeam(eventsRepo, teamId);
  };

  public query func getEvent(eventId : Text) : async ?Event {
    EventsRepo.getEvent(eventsRepo, eventId);
  };

  public shared ({ caller }) func updateEvent(eventId : Text, updatedEvent : Event) : async () {
    eventsRepo := EventsRepo.updateEvent(eventsRepo, eventId, updatedEvent, caller);
  };

  public shared ({ caller }) func deleteEvent(eventId : Text) : async () {
    eventsRepo := EventsRepo.deleteEvent(eventsRepo, eventId, caller);
  };

  // RSVP management functions
  public query func getRSVPsByEvent(eventId : Text) : async [RSVP] {
    EventsRepo.getRSVPsByEvent(eventsRepo, eventId);
  };

  public query func getRSVPsByUser(userId : Principal) : async [RSVP] {
    EventsRepo.getRSVPsByUser(eventsRepo, userId);
  };

  public query func getRSVP(eventId : Text, userId : Principal) : async ?RSVP {
    EventsRepo.getRSVP(eventsRepo, eventId, userId);
  };

  // New function to update RSVP status
  public shared ({ caller }) func updateRSVPStatus(eventId : Text, status : RSVPStatus) : async () {
    let rsvp : RSVP = {
      eventId;
      userId = caller;
      status;
      timestamp = Time.now();
    };
    eventsRepo := EventsRepo.addRSVP(eventsRepo, rsvp);

    // Fetch the event details
    switch (EventsRepo.getEvent(eventsRepo, eventId)) {
      case (null) {};
      case (?event) {
        // Notify the event creator about the RSVP response
        let responderName = switch (principalMap.get(userProfiles, caller)) {
          case (null) { Principal.toText(caller) };
          case (?profile) { profile.displayName };
        };

        let rsvpStatusText = switch (status) {
          case (#yes) { "Going" };
          case (#no) { "Not Going" };
          case (#maybe) { "Maybe" };
          case (#notResponded) { "Not Responded" };
        };

        let notificationMessage = responderName # " has RSVP'd " # rsvpStatusText # " for event " # event.title;

        notificationsRepo := NotificationsService.createEventInvitationNotification(notificationsRepo, event.creatorId, eventId, event.teamId, notificationMessage);

        // Notify all team admins about the RSVP response
        let teamAdmins = JoinRequestService.getTeamAdmins(teams, event.teamId);
        for (admin in teamAdmins.vals()) {
          notificationsRepo := NotificationsService.createEventInvitationNotification(notificationsRepo, admin, eventId, event.teamId, responderName # " has RSVP'd " # rsvpStatusText # " for event " # event.title);
        };
      };
    };
  };

  // Geocoding function
  public func geocodeAddress(address : Address) : async Coordinates {
    // Implement geocoding logic here
    // For now, return dummy coordinates
    {
      latitude = 0.0;
      longitude = 0.0;
    };
  };

  // Club management functions
  public shared ({ caller }) func createClub(name : Text, _sport : Text, logoPath : ?Text) : async Text {
    let clubId = Text.concat(name, Int.toText(Time.now()));
    let club : Club = {
      id = clubId;
      name;
      createdAt = Time.now();
      admins = [caller];
      logoPath;
    };
    clubRepo := ClubRepo.createClub(clubRepo, clubId, club);

    // Assign clubAdmin role to creator and update club members index
    switch (principalMap.get(userProfiles, caller)) {
      case (null) {};
      case (?profile) {
        clubMembersIndex := IndexesRepo.updateClubMembersIndex(clubMembersIndex, clubId, Principal.toText(caller), profile.displayName, #clubAdmin);

        // Assign clubAdmin role to the user profile
        userProfiles := RoleAssignment.assignClubAdminRole(userProfiles, clubRepo, caller, clubId);
      };
    };

    clubId;
  };

  public query func getClubs() : async [Club] {
    ClubRepo.getAllClubs(clubRepo);
  };

  public query func getClub(clubId : Text) : async ?Club {
    ClubRepo.getClub(clubRepo, clubId);
  };

  public shared ({ caller }) func updateClub(clubId : Text, updatedClub : Club) : async () {
    switch (ClubRepo.getClub(clubRepo, clubId)) {
      case (null) { Errors.trapKeyNotFoundInMap() };
      case (?club) {
        // Check if caller is club admin
        let isAdmin = Array.find<Principal>(club.admins, func(admin) { admin == caller });
        switch (isAdmin) {
          case (null) { Errors.trapUnauthorized() };
          case (?_) {
            clubRepo := ClubRepo.updateClub(clubRepo, clubId, updatedClub);
          };
        };
      };
    };
  };

  public shared ({ caller }) func deleteClub(clubId : Text) : async () {
    switch (ClubRepo.getClub(clubRepo, clubId)) {
      case (null) { Errors.trapKeyNotFoundInMap() };
      case (?club) {
        // Check if caller is club admin
        let isAdmin = Array.find<Principal>(club.admins, func(admin) { admin == caller });
        switch (isAdmin) {
          case (null) { Errors.trapUnauthorized() };
          case (?_) {
            // Delete the club
            clubRepo := ClubRepo.deleteClub(clubRepo, clubId);

            // Delete all teams associated with the club
            let teamsToDelete = Array.filter<Team>(
              Iter.toArray(textMap.vals(teams)),
              func(team) { team.clubId == clubId },
            );
            for (team in teamsToDelete.vals()) {
              teams := textMap.delete(teams, team.id);
            };

            // Remove all role permissions for the club and its teams from user profiles
            var updatedUserProfiles = userProfiles;
            for ((principal, profile) in principalMap.entries(userProfiles)) {
              let filteredTeamRoles = Array.filter<TeamRoleAssignment>(
                profile.teamRoles,
                func(assignment) {
                  switch (assignment.clubId) {
                    case (null) { true };
                    case (?cId) { cId != clubId };
                  };
                },
              );
              let filteredClubRoles = Array.filter<ClubRoleAssignment>(
                profile.clubRoles,
                func(assignment) { assignment.clubId != clubId },
              );
              let updatedProfile : UserProfile = {
                username = profile.username;
                displayName = profile.displayName;
                roles = profile.roles;
                teamRoles = filteredTeamRoles;
                clubRoles = filteredClubRoles;
              };
              updatedUserProfiles := principalMap.put(updatedUserProfiles, principal, updatedProfile);
            };
            userProfiles := updatedUserProfiles;

            // Delete all events linked to the club or its teams
            var updatedEventsRepo = eventsRepo;
            for (event in Iter.toArray(textMap.vals(eventsRepo.events)).vals()) {
              let isClubEvent = Array.find<Team>(
                teamsToDelete,
                func(team) { team.id == event.teamId },
              ) != null;
              if (isClubEvent) {
                updatedEventsRepo := {
                  events = textMap.delete(updatedEventsRepo.events, event.id);
                  rsvps = updatedEventsRepo.rsvps;
                };
              };
            };
            eventsRepo := updatedEventsRepo;

            // Delete all message threads related to the club or its teams
            var updatedChatThreads = chatThreads;
            for (thread in Iter.toArray(textMap.vals(chatThreads)).vals()) {
              let isClubThread = switch (thread.clubId) {
                case (null) { false };
                case (?cId) { cId == clubId };
              };
              let isTeamThread = switch (thread.teamId) {
                case (null) { false };
                case (?tId) {
                  Array.find<Team>(
                    teamsToDelete,
                    func(team) { team.id == tId },
                  ) != null;
                };
              };
              if (isClubThread or isTeamThread) {
                updatedChatThreads := textMap.delete(updatedChatThreads, thread.id);
              };
            };
            chatThreads := updatedChatThreads;

            // Update child profiles to remove club/team associations
            var updatedChildProfiles = childProfiles;
            for ((childId, child) in textMap.entries(childProfiles)) {
              if (child.clubId == clubId) {
                updatedChildProfiles := textMap.delete(updatedChildProfiles, childId);
              };
            };
            childProfiles := updatedChildProfiles;

            // Remove join requests for the club or its teams
            var updatedJoinRequests = joinRequests;
            for ((requestId, request) in textMap.entries(joinRequests)) {
              let isClubRequest = Array.find<Team>(
                teamsToDelete,
                func(team) { team.id == request.teamId },
              ) != null;
              if (isClubRequest) {
                updatedJoinRequests := textMap.delete(updatedJoinRequests, requestId);
              };
            };
            joinRequests := updatedJoinRequests;

            // Clean up notifications related to the club or its teams
            var updatedNotificationsRepo = notificationsRepo;
            for (notification in Iter.toArray(textMap.vals(notificationsRepo.notifications)).vals()) {
              let isClubNotification = switch (notification.notificationType) {
                case (#eventInvitation { teamId }) {
                  Array.find<Team>(
                    teamsToDelete,
                    func(team) { team.id == teamId },
                  ) != null;
                };
                case (#joinRequest { teamId }) {
                  Array.find<Team>(
                    teamsToDelete,
                    func(team) { team.id == teamId },
                  ) != null;
                };
              };
              if (isClubNotification) {
                updatedNotificationsRepo := {
                  notifications = textMap.delete(updatedNotificationsRepo.notifications, notification.id);
                };
              };
            };
            notificationsRepo := updatedNotificationsRepo;

            // Update member indexes to remove references to the deleted club and its teams
            clubMembersIndex := textMap.delete(clubMembersIndex, clubId);
            for (team in teamsToDelete.vals()) {
              teamMembersIndex := textMap.delete(teamMembersIndex, team.id);
            };
          };
        };
      };
    };
  };

  // New function to get all club members
  public query func getAllClubMembers() : async [ClubMember] {
    Collections.flatten<ClubMember>(Iter.toArray(textMap.vals(clubMembersIndex)));
  };

  // New function to get all team members
  public query func getAllTeamMembers() : async [TeamMember] {
    Collections.flatten<TeamMember>(Iter.toArray(textMap.vals(teamMembersIndex)));
  };

  // New function to get club members by club ID
  public query func getClubMembers(clubId : Text) : async [ClubMember] {
    IndexesRepo.getClubMembers(clubMembersIndex, clubId);
  };

  // New function to get team members by team ID
  public query func getTeamMembers(teamId : Text) : async [TeamMember] {
    IndexesRepo.getTeamMembers(teamMembersIndex, teamId);
  };

  // New function to remove a team member
  public shared ({ caller }) func removeTeamMember(teamId : Text, userId : Text) : async () {
    Guards.requireTeamAdmin(userProfiles, caller, teamId);
    teamMembersIndex := IndexesRepo.removeTeamMember(teamMembersIndex, teamId, userId);
  };

  // New function to remove a club member
  public shared ({ caller }) func removeClubMember(clubId : Text, userId : Text) : async () {
    // Check if caller is club admin
    switch (ClubRepo.getClub(clubRepo, clubId)) {
      case (null) { Errors.trapKeyNotFoundInMap() };
      case (?club) {
        let isAdmin = Array.find<Principal>(club.admins, func(admin) { admin == caller });
        switch (isAdmin) {
          case (null) { Errors.trapUnauthorized() };
          case (?_) {
            clubMembersIndex := IndexesRepo.removeClubMember(clubMembersIndex, clubId, userId);
          };
        };
      };
    };
  };

  // Join request functions
  public shared ({ caller }) func submitJoinRequest(teamId : Text, clubId : Text, requestedRole : UserRole) : async () {
    let joinRequest : JoinRequest = {
      id = Text.concat(Principal.toText(caller), teamId);
      userId = caller;
      teamId;
      requestedRole;
      status = #pending;
      timestamp = Time.now();
    };
    joinRequests := JoinRequestService.submitJoinRequest(joinRequests, joinRequest);

    // Notify team admins
    let teamAdmins = JoinRequestService.getTeamAdmins(teams, teamId);

    // Fetch the club name from the clubRepo
    let clubName = switch (ClubRepo.getClub(clubRepo, clubId)) {
      case (null) { "Unknown Club" };
      case (?club) { club.name };
    };

    // Fetch the user's display name from userProfiles
    let userDisplayName = switch (principalMap.get(userProfiles, caller)) {
      case (null) { Principal.toText(caller) };
      case (?profile) { profile.displayName };
    };

    for (admin in teamAdmins.vals()) {
      notificationsRepo := NotificationsService.createJoinRequestNotification(notificationsRepo, admin, teamId, requestedRole, userDisplayName # " wants to join " # teamId);
    };
  };

  public query ({ caller }) func getJoinRequestsByTeam(teamId : Text) : async [JoinRequest] {
    Guards.requireTeamAdmin(userProfiles, caller, teamId);
    JoinRequestService.getJoinRequestsByTeam(joinRequests, teamId);
  };

  public query ({ caller }) func getJoinRequestsByUser() : async [JoinRequest] {
    JoinRequestService.getJoinRequestsByUser(joinRequests, caller);
  };

  public shared ({ caller }) func approveJoinRequest(requestId : Text) : async () {
    let (updatedJoinRequests, joinRequest) = JoinRequestService.approveJoinRequest(joinRequests, requestId);
    joinRequests := updatedJoinRequests;

    // Assign role to user and add to team/club
    switch (joinRequest) {
      case (null) { Errors.trapKeyNotFoundInMap() };
      case (?request) {
        // Find the team to get the clubId
        switch (textMap.get(teams, request.teamId)) {
          case (null) { Errors.trapKeyNotFoundInMap() };
          case (?team) {
            let clubId = team.clubId;

            // Update user profile with new team role and clubId
            userProfiles := RoleAssignment.assignTeamRole(userProfiles, teams, request.userId, request.requestedRole, request.teamId, ?clubId);

            // Add to team members index
            switch (principalMap.get(userProfiles, request.userId)) {
              case (null) {};
              case (?profile) {
                // Add to team members index
                teamMembersIndex := IndexesRepo.updateTeamMembersIndex(teamMembersIndex, request.teamId, Principal.toText(request.userId), profile.displayName, request.requestedRole);

                // Add to club members index
                clubMembersIndex := IndexesRepo.updateClubMembersIndex(clubMembersIndex, clubId, Principal.toText(request.userId), profile.displayName, request.requestedRole);

                // Add all team roles to club members index
                let userTeamRoles = Collections.filter<TeamRoleAssignment>(
                  profile.teamRoles,
                  func(assignment) {
                    switch (assignment.clubId) {
                      case (null) { false };
                      case (?cId) { cId == clubId };
                    };
                  },
                );

                for (teamRole in userTeamRoles.vals()) {
                  clubMembersIndex := IndexesRepo.updateClubMembersIndex(clubMembersIndex, clubId, Principal.toText(request.userId), profile.displayName, teamRole.role);
                };

                // Create join request approval notification for the user
                notificationsRepo := NotificationsService.createJoinRequestApprovalNotification(notificationsRepo, request.userId, request.teamId, request.requestedRole, "Your request to join " # request.teamId # " has been approved.");
              };
            };
          };
        };
      };
    };
  };

  public shared ({ caller }) func rejectJoinRequest(requestId : Text) : async () {
    joinRequests := JoinRequestService.rejectJoinRequest(joinRequests, requestId);
  };

  // Helper function to convert UserRole to Text
  func userRoleToText(role : UserRole) : Text {
    switch (role) {
      case (#appAdmin) { "App Admin" };
      case (#coach) { "Coach" };
      case (#player) { "Player" };
      case (#parent) { "Parent" };
      case (#teamAdmin) { "Team Admin" };
      case (#clubAdmin) { "Club Admin" };
    };
  };

  // Child profile management functions
  public shared ({ caller }) func createChildProfile(name : Text, dateOfBirth : Text, clubId : Text, teamId : Text) : async Text {
    // Validate that the club exists
    switch (ClubRepo.getClub(clubRepo, clubId)) {
      case (null) {
        Debug.trap("Club not found. Please select a valid club before choosing a team.");
      };
      case (?_) {
        // Validate that the team exists and belongs to the selected club
        switch (textMap.get(teams, teamId)) {
          case (null) {
            Debug.trap("Team not found. Please select a valid team associated with the selected club.");
          };
          case (?team) {
            if (team.clubId != clubId) {
              Debug.trap("Selected team does not belong to the selected club. Please choose a team associated with the selected club.");
            };

            let childId = Text.concat(name, Int.toText(Time.now()));
            let childProfile : ChildProfile = {
              id = childId;
              name;
              dateOfBirth;
              clubId;
              teamId;
              parentId = caller;
            };
            childProfiles := textMap.put(childProfiles, childId, childProfile);

            // Automatically invite child to events for their team/club
            let teamEvents = EventsRepo.getEventsByTeam(eventsRepo, teamId);
            for (event in teamEvents.vals()) {
              let rsvp : RSVP = {
                eventId = event.id;
                userId = caller; // Parent manages RSVP for child
                status = #notResponded;
                timestamp = Time.now();
              };
              eventsRepo := EventsRepo.addRSVP(eventsRepo, rsvp);
            };

            return childId;
          };
        };
      };
    };
  };

  public query ({ caller }) func getChildProfilesByParent() : async [ChildProfile] {
    let allChildProfiles = Iter.toArray(textMap.vals(childProfiles));
    Array.filter<ChildProfile>(
      allChildProfiles,
      func(child) { child.parentId == caller },
    );
  };

  public query func getChildProfile(childId : Text) : async ?ChildProfile {
    textMap.get(childProfiles, childId);
  };

  public shared ({ caller }) func updateChildProfile(childId : Text, updatedProfile : ChildProfile) : async () {
    switch (textMap.get(childProfiles, childId)) {
      case (null) { Errors.trapKeyNotFoundInMap() };
      case (?profile) {
        if (profile.parentId != caller) {
          Errors.trapUnauthorized();
        };
        childProfiles := textMap.put(childProfiles, childId, updatedProfile);
      };
    };
  };

  public shared ({ caller }) func deleteChildProfile(childId : Text) : async () {
    switch (textMap.get(childProfiles, childId)) {
      case (null) { Errors.trapKeyNotFoundInMap() };
      case (?profile) {
        if (profile.parentId != caller) {
          Errors.trapUnauthorized();
        };
        childProfiles := textMap.delete(childProfiles, childId);
      };
    };
  };

  // Proxy RSVP management for children
  public shared ({ caller }) func updateChildRSVP(childId : Text, eventId : Text, status : RSVPStatus) : async () {
    switch (textMap.get(childProfiles, childId)) {
      case (null) { Errors.trapKeyNotFoundInMap() };
      case (?profile) {
        if (profile.parentId != caller) {
          Errors.trapUnauthorized();
        };
        let rsvp : RSVP = {
          eventId;
          userId = caller; // Parent manages RSVP for child
          status;
          timestamp = Time.now();
        };
        eventsRepo := EventsRepo.addRSVP(eventsRepo, rsvp);
      };
    };
  };

  // New function to get all users (app admin only)
  public query ({ caller }) func getAllUsers() : async [UserProfile] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Debug.trap("Unauthorized: Only app admins can view all users");
    };
    Iter.toArray(principalMap.vals(userProfiles));
  };

  // New function to assign role to any user (app admin only)
  public shared ({ caller }) func assignRoleToUser(user : Principal, role : UserRole) : async () {

  };
};

