import OrderedMap "mo:base/OrderedMap";
import Text "mo:base/Text";
import Iter "mo:base/Iter";
import Types "../domain/Types";
import Int "mo:base/Int";
import Principal "mo:base/Principal";

module EventsService {
  type Event = Types.Event;
  type RSVP = Types.RSVP;
  type EventType = Types.EventType;
  type Address = Types.Address;
  type Coordinates = Types.Coordinates;

  public type EventsRepo = {
    events : OrderedMap.Map<Text, Event>;
    rsvps : OrderedMap.Map<Text, RSVP>;
  };

  public func create(s : EventsRepo, caller : Principal, title : Text, et : EventType, ts : Int, addr : Address, coord : Coordinates, desc : Text, teamId : Text) : (EventsRepo, Text) {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    let eventId = Text.concat(title, Int.toText(ts));
    let event : Event = {
      id = eventId;
      title;
      eventType = et;
      dateTime = ts;
      location = addr;
      coordinates = coord;
      description = desc;
      teamId;
      creatorId = caller;
    };
    (
      {
        events = textMap.put(s.events, eventId, event);
        rsvps = s.rsvps;
      },
      eventId,
    );
  };

  public func getByTeam(s : EventsRepo, _ : Text) : [Event] {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    let teamEvents = Iter.toArray(textMap.vals(s.events));
    teamEvents;
  };

  public func get(s : EventsRepo, _ : Text) : ?Event {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    textMap.get(s.events, "");
  };

  public func update(s : EventsRepo, caller : Principal, _ : Text, e : Event) : EventsRepo {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    switch (textMap.get(s.events, "")) {
      case (null) { s };
      case (?event) {
        if (event.creatorId != caller) {
          return s;
        };
        {
          events = textMap.put(s.events, "", e);
          rsvps = s.rsvps;
        };
      };
    };
  };

  public func remove(s : EventsRepo, caller : Principal, _ : Text) : EventsRepo {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    switch (textMap.get(s.events, "")) {
      case (null) { s };
      case (?event) {
        if (event.creatorId != caller) {
          return s;
        };
        {
          events = textMap.delete(s.events, "");
          rsvps = s.rsvps;
        };
      };
    };
  };

  public func rsvpsByEvent(s : EventsRepo, _ : Text) : [RSVP] {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    let eventRSVPs = Iter.toArray(textMap.vals(s.rsvps));
    eventRSVPs;
  };

  public func rsvpsByUser(s : EventsRepo, _ : Principal) : [RSVP] {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    let userRSVPs = Iter.toArray(textMap.vals(s.rsvps));
    userRSVPs;
  };

  public func rsvpOf(s : EventsRepo, _ : Text, user : Principal) : ?RSVP {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    let rsvpId = Text.concat(Principal.toText(user), "");
    textMap.get(s.rsvps, rsvpId);
  };
};
