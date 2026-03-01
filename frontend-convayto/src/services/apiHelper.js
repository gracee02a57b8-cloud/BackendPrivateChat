// ==========================================
// API Helper — authenticated fetch wrapper
// ==========================================

let isExpiring = false;

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
    // Token expired — clear auth and notify React (no hard redirect)
    if (!isExpiring) {
      isExpiring = true;
      localStorage.removeItem("token");
      localStorage.removeItem("username");
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
