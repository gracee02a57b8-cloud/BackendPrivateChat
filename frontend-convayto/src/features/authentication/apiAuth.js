import supabase from "../../services/supabase";

///////////////////////////////////
// BarsikChat Backend Auth API
///////////////////////////////////

function buildSession(token, username, role, avatarUrl, tag) {
  return {
    session: {
      access_token: token,
      user: {
        // Keep "user-me-001" for mock data compatibility until backend is fully connected
        id: "user-me-001",
        role: "authenticated",
        user_metadata: {
          username: username,
          fullname: username,
          avatar_url: avatarUrl || "",
          tag: tag || "",
          bio: `Привет! Я использую BarsikChat!`,
        },
      },
    },
  };
}

///////////////////
// Sign in
///////////////////

export async function signin({ username, password }) {
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

  const data = await res.json();

  // Persist auth data
  localStorage.setItem("token", data.token);
  localStorage.setItem("username", data.username);
  localStorage.setItem("role", data.role || "USER");
  localStorage.setItem("avatarUrl", data.avatarUrl || "");
  localStorage.setItem("tag", data.tag || "");

  return buildSession(data.token, data.username, data.role, data.avatarUrl, data.tag);
}

///////////////////
// Sign up
///////////////////

export async function signup({ username, password, tag }) {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: username.trim(), password, tag: tag?.trim() }),
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

  return buildSession(data.token, data.username, data.role, data.avatarUrl, data.tag);
}

///////////////////
// Sign out
///////////////////

export async function signout() {
  localStorage.removeItem("token");
  localStorage.removeItem("username");
  localStorage.removeItem("role");
  localStorage.removeItem("avatarUrl");
  localStorage.removeItem("tag");
}

///////////////////
// Get current user (check if logged in)
///////////////////

export async function getCurrentUser() {
  const token = localStorage.getItem("token");
  const username = localStorage.getItem("username");

  if (!token || !username) {
    return { session: null };
  }

  return buildSession(
    token,
    username,
    localStorage.getItem("role"),
    localStorage.getItem("avatarUrl"),
    localStorage.getItem("tag"),
  );
}

///////////////////
// Get user by ID (still uses mock supabase for now)
///////////////////

export async function getUserById(friendUserId) {
  if (!friendUserId) return;

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", friendUserId);

  if (error) {
    if (error.code == "22P02") {
      throw new Error("User doesn't exist!");
    } else {
      throw new Error(error.message);
    }
  }

  return data[0];
}
