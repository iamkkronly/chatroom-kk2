const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 3000;
const mongoURI = process.env.MONGO_URI;

// Connect to MongoDB
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// Schemas
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

// Serve index.html directly
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Join room endpoint
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
    timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  }).sort({ timestamp: 1 });

  res.send({ success: true, messages });
});

// Send message endpoint
app.post('/send', async (req, res) => {
  const { room, username, message } = req.body;
  if (!room || !username || !message) return res.status(400).send('Missing fields');

  const user = await User.findOne({ room, username });
  if (!user) return res.status(403).send('User not in room');

  await Message.create({ room, username, message });
  res.send({ success: true });
});

// Clean old messages every hour
setInterval(async () => {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await Message.deleteMany({ timestamp: { $lt: cutoff } });
}, 60 * 60 * 1000);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
