import { useState, useEffect, useRef } from 'react';
import Sidebar from './Sidebar';
import ChatRoom from './ChatRoom';

const WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;

export default function Chat({ token, username, onLogout, joinRoomId, onShowNews }) {
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
    fetch('/api/rooms', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setRooms(data))
      .catch(console.error);
  };

  const loadRoomHistory = (roomId) => {
    if (loadedRooms.current.has(roomId)) return;
    loadedRooms.current.add(roomId);
    fetch(`/api/rooms/${roomId}/history`, {
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
    fetch('/api/chat/users', {
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

  const sendMessage = (content, fileData) => {
    if (!wsRef.current) return;
    if (!content && !fileData) return;
    const msg = { content: content || '', roomId: activeRoomId };
    if (fileData) {
      msg.fileUrl = fileData.fileUrl;
      msg.fileName = fileData.fileName;
      msg.fileSize = fileData.fileSize;
      msg.fileType = fileData.fileType;
    }
    wsRef.current.send(JSON.stringify(msg));
  };

  const startPrivateChat = async (targetUser) => {
    try {
      const res = await fetch(`/api/rooms/private/${targetUser}`, {
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
      const res = await fetch('/api/rooms/create', {
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
      const res = await fetch(`/api/rooms/join/${roomId}`, {
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

  const deleteRoom = async (roomId) => {
    try {
      const res = await fetch(`/api/rooms/${roomId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setMessagesByRoom((prev) => {
          const copy = { ...prev };
          delete copy[roomId];
          return copy;
        });
        loadedRooms.current.delete(roomId);
        if (activeRoomId === roomId) setActiveRoomId('general');
        fetchRooms();
      }
    } catch (err) {
      console.error(err);
    }
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
        onDeleteRoom={deleteRoom}
        onShowNews={onShowNews}
        token={token}
      />
      <ChatRoom
        messages={activeMessages}
        onSendMessage={sendMessage}
        roomName={roomName}
        username={username}
        connected={connected}
        token={token}
      />
    </div>
  );
}
