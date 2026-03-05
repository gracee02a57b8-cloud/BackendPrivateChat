import { apiFetch } from "../../services/apiHelper";
import { connectWebSocket, disconnectWebSocket } from "../../services/wsService";
import { initPushNotifications, unsubscribePush } from "../../services/pushService";

///////////////////////////////////
// BarsikChat Backend Auth API
///////////////////////////////////

function buildSession(token, username, role, avatarUrl, tag, email) {
  return {
    session: {
      access_token: token,
      user: {
        id: username,
        email: email || "",
        role: "authenticated",
        user_metadata: {
          username: username,
          fullname: username,
          avatar_url: avatarUrl || "",
          tag: tag || "",
          bio: "Привет! Я использую BarsikChat!",
        },
      },
    },
  };
}

///////////////////
// Sign in
///////////////////

export async function signin({ username, password, rememberMe = false }) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: username.trim(), password }),
  });

  if (!res.ok) {
    let errMsg = "Неверное имя пользователя или пароль";
    try {
      const d = await res.json();
      errMsg = d.error || d.message || errMsg;
    } catch {}
    throw new Error(errMsg);
  }

  const loginData = await res.json();

  // Persist auth data
  localStorage.setItem("token", loginData.token);
  if (loginData.refreshToken) localStorage.setItem("refreshToken", loginData.refreshToken);
  localStorage.setItem("username", loginData.username);
  localStorage.setItem("role", loginData.role || "USER");
  localStorage.setItem("avatarUrl", loginData.avatarUrl || "");
  localStorage.setItem("tag", loginData.tag || "");  localStorage.setItem("email", loginData.email || "");

  // Remember me: persist flag for auto-login via refresh token (no password stored)
  if (rememberMe) {
    localStorage.setItem("rememberMe", "true");
  } else {
    localStorage.removeItem("rememberMe");
  }
  // Clean up any legacy saved credentials
  localStorage.removeItem("savedUsername");
  localStorage.removeItem("savedPassword");

  // Connect WebSocket after login
  connectWebSocket();

  return buildSession(loginData.token, loginData.username, loginData.role, loginData.avatarUrl, loginData.tag, loginData.email);
}

///////////////////
// Sign up
///////////////////

export async function signup({ username, password, tag, fullname }) {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: username.trim(), password, tag: tag?.trim(), fullname: fullname?.trim() }),
  });

  if (!res.ok) {
    let errMsg = "Ошибка регистрации";
    try {
      const d = await res.json();
      errMsg = d.error || d.message || errMsg;
    } catch {}
    throw new Error(errMsg);
  }

  const data = await res.json();

  // Auto-login after registration
  localStorage.setItem("token", data.token);
  if (data.refreshToken) localStorage.setItem("refreshToken", data.refreshToken);
  localStorage.setItem("username", data.username);
  localStorage.setItem("role", data.role || "USER");
  localStorage.setItem("avatarUrl", data.avatarUrl || "");
  localStorage.setItem("tag", data.tag || "");
  localStorage.setItem("email", data.email || "");

  // Connect WebSocket after registration
  connectWebSocket();

  return buildSession(data.token, data.username, data.role, data.avatarUrl, data.tag, data.email);
}

///////////////////
// Sign out
///////////////////

export async function signout() {
  await unsubscribePush();
  disconnectWebSocket();

  // Revoke refresh token on server
  const refreshToken = localStorage.getItem("refreshToken");
  if (refreshToken) {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json",
                   "Authorization": `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ refreshToken }),
      });
    } catch { /* ignore — best effort */ }
  }

  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("username");
  localStorage.removeItem("role");
  localStorage.removeItem("avatarUrl");
  localStorage.removeItem("tag");
  localStorage.removeItem("email");
  localStorage.removeItem("rememberMe");
  localStorage.removeItem("savedUsername");
  localStorage.removeItem("savedPassword");
}

///////////////////
// Silent auto-login with saved credentials
///////////////////

async function tryAutoLogin() {
  const savedRemember = localStorage.getItem("rememberMe");
  const refreshToken = localStorage.getItem("refreshToken");

  // Clean up any legacy plaintext password storage
  localStorage.removeItem("savedPassword");
  localStorage.removeItem("savedUsername");

  if (savedRemember === "true" && refreshToken) {
    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("token", data.token);
        if (data.refreshToken) localStorage.setItem("refreshToken", data.refreshToken);
        // Reconnect WS with new token
        connectWebSocket();
        // Fetch user profile to build session
        const username = localStorage.getItem("username");
        const role = localStorage.getItem("role") || "USER";
        const avatarUrl = localStorage.getItem("avatarUrl") || "";
        const tag = localStorage.getItem("tag") || "";
        const email = localStorage.getItem("email") || "";
        return buildSession(data.token, username, role, avatarUrl, tag, email);
      }
    } catch {
      // Refresh failed — fall through to return null
    }
  }

  // Clean up stale auth data
  localStorage.removeItem("token");
  localStorage.removeItem("username");
  return { session: null };
}

///////////////////
// Get current user (check if logged in)
///////////////////

export async function getCurrentUser() {
  const token = localStorage.getItem("token");
  const username = localStorage.getItem("username");

  if (!token || !username) {
    return await tryAutoLogin();
  }

  // Verify token with server using raw fetch (bypasses apiFetch 401 handler)
  try {
    const res = await fetch("/api/profile", {
      headers: { "Authorization": `Bearer ${token}` },
    });

    if (!res.ok) {
      if (res.status === 401) {
        // Token expired — try refresh first, then silent re-login
        const refreshToken = localStorage.getItem("refreshToken");
        if (refreshToken) {
          try {
            const refreshRes = await fetch("/api/auth/refresh", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ refreshToken }),
            });
            if (refreshRes.ok) {
              const rd = await refreshRes.json();
              localStorage.setItem("token", rd.token);
              if (rd.refreshToken) localStorage.setItem("refreshToken", rd.refreshToken);
              return await getCurrentUser(); // retry with new token
            }
          } catch { /* fall through */ }
        }
        return await tryAutoLogin();
      }
      throw new Error(`Profile fetch failed: ${res.status}`);
    }

    const profile = await res.json();

    // Token is valid — connect WebSocket and init push
    connectWebSocket();
    initPushNotifications();

    // Keep localStorage in sync
    if (profile.avatarUrl) localStorage.setItem("avatarUrl", profile.avatarUrl);

    const avatarUrl = profile.avatarUrl || localStorage.getItem("avatarUrl") || "";
    const fullname = (profile.firstName && profile.lastName
      ? `${profile.firstName} ${profile.lastName}`.trim()
      : profile.firstName || profile.username || username);

    return {
      session: {
        access_token: token,
        user: {
          id: username,
          email: profile.email || localStorage.getItem("email") || "",
          role: "authenticated",
          user_metadata: {
            username: profile.username || username,
            fullname,
            firstName: profile.firstName || "",
            lastName: profile.lastName || "",
            avatar_url: avatarUrl,
            tag: profile.tag || localStorage.getItem("tag") || "",
            bio: profile.bio || "",
            phone: profile.phone || "",
          },
        },
      },
    };
  } catch {
    // Network error — fall back to localStorage values (offline support)
    connectWebSocket();
    return buildSession(
      token,
      username,
      localStorage.getItem("role"),
      localStorage.getItem("avatarUrl"),
      localStorage.getItem("tag"),
      localStorage.getItem("email"),
    );
  }
}

///////////////////
// Get user profile by username
///////////////////

export async function getUserById(username) {
  if (!username || username === "undefined") return null;

  try {
    const profile = await apiFetch(`/api/profile/${username}`);
    return {
      id: profile.username,
      fullname: profile.firstName && profile.lastName
        ? `${profile.firstName} ${profile.lastName}`.trim()
        : profile.username,
      username: profile.username,
      avatar_url: profile.avatarUrl || "",
      bio: profile.bio || "",
      tag: profile.tag || "",
      online: false, // Will be updated via contacts endpoint
      lastSeen: profile.lastSeen || null,
    };
  } catch {
    // Fallback — return minimal info
    return {
      id: username,
      fullname: username,
      username: username,
      avatar_url: "",
      bio: "",
      tag: "",
    };
  }
}
