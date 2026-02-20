import { useState } from 'react';
import Login from './components/Login';
import Chat from './components/Chat';
import './App.css';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [username, setUsername] = useState(localStorage.getItem('username'));

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

  return <Chat token={token} username={username} onLogout={handleLogout} />;
}

export default App;
