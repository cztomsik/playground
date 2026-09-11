const TAU = Math.PI * 2;

const particles = [];

const FLAME_COLORS = ['#ffdd55', '#ff9933', '#ff5522', '#999999'];

function spawnExplosion(x, y, r) {
  const n = 8 + (r * 0.7 | 0);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU;
    const sp = (0.2 + Math.random() * 0.8) * r * 7;
    particles.push({
      x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.25 + Math.random() * 0.5,
      maxLife: 0,
      size: 1.5 + Math.random() * 2.5,
      color: FLAME_COLORS[(Math.random() * FLAME_COLORS.length) | 0],
    });
  }
  // white-hot flash
  particles.push({ x, y, vx: 0, vy: 0, life: 0.12, maxLife: 0.12, size: r * 0.9, flash: true });
}

function spawnMuzzle(x, y, angle) {
  for (let i = 0; i < 3; i++) {
    const a = angle + (Math.random() - 0.5) * 0.5;
    const sp = 200 + Math.random() * 200;
    particles.push({
      x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.08 + Math.random() * 0.06,
      size: 1.5 + Math.random() * 2,
      color: '#ffcc44',
    });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    if (!p.flash) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const drag = Math.exp(-4 * dt);
      p.vx *= drag; p.vy *= drag;
    }
    if (!p.maxLife) p.maxLife = p.life;
  }
}

function drawParticles(ctx) {
  for (const p of particles) {
    const t = p.life / p.maxLife;
    if (p.flash) {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
      g.addColorStop(0, `rgba(255,240,200,${t})`);
      g.addColorStop(0.4, `rgba(255,150,50,${t * 0.7})`);
      g.addColorStop(1, 'rgba(255,80,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
    } else {
      ctx.globalAlpha = t;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      ctx.globalAlpha = 1;
    }
  }
}
