import OrderedMap "mo:base/OrderedMap";
import Text "mo:base/Text";
import Iter "mo:base/Iter";
import Principal "mo:base/Principal";
import Types "../domain/Types";
import Debug "mo:base/Debug";
import Int "mo:base/Int";
import Time "mo:base/Time";
import Array "mo:base/Array";

module NotificationsService {
  type Notification = Types.Notification;
  type NotificationType = Types.NotificationType;
  type UserRole = Types.UserRole;

  public type NotificationsRepo = {
    notifications : OrderedMap.Map<Text, Notification>;
  };

  public func init() : NotificationsRepo {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    {
      notifications = textMap.empty<Notification>();
    };
  };

  public func createEventInvitationNotification(repo : NotificationsRepo, userId : Principal, eventId : Text, teamId : Text, message : Text) : NotificationsRepo {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    let notification : Notification = {
      id = Text.concat(Principal.toText(userId), Int.toText(Int.abs(Time.now())));
      userId;
      notificationType = #eventInvitation { eventId; teamId };
      message;
      timestamp = Int.abs(Time.now());
      read = false;
    };
    {
      notifications = textMap.put(repo.notifications, notification.id, notification);
    };
  };

  public func createJoinRequestNotification(repo : NotificationsRepo, userId : Principal, teamId : Text, requestedRole : UserRole, message : Text) : NotificationsRepo {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    let notification : Notification = {
      id = Text.concat(Principal.toText(userId), Int.toText(Int.abs(Time.now())));
      userId;
      notificationType = #joinRequest { teamId; requestedRole };
      message;
      timestamp = Int.abs(Time.now());
      read = false;
    };
    {
      notifications = textMap.put(repo.notifications, notification.id, notification);
    };
  };

  public func createJoinRequestApprovalNotification(repo : NotificationsRepo, userId : Principal, teamId : Text, approvedRole : UserRole, message : Text) : NotificationsRepo {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    let notification : Notification = {
      id = Text.concat(Principal.toText(userId), Int.toText(Int.abs(Time.now())));
      userId;
      notificationType = #joinRequest { teamId; requestedRole = approvedRole };
      message;
      timestamp = Int.abs(Time.now());
      read = false;
    };
    {
      notifications = textMap.put(repo.notifications, notification.id, notification);
    };
  };

  public func createMessageNotification(repo : NotificationsRepo, userId : Principal, threadId : Text, message : Text) : NotificationsRepo {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    let notification : Notification = {
      id = Text.concat(Principal.toText(userId), Int.toText(Int.abs(Time.now())));
      userId;
      notificationType = #message { threadId };
      message;
      timestamp = Int.abs(Time.now());
      read = false;
    };
    {
      notifications = textMap.put(repo.notifications, notification.id, notification);
    };
  };

  public func markNotificationAsRead(repo : NotificationsRepo, notificationId : Text, caller : Principal) : NotificationsRepo {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    switch (textMap.get(repo.notifications, notificationId)) {
      case (null) { Debug.trap("Notification not found") };
      case (?notification) {
        if (notification.userId != caller) {
          Debug.trap("Unauthorized: Only the recipient can mark the notification as read");
        };
        let updatedNotification : Notification = {
          id = notification.id;
          userId = notification.userId;
          notificationType = notification.notificationType;
          message = notification.message;
          timestamp = notification.timestamp;
          read = true;
        };
        {
          notifications = textMap.put(repo.notifications, notificationId, updatedNotification);
        };
      };
    };
  };

  public func getNotificationsByUser(repo : NotificationsRepo, userId : Principal) : [Notification] {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    let userNotifications = Iter.toArray(textMap.vals(repo.notifications));
    Array.filter<Notification>(
      userNotifications,
      func(notification) { notification.userId == userId },
    );
  };

  public func getUnreadNotificationsCount(repo : NotificationsRepo, userId : Principal) : Nat {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    let userNotifications = Iter.toArray(textMap.vals(repo.notifications));
    var count = 0;
    for (notification in userNotifications.vals()) {
      if (notification.userId == userId and not notification.read) {
        count += 1;
      };
    };
    count;
  };
};

