// ==========================================
// API Helper — authenticated fetch wrapper
// P1-7: auto-refresh access token on 401
// ==========================================

let isExpiring = false;
let isRefreshing = false;
let refreshPromise = null;

async function tryRefreshToken() {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) return false;

  // Deduplicate concurrent refresh attempts
  if (isRefreshing) {
    return refreshPromise;
  }
  isRefreshing = true;

  refreshPromise = (async () => {
    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        localStorage.removeItem("refreshToken");
        return false;
      }

      const data = await res.json();
      localStorage.setItem("token", data.token);
      if (data.refreshToken) {
        localStorage.setItem("refreshToken", data.refreshToken);
      }
      return true;
    } catch {
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("token");

  const headers = {
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Don't set Content-Type for FormData (browser sets boundary)
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }

  const res = await fetch(path, { ...options, headers });

  if (res.status === 401) {
    // Try to refresh the access token before giving up
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      // Retry the original request with the new token
      const newToken = localStorage.getItem("token");
      const retryHeaders = { ...headers, Authorization: `Bearer ${newToken}` };
      const retryRes = await fetch(path, { ...options, headers: retryHeaders });

      if (retryRes.ok || retryRes.status !== 401) {
        if (!retryRes.ok) {
          let errMsg = `Ошибка ${retryRes.status}`;
          try {
            const d = await retryRes.json();
            errMsg = d.error || d.message || errMsg;
          } catch {}
          throw new Error(errMsg);
        }
        const text = await retryRes.text();
        if (!text) return null;
        try { return JSON.parse(text); } catch { return text; }
      }
    }

    // Refresh failed or retry still 401 — session expired
    if (!isExpiring) {
      isExpiring = true;
      localStorage.removeItem("token");
      localStorage.removeItem("username");
      localStorage.removeItem("refreshToken");
      window.dispatchEvent(new Event("auth:session-expired"));
      setTimeout(() => { isExpiring = false; }, 3000);
    }
    throw new Error("Сессия истекла, войдите снова");
  }

  if (!res.ok) {
    let errMsg = `Ошибка ${res.status}`;
    try {
      const d = await res.json();
      errMsg = d.error || d.message || errMsg;
    } catch {}
    throw new Error(errMsg);
  }

  // Some endpoints return empty body
  const text = await res.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
