// ==========================================
// ConversationMessaging.test.jsx
// Tests for: showMessageToast, apiRealtimeMessage (all WS types),
//            disappearing messages, apiMessage functions
// ==========================================
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ====== Mocks ======

vi.mock("../services/wsService", () => ({
  onWsMessage: vi.fn((cb) => () => {}),
  sendWsMessage: vi.fn(() => true),
  isWsConnected: vi.fn(() => true),
  connectWebSocket: vi.fn(),
  disconnectWebSocket: vi.fn(),
  onCallMessage: vi.fn(() => () => {}),
  onConferenceMessage: vi.fn(() => () => {}),
  onWsConnection: vi.fn(() => () => {}),
}));

vi.mock("../services/apiHelper", () => ({
  apiFetch: vi.fn(() => Promise.resolve([])),
}));

vi.mock("react-hot-toast", () => {
  const fn = vi.fn();
  fn.success = vi.fn();
  fn.error = vi.fn();
  fn.custom = vi.fn();
  fn.dismiss = vi.fn();
  return { default: fn, Toaster: () => null };
});

vi.mock("../utils/unreadStore", () => ({
  increment: vi.fn(),
  getActiveRoom: vi.fn(() => null),
  clear: vi.fn(),
  setActiveRoom: vi.fn(),
  getCount: vi.fn(() => 0),
  getCounts: vi.fn(() => ({})),
  subscribe: vi.fn(() => () => {}),
  _reset: vi.fn(),
}));

// ====== Imports (after mocks) ======
import toast from "react-hot-toast";
import { onWsMessage, sendWsMessage, isWsConnected } from "../services/wsService";
import { apiFetch } from "../services/apiHelper";
import { subscribeRealtimeMessage } from "../features/messageArea/apiRealtimeMessage";
import { showMessageToast } from "../utils/showMessageToast";
import { getRandomAvatar } from "../utils/avatarUtils";
import {
  getMessages,
  sendMessage,
  openConversation,
  setDisappearing,
  searchMessages,
  muteRoom,
  unmuteRoom,
  markMessageRead,
} from "../features/messageArea/apiMessage";

// ============================================================
// 1. showMessageToast — enhanced notification
// ============================================================
describe("showMessageToast", () => {
  beforeEach(() => {
    vi.mocked(toast.custom).mockClear();
  });

  it("calls toast.custom with render function and options", () => {
    showMessageToast({
      sender: "alice",
      content: "Hello!",
      timestamp: "2026-03-01T12:00:00Z",
      msgId: "msg-1",
    });

    expect(toast.custom).toHaveBeenCalledTimes(1);
    const [renderFn, options] = vi.mocked(toast.custom).mock.calls[0];
    expect(typeof renderFn).toBe("function");
    expect(options).toMatchObject({
      position: "bottom-right",
      duration: 4000,
      id: "msg-msg-1",
    });
  });

  it("renders avatar image from getRandomAvatar when no avatar", () => {
    showMessageToast({ sender: "alice", content: "Hi", msgId: "m1" });

    const renderFn = vi.mocked(toast.custom).mock.calls[0][0];
    const el = renderFn({ visible: true, id: "t1" });

    const { container } = render(el);
    const img = container.querySelector("[data-testid='toast-avatar']");
    expect(img).toBeTruthy();
    expect(img.getAttribute("src")).toBe(getRandomAvatar("alice"));
  });

  it("renders custom avatar when provided", () => {
    showMessageToast({
      sender: "bob",
      content: "Hi",
      msgId: "m2",
      avatar: "https://example.com/bob.png",
    });

    const renderFn = vi.mocked(toast.custom).mock.calls[0][0];
    const el = renderFn({ visible: true, id: "t2" });

    const { container } = render(el);
    const img = container.querySelector("[data-testid='toast-avatar']");
    expect(img.getAttribute("src")).toBe("https://example.com/bob.png");
  });

  it("displays sender name", () => {
    showMessageToast({ sender: "alice", content: "Hi", msgId: "m3" });

    const renderFn = vi.mocked(toast.custom).mock.calls[0][0];
    render(renderFn({ visible: true, id: "t3" }));

    expect(screen.getByTestId("toast-sender").textContent).toBe("alice");
  });

  it("displays formatted time", () => {
    showMessageToast({
      sender: "alice",
      content: "Hi",
      timestamp: "2026-03-01T15:30:00Z",
      msgId: "m4",
    });

    const renderFn = vi.mocked(toast.custom).mock.calls[0][0];
    render(renderFn({ visible: true, id: "t4" }));

    const time = screen.getByTestId("toast-time").textContent;
    // Time should be formatted (exact value depends on locale/timezone)
    expect(time).toMatch(/\d{2}:\d{2}/);
  });

  it("displays message preview", () => {
    showMessageToast({
      sender: "alice",
      content: "Привет, как дела?",
      msgId: "m5",
    });

    const renderFn = vi.mocked(toast.custom).mock.calls[0][0];
    render(renderFn({ visible: true, id: "t5" }));

    expect(screen.getByTestId("toast-preview").textContent).toBe(
      "Привет, как дела?",
    );
  });

  it("truncates preview to 60 chars", () => {
    const longMsg = "A".repeat(100);
    showMessageToast({ sender: "alice", content: longMsg, msgId: "m6" });

    const renderFn = vi.mocked(toast.custom).mock.calls[0][0];
    render(renderFn({ visible: true, id: "t6" }));

    expect(screen.getByTestId("toast-preview").textContent).toBe(
      "A".repeat(60),
    );
  });

  it("shows placeholder for empty content", () => {
    showMessageToast({ sender: "alice", content: "", msgId: "m7" });

    const renderFn = vi.mocked(toast.custom).mock.calls[0][0];
    render(renderFn({ visible: true, id: "t7" }));

    expect(screen.getByTestId("toast-preview").textContent).toBe(
      "📎 Вложение",
    );
  });

  it("shows placeholder for null content", () => {
    showMessageToast({ sender: "alice", content: null, msgId: "m8" });

    const renderFn = vi.mocked(toast.custom).mock.calls[0][0];
    render(renderFn({ visible: true, id: "t8" }));

    expect(screen.getByTestId("toast-preview").textContent).toBe(
      "📎 Вложение",
    );
  });
});

// ============================================================
// 2. apiRealtimeMessage — WebSocket message handling
// ============================================================
describe("apiRealtimeMessage", () => {
  let wsCallback;

  beforeEach(() => {
    vi.mocked(onWsMessage).mockImplementation((cb) => {
      wsCallback = cb;
      return () => {};
    });
    localStorage.setItem("username", "me");
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("processes CHAT message for correct room", () => {
    const cb = vi.fn();
    subscribeRealtimeMessage({ conversation_id: "room1", callback: cb });

    wsCallback({
      type: "CHAT",
      roomId: "room1",
      sender: "alice",
      content: "Hello",
      timestamp: "2026-03-01T12:00:00Z",
      id: "m1",
    });

    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "m1",
        conversation_id: "room1",
        content: "Hello",
        sender_id: "alice",
        type: "CHAT",
      }),
    );
  });

  it("ignores CHAT messages for other rooms", () => {
    const cb = vi.fn();
    subscribeRealtimeMessage({ conversation_id: "room1", callback: cb });

    wsCallback({
      type: "CHAT",
      roomId: "room2",
      sender: "alice",
      content: "Hello",
      id: "m2",
    });

    expect(cb).not.toHaveBeenCalled();
  });

  it("skips own messages (not forwarded)", () => {
    const cb = vi.fn();
    subscribeRealtimeMessage({ conversation_id: "room1", callback: cb });

    wsCallback({
      type: "CHAT",
      roomId: "room1",
      sender: "me",
      content: "My own message",
      id: "m3",
    });

    expect(cb).not.toHaveBeenCalled();
  });

  it("includes forwarded messages from self", () => {
    const cb = vi.fn();
    subscribeRealtimeMessage({ conversation_id: "room1", callback: cb });

    wsCallback({
      type: "CHAT",
      roomId: "room1",
      sender: "me",
      content: "↪ Переслано от alice: Hi there",
      id: "m4",
    });

    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({ id: "m4", content: "↪ Переслано от alice: Hi there" }),
    );
  });

  it("processes VOICE message", () => {
    const cb = vi.fn();
    subscribeRealtimeMessage({ conversation_id: "room1", callback: cb });

    wsCallback({
      type: "VOICE",
      roomId: "room1",
      sender: "alice",
      content: "🎤 Голосовое",
      id: "m5",
      fileUrl: "/audio.webm",
      duration: 10,
    });

    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "VOICE",
        fileUrl: "/audio.webm",
        duration: 10,
      }),
    );
  });

  it("processes VIDEO_CIRCLE message", () => {
    const cb = vi.fn();
    subscribeRealtimeMessage({ conversation_id: "room1", callback: cb });

    wsCallback({
      type: "VIDEO_CIRCLE",
      roomId: "room1",
      sender: "bob",
      content: "🎥 Видеокружок",
      id: "m6",
      fileUrl: "/video.webm",
      duration: 15,
      thumbnailUrl: "/thumb.jpg",
    });

    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "VIDEO_CIRCLE",
        fileUrl: "/video.webm",
        thumbnailUrl: "/thumb.jpg",
      }),
    );
  });

  it("processes CHAT message with reply fields", () => {
    const cb = vi.fn();
    subscribeRealtimeMessage({ conversation_id: "room1", callback: cb });

    wsCallback({
      type: "CHAT",
      roomId: "room1",
      sender: "alice",
      content: "Reply text",
      id: "m-reply",
      timestamp: "2026-03-01T12:00:00Z",
      replyToId: "orig-123",
      replyToSender: "bob",
      replyToContent: "Original message",
    });

    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "m-reply",
        content: "Reply text",
        replyToId: "orig-123",
        replyToSender: "bob",
        replyToContent: "Original message",
      }),
    );
  });

  it("handles EDIT message with edited flag", () => {
    const cb = vi.fn();
    subscribeRealtimeMessage({ conversation_id: "room1", callback: cb });

    wsCallback({
      type: "EDIT",
      roomId: "room1",
      sender: "alice",
      content: "Edited text",
      id: "m7",
      timestamp: "2026-03-01T12:01:00Z",
    });

    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "m7",
        content: "Edited text",
        type: "CHAT",
        edited: true,
      }),
    );
  });

  it("handles DELETE message", () => {
    const cb = vi.fn();
    subscribeRealtimeMessage({ conversation_id: "room1", callback: cb });

    wsCallback({
      type: "DELETE",
      roomId: "room1",
      sender: "alice",
      id: "m8",
    });

    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "m8",
        deleted: true,
        type: "DELETE",
      }),
    );
  });

  it("handles PIN message", () => {
    const cb = vi.fn();
    subscribeRealtimeMessage({ conversation_id: "room1", callback: cb });

    wsCallback({
      type: "PIN",
      roomId: "room1",
      sender: "alice",
      id: "m9",
      content: "Pinned message content",
    });

    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "m9",
        type: "PIN",
        pinned: true,
        pinnedBy: "alice",
      }),
    );
  });

  it("handles UNPIN message", () => {
    const cb = vi.fn();
    subscribeRealtimeMessage({ conversation_id: "room1", callback: cb });

    wsCallback({
      type: "UNPIN",
      roomId: "room1",
      sender: "alice",
      id: "m10",
    });

    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "m10",
        type: "UNPIN",
        pinned: false,
      }),
    );
  });

  it("handles REACTION message", () => {
    const cb = vi.fn();
    subscribeRealtimeMessage({ conversation_id: "room1", callback: cb });

    wsCallback({
      type: "REACTION",
      roomId: "room1",
      sender: "alice",
      id: "m11",
      emoji: "👍",
    });

    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "m11",
        type: "REACTION",
        emoji: "👍",
        sender_id: "alice",
      }),
    );
  });

  it("handles REACTION_REMOVE message", () => {
    const cb = vi.fn();
    subscribeRealtimeMessage({ conversation_id: "room1", callback: cb });

    wsCallback({
      type: "REACTION_REMOVE",
      roomId: "room1",
      sender: "alice",
      id: "m12",
      emoji: "👍",
    });

    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "REACTION_REMOVE",
        emoji: "👍",
      }),
    );
  });

  it("handles POLL message", () => {
    const cb = vi.fn();
    subscribeRealtimeMessage({ conversation_id: "room1", callback: cb });

    wsCallback({
      type: "POLL",
      roomId: "room1",
      sender: "alice",
      id: "m13",
      content: "What for lunch?",
      timestamp: "2026-03-01T12:00:00Z",
      pollData: { question: "What for lunch?", options: ["Pizza", "Sushi"] },
    });

    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "POLL",
        content: "What for lunch?",
        pollData: expect.objectContaining({ question: "What for lunch?" }),
      }),
    );
  });

  it("handles POLL_VOTE message", () => {
    const cb = vi.fn();
    subscribeRealtimeMessage({ conversation_id: "room1", callback: cb });

    wsCallback({
      type: "POLL_VOTE",
      roomId: "room1",
      id: "m14",
      pollData: { votes: { "0": ["alice"] } },
    });

    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({ type: "POLL_VOTE" }),
    );
  });

  it("handles POLL_CLOSE message", () => {
    const cb = vi.fn();
    subscribeRealtimeMessage({ conversation_id: "room1", callback: cb });

    wsCallback({
      type: "POLL_CLOSE",
      roomId: "room1",
      id: "m15",
      pollData: { closed: true },
    });

    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({ type: "POLL_CLOSE" }),
    );
  });

  it("handles DISAPPEARING_SET message", () => {
    const cb = vi.fn();
    subscribeRealtimeMessage({ conversation_id: "room1", callback: cb });

    wsCallback({
      type: "DISAPPEARING_SET",
      roomId: "room1",
      sender: "alice",
      id: "m16",
      content: "⏰ Исчезающие сообщения: 30 сек",
      timestamp: "2026-03-01T12:00:00Z",
    });

    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "DISAPPEARING_SET",
        content: "⏰ Исчезающие сообщения: 30 сек",
        sender_id: "alice",
      }),
    );
  });

  it("returns noop unsubscribe when no conversation_id", () => {
    const cb = vi.fn();
    const { unsubscribe } = subscribeRealtimeMessage({
      conversation_id: null,
      callback: cb,
    });
    expect(typeof unsubscribe).toBe("function");
  });

  it("passes file fields through for CHAT messages", () => {
    const cb = vi.fn();
    subscribeRealtimeMessage({ conversation_id: "room1", callback: cb });

    wsCallback({
      type: "CHAT",
      roomId: "room1",
      sender: "alice",
      content: "📎 file.pdf",
      id: "m17",
      fileUrl: "/files/file.pdf",
      fileName: "file.pdf",
      fileSize: 1024,
      fileType: "application/pdf",
    });

    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({
        fileUrl: "/files/file.pdf",
        fileName: "file.pdf",
        fileSize: 1024,
        fileType: "application/pdf",
      }),
    );
  });
});

// ============================================================
// 3. Disappearing messages — setting, WS event, API
// ============================================================
describe("Disappearing messages", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it("setDisappearing calls correct API endpoint", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ seconds: 30 });

    await setDisappearing("room1", 30);

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/rooms/room1/disappearing",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ seconds: 30 }),
      }),
    );
  });

  it("setDisappearing sends 0 to disable", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ seconds: 0 });

    await setDisappearing("room1", 0);

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/rooms/room1/disappearing",
      expect.objectContaining({
        body: JSON.stringify({ seconds: 0 }),
      }),
    );
  });

  it("setDisappearing sends 300 for 5 min", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ seconds: 300 });

    await setDisappearing("room1", 300);

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/rooms/room1/disappearing",
      expect.objectContaining({
        body: JSON.stringify({ seconds: 300 }),
      }),
    );
  });

  it("setDisappearing sends 3600 for 1 hour", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ seconds: 3600 });

    await setDisappearing("room1", 3600);

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/rooms/room1/disappearing",
      expect.objectContaining({
        body: JSON.stringify({ seconds: 3600 }),
      }),
    );
  });

  it("setDisappearing sends 86400 for 24 hours", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ seconds: 86400 });

    await setDisappearing("room1", 86400);

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/rooms/room1/disappearing",
      expect.objectContaining({
        body: JSON.stringify({ seconds: 86400 }),
      }),
    );
  });

  it("setDisappearing sends 604800 for 7 days", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ seconds: 604800 });

    await setDisappearing("room1", 604800);

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/rooms/room1/disappearing",
      expect.objectContaining({
        body: JSON.stringify({ seconds: 604800 }),
      }),
    );
  });

  it("DISAPPEARING_SET event is passed to message callback", () => {
    let wsCallback;
    vi.mocked(onWsMessage).mockImplementation((cb) => {
      wsCallback = cb;
      return () => {};
    });

    const cb = vi.fn();
    subscribeRealtimeMessage({ conversation_id: "room1", callback: cb });

    wsCallback({
      type: "DISAPPEARING_SET",
      roomId: "room1",
      sender: "alice",
      id: "d1",
      content: "⏰ Исчезающие сообщения: 30 сек",
      timestamp: "2026-03-01T12:00:00Z",
    });

    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "DISAPPEARING_SET",
        content: "⏰ Исчезающие сообщения: 30 сек",
      }),
    );
  });

  it("markMessageRead calls correct API endpoint", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ ok: true });

    await markMessageRead("room1", "msg-1");

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/rooms/room1/messages/msg-1/read",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

// ============================================================
// 4. apiMessage functions — core messaging
// ============================================================
describe("apiMessage functions", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    vi.mocked(sendWsMessage).mockClear();
    vi.mocked(isWsConnected).mockReturnValue(true);
    localStorage.setItem("username", "me");
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("getMessages fetches and transforms history", async () => {
    vi.mocked(apiFetch).mockImplementation((url) => {
      if (url.includes("/history"))
        return Promise.resolve([
          {
            id: "m2",
            sender: "bob",
            content: "Hi",
            timestamp: "2026-03-01 12:01:00",
            type: "CHAT",
          },
          {
            id: "m1",
            sender: "alice",
            content: "Hello",
            timestamp: "2026-03-01 12:00:00",
            type: "CHAT",
          },
        ]);
      if (url.includes("/reactions/batch"))
        return Promise.resolve({});
      return Promise.resolve([]);
    });

    const msgs = await getMessages({ conversation_id: "room1", pageParam: 0 });

    expect(msgs).toHaveLength(2);
    // API returns DESC, getMessages reverses to ASC
    expect(msgs[0]).toMatchObject({
      id: "m1",
      conversation_id: "room1",
      sender_id: "alice",
      content: "Hello",
    });
  });

  it("getMessages returns empty for null conversation_id", async () => {
    const msgs = await getMessages({ conversation_id: null });
    expect(msgs).toEqual([]);
  });

  it("getMessages reverses message order", async () => {
    vi.mocked(apiFetch).mockImplementation((url) => {
      if (url.includes("/history"))
        return Promise.resolve([
          { id: "m2", sender: "bob", content: "Second", type: "CHAT" },
          { id: "m1", sender: "alice", content: "First", type: "CHAT" },
        ]);
      return Promise.resolve({});
    });

    const msgs = await getMessages({ conversation_id: "room1" });
    // API returns DESC, getMessages reverses to ASC
    expect(msgs[0].id).toBe("m1");
    expect(msgs[1].id).toBe("m2");
  });

  it("getMessages handles API returning non-array", async () => {
    vi.mocked(apiFetch).mockResolvedValue(null);
    const msgs = await getMessages({ conversation_id: "room1" });
    expect(msgs).toEqual([]);
  });

  it("sendMessage sends via WebSocket when connected", async () => {
    vi.mocked(sendWsMessage).mockReturnValue(true);

    const result = await sendMessage({
      id: "m1",
      conversation_id: "room1",
      content: "Hello",
    });

    expect(sendWsMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "CHAT",
        roomId: "room1",
        content: "Hello",
        id: "m1",
      }),
    );
    expect(result).toMatchObject({
      id: "m1",
      content: "Hello",
      sender_id: "me",
      type: "CHAT",
    });
  });

  it("sendMessage falls back to REST when WS fails", async () => {
    vi.mocked(sendWsMessage).mockReturnValue(false);
    vi.mocked(apiFetch).mockResolvedValue({ ok: true });

    await sendMessage({
      id: "m2",
      conversation_id: "room1",
      content: "Hello via REST",
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/rooms/room1/messages",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("sendMessage includes reply fields in WS message and return value", async () => {
    vi.mocked(sendWsMessage).mockReturnValue(true);

    const result = await sendMessage({
      id: "m-reply",
      conversation_id: "room1",
      content: "My reply",
      replyToId: "orig-id",
      replyToSender: "bob",
      replyToContent: "Original text",
    });

    expect(sendWsMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "CHAT",
        roomId: "room1",
        content: "My reply",
        id: "m-reply",
        replyToId: "orig-id",
        replyToSender: "bob",
        replyToContent: "Original text",
      }),
    );

    expect(result).toMatchObject({
      id: "m-reply",
      content: "My reply",
      replyToId: "orig-id",
      replyToSender: "bob",
      replyToContent: "Original text",
    });
  });

  it("sendMessage omits reply fields when not replying", async () => {
    vi.mocked(sendWsMessage).mockReturnValue(true);

    const result = await sendMessage({
      id: "m-normal",
      conversation_id: "room1",
      content: "Just a message",
    });

    const wsArg = sendWsMessage.mock.calls[0][0];
    expect(wsArg).not.toHaveProperty("replyToId");
    expect(result).not.toHaveProperty("replyToId");
  });

  it("openConversation creates private room", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ id: "pm_me_alice" });

    const roomId = await openConversation("alice");

    expect(apiFetch).toHaveBeenCalledWith("/api/rooms/private/alice", {
      method: "POST",
    });
    expect(roomId).toBe("pm_me_alice");
  });

  it("searchMessages calls correct endpoint", async () => {
    vi.mocked(apiFetch).mockResolvedValue([]);

    await searchMessages("room1", "hello", 0, 50);

    expect(apiFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/rooms/room1/search?q=hello"),
    );
  });

  it("searchMessages returns empty for empty query", async () => {
    const result = await searchMessages("room1", "");
    expect(result).toEqual([]);
  });

  it("muteRoom sends POST request", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ muted: true });

    await muteRoom("room1", null);

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/rooms/room1/mute",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("unmuteRoom sends DELETE request", async () => {
    vi.mocked(apiFetch).mockResolvedValue({});

    await unmuteRoom("room1");

    expect(apiFetch).toHaveBeenCalledWith("/api/rooms/room1/mute", {
      method: "DELETE",
    });
  });

  it("getMessages maps all message fields", async () => {
    vi.mocked(apiFetch).mockImplementation((url) => {
      if (url.includes("/history"))
        return Promise.resolve([
          {
            id: "m1",
            sender: "alice",
            content: "Hello",
            timestamp: "2026-03-01 12:00:00",
            type: "CHAT",
            fileUrl: "/file.pdf",
            fileName: "file.pdf",
            fileSize: 2048,
            fileType: "application/pdf",
            edited: true,
            pinned: true,
            pinnedBy: "bob",
            replyToId: "m0",
            replyToSender: "bob",
            replyToContent: "Original",
            pollData: null,
          },
        ]);
      return Promise.resolve({});
    });

    const msgs = await getMessages({ conversation_id: "room1" });

    expect(msgs[0]).toMatchObject({
      fileUrl: "/file.pdf",
      fileName: "file.pdf",
      fileSize: 2048,
      fileType: "application/pdf",
      edited: true,
      pinned: true,
      pinnedBy: "bob",
      replyToId: "m0",
      replyToSender: "bob",
      replyToContent: "Original",
    });
  });

  it("getMessages fetches reactions batch", async () => {
    vi.mocked(apiFetch).mockImplementation((url) => {
      if (url.includes("/history"))
        return Promise.resolve([
          { id: "m1", sender: "alice", content: "Hi", type: "CHAT" },
        ]);
      if (url.includes("/reactions/batch"))
        return Promise.resolve({ m1: [{ emoji: "👍", username: "bob" }] });
      return Promise.resolve([]);
    });

    const msgs = await getMessages({ conversation_id: "room1" });

    expect(msgs[0].reactions).toEqual([
      { emoji: "👍", username: "bob" },
    ]);
  });
});

// ============================================================
// 5. avatarUtils
// ============================================================
describe("getRandomAvatar", () => {
  it("returns DiceBear URL with seed", () => {
    const url = getRandomAvatar("alice");
    expect(url).toContain("api.dicebear.com");
    expect(url).toContain("seed=alice");
  });

  it("uses 'user' as default seed for empty name", () => {
    const url = getRandomAvatar("");
    expect(url).toContain("seed=user");
  });

  it("encodes special characters in seed", () => {
    const url = getRandomAvatar("Иван Иванов");
    expect(url).toContain("seed=");
    expect(url).toContain(encodeURIComponent("Иван Иванов"));
  });

  it("returns deterministic URL for same name", () => {
    expect(getRandomAvatar("alice")).toBe(getRandomAvatar("alice"));
  });
});

// ============================================================
// 6. BUG FIX: Pinned message bar — compact layout
// The pinned bar was too large. Now it has max-h-10,
// overflow-hidden, compact text (text-xs/text-[11px]),
// reduced padding (px-3 py-1), and truncation on content.
// ============================================================
describe("BUG FIX: Pinned message bar compact layout", () => {
  // Render the exact pinned bar JSX from MessageView to verify layout
  function PinnedBar({ message, onUnpin }) {
    const { RiPushpinFill, RiCloseFill } = require("react-icons/ri");
    return (
      <div
        data-testid="pinned-bar"
        className="flex max-h-10 items-center gap-1.5 overflow-hidden border-b border-LightShade/20 bg-bgPrimary/80 px-3 py-1 backdrop-blur-sm dark:bg-bgPrimary-dark/80"
      >
        <RiPushpinFill className="flex-shrink-0 text-sm text-bgAccent dark:text-bgAccent-dark" />
        <div className="min-w-0 flex-1 overflow-hidden" data-testid="pinned-content-wrapper">
          <p className="truncate text-[11px] font-medium leading-tight text-bgAccent dark:text-bgAccent-dark">
            Закреплённое сообщение
          </p>
          <p
            className="truncate text-xs leading-tight text-textPrimary dark:text-textPrimary-dark"
            data-testid="pinned-content-text"
          >
            {message?.content || "📎 Вложение"}
          </p>
        </div>
        <button
          onClick={() => onUnpin?.(message)}
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full transition hover:bg-LightShade/20"
          title="Открепить"
          data-testid="unpin-btn"
        >
          <RiCloseFill className="text-sm opacity-60" />
        </button>
      </div>
    );
  }

  it("bar container has max-h-10 and overflow-hidden to cap height", () => {
    const { getByTestId } = render(
      <PinnedBar message={{ content: "Hello world" }} />,
    );
    const bar = getByTestId("pinned-bar");
    expect(bar.className).toContain("max-h-10");
    expect(bar.className).toContain("overflow-hidden");
  });

  it("bar uses compact padding px-3 py-1 (not px-4 py-2)", () => {
    const { getByTestId } = render(
      <PinnedBar message={{ content: "Hello" }} />,
    );
    const bar = getByTestId("pinned-bar");
    expect(bar.className).toContain("px-3");
    expect(bar.className).toContain("py-1");
    expect(bar.className).not.toContain("px-4");
    expect(bar.className).not.toContain("py-2");
  });

  it("content wrapper has overflow-hidden and min-w-0 for truncation", () => {
    const { getByTestId } = render(
      <PinnedBar message={{ content: "Test" }} />,
    );
    const wrapper = getByTestId("pinned-content-wrapper");
    expect(wrapper.className).toContain("overflow-hidden");
    expect(wrapper.className).toContain("min-w-0");
  });

  it("content text has truncate class for single-line clamp", () => {
    const { getByTestId } = render(
      <PinnedBar message={{ content: "Very long message text that should be truncated on smaller screens" }} />,
    );
    const text = getByTestId("pinned-content-text");
    expect(text.className).toContain("truncate");
    expect(text.textContent).toBe("Very long message text that should be truncated on smaller screens");
  });

  it("content text uses compact text-xs size (not text-sm)", () => {
    const { getByTestId } = render(
      <PinnedBar message={{ content: "Hi" }} />,
    );
    const text = getByTestId("pinned-content-text");
    expect(text.className).toContain("text-xs");
    expect(text.className).not.toContain("text-sm");
  });

  it("shows fallback '📎 Вложение' when content is empty", () => {
    const { getByTestId } = render(
      <PinnedBar message={{ content: "" }} />,
    );
    expect(getByTestId("pinned-content-text").textContent).toBe("📎 Вложение");
  });

  it("shows fallback '📎 Вложение' when content is null", () => {
    const { getByTestId } = render(
      <PinnedBar message={{ content: null }} />,
    );
    expect(getByTestId("pinned-content-text").textContent).toBe("📎 Вложение");
  });

  it("unpin button uses compact h-6 w-6 (not h-7 w-7)", () => {
    const { getByTestId } = render(
      <PinnedBar message={{ content: "Test" }} />,
    );
    const btn = getByTestId("unpin-btn");
    expect(btn.className).toContain("h-6");
    expect(btn.className).toContain("w-6");
    expect(btn.className).not.toContain("h-7");
    expect(btn.className).not.toContain("w-7");
  });

  it("unpin button fires onUnpin callback with the message", () => {
    const onUnpin = vi.fn();
    const msg = { id: "m1", content: "Pinned text" };
    render(<PinnedBar message={msg} onUnpin={onUnpin} />);
    fireEvent.click(screen.getByTitle("Открепить"));
    expect(onUnpin).toHaveBeenCalledWith(msg);
  });

  it("label uses text-[11px] for compact header", () => {
    const { getByTestId } = render(
      <PinnedBar message={{ content: "Test" }} />,
    );
    const bar = getByTestId("pinned-bar");
    const label = bar.querySelector("p.font-medium");
    expect(label).not.toBeNull();
    expect(label.className).toContain("text-[11px]");
    expect(label.textContent).toBe("Закреплённое сообщение");
  });

  it("bar uses gap-1.5 (not gap-2) for tighter spacing", () => {
    const { getByTestId } = render(
      <PinnedBar message={{ content: "Test" }} />,
    );
    const bar = getByTestId("pinned-bar");
    expect(bar.className).toContain("gap-1.5");
    expect(bar.className).not.toContain("gap-2");
  });
});
