import { useState, useEffect, useRef } from 'react';
import Sidebar from './Sidebar';
import ChatRoom from './ChatRoom';

const WS_URL = 'ws://localhost:9001';
const API_URL = 'http://localhost:9001';

export default function Chat({ token, username, onLogout, joinRoomId }) {
  const [rooms, setRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState('general');
  const [messagesByRoom, setMessagesByRoom] = useState({});
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const loadedRooms = useRef(new Set());

  useEffect(() => {
    fetchRooms();
    loadRoomHistory('general');

    const ws = new WebSocket(`${WS_URL}/ws/chat?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      fetchUsers();
      if (joinRoomId) handleAutoJoin(joinRoomId);
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      const roomId = msg.roomId || 'general';
      setMessagesByRoom((prev) => ({
        ...prev,
        [roomId]: [...(prev[roomId] || []), msg],
      }));
      if (msg.type === 'JOIN' || msg.type === 'LEAVE') {
        fetchUsers();
      }
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    return () => ws.close();
  }, [token]);

  const fetchRooms = () => {
    fetch(`${API_URL}/api/rooms`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setRooms(data))
      .catch(console.error);
  };

  const loadRoomHistory = (roomId) => {
    if (loadedRooms.current.has(roomId)) return;
    loadedRooms.current.add(roomId);
    fetch(`${API_URL}/api/rooms/${roomId}/history`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.length > 0) {
          setMessagesByRoom((prev) => ({ ...prev, [roomId]: data }));
        }
      })
      .catch(console.error);
  };

  const fetchUsers = () => {
    fetch(`${API_URL}/api/chat/users`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setOnlineUsers(data))
      .catch(console.error);
  };

  const selectRoom = (roomId) => {
    setActiveRoomId(roomId);
    loadRoomHistory(roomId);
  };

  const sendMessage = (content) => {
    if (!content.trim() || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ content: content.trim(), roomId: activeRoomId }));
  };

  const startPrivateChat = async (targetUser) => {
    try {
      const res = await fetch(`${API_URL}/api/rooms/private/${targetUser}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const room = await res.json();
      fetchRooms();
      selectRoom(room.id);
    } catch (err) {
      console.error(err);
    }
  };

  const createRoom = async (name) => {
    try {
      const res = await fetch(`${API_URL}/api/rooms/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name }),
      });
      const room = await res.json();
      fetchRooms();
      selectRoom(room.id);
      return room;
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  const joinRoom = async (roomId) => {
    try {
      const res = await fetch(`${API_URL}/api/rooms/join/${roomId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const room = await res.json();
      fetchRooms();
      selectRoom(room.id);
      return room;
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  const handleAutoJoin = async (roomId) => {
    await joinRoom(roomId);
  };

  const activeRoom = rooms.find((r) => r.id === activeRoomId);
  const activeMessages = messagesByRoom[activeRoomId] || [];
  const roomName = activeRoom ? activeRoom.name : 'Общий чат';

  return (
    <div className="chat-container">
      <Sidebar
        rooms={rooms}
        activeRoomId={activeRoomId}
        onSelectRoom={selectRoom}
        onlineUsers={onlineUsers}
        username={username}
        connected={connected}
        onLogout={onLogout}
        onStartPrivateChat={startPrivateChat}
        onCreateRoom={createRoom}
        onJoinRoom={joinRoom}
        token={token}
      />
      <ChatRoom
        messages={activeMessages}
        onSendMessage={sendMessage}
        roomName={roomName}
        username={username}
        connected={connected}
      />
    </div>
  );
}
