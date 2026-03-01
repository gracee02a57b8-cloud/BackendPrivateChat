// ==========================================
// ContactsUnreadNotifications.test.jsx
// Tests for: unread store, contacts filtering, unread badge, message notifications
// ==========================================
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ====== Mocks ======

// react-router-dom
vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({}),
  Link: ({ children, to }) => <a href={to}>{children}</a>,
}));

// react-query
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: null, isPending: false, error: null }),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
    prefetchQuery: vi.fn(),
    prefetchInfiniteQuery: vi.fn(),
  }),
}));

// apiHelper
vi.mock("../services/apiHelper", () => ({
  apiFetch: vi.fn(() => Promise.resolve([])),
}));

// react-hot-toast
vi.mock("react-hot-toast", () => {
  const fn = vi.fn();
  fn.success = vi.fn();
  fn.error = vi.fn();
  fn.custom = vi.fn();
  fn.dismiss = vi.fn();
  return { default: fn, Toaster: () => null };
});

// wsService
vi.mock("../services/wsService", () => ({
  onWsMessage: vi.fn((cb) => {
    return () => {};
  }),
  sendWsMessage: vi.fn(),
  isWsConnected: vi.fn(() => true),
  connectWebSocket: vi.fn(),
  disconnectWebSocket: vi.fn(),
  onCallMessage: vi.fn(() => () => {}),
  onConferenceMessage: vi.fn(() => () => {}),
  onWsConnection: vi.fn(() => () => {}),
}));

// contexts
vi.mock("../contexts/UiContext", () => ({
  useUi: () => ({ closeSidebar: vi.fn() }),
  UiProvider: ({ children }) => children,
}));

vi.mock("../hooks/useOnlineUsers", () => ({
  useOnlineUsers: () => new Set(),
}));

vi.mock("../utils/showMessageToast", () => ({
  showMessageToast: vi.fn(),
}));

// ====== Imports (after mocks) ======
import { apiFetch } from "../services/apiHelper";
import toast from "react-hot-toast";
import { showMessageToast } from "../utils/showMessageToast";
import { onWsMessage } from "../services/wsService";
import * as unreadStore from "../utils/unreadStore";
import { getContacts } from "../features/sideBar/useContacts";
import { subscribeRealtimeConversation } from "../features/sideBar/apiRealtimeConversation";
import UserItem from "../components/UserItem";

// ============================================================
// 1. Unread Store
// ============================================================
describe("Unread Store", () => {
  beforeEach(() => {
    unreadStore._reset();
  });

  it("increment increases count for a room", () => {
    unreadStore.increment("r1");
    expect(unreadStore.getCount("r1")).toBe(1);
    unreadStore.increment("r1");
    expect(unreadStore.getCount("r1")).toBe(2);
  });

  it("clear removes count for a room", () => {
    unreadStore.increment("r1");
    unreadStore.increment("r1");
    unreadStore.clear("r1");
    expect(unreadStore.getCount("r1")).toBe(0);
  });

  it("getCounts returns all counts", () => {
    unreadStore.increment("r1");
    unreadStore.increment("r2");
    unreadStore.increment("r2");
    expect(unreadStore.getCounts()).toEqual({ r1: 1, r2: 2 });
  });

  it("setActiveRoom clears unread and blocks further increments", () => {
    unreadStore.increment("r1");
    expect(unreadStore.getCount("r1")).toBe(1);
    unreadStore.setActiveRoom("r1");
    expect(unreadStore.getCount("r1")).toBe(0);
    unreadStore.increment("r1");
    expect(unreadStore.getCount("r1")).toBe(0);
  });

  it("setActiveRoom(null) allows increments again", () => {
    unreadStore.setActiveRoom("r1");
    unreadStore.increment("r1");
    expect(unreadStore.getCount("r1")).toBe(0);
    unreadStore.setActiveRoom(null);
    unreadStore.increment("r1");
    expect(unreadStore.getCount("r1")).toBe(1);
  });

  it("subscribe notifies on changes and unsubscribe stops", () => {
    const fn = vi.fn();
    const unsub = unreadStore.subscribe(fn);
    unreadStore.increment("r1");
    expect(fn).toHaveBeenCalledWith({ r1: 1 });
    unsub();
    unreadStore.increment("r1");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("getActiveRoom tracks current state", () => {
    expect(unreadStore.getActiveRoom()).toBeNull();
    unreadStore.setActiveRoom("r1");
    expect(unreadStore.getActiveRoom()).toBe("r1");
    unreadStore.setActiveRoom(null);
    expect(unreadStore.getActiveRoom()).toBeNull();
  });

  it("persists to localStorage", () => {
    unreadStore.increment("r1");
    const stored = JSON.parse(localStorage.getItem("barsik_unread"));
    expect(stored).toEqual({ r1: 1 });
  });

  it("different rooms increment independently", () => {
    unreadStore.increment("r1");
    unreadStore.increment("r2");
    unreadStore.increment("r1");
    expect(unreadStore.getCount("r1")).toBe(2);
    expect(unreadStore.getCount("r2")).toBe(1);
  });

  it("clear only affects specified room", () => {
    unreadStore.increment("r1");
    unreadStore.increment("r2");
    unreadStore.clear("r1");
    expect(unreadStore.getCount("r1")).toBe(0);
    expect(unreadStore.getCount("r2")).toBe(1);
  });
});

// ============================================================
// 2. Contacts Filtering (getContacts)
// ============================================================
describe("getContacts", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    localStorage.setItem("username", "me");
  });

  it("returns only users from private conversations", async () => {
    vi.mocked(apiFetch).mockImplementation((url) => {
      if (url === "/api/chat/contacts") {
        return Promise.resolve([
          { contact: "alice", firstName: "Alice", online: true, avatarUrl: "", tag: "" },
          { contact: "bob", firstName: "Bob", online: false, avatarUrl: "", tag: "" },
          { contact: "charlie", firstName: "Charlie", online: false, avatarUrl: "", tag: "" },
        ]);
      }
      if (url === "/api/rooms") {
        return Promise.resolve([
          { id: "r1", type: "PRIVATE", members: ["me", "alice"] },
          { id: "r2", type: "PRIVATE", members: ["me", "bob"] },
          { id: "r3", type: "ROOM", members: ["me", "alice", "charlie"] },
        ]);
      }
      return Promise.resolve([]);
    });

    const contacts = await getContacts();
    expect(contacts).toHaveLength(2);
    const usernames = contacts.map((c) => c.username);
    expect(usernames).toContain("alice");
    expect(usernames).toContain("bob");
    expect(usernames).not.toContain("charlie");
  });

  it("returns empty when no private rooms exist", async () => {
    vi.mocked(apiFetch).mockImplementation((url) => {
      if (url === "/api/chat/contacts")
        return Promise.resolve([{ contact: "alice", firstName: "Alice" }]);
      if (url === "/api/rooms")
        return Promise.resolve([{ id: "r1", type: "ROOM", members: ["me", "alice"] }]);
      return Promise.resolve([]);
    });

    const contacts = await getContacts();
    expect(contacts).toHaveLength(0);
  });

  it("handles API errors gracefully", async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error("network"));
    const contacts = await getContacts();
    expect(contacts).toEqual([]);
  });

  it("maps fullname with firstName + lastName", async () => {
    vi.mocked(apiFetch).mockImplementation((url) => {
      if (url === "/api/chat/contacts") {
        return Promise.resolve([
          { contact: "alice", firstName: "Alice", lastName: "Smith", avatarUrl: "img.png", tag: "#dev", online: true },
        ]);
      }
      if (url === "/api/rooms") {
        return Promise.resolve([{ id: "r1", type: "PRIVATE", members: ["me", "alice"] }]);
      }
      return Promise.resolve([]);
    });

    const contacts = await getContacts();
    expect(contacts[0]).toMatchObject({
      id: "alice",
      fullname: "Alice Smith",
      username: "alice",
      avatar_url: "img.png",
      tag: "#dev",
      online: true,
    });
  });

  it("falls back to contact name when firstName is empty", async () => {
    vi.mocked(apiFetch).mockImplementation((url) => {
      if (url === "/api/chat/contacts") {
        return Promise.resolve([
          { contact: "bob", firstName: null, lastName: null, avatarUrl: "" },
        ]);
      }
      if (url === "/api/rooms") {
        return Promise.resolve([{ id: "r1", type: "PRIVATE", members: ["me", "bob"] }]);
      }
      return Promise.resolve([]);
    });

    const contacts = await getContacts();
    expect(contacts[0].fullname).toBe("bob");
  });
});

// ============================================================
// 3. UserItem Unread Badge
// ============================================================
describe("UserItem unread badge", () => {
  it("displays unread count badge when count > 0", () => {
    render(
      <UserItem id="alice" name="Alice" subtext="Hey!" handler={() => {}} unreadCount={5} />,
    );
    expect(screen.getByTestId("unread-badge")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("does not display badge when count is 0", () => {
    render(
      <UserItem id="bob" name="Bob" subtext="hi" handler={() => {}} unreadCount={0} />,
    );
    expect(screen.queryByTestId("unread-badge")).not.toBeInTheDocument();
  });

  it("shows 99+ for counts over 99", () => {
    render(
      <UserItem id="c" name="Charlie" subtext="" handler={() => {}} unreadCount={150} />,
    );
    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("shows exact count for single unread", () => {
    render(
      <UserItem id="d" name="Diana" subtext="" handler={() => {}} unreadCount={1} />,
    );
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("does not show badge when unreadCount prop is not provided", () => {
    render(
      <UserItem id="e" name="Eve" subtext="" handler={() => {}} />,
    );
    expect(screen.queryByTestId("unread-badge")).not.toBeInTheDocument();
  });
});

// ============================================================
// 4. Notifications on new message
// ============================================================
describe("Message notifications", () => {
  let wsCallback;

  beforeEach(() => {
    vi.mocked(showMessageToast).mockClear();
    vi.mocked(onWsMessage).mockImplementation((cb) => {
      wsCallback = cb;
      return () => {};
    });
    unreadStore._reset();
    localStorage.setItem("username", "me");
  });

  it("shows toast notification on incoming CHAT message", () => {
    const cb = vi.fn();
    subscribeRealtimeConversation({ myUserId: "me", callback: cb });

    wsCallback({
      type: "CHAT",
      roomId: "room1",
      sender: "alice",
      content: "Привет!",
      timestamp: "2026-03-01T12:00:00Z",
      id: "m1",
    });

    expect(showMessageToast).toHaveBeenCalledWith(
      expect.objectContaining({ sender: "alice" }),
    );
  });

  it("does not show toast for own messages", () => {
    const cb = vi.fn();
    subscribeRealtimeConversation({ myUserId: "me", callback: cb });

    wsCallback({
      type: "CHAT",
      roomId: "room1",
      sender: "me",
      content: "My message",
      id: "m2",
    });

    expect(showMessageToast).not.toHaveBeenCalled();
  });

  it("does not show toast when viewing the active room", () => {
    unreadStore.setActiveRoom("room1");
    const cb = vi.fn();
    subscribeRealtimeConversation({ myUserId: "me", callback: cb });

    wsCallback({
      type: "CHAT",
      roomId: "room1",
      sender: "alice",
      content: "Hi",
      id: "m3",
    });

    expect(showMessageToast).not.toHaveBeenCalled();
  });

  it("increments unread count on incoming message", () => {
    const cb = vi.fn();
    subscribeRealtimeConversation({ myUserId: "me", callback: cb });

    wsCallback({
      type: "CHAT",
      roomId: "room1",
      sender: "alice",
      content: "Hi",
      id: "m4",
    });

    expect(unreadStore.getCount("room1")).toBe(1);
  });

  it("does not increment unread for active room", () => {
    unreadStore.setActiveRoom("room1");
    const cb = vi.fn();
    subscribeRealtimeConversation({ myUserId: "me", callback: cb });

    wsCallback({
      type: "CHAT",
      roomId: "room1",
      sender: "alice",
      content: "Hi",
      id: "m5",
    });

    expect(unreadStore.getCount("room1")).toBe(0);
  });

  it("calls sidebar callback to update last message", () => {
    const cb = vi.fn();
    subscribeRealtimeConversation({ myUserId: "me", callback: cb });

    wsCallback({
      type: "CHAT",
      roomId: "room1",
      sender: "alice",
      content: "Hi",
      timestamp: "2026-03-01T12:00:00Z",
      id: "m6",
    });

    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "UPDATE",
        new: expect.objectContaining({ id: "room1" }),
      }),
    );
  });

  it("shows toast for VOICE messages", () => {
    const cb = vi.fn();
    subscribeRealtimeConversation({ myUserId: "me", callback: cb });

    wsCallback({
      type: "VOICE",
      roomId: "room1",
      sender: "alice",
      content: "",
      id: "m7",
    });

    expect(showMessageToast).toHaveBeenCalledWith(
      expect.objectContaining({ sender: "alice" }),
    );
  });

  it("shows toast for VIDEO_CIRCLE messages", () => {
    const cb = vi.fn();
    subscribeRealtimeConversation({ myUserId: "me", callback: cb });

    wsCallback({
      type: "VIDEO_CIRCLE",
      roomId: "room1",
      sender: "bob",
      content: "",
      id: "m8",
    });

    expect(showMessageToast).toHaveBeenCalledWith(
      expect.objectContaining({ sender: "bob" }),
    );
  });

  it("does not show toast for EDIT messages", () => {
    const cb = vi.fn();
    subscribeRealtimeConversation({ myUserId: "me", callback: cb });

    wsCallback({
      type: "EDIT",
      roomId: "room1",
      sender: "alice",
      content: "edited",
      id: "m9",
    });

    expect(showMessageToast).not.toHaveBeenCalled();
  });

  it("does not show toast for DELETE messages", () => {
    const cb = vi.fn();
    subscribeRealtimeConversation({ myUserId: "me", callback: cb });

    wsCallback({
      type: "DELETE",
      roomId: "room1",
      sender: "alice",
      id: "m10",
    });

    expect(showMessageToast).not.toHaveBeenCalled();
  });
});
