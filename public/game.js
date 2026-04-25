const socket = io();

// ── State ──
let myUsername = '';
let myToken = '';
let myRole = null;
let isSoldier = false;
let myRoomId = '';
let allPlayers = [];
let leaderboardData = {};
let fullLbData = [];
let lbSortKey = 'score';

const roleColors = { king:'#f5c842', queen:'#e040fb', soldier:'#42a5f5', thief:'#ef5350' };
const roleDescriptions = {
  king: 'You are the mighty King! Your identity is secret. Sit back and collect your royal reward.',
  queen: 'You are the gracious Queen! Your identity is secret. Watch the hunt unfold.',
  soldier: 'You are the brave Soldier! Everyone knows who you are. Find the Thief to earn full points!',
  thief: 'You are the cunning Thief! Stay hidden. If the Soldier cannot find you, you escape with points!'
};

// ── Screens ──
const screens = {
  splash: document.getElementById('screen-splash'),
  auth: document.getElementById('screen-auth'),
  home: document.getElementById('screen-home'),
  waiting: document.getElementById('screen-waiting'),
  role: document.getElementById('screen-role'),
  guess: document.getElementById('screen-guess'),
  result: document.getElementById('screen-result')
};
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// ── Particles ──
(function spawnParticles() {
  const c = document.getElementById('particles');
  for (let i = 0; i < 25; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const s = Math.random() * 6 + 2;
    p.style.cssText = `width:${s}px;height:${s}px;left:${Math.random()*100}%;animation-duration:${Math.random()*14+8}s;animation-delay:${Math.random()*10}s`;
    c.appendChild(p);
  }
})();

// ── Splash → Auth or Home ──
window.addEventListener('load', () => {
  const token = localStorage.getItem('rh_token');
  const username = localStorage.getItem('rh_username');
  setTimeout(() => {
    if (token && username) {
      myToken = token; myUsername = username;
      showScreen('home');
      loadHome();
    } else {
      showScreen('auth');
    }
  }, 1800);
});

// ── AUTH ──
window.switchTab = function(tab) {
  document.getElementById('tabLogin').classList.toggle('active', tab === 'login');
  document.getElementById('tabSignup').classList.toggle('active', tab === 'signup');
  document.getElementById('formLogin').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('formSignup').style.display = tab === 'signup' ? 'block' : 'none';
  document.getElementById('auth-error').textContent = '';
};

document.getElementById('loginBtn').addEventListener('click', doLogin);
document.getElementById('signupBtn').addEventListener('click', doSignup);
document.getElementById('loginPass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
document.getElementById('signupPass').addEventListener('keydown', e => { if (e.key === 'Enter') doSignup(); });

async function doLogin() {
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  const err = document.getElementById('auth-error');
  if (!username || !password) { err.textContent = 'Fill all fields'; return; }
  const btn = document.getElementById('loginBtn');
  btn.textContent = 'Entering...'; btn.disabled = true;
  try {
    const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
    const data = await res.json();
    if (data.ok) {
      myToken = data.token; myUsername = data.username;
      localStorage.setItem('rh_token', myToken);
      localStorage.setItem('rh_username', myUsername);
      showScreen('home'); loadHome();
    } else { err.textContent = data.msg; }
  } catch { err.textContent = 'Connection error'; }
  btn.textContent = 'Enter the Kingdom'; btn.disabled = false;
}

async function doSignup() {
  const username = document.getElementById('signupUser').value.trim();
  const password = document.getElementById('signupPass').value;
  const err = document.getElementById('auth-error');
  if (!username || !password) { err.textContent = 'Fill all fields'; return; }
  const btn = document.getElementById('signupBtn');
  btn.textContent = 'Creating...'; btn.disabled = true;
  try {
    const res = await fetch('/api/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
    const data = await res.json();
    if (data.ok) {
      myToken = data.token; myUsername = data.username;
      localStorage.setItem('rh_token', myToken);
      localStorage.setItem('rh_username', myUsername);
      showScreen('home'); loadHome();
    } else { err.textContent = data.msg; }
  } catch { err.textContent = 'Connection error'; }
  btn.textContent = 'Create Account'; btn.disabled = false;
}

document.getElementById('rulesToggle').addEventListener('click', () => {
  document.getElementById('rulesBox').classList.toggle('open');
});

// ── HOME ──
async function loadHome() {
  document.getElementById('navUser').textContent = `👤 ${myUsername}`;
  document.getElementById('homeWelcome').innerHTML = `<h2>Welcome back, <span>${escHtml(myUsername)}</span> 👑</h2><p>Ready to hunt?</p>`;

  // Load profile stats
  try {
    const res = await fetch(`/api/profile/${encodeURIComponent(myUsername)}`);
    const data = await res.json();
    if (data.ok) renderHomeStats(data.stats);
  } catch {}

  // Load leaderboard
  loadLeaderboard();

  // Menu profile
  document.getElementById('menuProfile').innerHTML = `
    <div class="mp-avatar">👑</div>
    <div class="mp-name">${escHtml(myUsername)}</div>
    <div class="mp-stats">Tap profile to see stats</div>
  `;
}

function renderHomeStats(stats) {
  document.getElementById('homeStats').innerHTML = `
    <div class="stat-card"><div class="sv">${stats.totalScore}</div><div class="sl">Total Pts</div></div>
    <div class="stat-card"><div class="sv">${stats.gamesPlayed}</div><div class="sl">Games</div></div>
    <div class="stat-card"><div class="sv">${stats.wins}</div><div class="sl">Wins</div></div>
  `;
  // Profile tab
  document.getElementById('profileContent').innerHTML = `
    <div class="profile-avatar">👑</div>
    <div class="profile-name">${escHtml(myUsername)}</div>
    <div class="profile-joined">Royal Hunter</div>
    <div class="profile-stats">
      <div class="pstat"><div class="pv">${stats.totalScore}</div><div class="pl">Total Score</div></div>
      <div class="pstat"><div class="pv">${stats.gamesPlayed}</div><div class="pl">Games Played</div></div>
      <div class="pstat"><div class="pv">${stats.wins}</div><div class="pl">Wins</div></div>
      <div class="pstat"><div class="pv">${stats.catches}</div><div class="pl">Thieves Caught</div></div>
      <div class="pstat"><div class="pv">${stats.escapes}</div><div class="pl">Escapes</div></div>
      <div class="pstat"><div class="pv">${stats.gamesPlayed > 0 ? Math.round(stats.totalScore/stats.gamesPlayed) : 0}</div><div class="pl">Avg Score</div></div>
    </div>
    <div class="profile-badges">
      ${stats.gamesPlayed >= 1 ? '<span class="badge">🎮 First Game</span>' : ''}
      ${stats.wins >= 1 ? '<span class="badge">🥇 First Win</span>' : ''}
      ${stats.catches >= 1 ? '<span class="badge">⚔️ Thief Catcher</span>' : ''}
      ${stats.escapes >= 1 ? '<span class="badge">🗡️ Master Thief</span>' : ''}
      ${stats.gamesPlayed >= 10 ? '<span class="badge">🔥 Veteran</span>' : ''}
    </div>
  `;
}

async function loadLeaderboard() {
  try {
    const res = await fetch('/api/leaderboard');
    fullLbData = await res.json();
    renderFullLeaderboard();
    renderQuickLeaderboard();
  } catch {}
}

window.sortLb = function(key) {
  lbSortKey = key;
  document.querySelectorAll('.lb-filter').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  renderFullLeaderboard();
};

function renderFullLeaderboard() {
  const sorted = [...fullLbData].sort((a, b) => {
    if (lbSortKey === 'wins') return b.wins - a.wins;
    if (lbSortKey === 'games') return b.gamesPlayed - a.gamesPlayed;
    return b.totalScore - a.totalScore;
  });
  const medals = ['🥇','🥈','🥉'];
  document.getElementById('fullLbRows').innerHTML = sorted.map((p, i) => `
    <div class="lb-row-full ${i===0?'lb-top1':''} ${p.username===myUsername?'lb-me':''}">
      <div class="lbf-rank">${medals[i] || (i+1)}</div>
      <div class="lbf-info">
        <div class="lbf-name">${escHtml(p.username)} ${p.username===myUsername?'<span style="color:var(--gold);font-size:11px">(You)</span>':''}</div>
        <div class="lbf-sub">${p.gamesPlayed} games · ${p.wins} wins · ${p.catches} catches</div>
      </div>
      <div class="lbf-score">${p.totalScore}<span>total pts</span></div>
    </div>
  `).join('');
}

function renderQuickLeaderboard() {
  const top5 = [...fullLbData].sort((a,b) => b.totalScore - a.totalScore).slice(0,5);
  const medals = ['🥇','🥈','🥉','4️⃣','5️⃣'];
  document.getElementById('quickLbRows').innerHTML = top5.map((p,i) => `
    <div class="lb-row ${i===0?'lb-top':''}" style="margin-bottom:6px">
      <div class="lb-rank">${medals[i]}</div>
      <div class="lb-name ${p.username===myUsername?'lb-me':''}">${escHtml(p.username)}</div>
      <div class="lb-score">${p.totalScore}</div>
    </div>
  `).join('');
}

// ── MENU ──
document.getElementById('menuToggle').addEventListener('click', () => {
  document.getElementById('sideMenu').classList.add('open');
  document.getElementById('menuOverlay').classList.add('show');
});
window.closeMenu = function() {
  document.getElementById('sideMenu').classList.remove('open');
  document.getElementById('menuOverlay').classList.remove('show');
};
window.showTab = function(tabId) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
  closeMenu();
  if (tabId === 'tabLeaderboard') loadLeaderboard();
  if (tabId === 'tabProfile') {
    fetch(`/api/profile/${encodeURIComponent(myUsername)}`).then(r=>r.json()).then(d=>{ if(d.ok) renderHomeStats(d.stats); });
  }
};

document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('rh_token');
  localStorage.removeItem('rh_username');
  myToken = ''; myUsername = '';
  closeMenu();
  showScreen('auth');
});

// ── PLAY ──
document.getElementById('genRoom').addEventListener('click', () => {
  document.getElementById('roomId').value = Math.random().toString(36).substring(2,7).toUpperCase();
});
document.getElementById('joinBtn').addEventListener('click', joinRoom);
document.getElementById('roomId').addEventListener('keydown', e => { if(e.key==='Enter') joinRoom(); });

function joinRoom() {
  const room = document.getElementById('roomId').value.trim().toUpperCase();
  const err = document.getElementById('home-error');
  if (!room) { err.textContent = 'Enter a room code!'; return; }
  err.textContent = '';
  myRoomId = room;
  socket.emit('joinRoom', { roomId: room, username: myUsername, token: myToken });
}

window.leaveRoom = function() {
  socket.disconnect();
  socket.connect();
  showScreen('home');
  loadHome();
};

// ── WAITING ROOM ──
document.getElementById('copyRoom').addEventListener('click', () => {
  navigator.clipboard.writeText(myRoomId).then(() => {
    document.getElementById('copyRoom').textContent = '✅';
    setTimeout(() => document.getElementById('copyRoom').textContent = '📋', 1500);
  });
});
document.getElementById('startBtn').addEventListener('click', () => socket.emit('startGame'));

function renderPlayerSlots(players, canStart) {
  const c = document.getElementById('playerSlots');
  c.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const slot = document.createElement('div');
    slot.className = 'player-slot' + (players[i] ? ' filled' : '');
    if (players[i]) {
      const isMe = players[i].id === socket.id;
      slot.innerHTML = `<div class="slot-name">${escHtml(players[i].name)}${isMe?' (You)':''}</div><div class="slot-status">✅ Ready</div>`;
    } else {
      slot.innerHTML = `<div class="slot-empty">Waiting...</div>`;
    }
    c.appendChild(slot);
  }
  const status = document.getElementById('waitingStatus');
  const btn = document.getElementById('startBtn');
  if (players.length < 4) {
    status.textContent = `${players.length}/4 players · Need ${4-players.length} more`;
    btn.style.display = 'none';
  } else {
    status.textContent = '4/4 players ready!';
    btn.style.display = canStart ? 'block' : 'none';
  }
}

function renderRoomLeaderboard(lb) {
  const section = document.getElementById('waitingLeaderboard');
  const rows = document.getElementById('waitingLbRows');
  if (!lb || !Object.keys(lb).length) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  const sorted = Object.entries(lb).sort((a,b) => b[1]-a[1]);
  const medals = ['🥇','🥈','🥉'];
  rows.innerHTML = sorted.map(([name,pts],i) => `
    <div class="lb-row ${i===0?'lb-top':''}">
      <div class="lb-rank">${medals[i]||i+1}</div>
      <div class="lb-name ${name===myUsername?'lb-me':''}">${escHtml(name)}${name===myUsername?' (You)':''}</div>
      <div class="lb-score">${pts}</div>
    </div>
  `).join('');
}

// Chat
document.getElementById('sendChat').addEventListener('click', () => sendChat('chatInput'));
document.getElementById('chatInput').addEventListener('keydown', e => { if(e.key==='Enter') sendChat('chatInput'); });
document.getElementById('sendChat2').addEventListener('click', () => sendChat('chatInput2'));
document.getElementById('chatInput2').addEventListener('keydown', e => { if(e.key==='Enter') sendChat('chatInput2'); });
function sendChat(inputId) {
  const input = document.getElementById(inputId);
  const msg = input.value.trim();
  if (!msg) return;
  socket.emit('sendChat', { message: msg });
  input.value = '';
}
function appendChat(id, data) {
  const c = document.getElementById(id);
  const d = document.createElement('div');
  d.className = 'chat-msg';
  d.innerHTML = `<span class="chat-name">${escHtml(data.name)}</span> <span class="chat-text">${escHtml(data.message)}</span><span class="chat-time">${data.time}</span>`;
  c.appendChild(d);
  c.scrollTop = c.scrollHeight;
}

// ── ROLE REVEAL ──
function showRoleReveal(roleData) {
  myRole = roleData;
  document.getElementById('revealEmoji').textContent = roleData.emoji;
  document.getElementById('revealRoleName').textContent = roleData.label.toUpperCase();
  document.getElementById('revealRoleValue').textContent = `${roleData.value} pts`;
  document.getElementById('revealRoleDesc').textContent = roleDescriptions[roleData.role];
  const card = document.getElementById('roleRevealCard');
  card.style.borderColor = roleColors[roleData.role] + '66';
  card.style.boxShadow = `0 0 80px ${roleColors[roleData.role]}33`;
  showScreen('role');
  let t = 3;
  const el = document.getElementById('revealTimer');
  const iv = setInterval(() => { t--; el.textContent = t; if(t<=0) clearInterval(iv); }, 1000);
}

// ── GUESS SCREEN ──
function showGuessScreen(data) {
  allPlayers = data.players;
  isSoldier = socket.id === data.soldierId;
  document.getElementById('soldierReveal').textContent = `⚔️ ${escHtml(data.soldierName)} is the Soldier`;
  if (myRole) {
    document.getElementById('myRoleBadge').innerHTML = `Your role: <strong style="color:${roleColors[myRole.role]}">${myRole.emoji} ${myRole.label}</strong>`;
  }
  if (isSoldier) {
    document.getElementById('guessSection').style.display = 'block';
    document.getElementById('waitSection').style.display = 'none';
    renderGuessPlayers(data.players);
  } else {
    document.getElementById('guessSection').style.display = 'none';
    document.getElementById('waitSection').style.display = 'block';
  }
  showScreen('guess');
}

function renderGuessPlayers(players) {
  const c = document.getElementById('guessPlayers');
  c.innerHTML = '';
  const avatars = ['🧑','👩','🧔','👱','🧕','👨','🧑‍🦱','👩‍🦰'];
  players.forEach((p, i) => {
    if (p.id === socket.id) return;
    const btn = document.createElement('button');
    btn.className = 'guess-player-btn';
    btn.innerHTML = `<div class="player-avatar">${avatars[i%avatars.length]}</div><div>${escHtml(p.name)}</div><div class="player-label">Tap to accuse</div>`;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.guess-player-btn').forEach(b => { b.disabled=true; b.style.opacity='.5'; });
      btn.style.opacity='1'; btn.style.borderColor='#ef5350'; btn.style.background='rgba(239,83,80,.15)';
      socket.emit('makeGuess', { targetId: p.id });
    });
    c.appendChild(btn);
  });
}

// ── RESULTS ──
function showResults(data) {
  const { results, guessResult, leaderboard } = data;
  leaderboardData = leaderboard || {};
  const sorted = [...results].sort((a,b) => b.score-a.score);
  const headerEl = document.getElementById('resultHeader');
  const annoEl = document.getElementById('resultAnnouncement');
  if (guessResult.correct) {
    headerEl.textContent = '⚔️ Thief Caught!';
    annoEl.innerHTML = `The Soldier caught <strong>${escHtml(guessResult.thiefName)}</strong>!<br>Justice is served! 🎉`;
    launchConfetti();
  } else {
    headerEl.textContent = '🗡️ Thief Escaped!';
    annoEl.innerHTML = `Soldier guessed <strong>${escHtml(guessResult.guessedName)}</strong> but Thief was <strong>${escHtml(guessResult.thiefName)}</strong>!<br>The Thief escapes! 🌙`;
  }
  const medals = ['🥇','🥈','🥉','4️⃣'];
  document.getElementById('scoreboard').innerHTML = sorted.map((p,i) => `
    <div class="score-row ${i===0?'winner':''}">
      <div class="rank">${medals[i]}</div>
      <div class="player-info">
        <div class="p-name">${escHtml(p.name)}${p.id===socket.id?' <span style="color:rgba(255,255,255,.4);font-size:11px">(You)</span>':''}</div>
        <div class="p-role">${p.emoji} ${p.label}</div>
      </div>
      <div class="p-score">${p.score}</div>
    </div>
  `).join('');

  // Room leaderboard in result
  const rlb = document.getElementById('resultLeaderboard');
  const rlbRows = document.getElementById('resultLbRows');
  if (leaderboard && Object.keys(leaderboard).length) {
    rlb.style.display = 'block';
    const slb = Object.entries(leaderboard).sort((a,b)=>b[1]-a[1]);
    const m = ['🥇','🥈','🥉'];
    rlbRows.innerHTML = slb.map(([name,pts],i) => `
      <div class="lb-row ${i===0?'lb-top':''}">
        <div class="lb-rank">${m[i]||i+1}</div>
        <div class="lb-name ${name===myUsername?'lb-me':''}">${escHtml(name)}${name===myUsername?' (You)':''}</div>
        <div class="lb-score">${pts}</div>
      </div>
    `).join('');
  } else { rlb.style.display = 'none'; }

  showScreen('result');
  // Refresh global leaderboard in background
  loadLeaderboard();
}

function launchConfetti() {
  const c = document.getElementById('confettiContainer');
  c.innerHTML = '';
  const colors = ['#f5c842','#e040fb','#42a5f5','#ef5350','#66bb6a','#fff'];
  for (let i = 0; i < 80; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    p.style.cssText = `left:${Math.random()*100}%;background:${colors[Math.floor(Math.random()*colors.length)]};animation-duration:${Math.random()*2+2}s;animation-delay:${Math.random()*2}s;width:${Math.random()*10+5}px;height:${Math.random()*10+5}px;border-radius:${Math.random()>.5?'50%':'2px'}`;
    c.appendChild(p);
  }
}

document.getElementById('playAgainBtn').addEventListener('click', () => socket.emit('restartGame'));
document.getElementById('homeBtn').addEventListener('click', () => { showScreen('home'); loadHome(); });

// ── SOCKET EVENTS ──
socket.on('joinedRoom', (data) => {
  leaderboardData = data.leaderboard || {};
  document.getElementById('displayRoomId').textContent = data.roomId;
  renderPlayerSlots(data.players, data.players.length === 4);
  renderRoomLeaderboard(leaderboardData);
  showScreen('waiting');
});
socket.on('playerList', (data) => { allPlayers = data.players; renderPlayerSlots(data.players, data.canStart); });
socket.on('roleAssigned', showRoleReveal);
socket.on('gameStarted', showGuessScreen);
socket.on('gameResult', showResults);
socket.on('gameRestarted', (data) => {
  leaderboardData = data.leaderboard || {};
  myRole = null; isSoldier = false;
  allPlayers = data.players;
  renderPlayerSlots(data.players, data.canStart);
  renderRoomLeaderboard(leaderboardData);
  showScreen('waiting');
});
socket.on('playerLeft', (data) => { allPlayers = data.players; renderPlayerSlots(data.players, data.canStart); });
socket.on('chatMessage', (data) => { appendChat('chatMessages', data); appendChat('chatMessages2', data); });
socket.on('authError', () => { localStorage.clear(); showScreen('auth'); });
socket.on('gameError', (msg) => { document.getElementById('home-error').textContent = msg; });

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
