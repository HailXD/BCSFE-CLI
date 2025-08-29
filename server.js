const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const pty = require('node-pty');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const util = require('util');
const execFilePromise = util.promisify(execFile);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

io.on('connection', async (socket) => {
  console.log('a user connected');
  const username = `user_${socket.id.replace(/[^a-zA-Z0-9]/g, '')}`;
  const userHome = `/home/${username}`;
  const uploadDir = path.join(userHome, 'Documents', 'bcsfe', 'saves');

  try {
    // Create user
    await execFilePromise('useradd', ['-m', '-s', '/bin/bash', username]);
    console.log(`User ${username} created`);

    // Create upload directory
    fs.mkdirSync(uploadDir, { recursive: true });

    // Get user id and group id
    const { stdout: uid } = await execFilePromise('id', ['-u', username]);
    const { stdout: gid } = await execFilePromise('id', ['-g', username]);

    // Set ownership of upload directory
    await execFilePromise('chown', ['-R', `${username}:${username}`, userHome]);

    const ptyProcess = pty.spawn('python3', ['-m', 'bcsfe'], {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: userHome,
      env: { ...process.env, HOME: userHome },
      uid: parseInt(uid),
      gid: parseInt(gid)
    });

    ptyProcess.onData((data) => {
      socket.emit('terminal-output', data);
    });

    socket.on('terminal-input', (data) => {
      ptyProcess.write(data);
    });

    socket.on('disconnect', async () => {
      console.log('user disconnected');
      ptyProcess.kill();

      // Delete user
      try {
        await execFilePromise('userdel', ['-r', username]);
        console.log(`User ${username} deleted`);
      } catch (error) {
        console.error(`Error deleting user: ${error}`);
      }
    });

  } catch (error) {
    console.error(`Error setting up user session: ${error}`);
    socket.disconnect();
  }
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const username = `user_${req.query.socketId.replace(/[^a-zA-Z0-9]/g, '')}`;
    const userHome = `/home/${username}`;
    const uploadDir = path.join(userHome, 'Documents', 'bcsfe', 'saves');
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage });

app.post('/upload', upload.single('file'), async (req, res) => {
  const username = `user_${req.query.socketId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const userHome = `/home/${username}`;
  const uploadDir = path.join(userHome, 'Documents', 'bcsfe', 'saves');
  const filePath = path.join(uploadDir, req.file.filename);

  try {
    await execFilePromise('chown', [`${username}:${username}`, filePath]);
    await execFilePromise('chmod', ['600', filePath]);
    res.send(`File uploaded successfully to: ${filePath}`);
  } catch (error) {
    console.error(`Error setting file permissions: ${error}`);
    res.status(500).send('Error setting file permissions');
  }
});

server.listen(3000, () => {
  console.log('listening on *:3000');
});