const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const PORT = process.env.PORT || 10000;

const users = {};
let messages = []; // store chat messages in memory

// Clean up messages older than 24 hours
setInterval(() => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24h in ms
  messages = messages.filter(msg => msg.timestamp > cutoff);
}, 60 * 1000); // run every 60 seconds

// Serve index.html
app.get('/', (req, res) => {
  fs.readFile(path.join(__dirname, 'index.html'), 'utf8', (err, data) => {
    if (err) return res.status(500).send('Error loading page');
    res.send(data);
  });
});

io.on('connection', (socket) => {
  console.log('User connected');

  socket.on('set username', (username) => {
    users[socket.id] = username;

    // Send chat history from last 24 hours
    const recentMessages = messages.filter(
      msg => msg.timestamp > Date.now() - 24 * 60 * 60 * 1000
    );
    socket.emit('chat history', recentMessages);
  });

  socket.on('chat message', (text) => {
    const username = users[socket.id] || 'Anonymous';
    const msg = { user: username, text, timestamp: Date.now() };

    messages.push(msg);
    io.emit('chat message', msg);
  });

  socket.on('disconnect', () => {
    delete users[socket.id];
    console.log('User disconnected');
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
