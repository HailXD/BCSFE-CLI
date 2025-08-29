const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const pty = require('node-pty');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

const uploadDir = '/root/Documents/bcsfe/saves';

io.on('connection', (socket) => {
  console.log('a user connected');
  const sessionDir = path.join(uploadDir, socket.id);
  fs.mkdirSync(sessionDir, { recursive: true });

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
    fs.rm(sessionDir, { recursive: true, force: true }, (err) => {
      if (err) {
        console.error(`Error removing session directory: ${err}`);
      }
    });
  });
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const sessionDir = path.join(uploadDir, req.query.socketId);
    cb(null, sessionDir);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage });

app.post('/upload', upload.single('file'), (req, res) => {
  res.send('File uploaded successfully');
});

server.listen(3000, () => {
  console.log('listening on *:3000');
});