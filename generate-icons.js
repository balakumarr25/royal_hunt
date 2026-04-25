// Run: node generate-icons.js
const { createCanvas } = require('canvas');
const fs = require('fs');

function generateIcon(size, filename) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background
  const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  grad.addColorStop(0, '#1a0533');
  grad.addColorStop(1, '#0d0d2b');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * 0.2);
  ctx.fill();

  // Crown emoji
  ctx.font = `${size * 0.55}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('👑', size / 2, size / 2);

  fs.writeFileSync(`public/${filename}`, canvas.toBuffer('image/png'));
  console.log(`Generated ${filename}`);
}

generateIcon(192, 'icon-192.png');
generateIcon(512, 'icon-512.png');
