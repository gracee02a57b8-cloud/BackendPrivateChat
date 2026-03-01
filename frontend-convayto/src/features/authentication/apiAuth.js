import { apiFetch } from "../../services/apiHelper";
import { connectWebSocket, disconnectWebSocket } from "../../services/wsService";

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
  localStorage.setItem("username", loginData.username);
  localStorage.setItem("role", loginData.role || "USER");
  localStorage.setItem("avatarUrl", loginData.avatarUrl || "");
  localStorage.setItem("tag", loginData.tag || "");  localStorage.setItem("email", loginData.email || "");

  // Remember me: persist credentials for auto-login
  if (rememberMe) {
    localStorage.setItem("rememberMe", "true");
    localStorage.setItem("savedUsername", username.trim());
    localStorage.setItem("savedPassword", btoa(password));
  } else {
    localStorage.removeItem("rememberMe");
    localStorage.removeItem("savedUsername");
    localStorage.removeItem("savedPassword");
  }

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
  localStorage.removeItem("token");
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
  const savedUser = localStorage.getItem("savedUsername");
  const savedPass = localStorage.getItem("savedPassword");

  if (savedRemember === "true" && savedUser && savedPass) {
    try {
      const password = atob(savedPass);
      return await signin({ username: savedUser, password, rememberMe: true });
    } catch {
      // Saved credentials invalid — fall through to return null
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
        // Token expired — try silent re-login with saved credentials
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
            avatar_url: avatarUrl,
            tag: profile.tag || localStorage.getItem("tag") || "",
            bio: profile.bio || "",
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
