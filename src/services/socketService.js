import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

let socket = null;

const socketService = {
  // Safe to call multiple times; reconnects if previously disconnected.
  connect() {
    if (socket && socket.connected) return;
    socket = io(SERVER_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
    });
  },

  disconnect() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  },

  joinRoom(roomId, username) {
    if (!socket) this.connect();
    socket.emit('join_room', { roomId, username });
  },

  leaveRoom(roomId, username) {
    if (socket) {
      socket.emit('leave_room', { roomId, username });
    }
  },

  sendMessage(roomId, payload) {
    if (!socket) return;
    socket.emit('send_message', { roomId, message: payload });
  },

  onMessage(callback) {
    if (!socket) this.connect();
    socket.on('receive_message', callback);
    return () => socket?.off('receive_message', callback);
  },

  onRoomHistory(callback) {
    if (!socket) this.connect();
    socket.on('room_history', callback);
    return () => socket?.off('room_history', callback);
  },

  onUserJoined(callback) {
    if (!socket) this.connect();
    socket.on('user_joined', callback);
    return () => socket?.off('user_joined', callback);
  },

  onUserLeft(callback) {
    if (!socket) this.connect();
    socket.on('user_left', callback);
    return () => socket?.off('user_left', callback);
  },

  isConnected() {
    return !!(socket && socket.connected);
  },
};

export default socketService;
