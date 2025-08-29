const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const pty = require('node-pty');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

io.on('connection', (socket) => {
  console.log('a user connected');

  const ptyProcess = pty.spawn('python3', ['-m', 'bcsfe'], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd: process.env.HOME,
    env: process.env
  });

  ptyProcess.onData((data) => {
    socket.emit('terminal-output', data);
  });

  socket.on('terminal-input', (data) => {
    ptyProcess.write(data);
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
    ptyProcess.kill();
  });
});

server.listen(3000, () => {
  console.log('listening on *:3000');
});