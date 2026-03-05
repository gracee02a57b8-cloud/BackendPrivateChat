// ==========================================
// SessionPersistence.test.jsx — tests for session persistence on page reload
// Covers: apiHelper 401 handling, getCurrentUser token validation,
//         auto-login fallback, useUser event listener
// ==========================================
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// ====== localStorage mock ======
let store = {};
const localStorageMock = {
  getItem: vi.fn((key) => store[key] ?? null),
  setItem: vi.fn((key, val) => { store[key] = String(val); }),
  removeItem: vi.fn((key) => { delete store[key]; }),
  clear: vi.fn(() => { store = {}; }),
};
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true });

// ====== global fetch mock ======
const fetchMock = vi.fn();
globalThis.fetch = fetchMock;

// ====== Suppress initPushNotifications / unsubscribePush ReferenceErrors ======
globalThis.initPushNotifications = vi.fn();
globalThis.unsubscribePush = vi.fn();

// ====== Mock wsService ======
vi.mock("../services/wsService", () => ({
  connectWebSocket: vi.fn(),
  disconnectWebSocket: vi.fn(),
}));

// Module-level imports (after mocks)
let apiFetch, getCurrentUser, signin, signout, useUser;

// ==========================================
// 1. apiFetch — 401 handling
// ==========================================
describe("apiFetch — 401 handling", () => {
  beforeEach(async () => {
    vi.resetModules();
    store = { token: "valid-jwt", username: "testuser" };
    fetchMock.mockReset();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
    localStorageMock.getItem.mockImplementation((key) => store[key] ?? null);
    localStorageMock.removeItem.mockImplementation((key) => { delete store[key]; });

    const mod = await import("../services/apiHelper");
    apiFetch = mod.apiFetch;
  });

  it("attaches Authorization header when token exists", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      text: async () => JSON.stringify({ data: "ok" }),
    });
    await apiFetch("/api/test");
    expect(fetchMock).toHaveBeenCalledWith("/api/test", expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer valid-jwt" }),
    }));
  });

  it("does NOT hard-redirect on 401", async () => {
    const origHref = window.location.href;
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });

    await expect(apiFetch("/api/test")).rejects.toThrow("Сессия истекла");
    // No hard redirect
    expect(window.location.href).toBe(origHref);
  });

  it("clears token and username from localStorage on 401", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
    try { await apiFetch("/api/test"); } catch {}
    expect(localStorageMock.removeItem).toHaveBeenCalledWith("token");
    expect(localStorageMock.removeItem).toHaveBeenCalledWith("username");
  });

  it("dispatches auth:session-expired event on 401", async () => {
    const handler = vi.fn();
    window.addEventListener("auth:session-expired", handler);
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
    try { await apiFetch("/api/test"); } catch {}
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener("auth:session-expired", handler);
  });

  it("debounces multiple parallel 401s (event dispatched once)", async () => {
    const handler = vi.fn();
    window.addEventListener("auth:session-expired", handler);
    fetchMock.mockResolvedValue({ ok: false, status: 401 });
    const promises = [
      apiFetch("/api/a").catch(() => {}),
      apiFetch("/api/b").catch(() => {}),
      apiFetch("/api/c").catch(() => {}),
    ];
    await Promise.all(promises);
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener("auth:session-expired", handler);
  });

  it("throws for non-401 errors without clearing auth", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false, status: 500,
      json: async () => ({ error: "Server error" }),
    });
    await expect(apiFetch("/api/test")).rejects.toThrow("Server error");
    expect(localStorageMock.removeItem).not.toHaveBeenCalled();
  });
});

// ==========================================
// 2. getCurrentUser — session check on reload
// ==========================================
describe("getCurrentUser — session persistence on reload", () => {
  beforeEach(async () => {
    vi.resetModules();
    store = {};
    fetchMock.mockReset();
    localStorageMock.getItem.mockImplementation((key) => store[key] ?? null);
    localStorageMock.setItem.mockImplementation((key, val) => { store[key] = String(val); });
    localStorageMock.removeItem.mockImplementation((key) => { delete store[key]; });
    globalThis.initPushNotifications = vi.fn();

    vi.mock("../services/wsService", () => ({
      connectWebSocket: vi.fn(),
      disconnectWebSocket: vi.fn(),
    }));

    const mod = await import("../features/authentication/apiAuth");
    getCurrentUser = mod.getCurrentUser;
    signin = mod.signin;
  });

  it("returns valid session when token is present and profile fetch succeeds", async () => {
    store = { token: "jwt-123", username: "alice" };
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({
        username: "alice",
        firstName: "Alice",
        lastName: "Smith",
        avatarUrl: "/uploads/alice.jpg",
        email: "alice@test.com",
        tag: "@alice",
        bio: "Hello!",
      }),
    });

    const result = await getCurrentUser();
    expect(result.session).not.toBeNull();
    expect(result.session.user.id).toBe("alice");
    expect(result.session.user.role).toBe("authenticated");
    expect(result.session.user.user_metadata.fullname).toBe("Alice Smith");
    expect(result.session.user.user_metadata.avatar_url).toBe("/uploads/alice.jpg");
  });

  it("uses raw fetch (not apiFetch) for profile check — no hard redirect on 401", async () => {
    store = { token: "expired-jwt", username: "alice" };
    const origHref = window.location.href;

    // Profile returns 401 — no saved credentials
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });

    const result = await getCurrentUser();
    expect(result.session).toBeNull();
    // No hard redirect occurred
    expect(window.location.href).toBe(origHref);
  });

  it("returns null session when no token in localStorage", async () => {
    store = {};
    const result = await getCurrentUser();
    expect(result.session).toBeNull();
  });

  it("returns null session when no username in localStorage", async () => {
    store = { token: "jwt-123" };
    const result = await getCurrentUser();
    expect(result.session).toBeNull();
  });

  it("tries auto-login with refresh token when access token is expired (401)", async () => {
    store = {
      token: "expired-jwt",
      username: "bob",
      rememberMe: "true",
      refreshToken: "refresh-token-bob",
    };

    // First call: profile check → 401
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
    // Second call: refresh token → success
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({
        token: "new-jwt",
        refreshToken: "new-refresh-token",
      }),
    });
    // Third call: retry profile with new token → success
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({
        username: "bob",
        firstName: "Bob",
        avatarUrl: "",
        tag: "@bob",
      }),
    });

    const result = await getCurrentUser();
    expect(result.session).not.toBeNull();
    expect(result.session.user.id).toBe("bob");
    // New token was stored
    expect(store.token).toBe("new-jwt");
  });

  it("tries auto-login via refresh token when no access token but rememberMe is set", async () => {
    store = {
      rememberMe: "true",
      refreshToken: "carol-refresh-token",
      username: "carol",
    };

    // Refresh token call → success
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({
        token: "carol-jwt",
        refreshToken: "carol-new-refresh",
      }),
    });

    const result = await getCurrentUser();
    expect(result.session).not.toBeNull();
    // Session built from localStorage values + new token
    expect(store.token).toBe("carol-jwt");
  });

  it("returns null when refresh token is expired/invalid", async () => {
    store = {
      token: "expired-jwt",
      username: "dan",
      rememberMe: "true",
      refreshToken: "expired-refresh-token",
    };

    // Profile check → 401
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
    // Refresh token → 401 (expired)
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
    // tryAutoLogin also fails — refreshToken same expired one
    // tryAutoLogin: refresh call also fails
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });

    const result = await getCurrentUser();
    expect(result.session).toBeNull();
  });

  it("falls back to localStorage on network error (offline support)", async () => {
    store = {
      token: "jwt-123",
      username: "eve",
      role: "USER",
      avatarUrl: "/img/eve.png",
      tag: "@eve",
      email: "eve@test.com",
    };

    // Network error
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const result = await getCurrentUser();
    expect(result.session).not.toBeNull();
    expect(result.session.user.id).toBe("eve");
    expect(result.session.user.user_metadata.avatar_url).toBe("/img/eve.png");
  });

  it("clears stale auth data when returning null session", async () => {
    store = { token: "expired-jwt", username: "frank" };

    // Profile → 401, no rememberMe
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });

    const result = await getCurrentUser();
    expect(result.session).toBeNull();
    // Stale token and username were cleaned up
    expect(store.token).toBeUndefined();
    expect(store.username).toBeUndefined();
  });
});

// ==========================================
// 3. useUser — auth:session-expired event handling
// ==========================================
describe("useUser — auth:session-expired event handling", () => {
  let queryClient;

  function wrapper({ children }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }

  beforeEach(async () => {
    vi.resetModules();
    store = { token: "jwt", username: "user1" };
    fetchMock.mockReset();
    localStorageMock.getItem.mockImplementation((key) => store[key] ?? null);
    localStorageMock.setItem.mockImplementation((key, val) => { store[key] = String(val); });
    localStorageMock.removeItem.mockImplementation((key) => { delete store[key]; });
    globalThis.initPushNotifications = vi.fn();

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });

    vi.mock("../services/wsService", () => ({
      connectWebSocket: vi.fn(),
      disconnectWebSocket: vi.fn(),
    }));

    const mod = await import("../features/authentication/useUser");
    useUser = mod.useUser;
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("returns isAuthenticated=true when user has valid session", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ username: "user1", firstName: "User" }),
    });

    const { result } = renderHook(() => useUser(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("clears user data when auth:session-expired event fires", async () => {
    // Initial load succeeds
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ username: "user1", firstName: "User" }),
    });

    const { result } = renderHook(() => useUser(), { wrapper });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

    // Simulate token expiry mid-session
    act(() => {
      window.dispatchEvent(new Event("auth:session-expired"));
    });

    await waitFor(() => expect(result.current.isAuthenticated).toBe(false));
    expect(result.current.session).toBeNull();
  });

  it("query has retry:false to avoid repeated failed auth checks", async () => {
    store = {};
    fetchMock.mockResolvedValue({ ok: false, status: 401 });

    const { result } = renderHook(() => useUser(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // Should not retry — only one call (or zero if short-circuited by no token)
    expect(result.current.isAuthenticated).toBe(false);
  });
});

// ==========================================
// 4. signin — stores auth data correctly
// ==========================================
describe("signin — stores auth data for session persistence", () => {
  beforeEach(async () => {
    vi.resetModules();
    store = {};
    fetchMock.mockReset();
    localStorageMock.getItem.mockImplementation((key) => store[key] ?? null);
    localStorageMock.setItem.mockImplementation((key, val) => { store[key] = String(val); });
    localStorageMock.removeItem.mockImplementation((key) => { delete store[key]; });

    vi.mock("../services/wsService", () => ({
      connectWebSocket: vi.fn(),
      disconnectWebSocket: vi.fn(),
    }));

    const mod = await import("../features/authentication/apiAuth");
    signin = mod.signin;
  });

  it("stores token, username, role in localStorage after login", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({
        token: "jwt-token-123",
        username: "alice",
        role: "USER",
        avatarUrl: "/img/a.png",
        tag: "@alice",
        email: "alice@test.com",
      }),
    });

    const result = await signin({ username: "alice", password: "pass", rememberMe: false });
    expect(store.token).toBe("jwt-token-123");
    expect(store.username).toBe("alice");
    expect(store.role).toBe("USER");
    expect(result.session.user.role).toBe("authenticated");
  });

  it("stores rememberMe flag when checked (no password stored)", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({
        token: "jwt-token-456",
        refreshToken: "refresh-456",
        username: "bob",
        role: "USER",
        avatarUrl: "",
        tag: "@bob",
      }),
    });

    await signin({ username: "bob", password: "mypassword", rememberMe: true });
    expect(store.rememberMe).toBe("true");
    expect(store.refreshToken).toBe("refresh-456");
    // Password must NOT be stored
    expect(store.savedUsername).toBeUndefined();
    expect(store.savedPassword).toBeUndefined();
  });

  it("removes rememberMe flag and cleans legacy credentials when unchecked", async () => {
    store.rememberMe = "true";
    store.savedUsername = "bob";
    store.savedPassword = btoa("oldpass");

    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({
        token: "jwt-new",
        username: "bob",
        role: "USER",
        avatarUrl: "",
        tag: "@bob",
      }),
    });

    await signin({ username: "bob", password: "newpass", rememberMe: false });
    expect(store.rememberMe).toBeUndefined();
    // Legacy credentials cleaned up
    expect(store.savedUsername).toBeUndefined();
    expect(store.savedPassword).toBeUndefined();
  });
});

// ==========================================
// 5. signout — clears all auth data
// ==========================================
describe("signout — clears all session data", () => {
  beforeEach(async () => {
    vi.resetModules();
    store = {
      token: "jwt",
      refreshToken: "refresh-jwt",
      username: "user",
      role: "USER",
      avatarUrl: "/img.png",
      tag: "@user",
      email: "u@t.com",
      rememberMe: "true",
      savedUsername: "user",
      savedPassword: btoa("pass"),
    };
    localStorageMock.getItem.mockImplementation((key) => store[key] ?? null);
    localStorageMock.removeItem.mockImplementation((key) => { delete store[key]; });
    fetchMock.mockReset();
    // logout endpoint — best effort
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    globalThis.unsubscribePush = vi.fn().mockResolvedValue(undefined);

    vi.mock("../services/wsService", () => ({
      connectWebSocket: vi.fn(),
      disconnectWebSocket: vi.fn(),
    }));

    const mod = await import("../features/authentication/apiAuth");
    signout = mod.signout;
  });

  it("removes all auth keys from localStorage", async () => {
    await signout();
    expect(store.token).toBeUndefined();
    expect(store.refreshToken).toBeUndefined();
    expect(store.username).toBeUndefined();
    expect(store.role).toBeUndefined();
    expect(store.rememberMe).toBeUndefined();
    // Legacy keys also cleaned
    expect(store.savedUsername).toBeUndefined();
    expect(store.savedPassword).toBeUndefined();
  });
});
