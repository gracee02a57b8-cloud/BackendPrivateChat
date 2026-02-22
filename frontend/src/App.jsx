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

  const handleLogin = (newToken, newUsername, newRole) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('username', newUsername);
    localStorage.setItem('role', newRole || 'USER');
    setToken(newToken);
    setUsername(newUsername);
    setRole(newRole || 'USER');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    setToken(null);
    setUsername(null);
    setRole(null);
    setView('chat');
  };

  if (!token) {
    return <Login onLogin={handleLogin} />;
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

  if (view === 'admin' && role === 'ADMIN') {
    return (
      <AdminPanel
        token={token}
        onBack={() => setView('chat')}
      />
    );
  }

  return (
    <Chat
      token={token}
      username={username}
      onLogout={handleLogout}
      joinRoomId={joinRoomId}
      onShowNews={() => setView('news')}
      onShowAdmin={() => setView('admin')}
      role={role}
    />
  );
}

export default App;
