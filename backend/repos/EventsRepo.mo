import OrderedMap "mo:base/OrderedMap";
import Text "mo:base/Text";
import Iter "mo:base/Iter";
import Debug "mo:base/Debug";
import Types "../domain/Types";
import Int "mo:base/Int";
import Principal "mo:base/Principal";

module EventsRepo {
  type Event = Types.Event;
  type RSVP = Types.RSVP;
  type EventType = Types.EventType;
  type Address = Types.Address;
  type Coordinates = Types.Coordinates;

  public type EventsRepo = {
    events : OrderedMap.Map<Text, Event>;
    rsvps : OrderedMap.Map<Text, RSVP>;
  };

  public func init() : EventsRepo {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    {
      events = textMap.empty<Event>();
      rsvps = textMap.empty<RSVP>();
    };
  };

  public func createEvent(repo : EventsRepo, title : Text, eventType : EventType, dateTime : Int, location : Address, coordinates : Coordinates, description : Text, teamId : Text, creatorId : Principal) : EventsRepo {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    let eventId = Text.concat(title, Int.toText(dateTime));
    let event : Event = {
      id = eventId;
      title;
      eventType;
      dateTime;
      location;
      coordinates;
      description;
      teamId;
      creatorId;
    };
    {
      events = textMap.put(repo.events, eventId, event);
      rsvps = repo.rsvps;
    };
  };

  public func addRSVP(repo : EventsRepo, rsvp : RSVP) : EventsRepo {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    {
      events = repo.events;
      rsvps = textMap.put(repo.rsvps, Text.concat(Principal.toText(rsvp.userId), rsvp.eventId), rsvp);
    };
  };

  public func getEventsByTeam(repo : EventsRepo, _ : Text) : [Event] {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    let teamEvents = Iter.toArray(textMap.vals(repo.events));
    teamEvents;
  };

  public func getEvent(repo : EventsRepo, eventId : Text) : ?Event {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    textMap.get(repo.events, eventId);
  };

  public func updateEvent(repo : EventsRepo, eventId : Text, updatedEvent : Event, caller : Principal) : EventsRepo {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    switch (textMap.get(repo.events, eventId)) {
      case (null) { Debug.trap("Event not found") };
      case (?event) {
        if (event.creatorId != caller) {
          Debug.trap("Unauthorized: Only the creator can update the event");
        };
        {
          events = textMap.put(repo.events, eventId, updatedEvent);
          rsvps = repo.rsvps;
        };
      };
    };
  };

  public func deleteEvent(repo : EventsRepo, eventId : Text, caller : Principal) : EventsRepo {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    switch (textMap.get(repo.events, eventId)) {
      case (null) { Debug.trap("Event not found") };
      case (?event) {
        if (event.creatorId != caller) {
          Debug.trap("Unauthorized: Only the creator can delete the event");
        };
        {
          events = textMap.delete(repo.events, eventId);
          rsvps = repo.rsvps;
        };
      };
    };
  };

  public func getRSVPsByEvent(repo : EventsRepo, _ : Text) : [RSVP] {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    let eventRSVPs = Iter.toArray(textMap.vals(repo.rsvps));
    eventRSVPs;
  };

  public func getRSVPsByUser(repo : EventsRepo, _ : Principal) : [RSVP] {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    let userRSVPs = Iter.toArray(textMap.vals(repo.rsvps));
    userRSVPs;
  };

  public func getRSVP(repo : EventsRepo, eventId : Text, userId : Principal) : ?RSVP {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    let rsvpId = Text.concat(Principal.toText(userId), eventId);
    textMap.get(repo.rsvps, rsvpId);
  };
};

