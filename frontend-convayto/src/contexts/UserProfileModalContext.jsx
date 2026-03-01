// ==========================================
// Context for opening a user profile modal from anywhere
// ==========================================
import { createContext, useContext, useState, useCallback } from "react";
import UserProfileModal from "../components/UserProfileModal";

const UserProfileModalCtx = createContext(null);

export function UserProfileModalProvider({ children }) {
  const [profileUsername, setProfileUsername] = useState(null);

  const openUserProfile = useCallback((username) => {
    setProfileUsername(username);
  }, []);

  const closeUserProfile = useCallback(() => {
    setProfileUsername(null);
  }, []);

  return (
    <UserProfileModalCtx.Provider value={{ openUserProfile, closeUserProfile }}>
      {children}
      {profileUsername && (
        <UserProfileModal
          username={profileUsername}
          onClose={closeUserProfile}
        />
      )}
    </UserProfileModalCtx.Provider>
  );
}

export function useUserProfileModal() {
  const ctx = useContext(UserProfileModalCtx);
  if (!ctx)
    throw new Error(
      "useUserProfileModal must be used within UserProfileModalProvider",
    );
  return ctx;
}
