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

  // ── Theme management: sync dark-mode class with system preference in "auto" mode ──
  useEffect(() => {
    const applyTheme = () => {
      const t = localStorage.getItem('barsik_theme') || 'auto';
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const dark = t === 'dark' || (t === 'auto' && mq.matches);
      document.documentElement.classList.toggle('dark-mode', dark);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', dark ? '#13131c' : '#e8eef5');
    };
    applyTheme();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme();
    mq.addEventListener('change', handler);
    window.addEventListener('theme-changed', handler);
    return () => {
      mq.removeEventListener('change', handler);
      window.removeEventListener('theme-changed', handler);
    };
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

  // Auto-relogin when token expires (403) — uses remembered credentials
  const handleTokenExpired = async () => {
    const curUser = localStorage.getItem('username');
    if (!curUser) { handleLogout(); return; }
    try {
      const remembered = JSON.parse(localStorage.getItem('barsik_remembered') || '{}');
      const pwd = remembered[curUser];
      if (!pwd) { handleLogout(); return; }
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: curUser, password: pwd }),
      });
      if (!res.ok) { handleLogout(); return; }
      const data = await res.json();
      if (data.token) {
        handleLogin(data.token, data.username, data.role, data.avatarUrl, data.tag);
        console.log('[Auth] Token auto-refreshed for', curUser);
      } else {
        handleLogout();
      }
    } catch {
      handleLogout();
    }
  };

  const handleAddAccount = () => {
    // Save current account to the list before logging out
    const curUser = localStorage.getItem('username');
    if (curUser) {
      saveAccountToList(
        curUser,
        localStorage.getItem('role') || 'USER',
        localStorage.getItem('avatarUrl') || '',
        localStorage.getItem('tag') || ''
      );
    }
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
        const credMap = JSON.parse(remembered);
        const pwd = credMap[acc.username];
        if (pwd) {
          // Save current account before switching
          const curUser = localStorage.getItem('username');
          if (curUser) {
            saveAccountToList(
              curUser,
              localStorage.getItem('role') || 'USER',
              localStorage.getItem('avatarUrl') || '',
              localStorage.getItem('tag') || ''
            );
          }
          // Auto-login
          fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: acc.username, password: pwd }),
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
    // If no remembered password, just go to login screen with pre-filled username
    handleAddAccount();
    // Store desired username so Login can pre-fill it
    sessionStorage.setItem('barsik_switch_user', acc.username);
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
      onTokenExpired={handleTokenExpired}
      onAddAccount={handleAddAccount}
      onSwitchAccount={handleSwitchAccount}
      savedAccounts={savedAccounts}
      joinRoomId={joinRoomId}
      joinConfId={joinConfId}
      onShowNews={() => setView('news')}
    />
  );
}

export default App;
