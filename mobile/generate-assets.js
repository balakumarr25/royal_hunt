// node generate-assets.js
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

function drawIcon(canvas) {
  const ctx = canvas.getContext('2d');
  const s = canvas.width;
  // Background
  const grad = ctx.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
  grad.addColorStop(0, '#1a0533');
  grad.addColorStop(1, '#0d0d2b');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(0, 0, s, s, s * 0.18);
  ctx.fill();
  // Crown
  ctx.font = `${s * 0.55}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('👑', s / 2, s / 2);
}

function drawSplash(canvas) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  // Background
  const grad = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, w/2);
  grad.addColorStop(0, '#1a0533');
  grad.addColorStop(1, '#0d0d2b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  // Crown
  ctx.font = '220px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('👑', w / 2, h / 2 - 60);
  // Title
  ctx.fillStyle = '#f5c842';
  ctx.font = 'bold 100px sans-serif';
  ctx.fillText('Royal Hunt', w / 2, h / 2 + 140);
}

const assetsDir = path.join(__dirname, 'assets');

// icon.png 1024x1024
const icon = createCanvas(1024, 1024);
drawIcon(icon);
fs.writeFileSync(path.join(assetsDir, 'icon.png'), icon.toBuffer('image/png'));
console.log('✅ icon.png');

// adaptive-icon.png 1024x1024
const adaptive = createCanvas(1024, 1024);
drawIcon(adaptive);
fs.writeFileSync(path.join(assetsDir, 'adaptive-icon.png'), adaptive.toBuffer('image/png'));
console.log('✅ adaptive-icon.png');

// splash.png 1284x2778
const splash = createCanvas(1284, 2778);
drawSplash(splash);
fs.writeFileSync(path.join(assetsDir, 'splash.png'), splash.toBuffer('image/png'));
console.log('✅ splash.png');

// favicon.png 48x48
const fav = createCanvas(48, 48);
drawIcon(fav);
fs.writeFileSync(path.join(assetsDir, 'favicon.png'), fav.toBuffer('image/png'));
console.log('✅ favicon.png');

console.log('\nAll assets generated in mobile/assets/');
