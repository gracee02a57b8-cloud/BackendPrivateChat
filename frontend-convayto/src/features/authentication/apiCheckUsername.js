import { apiFetch } from "../../services/apiHelper";

export default async function apiCheckUsername(username) {
  if (!username) return;

  try {
    // Проверяем существование пользователя через профиль
    const profile = await apiFetch(`/api/profile/${username}`);
    if (profile?.username) {
      return { username: profile.username };
    }
    return null;
  } catch {
    // 404 или ошибка — пользователь не существует
    return null;
  }
}
