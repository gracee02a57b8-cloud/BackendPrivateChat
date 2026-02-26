// ═══════════════════════════════════════════════
//  API Client
// ═══════════════════════════════════════════════
const BASE = '';

function headers(token: string | null) {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function request<T>(method: string, path: string, token: string | null, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(token),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : (null as T);
}

// ── Auth ──
export const login = (username: string, password: string) =>
  request<{ token: string; username: string; role: string; avatarUrl?: string; tag?: string }>('POST', '/api/auth/login', null, { username, password });

export const register = (username: string, password: string, tag?: string) =>
  request<{ token: string; username: string; role: string }>('POST', '/api/auth/register', null, { username, password, tag });

// ── Rooms ──
export const fetchRooms = (token: string) =>
  request<any[]>('GET', '/api/rooms', token);

export const createRoom = (token: string, name: string, description?: string) =>
  request<any>('POST', '/api/rooms/create', token, { name, description });

export const joinRoom = (token: string, roomId: string) =>
  request<any>('POST', `/api/rooms/${roomId}/join`, token);

export const startPrivateChat = (token: string, target: string) =>
  request<any>('POST', `/api/rooms/private/${target}`, token);

export const getSavedRoom = (token: string) =>
  request<any>('POST', '/api/rooms/saved', token);

export const deleteRoom = (token: string, roomId: number) =>
  request<any>('DELETE', `/api/rooms/${roomId}`, token);

export const leaveRoom = (token: string, roomId: number) =>
  request<any>('POST', `/api/rooms/${roomId}/leave`, token);

// Aliases
export const createPrivateRoom = startPrivateChat;
export const getSavedMessagesRoom = getSavedRoom;

// ── Messages ──
export const fetchMessages = (token: string, roomId: number) =>
  request<any[]>('GET', `/api/rooms/${roomId}/messages`, token);

export const fetchMediaStats = (token: string, roomId: number) =>
  request<any>('GET', `/api/rooms/${roomId}/media-stats`, token);

// ── Users ──
export const fetchUsers = (token: string) =>
  request<any[]>('GET', '/api/chat/users', token);

export const searchUsers = (token: string, query: string) =>
  request<any[]>('GET', `/api/chat/search?q=${encodeURIComponent(query)}`, token);

export const fetchContacts = (token: string) =>
  request<any[]>('GET', '/api/contacts', token);

export const addContact = (token: string, username: string) =>
  request<any>('POST', `/api/contacts/${username}`, token);

export const removeContact = (token: string, username: string) =>
  request<any>('DELETE', `/api/contacts/${username}`, token);

// ── Block ──
export const blockUser = (token: string, username: string) =>
  request<any>('POST', `/api/blocks/${username}`, token);

export const unblockUser = (token: string, username: string) =>
  request<any>('DELETE', `/api/blocks/${username}`, token);

// ── Profile ──
export const fetchProfile = (token: string) =>
  request<any>('GET', '/api/profile', token);

export const updateProfile = (token: string, data: any) =>
  request<any>('PUT', '/api/profile', token, data);

export const fetchUserProfile = (token: string, username: string) =>
  request<any>('GET', `/api/profile/${username}`, token);

export const uploadAvatar = async (token: string, file: File) => {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/profile/avatar', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  if (!res.ok) throw new Error('Upload failed');
  return res.json();
};

export const deleteAvatar = (token: string) =>
  request<any>('DELETE', '/api/profile/avatar', token);

// Profile aliases
export const getProfile = fetchProfile;
export const getUserProfile = fetchUserProfile;

// ── File Upload ──
export const uploadFile = async (token: string, file: File, onProgress?: (pct: number) => void): Promise<any> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data);
        } catch {
          resolve(xhr.responseText);
        }
      } else reject(new Error(`Upload failed: ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('Upload error'));
    const fd = new FormData();
    fd.append('file', file);
    xhr.send(fd);
  });
};

// ── News ──
export const fetchNews = (token: string) => request<any[]>('GET', '/api/news', token);
export const createNews = (token: string, data: any) => request<any>('POST', '/api/news', token, data);
export const deleteNews = (token: string, id: number) => request<any>('DELETE', `/api/news/${id}`, token);
export const fetchComments = (token: string, newsId: number) => request<any[]>('GET', `/api/news/${newsId}/comments`, token);
export const addComment = (token: string, newsId: number, content: string) => request<any>('POST', `/api/news/${newsId}/comments`, token, { content });
export const deleteComment = (token: string, newsId: number, commentId: number) => request<any>('DELETE', `/api/news/${newsId}/comments/${commentId}`, token);

// ── Tasks ──
export const fetchTasks = (token: string) => request<any[]>('GET', '/api/tasks', token);
export const createTask = (token: string, data: any) => request<any>('POST', '/api/tasks', token, data);
export const completeTask = (token: string, id: number) => request<any>('PUT', `/api/tasks/${id}`, token, { completed: true });
export const updateTask = (token: string, id: number, data: any) => request<any>('PUT', `/api/tasks/${id}`, token, data);
export const deleteTask = (token: string, id: number) => request<any>('DELETE', `/api/tasks/${id}`, token);

// ── Calls ──
export const fetchCallHistory = (token: string) => request<any[]>('GET', '/api/calls/history?limit=100', token);

// ── Stories ──
export const fetchStories = (token: string) => request<any[]>('GET', '/api/stories', token);
export const createStory = (token: string, data: any) => request<any>('POST', '/api/stories', token, data);
export const viewStory = (token: string, id: number) => request<any>('POST', `/api/stories/${id}/view`, token);
export const fetchViewers = (token: string, id: number) => request<any[]>('GET', `/api/stories/${id}/viewers`, token);
export const deleteStory = (token: string, id: number) => request<any>('DELETE', `/api/stories/${id}`, token);

// ── WebRTC ──
export const fetchTurnConfig = (token: string) => request<any>('GET', '/api/webrtc/turn-config', token);

// ── Conference ──
export const createConference = (token: string) => request<any>('POST', '/api/conference/create', token);
export const joinConference = (token: string, confId: string) => request<any>('POST', `/api/conference/${confId}/join`, token);

// ── Push ──
export const fetchVapidKey = (token: string) => request<any>('GET', '/api/push/vapid-key', token);
export const subscribePush = (token: string, sub: any) => request<any>('POST', '/api/push/subscribe', token, sub);

// ── Admin ──
export const fetchAdminStats = (token: string) => request<any>('GET', '/api/admin/stats', token);
