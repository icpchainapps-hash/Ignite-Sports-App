import OrderedMap "mo:base/OrderedMap";
import Text "mo:base/Text";
import Principal "mo:base/Principal";

module {
  public let textMap = OrderedMap.Make<Text>(Text.compare);
  public let principalMap = OrderedMap.Make<Principal>(Principal.compare);
};
