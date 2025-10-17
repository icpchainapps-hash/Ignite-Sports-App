import OrderedMap "mo:base/OrderedMap";
import Text "mo:base/Text";
import Iter "mo:base/Iter";
import Array "mo:base/Array";
import Principal "mo:base/Principal";

module MessagesRepo {
  type Message = {
    id : Text;
    threadId : Text;
    sender : Principal;
    content : Text;
    timestamp : Int;
  };

  public type MessagesRepo = {
    messages : OrderedMap.Map<Text, Message>;
  };

  public func init() : MessagesRepo {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    {
      messages = textMap.empty<Message>();
    };
  };

  public func addMessage(repo : MessagesRepo, message : Message) : MessagesRepo {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    {
      messages = textMap.put(repo.messages, message.id, message);
    };
  };

  public func getMessagesByThread(repo : MessagesRepo, threadId : Text) : [Message] {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    let threadMessages = Iter.toArray(textMap.vals(repo.messages));
    Array.filter<Message>(
      threadMessages,
      func(message) { message.threadId == threadId },
    );
  };

  public func getAllMessages(repo : MessagesRepo) : [Message] {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    Iter.toArray(textMap.vals(repo.messages));
  };
};
