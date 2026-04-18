const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const cors    = require('cors');

const app    = express();
const server = http.createServer(app);

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ['GET', 'POST'],
  },
});

app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

// Each room: { users: [{ id, username }], messages: [...] }
const rooms = {};

function getOrCreateRoom(roomId) {
  if (!rooms[roomId]) {
    rooms[roomId] = { users: [], messages: [] };
  }
  return rooms[roomId];
}

app.get('/api/rooms', (req, res) => {
  const list = Object.entries(rooms).map(([id, data]) => ({
    id,
    userCount:    data.users.length,
    messageCount: data.messages.length,
  }));
  res.json(list);
});

io.on('connection', (socket) => {
  console.log(`[socket] connected  ${socket.id}`);

  socket.on('join_room', ({ roomId, username }) => {
    socket.join(roomId);

    const room = getOrCreateRoom(roomId);

    // Remove stale entry for this socket in case of reconnect
    room.users = room.users.filter((u) => u.id !== socket.id);
    room.users.push({ id: socket.id, username });

    socket.emit('room_history', room.messages);

    io.to(roomId).emit('user_joined', {
      username,
      userCount: room.users.length,
    });

    console.log(`[socket] ${username} joined room "${roomId}" (${room.users.length} online)`);
  });

  socket.on('send_message', ({ roomId, message }) => {
    const room = getOrCreateRoom(roomId);

    const msg = {
      id:        `${socket.id}-${Date.now()}`,
      username:  message.username,
      text:      message.text,
      type:      message.type || 'text',
      timestamp: message.timestamp || new Date().toISOString(),
    };

    // Cap history at 200 messages per room
    room.messages.push(msg);
    if (room.messages.length > 200) {
      room.messages = room.messages.slice(-200);
    }

    io.to(roomId).emit('receive_message', msg);
  });

  socket.on('leave_room', ({ roomId, username }) => {
    socket.leave(roomId);

    if (rooms[roomId]) {
      rooms[roomId].users = rooms[roomId].users.filter(
        (u) => u.id !== socket.id
      );
      io.to(roomId).emit('user_left', {
        username,
        userCount: rooms[roomId].users.length,
      });
    }

    console.log(`[socket] ${username} left room "${roomId}"`);
  });

  socket.on('disconnect', (reason) => {
    console.log(`[socket] disconnected ${socket.id} (${reason})`);

    Object.entries(rooms).forEach(([roomId, room]) => {
      const user = room.users.find((u) => u.id === socket.id);
      if (user) {
        room.users = room.users.filter((u) => u.id !== socket.id);
        io.to(roomId).emit('user_left', {
          username:  user.username,
          userCount: room.users.length,
        });
      }
    });
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`StockPulse chat server running on http://localhost:${PORT}`);
});
