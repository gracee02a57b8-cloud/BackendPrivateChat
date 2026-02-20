import { useState, useEffect } from 'react';
import Login from './components/Login';
import Chat from './components/Chat';
import './App.css';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [username, setUsername] = useState(localStorage.getItem('username'));
  const [joinRoomId, setJoinRoomId] = useState(null);

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
  };

  if (!token) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Chat
      token={token}
      username={username}
      onLogout={handleLogout}
      joinRoomId={joinRoomId}
    />
  );
}

export default App;
