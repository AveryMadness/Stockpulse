/**
 * socketService.js
 *
 * Wrapper around the Socket.io client.
 * Connects to the chat server defined in VITE_SOCKET_URL.
 *
 * Usage:
 *   import socketService from './socketService';
 *   socketService.connect();
 *   socketService.joinRoom('AAPL', 'Alice');
 *   socketService.sendMessage('AAPL', { text: 'Hello!', username: 'Alice' });
 *   socketService.onMessage((msg) => console.log(msg));
 *   socketService.leaveRoom('AAPL', 'Alice');
 */

import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

let socket = null;

const socketService = {
  /**
   * connect - initialise the Socket.io connection.
   * Safe to call multiple times; reconnects if previously disconnected.
   */
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

  /**
   * disconnect - close the connection.
   */
  disconnect() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  },

  /**
   * joinRoom - join a named chat room.
   * @param {string} roomId   Room identifier (ticker symbol or custom name)
   * @param {string} username Display name of the current user
   */
  joinRoom(roomId, username) {
    if (!socket) this.connect();
    socket.emit('join_room', { roomId, username });
  },

  /**
   * leaveRoom - leave a chat room.
   * @param {string} roomId
   * @param {string} username
   */
  leaveRoom(roomId, username) {
    if (socket) {
      socket.emit('leave_room', { roomId, username });
    }
  },

  /**
   * sendMessage - broadcast a message to a room.
   * @param {string} roomId
   * @param {{ text: string, username: string, type?: 'text'|'link'|'image' }} payload
   */
  sendMessage(roomId, payload) {
    if (!socket) return;
    socket.emit('send_message', { roomId, message: payload });
  },

  /**
   * onMessage - register a listener for incoming messages.
   * @param {Function} callback  Receives the message object
   * @returns {Function}         Cleanup function to remove the listener
   */
  onMessage(callback) {
    if (!socket) this.connect();
    socket.on('receive_message', callback);
    return () => socket?.off('receive_message', callback);
  },

  /**
   * onRoomHistory - receive the message backlog when first joining.
   * @param {Function} callback  Receives an array of past messages
   * @returns {Function}         Cleanup function
   */
  onRoomHistory(callback) {
    if (!socket) this.connect();
    socket.on('room_history', callback);
    return () => socket?.off('room_history', callback);
  },

  /**
   * onUserJoined / onUserLeft - listen for presence events.
   */
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

  /** isConnected - returns true when the socket is live. */
  isConnected() {
    return !!(socket && socket.connected);
  },
};

export default socketService;
