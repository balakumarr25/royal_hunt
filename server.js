const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Game state
const rooms = {};

function createRoom(roomId) {
  return {
    id: roomId,
    players: [],
    gameState: 'waiting', // waiting | revealing | guessing | result
    roles: ['king', 'queen', 'soldier', 'thief'],
    soldierSocketId: null,
    thiefSocketId: null,
    guessResult: null,
    chat: [],
    leaderboard: {} // name -> totalScore across rounds
  };
}

function assignRoles(players) {
  const roles = [
    { role: 'king', value: 1000, label: 'King', emoji: '👑' },
    { role: 'queen', value: 500, label: 'Queen', emoji: '👸' },
    { role: 'soldier', value: 200, label: 'Soldier', emoji: '⚔️' },
    { role: 'thief', value: 100, label: 'Thief', emoji: '🗡️' }
  ];
  const shuffled = roles.sort(() => Math.random() - 0.5);
  players.forEach((p, i) => {
    p.role = shuffled[i].role;
    p.value = shuffled[i].value;
    p.emoji = shuffled[i].emoji;
    p.label = shuffled[i].label;
    p.score = 0;
  });
}

function getRoomForSocket(socketId) {
  for (const roomId in rooms) {
    const room = rooms[roomId];
    if (room.players.find(p => p.id === socketId)) return room;
  }
  return null;
}

io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  socket.on('joinRoom', ({ roomId, playerName }) => {
    let room = rooms[roomId];
    if (!room) {
      room = createRoom(roomId);
      rooms[roomId] = room;
    }

    if (room.gameState !== 'waiting') {
      socket.emit('error', { message: 'Game already in progress!' });
      return;
    }

    if (room.players.length >= 4) {
      socket.emit('error', { message: 'Room is full (4 players max)!' });
      return;
    }

    if (room.players.find(p => p.name === playerName)) {
      socket.emit('error', { message: 'Name already taken in this room!' });
      return;
    }

    const player = {
      id: socket.id,
      name: playerName,
      role: null,
      value: 0,
      emoji: '',
      label: '',
      score: 0,
      ready: false
    };

    room.players.push(player);
    socket.join(roomId);

    socket.emit('joinedRoom', {
      roomId,
      playerName,
      playerCount: room.players.length,
      players: room.players.map(p => ({ id: p.id, name: p.name })),
      leaderboard: room.leaderboard
    });

    io.to(roomId).emit('playerList', {
      players: room.players.map(p => ({ id: p.id, name: p.name })),
      count: room.players.length,
      canStart: room.players.length === 4
    });
  });

  socket.on('startGame', () => {
    const room = getRoomForSocket(socket.id);
    if (!room || room.gameState !== 'waiting') return;
    if (room.players.length !== 4) return;
    startGame(room);
  });

  socket.on('makeGuess', ({ targetId }) => {
    const room = getRoomForSocket(socket.id);
    if (!room || room.gameState !== 'guessing') return;
    if (socket.id !== room.soldierSocketId) return;

    const thief = room.players.find(p => p.role === 'thief');
    const target = room.players.find(p => p.id === targetId);
    const soldier = room.players.find(p => p.id === socket.id);

    const correct = thief && target && thief.id === target.id;

    if (correct) {
      soldier.score = 200;
      thief.score = 0;
      room.guessResult = { correct: true, thiefId: thief.id, thiefName: thief.name, guessedName: target.name };
    } else {
      soldier.score = 100;
      if (thief) thief.score = 100;
      room.guessResult = { correct: false, thiefId: thief ? thief.id : null, thiefName: thief ? thief.name : '', guessedName: target ? target.name : '' };
    }

    // King and Queen always get their values
    room.players.forEach(p => {
      if (p.role === 'king') p.score = 1000;
      if (p.role === 'queen') p.score = 500;
    });

    room.gameState = 'result';
    // Update leaderboard
    room.players.forEach(p => {
      if (!room.leaderboard[p.name]) room.leaderboard[p.name] = 0;
      room.leaderboard[p.name] += p.score;
    });
    revealResults(room);
  });

  socket.on('restartGame', () => {
    const room = getRoomForSocket(socket.id);
    if (!room) return;
    room.gameState = 'waiting';
    room.players.forEach(p => {
      p.role = null;
      p.value = 0;
      p.score = 0;
      p.ready = false;
    });
    room.soldierSocketId = null;
    room.thiefSocketId = null;
    room.guessResult = null;
    io.to(room.id).emit('gameRestarted', {
      players: room.players.map(p => ({ id: p.id, name: p.name })),
      count: room.players.length,
      leaderboard: room.leaderboard,
      canStart: room.players.length === 4
    });
  });

  socket.on('sendChat', ({ message }) => {
    const room = getRoomForSocket(socket.id);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    io.to(room.id).emit('chatMessage', {
      name: player.name,
      message,
      time: new Date().toLocaleTimeString()
    });
  });

  socket.on('disconnect', () => {
    const room = getRoomForSocket(socket.id);
    if (!room) return;
    room.players = room.players.filter(p => p.id !== socket.id);
    io.to(room.id).emit('playerLeft', {
      players: room.players.map(p => ({ id: p.id, name: p.name })),
      count: room.players.length,
      canStart: room.players.length === 4
    });
    if (room.players.length === 0) {
      delete rooms[room.id];
    }
  });
});

function startGame(room) {
  assignRoles(room.players);
  room.soldierSocketId = room.players.find(p => p.role === 'soldier').id;
  room.thiefSocketId = room.players.find(p => p.role === 'thief').id;
  room.gameState = 'revealing';

  // Send each player their own role privately
  room.players.forEach(player => {
    io.to(player.id).emit('roleAssigned', {
      role: player.role,
      label: player.label,
      emoji: player.emoji,
      value: player.value
    });
  });

  // Tell everyone who the soldier is
  const soldier = room.players.find(p => p.role === 'soldier');
  setTimeout(() => {
    room.gameState = 'guessing';
    io.to(room.id).emit('gameStarted', {
      soldierName: soldier.name,
      soldierId: soldier.id,
      players: room.players.map(p => ({ id: p.id, name: p.name }))
    });
  }, 3000);
}

function revealResults(room) {
  const results = room.players.map(p => ({
    id: p.id,
    name: p.name,
    role: p.role,
    label: p.label,
    emoji: p.emoji,
    value: p.value,
    score: p.score
  }));

  io.to(room.id).emit('gameResult', {
    results,
    guessResult: room.guessResult,
    leaderboard: room.leaderboard
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Royal Hunt server running on http://localhost:${PORT}`);
});
