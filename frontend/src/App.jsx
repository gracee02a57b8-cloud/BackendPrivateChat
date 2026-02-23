import { useState, useEffect } from 'react';
import Login from './components/Login';
import Chat from './components/Chat';
import NewsBoard from './components/NewsBoard';
import AdminPanel from './components/AdminPanel';
import './App.css';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [username, setUsername] = useState(localStorage.getItem('username'));
  const [role, setRole] = useState(localStorage.getItem('role'));
  const [avatarUrl, setAvatarUrl] = useState(localStorage.getItem('avatarUrl') || '');
  const [joinRoomId, setJoinRoomId] = useState(null);
  const [joinConfId, setJoinConfId] = useState(null);
  const [view, setView] = useState('chat');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinId = params.get('join');
    const confId = params.get('conf');
    if (joinId) {
      setJoinRoomId(joinId);
    }
    if (confId) {
      setJoinConfId(confId);
      // Persist to sessionStorage so it survives login/register flow
      sessionStorage.setItem('pendingConfId', confId);
    }
    if (joinId || confId) {
      window.history.replaceState({}, '', '/');
    }
    // Also check sessionStorage for previously saved confId (e.g. after page reload during login)
    if (!confId) {
      const saved = sessionStorage.getItem('pendingConfId');
      if (saved) setJoinConfId(saved);
    }
  }, []);

  const handleLogin = (newToken, newUsername, newRole, newAvatarUrl) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('username', newUsername);
    localStorage.setItem('role', newRole || 'USER');
    localStorage.setItem('avatarUrl', newAvatarUrl || '');
    setToken(newToken);
    setUsername(newUsername);
    setRole(newRole || 'USER');
    setAvatarUrl(newAvatarUrl || '');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    localStorage.removeItem('avatarUrl');
    setToken(null);
    setUsername(null);
    setRole(null);
    setAvatarUrl('');
    setView('chat');
  };

  if (!token) {
    return <Login onLogin={handleLogin} pendingConfId={joinConfId} />;
  }

  if (role === 'ADMIN') {
    return (
      <AdminPanel
        token={token}
        username={username}
        onLogout={handleLogout}
      />
    );
  }

  if (view === 'news') {
    return (
      <NewsBoard
        token={token}
        username={username}
        onBack={() => setView('chat')}
      />
    );
  }

  return (
    <Chat
      token={token}
      username={username}
      avatarUrl={avatarUrl}
      onAvatarChange={setAvatarUrl}
      onLogout={handleLogout}
      joinRoomId={joinRoomId}
      joinConfId={joinConfId}
      onShowNews={() => setView('news')}
    />
  );
}

export default App;
