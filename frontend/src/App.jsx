import { useState, useEffect } from 'react';
import Login from './components/Login';
import Chat from './components/Chat';
import NewsBoard from './components/NewsBoard';
import './App.css';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [username, setUsername] = useState(localStorage.getItem('username'));
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

  const handleLogin = (newToken, newUsername) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('username', newUsername);
    setToken(newToken);
    setUsername(newUsername);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setToken(null);
    setUsername(null);
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

  return (
    <Chat
      token={token}
      username={username}
      onLogout={handleLogout}
      joinRoomId={joinRoomId}
      onShowNews={() => setView('news')}
    />
  );
}

export default App;
