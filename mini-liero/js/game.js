// ---------- Canvas ----------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
addEventListener('resize', resize);
resize();

// ---------- Input ----------
const keys = { up: false, down: false, left: false, right: false };
const keyMap = {
  w: 'up', arrowup: 'up',
  s: 'down', arrowdown: 'down',
  a: 'left', arrowleft: 'left',
  d: 'right', arrowright: 'right',
};
const mouse = { x: 0, y: 0, down: false };
let started = false;

addEventListener('keydown', e => {
  const k = keyMap[e.key.toLowerCase()];
  if (k) { keys[k] = true; e.preventDefault(); }
  if (!started) {
    started = true;
    document.getElementById('msg').style.display = 'none';
    ensureAudio();
  }
});
addEventListener('keyup', e => {
  const k = keyMap[e.key.toLowerCase()];
  if (k) keys[k] = false;
});
addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
addEventListener('mousedown', e => { if (e.button === 0) mouse.down = true; });
addEventListener('mouseup', e => { if (e.button === 0) mouse.down = false; });

// ---------- Tiny WebAudio synth ----------
let audioCtx = null;
let noiseBuf = null;
function ensureAudio() {
  if (audioCtx) { audioCtx.resume(); return; }
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const len = audioCtx.sampleRate * 0.4;
  noiseBuf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
}
function playShot() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = 'square';
  o.frequency.setValueAtTime(650, t);
  o.frequency.exponentialRampToValueAtTime(140, t + 0.09);
  g.gain.setValueAtTime(0.06, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
  o.connect(g).connect(audioCtx.destination);
  o.start(t); o.stop(t + 0.1);
}
function playBoom(r) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const src = audioCtx.createBufferSource();
  src.buffer = noiseBuf;
  const f = audioCtx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(900, t);
  f.frequency.exponentialRampToValueAtTime(120, t + 0.3);
  const g = audioCtx.createGain();
  const vol = Math.min(0.5, 0.12 + r / 200);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  src.connect(f).connect(g).connect(audioCtx.destination);
  src.start(t); src.stop(t + 0.4);
}

// ---------- World ----------
const terrain = new Terrain(2000, 1500);
const projectiles = [];
let shake = 0;

const players = [
  new Player('you',  '#57aaff', 0, 0, false),
  new Player('rust', '#ff5a5a', 0, 0, true),
  new Player('mud',  '#9dff5a', 0, 0, true),
  new Player('bone', '#e8e0d0', 0, 0, true),
];

function respawn(p) {
  for (let t = 0; t < 80; t++) {
    const x = 200 + Math.random() * (terrain.w - 400);
    const y = 200 + Math.random() * (terrain.h - 400);
    let clear = true;
    for (let a = 0; a < 8 && clear; a++)
      clear = !terrain.isSolid(x + Math.cos(a / 8 * TAU) * 20, y + Math.sin(a / 8 * TAU) * 20);
    if (!clear) continue;
    for (const q of players) {
      if (q !== p && q.alive && (q.x - x) ** 2 + (q.y - y) ** 2 < 350 * 350) { clear = false; break; }
    }
    if (!clear) continue;
    p.x = x; p.y = y;
    p.vx = 0; p.vy = 0;
    p.hp = 100;
    p.alive = true;
    return;
  }
  // Fallback: spiral-scan outward from map center for any clear spot
  for (let gy = 100; gy < terrain.h - 100; gy += 40) {
    for (let gx = 100; gx < terrain.w - 100; gx += 40) {
      if (!terrain.isSolid(gx, gy)) {
        p.x = gx; p.y = gy; p.vx = 0; p.vy = 0; p.hp = 100; p.alive = true;
        return;
      }
    }
  }
  p.x = terrain.w / 2; p.y = terrain.h / 2; p.vx = 0; p.vy = 0; p.hp = 100; p.alive = true;
}
for (const p of players) respawn(p);

// ---------- Combat ----------
function tryFire(p) {
  if (!p.alive || p.fireCooldown > 0) return;
  p.fireCooldown = 0.22;
  const a = p.turretAngle;
  const mx = p.x + Math.cos(a) * 26;
  const my = p.y + Math.sin(a) * 26;
  projectiles.push({
    x: mx, y: my,
    vx: Math.cos(a) * 720 + p.vx * 0.3,
    vy: Math.sin(a) * 720 + p.vy * 0.3,
    life: 1.2,
    owner: p,
  });
  p.vx -= Math.cos(a) * 25; // recoil
  p.vy -= Math.sin(a) * 25;
  spawnMuzzle(mx, my, a);
  playShot();
}

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const b = projectiles[i];
    b.life -= dt;
    const speed = Math.hypot(b.vx, b.vy);
    const dist = speed * dt;
    const step = 5;
    let hit = false;
    if (speed > 0) {
      for (let s = 0; s < dist; s += step) {
        b.x += b.vx / speed * step;
        b.y += b.vy / speed * step;
        if (terrain.isSolid(b.x, b.y)) { hit = true; break; }
        for (const p of players) {
          if (!p.alive) continue;
          const dx = p.x - b.x, dy = p.y - b.y;
          const rr = p.radius + 4;
          if (dx * dx + dy * dy < rr * rr) { hit = true; break; }
        }
        if (hit) break;
      }
    }
    if (hit || b.life <= 0) {
      explode(b.x, b.y, 34, 38, b.owner);
      projectiles.splice(i, 1);
    }
  }
}

function explode(x, y, r, power, owner) {
  terrain.carve(x, y, r * 0.85);
  spawnExplosion(x, y, r);
  shake = Math.min(22, shake + r * 0.35);
  playBoom(r);
  for (const p of players) {
    if (!p.alive) continue;
    const dx = p.x - x, dy = p.y - y;
    const d = Math.hypot(dx, dy);
    if (d < r + 12) {
      const f = 1 - d / (r + 12);
      p.hp -= power * f;
      p.vx += dx / (d || 1) * f * 130; // blast knockback
      p.vy += dy / (d || 1) * f * 130;
      if (p.hp <= 0) kill(p, owner);
    }
  }
}

function kill(p, killer) {
  if (!p.alive) return;
  p.alive = false;
  p.deaths++;
  if (killer && killer !== p) killer.kills++;
  explode(p.x, p.y, 35, 15, null);
  p.respawnIn = 2;
}

// ---------- Camera ----------
function getCamera() {
  const you = players[0];
  let cx = you.x - canvas.width / 2;
  let cy = you.y - canvas.height / 2;
  if (terrain.w > canvas.width) cx = Math.max(0, Math.min(terrain.w - canvas.width, cx));
  else cx = (terrain.w - canvas.width) / 2;
  if (terrain.h > canvas.height) cy = Math.max(0, Math.min(terrain.h - canvas.height, cy));
  else cy = (terrain.h - canvas.height) / 2;
  if (shake > 0.5) {
    cx += (Math.random() - 0.5) * shake;
    cy += (Math.random() - 0.5) * shake;
  }
  return { x: cx, y: cy };
}

// ---------- Update ----------
function update(dt) {
  const you = players[0];

  for (const p of players) {
    if (!p.alive) {
      p.respawnIn -= dt;
      if (p.respawnIn <= 0) respawn(p);
      continue;
    }
    p.update(dt, terrain, players);
    if (p.isBot && p.wantFire !== null) {
      p.turretAngle = p.wantFire;
      tryFire(p);
      p.wantFire = null;
    }
  }

  // Local player: aim turret at the mouse, hold to fire
  if (you.alive) {
    const cam = getCamera();
    you.turretAngle = Math.atan2(mouse.y + cam.y - you.y, mouse.x + cam.x - you.x);
    if (mouse.down) tryFire(you);
  }

  updateProjectiles(dt);
  updateParticles(dt);
  shake *= Math.exp(-6 * dt);
  updateHud();
}

const hpFill = document.getElementById('hpfill');
const statsEl = document.getElementById('stats');
const scoreEl = document.getElementById('score');

function updateHud() {
  const you = players[0];
  hpFill.style.width = Math.max(0, you.hp) + '%';
  hpFill.style.background = you.hp > 50 ? '#5a5' : you.hp > 25 ? '#ca5' : '#c44';
  statsEl.textContent = `hp ${Math.max(0, you.hp | 0)}  |  K ${you.kills} / D ${you.deaths}`;
  scoreEl.textContent = 'kills: ' + players.map(p => `${p.name} ${p.kills}`).join('   ');
}

// ---------- Render ----------
function drawPlayer(p) {
  if (!p.alive) return;
  ctx.save();
  ctx.translate(p.x, p.y);

  // barrel
  ctx.save();
  ctx.rotate(p.turretAngle);
  ctx.fillStyle = '#2e3238';
  ctx.fillRect(-2, -3, 28, 6);
  ctx.fillStyle = '#4a4f57';
  ctx.fillRect(20, -3.5, 8, 7);
  ctx.restore();

  // hull
  ctx.rotate(p.bodyAngle);
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(-10, -11);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-10, 11);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.stroke();
  ctx.restore();

  // name + hp bar
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = p.isYou ? '#fff' : 'rgba(255,255,255,0.7)';
  ctx.fillText(p.name, 0, -24);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(-14, -22, 28, 3);
  ctx.fillStyle = p.hp > 50 ? '#6c6' : p.hp > 25 ? '#cc6' : '#c44';
  ctx.fillRect(-14, -22, 28 * Math.max(0, p.hp) / 100, 3);
}

function drawMinimap(cam) {
  const mw = 150, mh = mw * terrain.h / terrain.w;
  const mx = canvas.width - mw - 12, my = 12;
  const s = mw / terrain.w;
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = '#111';
  ctx.fillRect(mx - 2, my - 2, mw + 4, mh + 4);
  ctx.drawImage(terrain.canvas, mx, my, mw, mh);
  for (const p of players) {
    if (!p.alive) continue;
    ctx.fillStyle = p.isYou ? '#fff' : p.color;
    ctx.fillRect(mx + p.x * s - 2, my + p.y * s - 2, 4, 4);
  }
  // viewport box
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.strokeRect(mx + cam.x * s, my + cam.y * s, canvas.width * s, canvas.height * s);
  ctx.restore();
}

function render() {
  const cam = getCamera();

  // space backdrop with faint stars
  ctx.fillStyle = '#14161c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  for (let i = 0; i < 60; i++) {
    const sx = (i * 977 + 131 - cam.x * 0.3) % canvas.width;
    const sy = (i * 613 + 97 - cam.y * 0.3) % canvas.height;
    ctx.fillRect((sx + canvas.width) % canvas.width, (sy + canvas.height) % canvas.height, 1, 1);
  }

  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  ctx.drawImage(terrain.canvas, 0, 0);
  // projectiles
  ctx.strokeStyle = '#ffd055';
  ctx.lineWidth = 2;
  for (const b of projectiles) {
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx * 0.015, b.y - b.vy * 0.015);
    ctx.stroke();
  }
  ctx.lineWidth = 1;
  for (const p of players) drawPlayer(p);
  drawParticles(ctx);
  ctx.restore();

  drawMinimap(cam);
}

// ---------- Main loop ----------
let last = performance.now();
function frame(t) {
  const dt = Math.min(0.033, (t - last) / 1000);
  last = t;
  if (started) update(dt);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
