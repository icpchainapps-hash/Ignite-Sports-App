import HashMap "mo:base/HashMap";
import Text "mo:base/Text";
import Iter "mo:base/Iter";
import Debug "mo:base/Debug";

module UserRepo {
  type UserRole = {
    #appAdmin;
    #coach;
    #player;
    #parent;
    #teamAdmin;
    #clubAdmin;
  };

  type UserProfile = {
    username : Text;
    displayName : Text;
    roles : [UserRole];
  };

  transient let textHash = HashMap.Make<Text>(Text.equal, Text.hash);

  /// Creates a new user profile.
  public func createUserProfile(username : Text, displayName : Text, roles : [UserRole]) : UserProfile {
    {
      username;
      displayName;
      roles;
    };
  };

  /// Retrieves a user profile by username.
  public func getUserProfile(userProfiles : HashMap.HashMap<Text, UserProfile>, username : Text) : ?UserProfile {
    textHash.get(userProfiles, username);
  };

  /// Updates an existing user profile.
  public func updateUserProfile(userProfiles : HashMap.HashMap<Text, UserProfile>, username : Text, updatedProfile : UserProfile) : HashMap.HashMap<Text, UserProfile> {
    if (not textHash.contains(userProfiles, username)) {
      Debug.trap("User profile not found");
    };
    textHash.put(userProfiles, username, updatedProfile);
  };

  /// Deletes a user profile.
  public func deleteUserProfile(userProfiles : HashMap.HashMap<Text, UserProfile>, username : Text) : HashMap.HashMap<Text, UserProfile> {
    if (not textHash.contains(userProfiles, username)) {
      Debug.trap("User profile not found");
    };
    textHash.delete(userProfiles, username);
  };

  /// Retrieves all user profiles.
  public func getAllUserProfiles(userProfiles : HashMap.HashMap<Text, UserProfile>) : [UserProfile] {
    Iter.toArray(textHash.vals(userProfiles));
  };

  /// Checks if a user profile exists for a given username.
  public func userProfileExists(userProfiles : HashMap.HashMap<Text, UserProfile>, username : Text) : Bool {
    textHash.contains(userProfiles, username);
  };

  /// Clears all user profiles.
  public func clearAllUserProfiles() : HashMap.HashMap<Text, UserProfile> {
    textHash.empty();
  };
};
