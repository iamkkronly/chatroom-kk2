const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const PORT = process.env.PORT || 3000;
const mongoURI = process.env.MONGO_URI;

mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

const messageSchema = new mongoose.Schema({
  username: String,
  message: String,
  timestamp: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

io.on('connection', async (socket) => {
  // Send last 24h messages to new user
  const cutoff = new Date(Date.now() - 24*60*60*1000);
  const recentMessages = await Message.find({ timestamp: { $gte: cutoff } }).sort({ timestamp: 1 });
  recentMessages.forEach(msg => {
    socket.emit('message', { username: msg.username, message: msg.message });
  });

  socket.on('joinRoom', ({ username }) => {
    socket.broadcast.emit('message', { username: 'System', message: `${username} joined the chat` });
  });

  socket.on('sendMessage', async ({ username, message }) => {
    // Save message
    await Message.create({ username, message });
    // Broadcast message to all clients
    io.emit('message', { username, message });
  });

  socket.on('disconnect', () => {
    // Optional: emit disconnect message
  });
});

// Periodic cleanup of old messages every hour
setInterval(async () => {
  const cutoff = new Date(Date.now() - 24*60*60*1000);
  await Message.deleteMany({ timestamp: { $lt: cutoff } });
}, 60*60*1000);

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
