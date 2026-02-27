import { apiFetch } from "../../services/apiHelper";

// ==========================================
// BarsikChat Backend — Профиль пользователя
// ==========================================

export async function updateCurrentUser({
  password,
  fullname,
  username,
  bio,
  avatar,
  previousAvatar,
}) {
  // 1. Загрузка аватарки (если передан файл)
  if (avatar) {
    const formData = new FormData();
    formData.append("file", avatar);

    const result = await apiFetch("/api/profile/avatar", {
      method: "POST",
      body: formData,
    });

    // Обновить localStorage
    if (result?.avatarUrl) {
      localStorage.setItem("avatarUrl", result.avatarUrl);
    }

    return { user: { user_metadata: { avatar_url: result?.avatarUrl || "" } } };
  }

  // 2. Обновление текстовых полей профиля
  const body = {};
  if (fullname !== undefined) body.firstName = fullname;
  if (username !== undefined) body.username = username;
  if (bio !== undefined) body.bio = bio;

  if (Object.keys(body).length > 0) {
    const result = await apiFetch("/api/profile", {
      method: "PUT",
      body: JSON.stringify(body),
    });

    // Обновить localStorage с новыми данными
    if (result?.username) localStorage.setItem("username", result.username);

    return { user: { user_metadata: result } };
  }

  // 3. Смена пароля
  if (password) {
    await apiFetch("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ newPassword: password }),
    });
    return { user: {} };
  }

  return null;
}

///////////////////////

export async function sendPasswordResetEmail({ email, redirectTo }) {
  await apiFetch("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  return null;
}
