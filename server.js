const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const JWT_SECRET = 'royalhunt_secret_2024';

// ── In-memory stores (persists while server runs) ──
const users = {};      // username -> { username, passwordHash, createdAt }
const userStats = {};  // username -> { totalScore, gamesPlayed, wins, catches, escapes }
const rooms = {};

// ── AUTH ROUTES ──
app.post('/api/signup', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ ok: false, msg: 'Fill all fields' });
  if (username.length < 3) return res.json({ ok: false, msg: 'Username min 3 chars' });
  if (password.length < 4) return res.json({ ok: false, msg: 'Password min 4 chars' });
  if (users[username.toLowerCase()]) return res.json({ ok: false, msg: 'Username already taken' });
  const hash = await bcrypt.hash(password, 10);
  const key = username.toLowerCase();
  users[key] = { username, passwordHash: hash, createdAt: Date.now() };
  userStats[key] = { totalScore: 0, gamesPlayed: 0, wins: 0, catches: 0, escapes: 0 };
  const token = jwt.sign({ username }, JWT_SECRET);
  res.json({ ok: true, token, username });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const key = username?.toLowerCase();
  const user = users[key];
  if (!user) return res.json({ ok: false, msg: 'User not found' });
  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) return res.json({ ok: false, msg: 'Wrong password' });
  const token = jwt.sign({ username: user.username }, JWT_SECRET);
  res.json({ ok: true, token, username: user.username });
});

app.get('/api/leaderboard', (req, res) => {
  const board = Object.entries(userStats)
    .map(([key, s]) => ({ username: users[key]?.username || key, ...s }))
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 50);
  res.json(board);
});

app.get('/api/profile/:username', (req, res) => {
  const key = req.params.username.toLowerCase();
  const stats = userStats[key];
  if (!stats) return res.json({ ok: false });
  res.json({ ok: true, username: users[key]?.username, stats });
});

// ── GAME HELPERS ──
function createRoom(roomId) {
  return {
    id: roomId, players: [],
    gameState: 'waiting',
    soldierSocketId: null, thiefSocketId: null,
    guessResult: null, leaderboard: {}
  };
}

function assignRoles(players) {
  const roles = [
    { role: 'king',   value: 1000, label: 'King',   emoji: '👑' },
    { role: 'queen',  value: 500,  label: 'Queen',  emoji: '👸' },
    { role: 'soldier',value: 200,  label: 'Soldier',emoji: '⚔️' },
    { role: 'thief',  value: 100,  label: 'Thief',  emoji: '🗡️' }
  ];
  const shuffled = roles.sort(() => Math.random() - 0.5);
  players.forEach((p, i) => Object.assign(p, shuffled[i], { score: 0 }));
}

function getRoomForSocket(socketId) {
  for (const id in rooms) {
    if (rooms[id].players.find(p => p.id === socketId)) return rooms[id];
  }
  return null;
}

// ── SOCKET ──
io.on('connection', (socket) => {

  socket.on('joinRoom', ({ roomId, username, token }) => {
    try { jwt.verify(token, JWT_SECRET); } catch { socket.emit('authError'); return; }

    let room = rooms[roomId];
    if (!room) { room = createRoom(roomId); rooms[roomId] = room; }
    if (room.gameState !== 'waiting') { socket.emit('gameError', 'Game in progress'); return; }
    if (room.players.length >= 4) { socket.emit('gameError', 'Room is full'); return; }
    if (room.players.find(p => p.username === username)) { socket.emit('gameError', 'Already in room'); return; }

    const player = { id: socket.id, username, name: username, role: null, value: 0, emoji: '', label: '', score: 0 };
    room.players.push(player);
    socket.join(roomId);

    socket.emit('joinedRoom', {
      roomId, username,
      players: room.players.map(p => ({ id: p.id, name: p.username })),
      leaderboard: room.leaderboard
    });
    io.to(roomId).emit('playerList', {
      players: room.players.map(p => ({ id: p.id, name: p.username })),
      canStart: room.players.length === 4
    });
  });

  socket.on('startGame', () => {
    const room = getRoomForSocket(socket.id);
    if (!room || room.gameState !== 'waiting' || room.players.length !== 4) return;
    startGame(room);
  });

  socket.on('makeGuess', ({ targetId }) => {
    const room = getRoomForSocket(socket.id);
    if (!room || room.gameState !== 'guessing' || socket.id !== room.soldierSocketId) return;

    const thief = room.players.find(p => p.role === 'thief');
    const target = room.players.find(p => p.id === targetId);
    const soldier = room.players.find(p => p.id === socket.id);
    const correct = thief && target && thief.id === target.id;

    if (correct) {
      soldier.score = 200; thief.score = 0;
      room.guessResult = { correct: true, thiefId: thief.id, thiefName: thief.username, guessedName: target.username };
    } else {
      soldier.score = 100; if (thief) thief.score = 100;
      room.guessResult = { correct: false, thiefId: thief?.id, thiefName: thief?.username || '', guessedName: target?.username || '' };
    }
    room.players.forEach(p => {
      if (p.role === 'king') p.score = 1000;
      if (p.role === 'queen') p.score = 500;
    });

    // Update persistent stats
    const sorted = [...room.players].sort((a, b) => b.score - a.score);
    room.players.forEach(p => {
      const key = p.username.toLowerCase();
      if (!userStats[key]) userStats[key] = { totalScore: 0, gamesPlayed: 0, wins: 0, catches: 0, escapes: 0 };
      userStats[key].totalScore += p.score;
      userStats[key].gamesPlayed += 1;
      if (sorted[0].username === p.username) userStats[key].wins += 1;
      if (p.role === 'soldier' && correct) userStats[key].catches += 1;
      if (p.role === 'thief' && !correct) userStats[key].escapes += 1;
      if (!room.leaderboard[p.username]) room.leaderboard[p.username] = 0;
      room.leaderboard[p.username] += p.score;
    });

    room.gameState = 'result';
    revealResults(room);
  });

  socket.on('restartGame', () => {
    const room = getRoomForSocket(socket.id);
    if (!room) return;
    room.gameState = 'waiting';
    room.players.forEach(p => { p.role = null; p.value = 0; p.score = 0; });
    room.soldierSocketId = null; room.thiefSocketId = null; room.guessResult = null;
    io.to(room.id).emit('gameRestarted', {
      players: room.players.map(p => ({ id: p.id, name: p.username })),
      leaderboard: room.leaderboard, canStart: room.players.length === 4
    });
  });

  socket.on('sendChat', ({ message }) => {
    const room = getRoomForSocket(socket.id);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    io.to(room.id).emit('chatMessage', { name: player.username, message, time: new Date().toLocaleTimeString() });
  });

  socket.on('disconnect', () => {
    const room = getRoomForSocket(socket.id);
    if (!room) return;
    room.players = room.players.filter(p => p.id !== socket.id);
    io.to(room.id).emit('playerLeft', {
      players: room.players.map(p => ({ id: p.id, name: p.username })),
      canStart: room.players.length === 4
    });
    if (room.players.length === 0) delete rooms[room.id];
  });
});

function startGame(room) {
  assignRoles(room.players);
  room.soldierSocketId = room.players.find(p => p.role === 'soldier').id;
  room.thiefSocketId = room.players.find(p => p.role === 'thief').id;
  room.gameState = 'revealing';
  room.players.forEach(p => io.to(p.id).emit('roleAssigned', { role: p.role, label: p.label, emoji: p.emoji, value: p.value }));
  const soldier = room.players.find(p => p.role === 'soldier');
  setTimeout(() => {
    room.gameState = 'guessing';
    io.to(room.id).emit('gameStarted', {
      soldierName: soldier.username, soldierId: soldier.id,
      players: room.players.map(p => ({ id: p.id, name: p.username }))
    });
  }, 3500);
}

function revealResults(room) {
  io.to(room.id).emit('gameResult', {
    results: room.players.map(p => ({ id: p.id, name: p.username, role: p.role, label: p.label, emoji: p.emoji, value: p.value, score: p.score })),
    guessResult: room.guessResult, leaderboard: room.leaderboard
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Royal Hunt running on http://localhost:${PORT}`));
