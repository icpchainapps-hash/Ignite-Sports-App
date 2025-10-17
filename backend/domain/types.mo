module {
  public type PlayerRole = {
    #goalkeeper;
    #defender;
    #midfielder;
    #forward;
  };

  public type PositionEligibility = {
    goalkeeper : Bool;
    defender : Bool;
    midfielder : Bool;
    forward : Bool;
  };

  public type Player = {
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

  public type Formation = {
    #fourFourTwo;
    #fourThreeThree;
    #threeFiveTwo;
    #fourTwoThreeOne;
    #custom;
  };

  public type Lineup = {
    id : Text;
    name : Text;
    formation : Formation;
    players : [Player];
    createdAt : Int;
    updatedAt : Int;
  };

  public type Substitution = {
    time : Nat;
    fieldPlayerId : Text;
    benchPlayerId : Text;
  };

  public type SubstitutionSchedule = {
    lineupId : Text;
    substitutions : [Substitution];
    createdAt : Int;
    updatedAt : Int;
  };

  public type SubstitutionSpeedMode = {
    #slow;
    #medium;
    #fast;
  };

  public type MinSubRoundsResult = {
    R : Nat;
    stintMinutes : Float;
    details : {
      totalPlayers : Nat;
      onField : Nat;
      gameMinutes : Nat;
      maxSubsPerRound : Nat;
      targetMinutesPerPlayer : Float;
      lockedOnFieldCount : Nat;
      lockedOffFieldCount : Nat;
      benchSize : Nat;
      totalFieldMinutes : Nat;
      totalBenchMinutes : Nat;
      minRounds : Nat;
      minStintMinutes : Float;
      isFeasible : Bool;
      errorMessage : ?Text;
    };
  };

  public type PlayerGameTime = {
    playerId : Text;
    playerName : Text;
    totalMinutes : Float;
    onFieldIntervals : [(Nat, Nat)];
    totalIntervals : Nat;
    isOnField : Bool;
    totalOffFieldTime : Float;
    benchEventCount : Nat;
  };

  public type BenchEventCount = {
    playerId : Text;
    playerName : Text;
    benchEvents : Nat;
  };

  public type FairnessMetrics = {
    playerId : Text;
    playerName : Text;
    targetBenchCount : Nat;
    actualBenchCount : Nat;
    totalMinutes : Float;
    offFieldMinutes : Float;
    deviationFromTarget : Float;
  };

  public type SubstitutionRound = {
    roundNumber : Nat;
    time : Nat;
    substitutions : [Substitution];
  };

  public type SubstitutionScheduleWithRounds = {
    lineupId : Text;
    rounds : [SubstitutionRound];
    createdAt : Int;
    updatedAt : Int;
  };

  public type SubstitutionCombination = {
    numSubs : Nat;
    projectedVariance : Float;
    projectedMinutes : [PlayerGameTime];
    roundDetails : [SubstitutionRound];
  };

  public type SubstitutionPreview = {
    optimalCombination : SubstitutionCombination;
    allCombinations : [SubstitutionCombination];
    playerMinutesSummary : [PlayerGameTime];
    fairnessMetrics : [FairnessMetrics];
    benchEventCounts : [BenchEventCount];
    totalRounds : Nat;
    intervalLength : Nat;
    totalMatchTime : Nat;
  };

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

  public type StripeConfiguration = {
    publishableKey : Text;
    secretKey : Text;
    connected : Bool;
  };

  public type Metrics = {
    clubs : Nat;
    teams : Nat;
    logins : Nat;
    users : Nat;
    revenue : Float;
    year : Nat;
    month : Nat;
  };

  public type Club = {
    id : Text;
    name : Text;
    createdAt : Int;
    admins : [Principal];
    logoPath : ?Text;
  };

  public type Team = {
    id : Text;
    name : Text;
    clubId : Text;
    createdAt : Int;
    admins : [Principal];
    players : [Player];
  };

  public type ChatThread = {
    id : Text;
    title : Text;
    creator : Principal;
    createdAt : Int;
    clubId : ?Text;
    teamId : ?Text;
    threadType : MessageType;
  };

  public type MessageType = {
    #clubWide;
    #teamWide;
    #broadcast;
  };

  public type Address = {
    street : Text;
    city : Text;
    state : Text;
    postcode : Text;
  };

  public type Coordinates = {
    latitude : Float;
    longitude : Float;
  };

  public type EventType = {
    #game;
    #match;
    #socialEvent;
    #training;
  };

  public type Event = {
    id : Text;
    title : Text;
    eventType : EventType;
    dateTime : Int;
    location : Address;
    coordinates : Coordinates;
    description : Text;
    teamId : Text;
    creatorId : Principal;
  };

  public type RSVPStatus = {
    #yes;
    #no;
    #maybe;
    #notResponded;
  };

  public type RSVP = {
    eventId : Text;
    userId : Principal;
    status : RSVPStatus;
    timestamp : Int;
  };

  public type NotificationType = {
    #eventInvitation : { eventId : Text; teamId : Text };
    #joinRequest : { teamId : Text; requestedRole : UserRole };
    #message : { threadId : Text };
  };

  public type Notification = {
    id : Text;
    userId : Principal;
    notificationType : NotificationType;
    message : Text;
    timestamp : Int;
    read : Bool;
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

  public type JoinRequest = {
    id : Text;
    userId : Principal;
    teamId : Text;
    requestedRole : UserRole;
    status : {
      #pending;
      #approved;
      #rejected;
    };
    timestamp : Int;
  };
};

