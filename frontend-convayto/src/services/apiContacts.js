// ==========================================
// API layer for contacts & user profile
// ==========================================
import { apiFetch } from "./apiHelper";

/** Fetch current user's contact list */
export async function fetchContacts() {
  return apiFetch("/api/contacts");
}

/** Add a user to contacts */
export async function addContact(username) {
  return apiFetch(`/api/contacts/${encodeURIComponent(username)}`, {
    method: "POST",
  });
}

/** Remove a user from contacts */
export async function removeContact(username) {
  return apiFetch(`/api/contacts/${encodeURIComponent(username)}`, {
    method: "DELETE",
  });
}

/** Fetch another user's public profile (includes isContact flag) */
export async function fetchUserProfile(username) {
  return apiFetch(`/api/profile/${encodeURIComponent(username)}`);
}
