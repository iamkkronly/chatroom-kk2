const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http');
const socketio = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const PORT = process.env.PORT || 3000;
const mongoURI = process.env.MONGO_URI;

// Connect to MongoDB
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

// MongoDB Schemas
const userSchema = new mongoose.Schema({
  room: String,
  username: String,
  password: String,
});

const messageSchema = new mongoose.Schema({
  room: String,
  username: String,
  message: String,
  timestamp: { type: Date, default: Date.now },
});

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);

// Middleware
app.use(bodyParser.json());
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// Join Room
app.post('/join', async (req, res) => {
  const { room, username, password } = req.body;
  if (!room || !username || !password) return res.status(400).send('Missing fields');

  const existingUser = await User.findOne({ room, username });

  if (existingUser && existingUser.password !== password) {
    return res.status(403).send('Wrong password');
  }

  if (!existingUser) {
    await User.create({ room, username, password });
  }

  const messages = await Message.find({
    room,
    timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
  }).sort({ timestamp: 1 });

  res.send({ success: true, messages });
});

// Real-time chat with Socket.IO
io.on('connection', socket => {
  socket.on('joinRoom', ({ room, username }) => {
    socket.join(room);
    socket.to(room).emit('message', { username: 'System', message: `${username} joined the room` });
  });

  socket.on('sendMessage', async ({ room, username, message }) => {
    await Message.create({ room, username, message });
    io.to(room).emit('message', { username, message });
  });

  socket.on('disconnecting', () => {
    const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
    rooms.forEach(room => {
      socket.to(room).emit('message', { username: 'System', message: 'A user left the room' });
    });
  });
});

// Delete old messages (every hour)
setInterval(async () => {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await Message.deleteMany({ timestamp: { $lt: cutoff } });
}, 60 * 60 * 1000);

// Start server
server.listen(PORT, () => console.log(`🚀 Real-time chat running on http://localhost:${PORT}`));
