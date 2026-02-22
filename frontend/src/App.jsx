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
  const [view, setView] = useState('chat');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinId = params.get('join');
    if (joinId) {
      setJoinRoomId(joinId);
      window.history.replaceState({}, '', '/');
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
    return <Login onLogin={handleLogin} />;
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
      onShowNews={() => setView('news')}
    />
  );
}

export default App;
