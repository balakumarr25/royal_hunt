const socket = io();

// State
let myName = '';
let myRoomId = '';
let myRole = null;
let isSoldier = false;
let soldierId = null;
let allPlayers = [];
let leaderboardData = {};

// Screens
const screens = {
  lobby: document.getElementById('screen-lobby'),
  waiting: document.getElementById('screen-waiting'),
  role: document.getElementById('screen-role'),
  guess: document.getElementById('screen-guess'),
  result: document.getElementById('screen-result')
};

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// ===== PARTICLES =====
function spawnParticles() {
  const container = document.getElementById('particles');
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 6 + 2;
    p.style.cssText = `
      width:${size}px; height:${size}px;
      left:${Math.random()*100}%;
      animation-duration:${Math.random()*15+8}s;
      animation-delay:${Math.random()*10}s;
    `;
    container.appendChild(p);
  }
}
spawnParticles();

// ===== LOBBY =====
document.getElementById('genRoom').addEventListener('click', () => {
  const code = Math.random().toString(36).substring(2, 7).toUpperCase();
  document.getElementById('roomId').value = code;
});

document.getElementById('rulesToggle').addEventListener('click', () => {
  document.getElementById('rulesBox').classList.toggle('open');
});

document.getElementById('joinBtn').addEventListener('click', joinGame);
document.getElementById('playerName').addEventListener('keydown', e => { if (e.key === 'Enter') joinGame(); });
document.getElementById('roomId').addEventListener('keydown', e => { if (e.key === 'Enter') joinGame(); });

function joinGame() {
  const name = document.getElementById('playerName').value.trim();
  const room = document.getElementById('roomId').value.trim().toUpperCase();
  const errEl = document.getElementById('lobby-error');
  if (!name) { errEl.textContent = 'Please enter your name!'; return; }
  if (!room) { errEl.textContent = 'Please enter a room code!'; return; }
  errEl.textContent = '';
  myName = name;
  myRoomId = room;
  socket.emit('joinRoom', { roomId: room, playerName: name });
}

// ===== WAITING ROOM =====
document.getElementById('copyRoom').addEventListener('click', () => {
  navigator.clipboard.writeText(myRoomId).then(() => {
    document.getElementById('copyRoom').textContent = '✅';
    setTimeout(() => document.getElementById('copyRoom').textContent = '📋', 1500);
  });
});

document.getElementById('startBtn').addEventListener('click', () => {
  socket.emit('startGame');
});

// ===== LEADERBOARD =====
function renderLeaderboard(lb, containerId, sectionId) {
  const section = document.getElementById(sectionId);
  const rows = document.getElementById(containerId);
  if (!lb || Object.keys(lb).length === 0) {
    section.style.display = 'none';
    return;
  }
  section.style.display = 'block';
  const sorted = Object.entries(lb).sort((a, b) => b[1] - a[1]);
  const medals = ['🥇', '🥈', '🥉'];
  rows.innerHTML = '';
  sorted.forEach(([name, total], i) => {
    const row = document.createElement('div');
    row.className = 'lb-row' + (i === 0 ? ' lb-top' : '');
    const isMe = name === myName;
    row.innerHTML = `
      <div class="lb-rank">${medals[i] || (i + 1)}</div>
      <div class="lb-name ${isMe ? 'lb-me' : ''}">${escHtml(name)} ${isMe ? '(You)' : ''}</div>
      <div class="lb-score">${total}<span class="lb-games"> pts total</span></div>
    `;
    rows.appendChild(row);
  });
}

function renderPlayerSlots(players, canStart) {
  const container = document.getElementById('playerSlots');
  container.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const slot = document.createElement('div');
    slot.className = 'player-slot' + (players[i] ? ' filled' : '');
    if (players[i]) {
      const isMe = players[i].id === socket.id;
      slot.innerHTML = `
        <div class="slot-name">${escHtml(players[i].name)} ${isMe ? '(You)' : ''}</div>
        <div class="slot-status">✅ Ready</div>
      `;
    } else {
      slot.innerHTML = `<div class="slot-empty">Waiting...</div>`;
    }
    container.appendChild(slot);
  }
  const status = document.getElementById('waitingStatus');
  const startBtn = document.getElementById('startBtn');
  if (players.length < 4) {
    status.textContent = `${players.length}/4 players joined. Waiting for ${4 - players.length} more...`;
    startBtn.style.display = 'none';
  } else {
    status.textContent = '4/4 players ready!';
    startBtn.style.display = canStart ? 'block' : 'none';
  }
}

// Chat (waiting room)
document.getElementById('sendChat').addEventListener('click', sendChat1);
document.getElementById('chatInput').addEventListener('keydown', e => { if (e.key === 'Enter') sendChat1(); });
function sendChat1() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;
  socket.emit('sendChat', { message: msg });
  input.value = '';
}

// Chat (guess screen)
document.getElementById('sendChat2').addEventListener('click', sendChat2);
document.getElementById('chatInput2').addEventListener('keydown', e => { if (e.key === 'Enter') sendChat2(); });
function sendChat2() {
  const input = document.getElementById('chatInput2');
  const msg = input.value.trim();
  if (!msg) return;
  socket.emit('sendChat', { message: msg });
  input.value = '';
}

function appendChat(containerId, data) {
  const container = document.getElementById(containerId);
  const div = document.createElement('div');
  div.className = 'chat-msg';
  div.innerHTML = `<span class="chat-name">${escHtml(data.name)}</span> <span class="chat-text">${escHtml(data.message)}</span><span class="chat-time">${data.time}</span>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// ===== ROLE REVEAL =====
const roleDescriptions = {
  king: 'You are the mighty King! Your identity is secret. Sit back and collect your royal reward.',
  queen: 'You are the gracious Queen! Your identity is secret. Watch the hunt unfold.',
  soldier: 'You are the brave Soldier! Everyone knows who you are. Find the Thief to earn full points!',
  thief: 'You are the cunning Thief! Stay hidden. If the Soldier cannot find you, you escape with points!'
};

const roleColors = {
  king: '#f5c842',
  queen: '#e040fb',
  soldier: '#42a5f5',
  thief: '#ef5350'
};

function showRoleReveal(roleData) {
  document.getElementById('revealEmoji').textContent = roleData.emoji;
  document.getElementById('revealRoleName').textContent = roleData.label.toUpperCase();
  document.getElementById('revealRoleValue').textContent = `${roleData.value} pts`;
  document.getElementById('revealRoleDesc').textContent = roleDescriptions[roleData.role];

  const card = document.getElementById('roleRevealCard');
  card.style.borderColor = roleColors[roleData.role] + '66';
  card.style.boxShadow = `0 0 80px ${roleColors[roleData.role]}33`;

  showScreen('role');

  let t = 3;
  const timerEl = document.getElementById('revealTimer');
  const interval = setInterval(() => {
    t--;
    timerEl.textContent = t;
    if (t <= 0) clearInterval(interval);
  }, 1000);
}

// ===== GUESS SCREEN =====
function showGuessScreen(data) {
  soldierId = data.soldierId;
  allPlayers = data.players;
  isSoldier = socket.id === data.soldierId;

  document.getElementById('soldierReveal').textContent = `⚔️ ${escHtml(data.soldierName)} is the Soldier`;

  const myRoleBadge = document.getElementById('myRoleBadge');
  if (myRole) {
    myRoleBadge.innerHTML = `Your role: <strong style="color:${roleColors[myRole.role]}">${myRole.emoji} ${myRole.label}</strong>`;
  }

  const guessSection = document.getElementById('guessSection');
  const waitSection = document.getElementById('waitSection');

  if (isSoldier) {
    guessSection.style.display = 'block';
    waitSection.style.display = 'none';
    renderGuessPlayers(data.players);
  } else {
    guessSection.style.display = 'none';
    waitSection.style.display = 'block';
  }

  showScreen('guess');
}

function renderGuessPlayers(players) {
  const container = document.getElementById('guessPlayers');
  container.innerHTML = '';
  const avatars = ['🧑', '👩', '🧔', '👱', '🧕', '👨', '🧑‍🦱', '👩‍🦰'];
  players.forEach((p, i) => {
    if (p.id === socket.id) return; // Soldier can't guess themselves
    const btn = document.createElement('button');
    btn.className = 'guess-player-btn';
    btn.innerHTML = `
      <div class="player-avatar">${avatars[i % avatars.length]}</div>
      <div>${escHtml(p.name)}</div>
      <div class="player-label">Tap to accuse</div>
    `;
    btn.addEventListener('click', () => makeGuess(p.id, btn));
    container.appendChild(btn);
  });
}

function makeGuess(targetId, btn) {
  // Disable all buttons
  document.querySelectorAll('.guess-player-btn').forEach(b => {
    b.disabled = true;
    b.style.opacity = '0.5';
  });
  btn.style.opacity = '1';
  btn.style.borderColor = '#ef5350';
  btn.style.background = 'rgba(239,83,80,0.15)';
  socket.emit('makeGuess', { targetId });
}

// ===== RESULT SCREEN =====
function showResults(data) {
  const { results, guessResult, leaderboard } = data;
  leaderboardData = leaderboard || {};
  const sorted = [...results].sort((a, b) => b.score - a.score);

  const headerEl = document.getElementById('resultHeader');
  const announcementEl = document.getElementById('resultAnnouncement');

  if (guessResult.correct) {
    headerEl.textContent = '⚔️ Thief Caught!';
    announcementEl.innerHTML = `The Soldier caught <strong>${escHtml(guessResult.thiefName)}</strong> the Thief!<br>Justice is served! 🎉`;
    launchConfetti();
  } else {
    headerEl.textContent = '🗡️ Thief Escaped!';
    announcementEl.innerHTML = `The Soldier guessed <strong>${escHtml(guessResult.guessedName)}</strong> but the Thief was <strong>${escHtml(guessResult.thiefName)}</strong>!<br>The Thief escapes into the night! 🌙`;
  }

  const scoreboard = document.getElementById('scoreboard');
  scoreboard.innerHTML = '';
  const medals = ['🥇', '🥈', '🥉', '4️⃣'];
  sorted.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'score-row' + (i === 0 ? ' winner' : '');
    row.innerHTML = `
      <div class="rank">${medals[i]}</div>
      <div class="player-info">
        <div class="p-name">${escHtml(p.name)} ${p.id === socket.id ? '<span style="color:rgba(255,255,255,0.4);font-size:12px">(You)</span>' : ''}</div>
        <div class="p-role">${p.emoji} ${p.label}</div>
      </div>
      <div class="p-score">${p.score}</div>
    `;
    scoreboard.appendChild(row);
  });

  renderLeaderboard(leaderboardData, 'resultLbRows', 'resultLeaderboard');
  showScreen('result');
}

function launchConfetti() {
  const container = document.getElementById('confettiContainer');
  container.innerHTML = '';
  const colors = ['#f5c842', '#e040fb', '#42a5f5', '#ef5350', '#66bb6a', '#fff'];
  for (let i = 0; i < 80; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.cssText = `
      left: ${Math.random() * 100}%;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      animation-duration: ${Math.random() * 2 + 2}s;
      animation-delay: ${Math.random() * 2}s;
      width: ${Math.random() * 10 + 5}px;
      height: ${Math.random() * 10 + 5}px;
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
    `;
    container.appendChild(piece);
  }
}

document.getElementById('playAgainBtn').addEventListener('click', () => {
  socket.emit('restartGame');
});

// ===== SOCKET EVENTS =====
socket.on('joinedRoom', (data) => {
  leaderboardData = data.leaderboard || {};
  document.getElementById('displayRoomId').textContent = data.roomId;
  renderPlayerSlots(data.players, data.players.length === 4);
  renderLeaderboard(leaderboardData, 'waitingLbRows', 'waitingLeaderboard');
  showScreen('waiting');
});

socket.on('playerList', (data) => {
  allPlayers = data.players;
  renderPlayerSlots(data.players, data.canStart);
});

socket.on('roleAssigned', (data) => {
  myRole = data;
  showRoleReveal(data);
});

socket.on('gameStarted', (data) => {
  showGuessScreen(data);
});

socket.on('gameResult', (data) => {
  showResults(data);
});

socket.on('gameRestarted', (data) => {
  leaderboardData = data.leaderboard || {};
  myRole = null;
  isSoldier = false;
  soldierId = null;
  allPlayers = data.players;
  renderPlayerSlots(data.players, data.canStart);
  renderLeaderboard(leaderboardData, 'waitingLbRows', 'waitingLeaderboard');
  showScreen('waiting');
});

socket.on('playerLeft', (data) => {
  allPlayers = data.players;
  renderPlayerSlots(data.players, data.canStart);
});

socket.on('chatMessage', (data) => {
  appendChat('chatMessages', data);
  appendChat('chatMessages2', data);
});

socket.on('error', (data) => {
  document.getElementById('lobby-error').textContent = data.message;
});

// ===== UTILS =====
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
