// ==========================================
// MessageDisplay.test.jsx
// Tests for message display pipeline: optimistic updates, smart rollback,
// settlement on success, WS subscription cache updates, cleanup effect,
// and cache invalidation for new conversations.
// ==========================================
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";

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
import { onWsMessage, sendWsMessage } from "../services/wsService";
import { apiFetch } from "../services/apiHelper";
import { subscribeRealtimeMessage } from "../features/messageArea/apiRealtimeMessage";
import { sendMessage, getMessages } from "../features/messageArea/apiMessage";

// ============================================================
// Helpers
// ============================================================

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false },
    },
  });
}

function makeMsgPage(...msgs) {
  return { pages: [msgs], pageParams: [0] };
}

function makeTwoPages(olderMsgs, newerMsgs) {
  return {
    pages: [newerMsgs, olderMsgs],
    pageParams: [0, 1],
  };
}

function makeMsg(id, sender = "alice", content = "Hi") {
  return {
    id,
    conversation_id: "room1",
    content,
    sender_id: sender,
    created_at: "2026-03-01T12:00:00Z",
    type: "CHAT",
  };
}

function makeOptimisticMsg(id, sender = "me", content = "My message") {
  return {
    id,
    conversation_id: "room1",
    content,
    sender_id: sender,
    created_at: new Date(),
    type: "CHAT",
    optimistic: true,
  };
}

// ============================================================
// 1. Optimistic update — adds message to page 0
// ============================================================
describe("Optimistic update cache behavior", () => {
  let qc;

  beforeEach(() => {
    qc = makeQueryClient();
  });

  it("appends optimistic message to existing page 0", () => {
    const existing = makeMsgPage(makeMsg("m1"), makeMsg("m2"));
    qc.setQueryData(["friend", "bob"], existing);

    const optimistic = makeOptimisticMsg("m3");

    // Simulate onMutate logic
    qc.setQueryData(["friend", "bob"], (old) => {
      if (!old?.pages) return { pages: [[optimistic]], pageParams: [0] };
      return {
        ...old,
        pages: old.pages.slice().map((page, i) =>
          i === 0 ? [...page, optimistic] : page,
        ),
      };
    });

    const data = qc.getQueryData(["friend", "bob"]);
    expect(data.pages[0]).toHaveLength(3);
    expect(data.pages[0][2].id).toBe("m3");
    expect(data.pages[0][2].optimistic).toBe(true);
  });

  it("creates new cache when no data exists", () => {
    const optimistic = makeOptimisticMsg("m1");

    qc.setQueryData(["friend", "bob"], (old) => {
      if (!old?.pages) return { pages: [[optimistic]], pageParams: [0] };
      return old;
    });

    const data = qc.getQueryData(["friend", "bob"]);
    expect(data.pages).toHaveLength(1);
    expect(data.pages[0]).toHaveLength(1);
    expect(data.pages[0][0].id).toBe("m1");
  });

  it("does not mutate original pages array", () => {
    const existing = makeMsgPage(makeMsg("m1"));
    qc.setQueryData(["friend", "bob"], existing);

    const origPages = qc.getQueryData(["friend", "bob"]).pages;

    qc.setQueryData(["friend", "bob"], (old) => ({
      ...old,
      pages: old.pages.slice().map((page, i) =>
        i === 0 ? [...page, makeOptimisticMsg("m2")] : page,
      ),
    }));

    // The new data should have a different pages reference
    const newData = qc.getQueryData(["friend", "bob"]);
    expect(newData.pages).not.toBe(origPages);
    expect(newData.pages[0]).toHaveLength(2);
  });
});

// ============================================================
// 2. Smart rollback — only remove failed message on error
// ============================================================
describe("Smart rollback on send error", () => {
  let qc;

  beforeEach(() => {
    qc = makeQueryClient();
  });

  it("removes only the failed optimistic message", () => {
    // Simulate: 2 existing messages + 1 optimistic + 1 WS-delivered
    const existing = makeMsgPage(
      makeMsg("m1"),
      makeMsg("m2"),
      makeOptimisticMsg("m3-failed"),
      makeMsg("m4-from-ws", "charlie", "New from WS"),
    );
    qc.setQueryData(["friend", "bob"], existing);

    // Simulate onError: remove only the failed message
    const failedId = "m3-failed";
    qc.setQueryData(["friend", "bob"], (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page) =>
          page.filter((m) => m.id !== failedId),
        ),
      };
    });

    const data = qc.getQueryData(["friend", "bob"]);
    expect(data.pages[0]).toHaveLength(3);
    expect(data.pages[0].map((m) => m.id)).toEqual(["m1", "m2", "m4-from-ws"]);
  });

  it("preserves WS-delivered messages that arrived after snapshot", () => {
    // Initial state: existing messages
    const existing = makeMsgPage(makeMsg("m1"), makeMsg("m2"));
    qc.setQueryData(["friend", "bob"], existing);

    // Step 1: optimistic add
    qc.setQueryData(["friend", "bob"], (old) => ({
      ...old,
      pages: old.pages.map((p, i) =>
        i === 0 ? [...p, makeOptimisticMsg("opt-1")] : p,
      ),
    }));

    // Step 2: WS message arrives from another user (between send and error)
    qc.setQueryData(["friend", "bob"], (old) => ({
      ...old,
      pages: old.pages.map((p, i) =>
        i === 0 ? [...p, makeMsg("ws-1", "dave", "Hello from Dave")] : p,
      ),
    }));

    // Step 3: send fails — smart rollback removes only opt-1
    qc.setQueryData(["friend", "bob"], (old) => ({
      ...old,
      pages: old.pages.map((p) => p.filter((m) => m.id !== "opt-1")),
    }));

    const data = qc.getQueryData(["friend", "bob"]);
    expect(data.pages[0]).toHaveLength(3);
    expect(data.pages[0].map((m) => m.id)).toEqual(["m1", "m2", "ws-1"]);
  });

  it("blanket rollback would lose WS messages (proving the bug)", () => {
    // Demonstrates the old buggy behavior
    const existing = makeMsgPage(makeMsg("m1"), makeMsg("m2"));
    qc.setQueryData(["friend", "bob"], existing);

    // Snapshot BEFORE optimistic add (old approach)
    const snapshot = qc.getQueryData(["friend", "bob"]);

    // Optimistic add
    qc.setQueryData(["friend", "bob"], (old) => ({
      ...old,
      pages: old.pages.map((p, i) =>
        i === 0 ? [...p, makeOptimisticMsg("opt-1")] : p,
      ),
    }));

    // WS message arrives
    qc.setQueryData(["friend", "bob"], (old) => ({
      ...old,
      pages: old.pages.map((p, i) =>
        i === 0 ? [...p, makeMsg("ws-1", "dave")] : p,
      ),
    }));

    // Old buggy rollback: restore snapshot
    qc.setQueryData(["friend", "bob"], snapshot);

    const data = qc.getQueryData(["friend", "bob"]);
    // BUG: ws-1 is lost!
    expect(data.pages[0]).toHaveLength(2);
    expect(data.pages[0].find((m) => m.id === "ws-1")).toBeUndefined();
  });
});

// ============================================================
// 3. Settlement on success — optimistic message replaced with server data
// ============================================================
describe("Settlement of optimistic message on success", () => {
  let qc;

  beforeEach(() => {
    qc = makeQueryClient();
  });

  it("replaces optimistic message fields with server response", () => {
    const optimistic = makeOptimisticMsg("m1", "me", "Hello");
    qc.setQueryData(["friend", "bob"], makeMsgPage(optimistic));

    const serverResponse = {
      id: "m1",
      conversation_id: "room1",
      content: "Hello",
      sender_id: "me",
      created_at: "2026-03-01T12:05:00Z",
      type: "CHAT",
    };

    // Simulate onSuccess settlement
    qc.setQueryData(["friend", "bob"], (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page) =>
          page.map((m) =>
            m.id === serverResponse.id
              ? { ...m, ...serverResponse, optimistic: false }
              : m,
          ),
        ),
      };
    });

    const data = qc.getQueryData(["friend", "bob"]);
    const msg = data.pages[0][0];
    expect(msg.optimistic).toBe(false);
    expect(msg.created_at).toBe("2026-03-01T12:05:00Z");
  });

  it("does not remove other messages during settlement", () => {
    const existing = makeMsgPage(
      makeMsg("m1"),
      makeOptimisticMsg("m2", "me", "New"),
      makeMsg("m3", "charlie"),
    );
    qc.setQueryData(["friend", "bob"], existing);

    const serverResponse = { id: "m2", content: "New", sender_id: "me", optimistic: false };

    qc.setQueryData(["friend", "bob"], (old) => ({
      ...old,
      pages: old.pages.map((page) =>
        page.map((m) =>
          m.id === serverResponse.id ? { ...m, ...serverResponse } : m,
        ),
      ),
    }));

    const data = qc.getQueryData(["friend", "bob"]);
    expect(data.pages[0]).toHaveLength(3);
    expect(data.pages[0].map((m) => m.id)).toEqual(["m1", "m2", "m3"]);
  });
});

// ============================================================
// 4. WS subscription — appends new messages, updates existing
// ============================================================
describe("WS subscription cache updates", () => {
  let qc;

  beforeEach(() => {
    qc = makeQueryClient();
  });

  function applySubscriptionUpdate(friendUserId, newData) {
    qc.setQueryData(["friend", friendUserId], (prevData) => {
      if (!prevData) return prevData;

      if (newData.type === "DELETE" && newData.deleted) {
        return {
          ...prevData,
          pages: prevData.pages.map((page) =>
            page.filter((m) => m.id !== newData.id),
          ),
        };
      }

      const existsInAnyPage = prevData?.pages?.some((page) =>
        page?.some((message) => message?.id === newData.id),
      );

      if (existsInAnyPage) {
        return {
          ...prevData,
          pages: prevData.pages.map((page) =>
            page.map((message) =>
              message.id === newData.id
                ? newData.edited
                  ? { ...message, ...newData }
                  : newData
                : message,
            ),
          ),
        };
      } else {
        return {
          ...prevData,
          pages: prevData.pages.slice().map((page, index) =>
            index === 0 ? [...page, newData] : page,
          ),
        };
      }
    });
  }

  it("appends new message from another user to page 0", () => {
    qc.setQueryData(["friend", "bob"], makeMsgPage(makeMsg("m1"), makeMsg("m2")));

    const wsMsg = makeMsg("m3", "charlie", "Hello from Charlie");
    applySubscriptionUpdate("bob", wsMsg);

    const data = qc.getQueryData(["friend", "bob"]);
    expect(data.pages[0]).toHaveLength(3);
    expect(data.pages[0][2].id).toBe("m3");
    expect(data.pages[0][2].sender_id).toBe("charlie");
  });

  it("replaces existing message (edit from another user)", () => {
    qc.setQueryData(["friend", "bob"], makeMsgPage(
      makeMsg("m1"),
      makeMsg("m2", "charlie", "Original"),
    ));

    const editMsg = { ...makeMsg("m2", "charlie", "Edited text"), edited: true };
    applySubscriptionUpdate("bob", editMsg);

    const data = qc.getQueryData(["friend", "bob"]);
    expect(data.pages[0]).toHaveLength(2);
    expect(data.pages[0][1].content).toBe("Edited text");
    expect(data.pages[0][1].edited).toBe(true);
  });

  it("removes deleted message", () => {
    qc.setQueryData(["friend", "bob"], makeMsgPage(
      makeMsg("m1"),
      makeMsg("m2"),
      makeMsg("m3"),
    ));

    applySubscriptionUpdate("bob", { id: "m2", type: "DELETE", deleted: true });

    const data = qc.getQueryData(["friend", "bob"]);
    expect(data.pages[0]).toHaveLength(2);
    expect(data.pages[0].map((m) => m.id)).toEqual(["m1", "m3"]);
  });

  it("does nothing when prevData is null", () => {
    // No cache data at all
    applySubscriptionUpdate("bob", makeMsg("m1"));

    const data = qc.getQueryData(["friend", "bob"]);
    expect(data).toBeUndefined();
  });

  it("handles multiple rapid messages correctly", () => {
    qc.setQueryData(["friend", "bob"], makeMsgPage(makeMsg("m1")));

    applySubscriptionUpdate("bob", makeMsg("m2", "alice", "Second"));
    applySubscriptionUpdate("bob", makeMsg("m3", "charlie", "Third"));
    applySubscriptionUpdate("bob", makeMsg("m4", "dave", "Fourth"));

    const data = qc.getQueryData(["friend", "bob"]);
    expect(data.pages[0]).toHaveLength(4);
    expect(data.pages[0].map((m) => m.id)).toEqual(["m1", "m2", "m3", "m4"]);
  });

  it("appends to page 0 in multi-page cache", () => {
    const twoPages = makeTwoPages(
      [makeMsg("old1"), makeMsg("old2")],
      [makeMsg("new1"), makeMsg("new2")],
    );
    qc.setQueryData(["friend", "bob"], twoPages);

    applySubscriptionUpdate("bob", makeMsg("m5", "eve", "Fresh"));

    const data = qc.getQueryData(["friend", "bob"]);
    // Page 0 (newest) should have the new message appended
    expect(data.pages[0]).toHaveLength(3);
    expect(data.pages[0][2].id).toBe("m5");
    // Page 1 (older) stays unchanged
    expect(data.pages[1]).toHaveLength(2);
  });
});

// ============================================================
// 5. Cleanup effect — truncates only when switching chats
// ============================================================
describe("Cleanup effect (page truncation)", () => {
  let qc;

  beforeEach(() => {
    qc = makeQueryClient();
  });

  // Updated to match new cleanup logic — always trim to page 0 when there are 2+ pages
  function simulateCleanup(friendUserId) {
    qc.setQueryData(["friend", friendUserId], (prev) => {
      if (!prev || prev.pages.length <= 1) return;
      const trimmed = prev.pages.slice(0, 1);
      const params = prev.pageParams.slice(0, 1);
      return { pages: trimmed, pageParams: params };
    });
  }

  it("does nothing when cache is empty", () => {
    simulateCleanup("bob");
    expect(qc.getQueryData(["friend", "bob"])).toBeUndefined();
  });

  it("does nothing when there is only one page", () => {
    const data = makeMsgPage(makeMsg("m1"), makeMsg("m2"));
    qc.setQueryData(["friend", "bob"], data);

    simulateCleanup("bob");

    const after = qc.getQueryData(["friend", "bob"]);
    expect(after.pages).toHaveLength(1);
    expect(after.pages[0]).toHaveLength(2);
  });

  it("truncates to first page when there are multiple pages", () => {
    const data = makeTwoPages(
      [makeMsg("old1"), makeMsg("old2")],
      [makeMsg("new1")],
    );
    qc.setQueryData(["friend", "bob"], data);

    simulateCleanup("bob");

    const after = qc.getQueryData(["friend", "bob"]);
    expect(after.pages).toHaveLength(1);
    // Keeps page 0 (newest)
    expect(after.pages[0]).toEqual([makeMsg("new1")]);
  });

  it("removes empty trailing pages (the bug fix)", () => {
    const data = { pages: [[makeMsg("m1")], []], pageParams: [0, 1] };
    qc.setQueryData(["friend", "bob"], data);

    simulateCleanup("bob");

    const after = qc.getQueryData(["friend", "bob"]);
    // Now truncates to page 0 — removing the empty trailing page
    expect(after.pages).toHaveLength(1);
    expect(after.pages[0]).toHaveLength(1);
    expect(after.pages[0][0].id).toBe("m1");
  });
});

// ============================================================
// 5b. Pagination & select reversal — the "disappearing messages" bug
// ============================================================
describe("Pagination: getNextPageParam and select reversal", () => {
  const MAX = 25; // MAX_MESSAGES_PER_PAGE

  describe("getNextPageParam", () => {
    // Matches the production logic in useMessages
    function getNextPageParam(lastPage, _allPages, lastPageParam) {
      if (!lastPage || lastPage.length < MAX) return undefined;
      return lastPageParam + 1;
    }

    it("returns undefined for empty page", () => {
      expect(getNextPageParam([], [], 0)).toBeUndefined();
    });

    it("returns undefined for null page", () => {
      expect(getNextPageParam(null, [], 0)).toBeUndefined();
    });

    it("returns undefined for partial page (< MAX_MESSAGES_PER_PAGE)", () => {
      const partialPage = Array.from({ length: 4 }, (_, i) => makeMsg(`m${i}`));
      expect(getNextPageParam(partialPage, [], 0)).toBeUndefined();
    });

    it("returns undefined for page with exactly 24 messages", () => {
      const page = Array.from({ length: 24 }, (_, i) => makeMsg(`m${i}`));
      expect(getNextPageParam(page, [], 0)).toBeUndefined();
    });

    it("returns next pageParam for full page (25 messages)", () => {
      const fullPage = Array.from({ length: 25 }, (_, i) => makeMsg(`m${i}`));
      expect(getNextPageParam(fullPage, [], 0)).toBe(1);
    });

    it("returns next pageParam for subsequent full pages", () => {
      const fullPage = Array.from({ length: 25 }, (_, i) => makeMsg(`m${i}`));
      expect(getNextPageParam(fullPage, [], 2)).toBe(3);
    });
  });

  describe("select function (page reversal with empty-page filtering)", () => {
    // Matches the production logic in useMessages
    function selectFn(data) {
      if (!data || data.pages.length < 2) return data;
      let pages = [...data.pages];
      let params = [...data.pageParams];
      while (pages.length > 1 && pages[pages.length - 1]?.length === 0) {
        pages.pop();
        params.pop();
      }
      if (pages.length < 2) return { ...data, pages, pageParams: params };
      return { pages: pages.reverse(), pageParams: params.reverse() };
    }

    it("returns data unchanged for single page", () => {
      const data = makeMsgPage(makeMsg("m1"));
      expect(selectFn(data)).toBe(data);
    });

    it("returns null/undefined unchanged", () => {
      expect(selectFn(null)).toBeNull();
      expect(selectFn(undefined)).toBeUndefined();
    });

    it("reverses two non-empty pages", () => {
      const data = {
        pages: [[makeMsg("new")], [makeMsg("old")]],
        pageParams: [0, 1],
      };
      const result = selectFn(data);
      expect(result.pages[0][0].id).toBe("old");
      expect(result.pages[1][0].id).toBe("new");
    });

    it("BUG FIX: filters empty trailing page before reversal", () => {
      // This is the exact scenario that caused messages to disappear:
      // page 0 has 4 messages, page 1 is empty (fetched past the end).
      const data = {
        pages: [[makeMsg("m1"), makeMsg("m2"), makeMsg("m3"), makeMsg("m4")], []],
        pageParams: [0, 1],
      };
      const result = selectFn(data);
      // After filtering the empty page, only 1 page remains → returned as-is (no reversal)
      expect(result.pages).toHaveLength(1);
      expect(result.pages[0]).toHaveLength(4);
      expect(result.pages[0][0].id).toBe("m1");
    });

    it("BUG FIX: pages[0] is never empty after select", () => {
      // Before fix: select would reverse [msgs, []] → [[], msgs], causing "Нет сообщений"
      const data = {
        pages: [[makeMsg("a"), makeMsg("b")], []],
        pageParams: [0, 1],
      };
      const result = selectFn(data);
      // pages[0] must have messages — never empty
      expect(result.pages[0].length).toBeGreaterThan(0);
    });

    it("filters multiple empty trailing pages", () => {
      const data = {
        pages: [[makeMsg("m1")], [], []],
        pageParams: [0, 1, 2],
      };
      const result = selectFn(data);
      expect(result.pages).toHaveLength(1);
      expect(result.pages[0][0].id).toBe("m1");
    });

    it("preserves non-empty pages and reverses correctly", () => {
      // 3 pages: page 0 (newest), page 1 (middle), page 2 (oldest) — all non-empty
      const data = {
        pages: [
          [makeMsg("c1"), makeMsg("c2")],
          [makeMsg("b1"), makeMsg("b2")],
          [makeMsg("a1"), makeMsg("a2")],
        ],
        pageParams: [0, 1, 2],
      };
      const result = selectFn(data);
      // After reversal: oldest first
      expect(result.pages[0][0].id).toBe("a1");
      expect(result.pages[1][0].id).toBe("b1");
      expect(result.pages[2][0].id).toBe("c1");
    });

    it("filters empty trailing page from 3 pages and still reverses remaining", () => {
      const data = {
        pages: [
          [makeMsg("new1")],
          [makeMsg("old1")],
          [],
        ],
        pageParams: [0, 1, 2],
      };
      const result = selectFn(data);
      // Empty page removed → 2 pages → reversed
      expect(result.pages).toHaveLength(2);
      expect(result.pages[0][0].id).toBe("old1");
      expect(result.pages[1][0].id).toBe("new1");
    });
  });

  describe("Messages component 'Нет сообщений' condition", () => {
    // Matches the production logic in Messages.jsx
    function hasAnyMessages(pages) {
      return pages && pages.some((p) => p?.length > 0);
    }

    it("shows 'Нет сообщений' when pages is undefined", () => {
      expect(hasAnyMessages(undefined)).toBeFalsy();
    });

    it("shows 'Нет сообщений' when all pages are empty", () => {
      expect(hasAnyMessages([[]])).toBe(false);
    });

    it("shows 'Нет сообщений' when pages has multiple empty arrays", () => {
      expect(hasAnyMessages([[], []])).toBe(false);
    });

    it("does NOT show 'Нет сообщений' when any page has messages", () => {
      expect(hasAnyMessages([[], [makeMsg("m1")]])).toBe(true);
    });

    it("does NOT show 'Нет сообщений' for normal single page with messages", () => {
      expect(hasAnyMessages([[makeMsg("m1"), makeMsg("m2")]])).toBe(true);
    });

    it("BUG FIX: does NOT show 'Нет сообщений' even if pages[0] is empty but pages[1] has messages", () => {
      // Before fix: pages[0].length === 0 → showed "Нет сообщений" even though pages[1] had messages
      expect(hasAnyMessages([[], [makeMsg("m1")]])).toBe(true);
    });
  });
});

// ============================================================
// 6. Cache invalidation for new conversations
// ============================================================
describe("Cache invalidation for new conversations", () => {
  let qc;

  beforeEach(() => {
    qc = makeQueryClient();
  });

  it("tracks hadData = false when cache was empty before optimistic add", () => {
    const prev = qc.getQueryData(["friend", "bob"]);
    const hadData = prev?.pages?.some((p) => p?.length > 0);
    expect(hadData).toBeFalsy();
  });

  it("tracks hadData = true when cache had messages", () => {
    qc.setQueryData(["friend", "bob"], makeMsgPage(makeMsg("m1")));

    const prev = qc.getQueryData(["friend", "bob"]);
    const hadData = prev?.pages?.some((p) => p?.length > 0);
    expect(hadData).toBe(true);
  });

  it("tracks hadData = false when cache had only empty pages", () => {
    qc.setQueryData(["friend", "bob"], { pages: [[]], pageParams: [0] });

    const prev = qc.getQueryData(["friend", "bob"]);
    const hadData = prev?.pages?.some((p) => p?.length > 0);
    expect(hadData).toBe(false);
  });

  it("convInfo is updated with new conversation_id on success", () => {
    qc.setQueryData(["convInfo", "bob"], { id: null, friendInfo: { id: "bob" } });

    // Simulate onSuccess for new conversation
    qc.setQueryData(["convInfo", "bob"], (prevData) => ({
      ...prevData,
      id: "pm_me_bob",
    }));

    const convInfo = qc.getQueryData(["convInfo", "bob"]);
    expect(convInfo.id).toBe("pm_me_bob");
  });
});

// ============================================================
// 7. apiRealtimeMessage — sender filtering
// ============================================================
describe("apiRealtimeMessage sender filtering", () => {
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

  it("skips own CHAT messages (prevents echo)", () => {
    const cb = vi.fn();
    subscribeRealtimeMessage({ conversation_id: "room1", callback: cb });

    wsCallback({
      type: "CHAT",
      roomId: "room1",
      sender: "me",
      content: "My own message",
      id: "m1",
    });

    expect(cb).not.toHaveBeenCalled();
  });

  it("passes through messages from other users", () => {
    const cb = vi.fn();
    subscribeRealtimeMessage({ conversation_id: "room1", callback: cb });

    wsCallback({
      type: "CHAT",
      roomId: "room1",
      sender: "alice",
      content: "Hello",
      id: "m2",
      timestamp: "2026-03-01T12:00:00Z",
    });

    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "m2",
        sender_id: "alice",
        content: "Hello",
      }),
    );
  });

  it("allows forwarded messages from self", () => {
    const cb = vi.fn();
    subscribeRealtimeMessage({ conversation_id: "room1", callback: cb });

    wsCallback({
      type: "CHAT",
      roomId: "room1",
      sender: "me",
      content: "↪ Переслано от alice: Hello",
      id: "m3",
    });

    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({ id: "m3" }),
    );
  });

  it("skips own EDIT messages", () => {
    const cb = vi.fn();
    subscribeRealtimeMessage({ conversation_id: "room1", callback: cb });

    wsCallback({
      type: "EDIT",
      roomId: "room1",
      sender: "me",
      content: "Edited",
      id: "m4",
    });

    expect(cb).not.toHaveBeenCalled();
  });

  it("processes EDIT from other users", () => {
    const cb = vi.fn();
    subscribeRealtimeMessage({ conversation_id: "room1", callback: cb });

    wsCallback({
      type: "EDIT",
      roomId: "room1",
      sender: "alice",
      content: "Edited by alice",
      id: "m5",
      timestamp: "2026-03-01T12:01:00Z",
    });

    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "m5",
        content: "Edited by alice",
        edited: true,
        type: "CHAT",
      }),
    );
  });

  it("ignores messages for other rooms", () => {
    const cb = vi.fn();
    subscribeRealtimeMessage({ conversation_id: "room1", callback: cb });

    wsCallback({
      type: "CHAT",
      roomId: "room2",
      sender: "alice",
      content: "Wrong room",
      id: "m6",
    });

    expect(cb).not.toHaveBeenCalled();
  });

  it("returns unsubscribe function", () => {
    const { unsubscribe } = subscribeRealtimeMessage({
      conversation_id: "room1",
      callback: vi.fn(),
    });

    expect(typeof unsubscribe).toBe("function");
  });

  it("returns no-op unsubscribe for null conversation_id", () => {
    const { unsubscribe } = subscribeRealtimeMessage({
      conversation_id: null,
      callback: vi.fn(),
    });

    expect(typeof unsubscribe).toBe("function");
    // Should not throw
    unsubscribe();
  });
});

// ============================================================
// 8. getMessages — transform and reverse
// ============================================================
describe("getMessages transform", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it("returns empty array for null conversation_id", async () => {
    const result = await getMessages({ conversation_id: null });
    expect(result).toEqual([]);
  });

  it("transforms backend messages to frontend format", async () => {
    vi.mocked(apiFetch).mockImplementation((url) => {
      if (url.includes("/history"))
        return Promise.resolve([
          {
            id: "m1",
            sender: "alice",
            content: "Hello",
            timestamp: "2026-03-01T12:00:00Z",
            type: "CHAT",
            roomId: "room1",
          },
        ]);
      if (url.includes("/reactions/batch"))
        return Promise.resolve({});
      return Promise.resolve([]);
    });

    const result = await getMessages({ conversation_id: "room1" });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "m1",
      sender_id: "alice",
      content: "Hello",
      conversation_id: "room1",
      type: "CHAT",
    });
  });

  it("reverses messages so oldest is first", async () => {
    vi.mocked(apiFetch).mockImplementation((url) => {
      if (url.includes("/history"))
        return Promise.resolve([
          { id: "m3", sender: "a", content: "Newest", type: "CHAT", timestamp: "3" },
          { id: "m2", sender: "a", content: "Middle", type: "CHAT", timestamp: "2" },
          { id: "m1", sender: "a", content: "Oldest", type: "CHAT", timestamp: "1" },
        ]);
      return Promise.resolve({});
    });

    const result = await getMessages({ conversation_id: "room1" });

    expect(result[0].id).toBe("m1");
    expect(result[2].id).toBe("m3");
  });

  it("handles empty response gracefully", async () => {
    vi.mocked(apiFetch).mockResolvedValue([]);
    const result = await getMessages({ conversation_id: "room1" });
    expect(result).toEqual([]);
  });

  it("handles non-array response gracefully", async () => {
    vi.mocked(apiFetch).mockResolvedValue(null);
    const result = await getMessages({ conversation_id: "room1" });
    expect(result).toEqual([]);
  });
});

// ============================================================
// 9. sendMessage — WS and REST fallback
// ============================================================
describe("sendMessage", () => {
  beforeEach(() => {
    vi.mocked(sendWsMessage).mockReset();
    vi.mocked(apiFetch).mockReset();
    localStorage.setItem("username", "me");
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("sends via WS when connected", async () => {
    vi.mocked(sendWsMessage).mockReturnValue(true);

    const result = await sendMessage({
      id: "m1",
      conversation_id: "room1",
      content: "Hello",
      friendUserId: "bob",
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
      conversation_id: "room1",
      content: "Hello",
      sender_id: "me",
    });
  });

  it("falls back to REST when WS is disconnected", async () => {
    vi.mocked(sendWsMessage).mockReturnValue(false);
    vi.mocked(apiFetch).mockResolvedValue({});

    const result = await sendMessage({
      id: "m2",
      conversation_id: "room1",
      content: "REST message",
      friendUserId: "bob",
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/rooms/room1/messages",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.id).toBe("m2");
  });

  it("opens conversation when conversation_id is null", async () => {
    vi.mocked(sendWsMessage).mockReturnValue(true);
    vi.mocked(apiFetch).mockResolvedValue({ id: "pm_me_bob" });

    const result = await sendMessage({
      id: "m3",
      conversation_id: null,
      content: "First message",
      friendUserId: "bob",
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/rooms/private/bob",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.conversation_id).toBe("pm_me_bob");
  });

  it("includes reply fields when provided", async () => {
    vi.mocked(sendWsMessage).mockReturnValue(true);

    await sendMessage({
      id: "m4",
      conversation_id: "room1",
      content: "Reply",
      friendUserId: "bob",
      replyToId: "orig-1",
      replyToSender: "alice",
      replyToContent: "Original",
    });

    expect(sendWsMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        replyToId: "orig-1",
        replyToSender: "alice",
        replyToContent: "Original",
      }),
    );
  });
});

// ============================================================
// 10. End-to-end: send + WS echo + cache consistency
// ============================================================
describe("End-to-end message flow", () => {
  let qc;
  let wsCallback;

  beforeEach(() => {
    qc = makeQueryClient();
    vi.mocked(onWsMessage).mockImplementation((cb) => {
      wsCallback = cb;
      return () => {};
    });
    localStorage.setItem("username", "me");
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("full flow: load → send optimistic → settle → WS from others", () => {
    // 1. Initial messages loaded
    qc.setQueryData(["friend", "bob"], makeMsgPage(
      makeMsg("m1", "alice"),
      makeMsg("m2", "bob"),
    ));

    // 2. Check hadData
    const prev = qc.getQueryData(["friend", "bob"]);
    const hadData = prev?.pages?.some((p) => p?.length > 0);
    expect(hadData).toBe(true);

    // 3. Optimistic add
    const optimistic = makeOptimisticMsg("m3", "me", "My message");
    qc.setQueryData(["friend", "bob"], (old) => ({
      ...old,
      pages: old.pages.map((p, i) => (i === 0 ? [...p, optimistic] : p)),
    }));

    expect(qc.getQueryData(["friend", "bob"]).pages[0]).toHaveLength(3);

    // 4. Settle on success
    const serverMsg = { id: "m3", content: "My message", sender_id: "me", created_at: "2026-03-01T12:05:00Z" };
    qc.setQueryData(["friend", "bob"], (old) => ({
      ...old,
      pages: old.pages.map((page) =>
        page.map((m) => (m.id === "m3" ? { ...m, ...serverMsg, optimistic: false } : m)),
      ),
    }));

    const settled = qc.getQueryData(["friend", "bob"]).pages[0][2];
    expect(settled.optimistic).toBe(false);

    // 5. WS message from another user
    const wsMsg = makeMsg("m4", "charlie", "Hello!");
    qc.setQueryData(["friend", "bob"], (old) => ({
      ...old,
      pages: old.pages.map((p, i) => (i === 0 ? [...p, wsMsg] : p)),
    }));

    const final = qc.getQueryData(["friend", "bob"]);
    expect(final.pages[0]).toHaveLength(4);
    expect(final.pages[0].map((m) => m.id)).toEqual(["m1", "m2", "m3", "m4"]);
  });

  it("full flow: send on empty cache → invalidation flag set", () => {
    // Cache is empty (initial fetch cancelled or not started)
    const prev = qc.getQueryData(["friend", "bob"]);
    const hadData = prev?.pages?.some((p) => p?.length > 0);
    expect(hadData).toBeFalsy();

    // Optimistic add creates new cache
    const optimistic = makeOptimisticMsg("m1", "me", "First message");
    qc.setQueryData(["friend", "bob"], (old) => {
      if (!old?.pages) return { pages: [[optimistic]], pageParams: [0] };
      return old;
    });

    // hadData was false → onSuccess should call invalidateQueries
    // (We verify the flag; actual invalidation is tested via integration)
    expect(hadData).toBeFalsy();

    const data = qc.getQueryData(["friend", "bob"]);
    expect(data.pages[0]).toHaveLength(1);
    expect(data.pages[0][0].id).toBe("m1");
  });
});
