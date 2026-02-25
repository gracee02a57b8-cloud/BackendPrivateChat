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
  const [tag, setTag] = useState(localStorage.getItem('tag') || '');
  const [joinRoomId, setJoinRoomId] = useState(null);
  const [joinConfId, setJoinConfId] = useState(null);
  const [view, setView] = useState('chat');

  // Multi-account support
  const [savedAccounts, setSavedAccounts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('barsik_accounts') || '[]'); }
    catch { return []; }
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinId = params.get('join');
    const confId = params.get('conf');
    if (joinId) {
      setJoinRoomId(joinId);
    }
    if (confId) {
      setJoinConfId(confId);
      sessionStorage.setItem('pendingConfId', confId);
    }
    if (joinId || confId) {
      window.history.replaceState({}, '', '/');
    }
    if (!confId) {
      const saved = sessionStorage.getItem('pendingConfId');
      if (saved) setJoinConfId(saved);
    }
  }, []);

  const saveAccountToList = (accUsername, accRole, accAvatarUrl, accTag) => {
    setSavedAccounts(prev => {
      const filtered = prev.filter(a => a.username !== accUsername);
      const updated = [...filtered, { username: accUsername, role: accRole, avatarUrl: accAvatarUrl, tag: accTag }];
      localStorage.setItem('barsik_accounts', JSON.stringify(updated));
      return updated;
    });
  };

  const handleLogin = (newToken, newUsername, newRole, newAvatarUrl, newTag) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('username', newUsername);
    localStorage.setItem('role', newRole || 'USER');
    localStorage.setItem('avatarUrl', newAvatarUrl || '');
    localStorage.setItem('tag', newTag || '');
    setToken(newToken);
    setUsername(newUsername);
    setRole(newRole || 'USER');
    setAvatarUrl(newAvatarUrl || '');
    setTag(newTag || '');
    saveAccountToList(newUsername, newRole || 'USER', newAvatarUrl || '', newTag || '');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    localStorage.removeItem('avatarUrl');
    localStorage.removeItem('tag');
    setToken(null);
    setUsername(null);
    setRole(null);
    setAvatarUrl('');
    setTag('');
    setView('chat');
  };

  const handleAddAccount = () => {
    // Log out current account but keep savedAccounts
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    localStorage.removeItem('avatarUrl');
    localStorage.removeItem('tag');
    setToken(null);
    setUsername(null);
    setRole(null);
    setAvatarUrl('');
    setTag('');
    setView('chat');
  };

  const handleSwitchAccount = (acc) => {
    // Try to log in with remembered credentials if available
    const remembered = localStorage.getItem('barsik_remembered');
    if (remembered) {
      try {
        const cred = JSON.parse(remembered);
        if (cred.username === acc.username && cred.password) {
          // Auto-login
          fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: acc.username, password: cred.password }),
          })
            .then(r => r.json())
            .then(data => {
              if (data.token) {
                handleLogin(data.token, data.username, data.role, data.avatarUrl, data.tag);
              }
            })
            .catch(console.error);
          return;
        }
      } catch {}
    }
    // If no remembered password, just go to login screen
    handleAddAccount();
  };

  if (!token) {
    return <Login onLogin={handleLogin} pendingConfId={joinConfId} savedAccounts={savedAccounts} onSwitchAccount={handleSwitchAccount} />;
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
      onAddAccount={handleAddAccount}
      joinRoomId={joinRoomId}
      joinConfId={joinConfId}
      onShowNews={() => setView('news')}
    />
  );
}

export default App;
