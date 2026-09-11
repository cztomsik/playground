// Tank: body has an angle (driving), turret aims independently.
// Local player reads the global `keys` object (defined in game.js).
class Player {
  constructor(name, color, x, y, isBot = false) {
    this.name = name;
    this.color = color;
    this.isBot = isBot;
    this.isYou = !isBot;
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.bodyAngle = Math.random() * TAU;
    this.turretAngle = this.bodyAngle;
    this.radius = 13;
    this.hp = 100;
    this.alive = true;
    this.kills = 0;
    this.deaths = 0;
    this.respawnIn = 0;
    this.fireCooldown = 0;
    this.wantFire = null;
    // bot brain
    this.thinkTimer = 0;
    this.targetX = x; this.targetY = y;
    this.fireDelay = 1;
  }

  update(dt, terrain, players) {
    if (!this.alive) return;
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);

    let turn, thrust;
    if (this.isBot) {
      [turn, thrust] = this._ai(dt, terrain, players);
    } else {
      turn = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      thrust = (keys.up ? 1 : 0) - (keys.down ? 0.6 : 0);
    }

    this.bodyAngle += turn * 3.2 * dt;
    const accel = thrust * 260;
    this.vx += Math.cos(this.bodyAngle) * accel * dt;
    this.vy += Math.sin(this.bodyAngle) * accel * dt;

    const drag = Math.exp(-1.2 * dt);
    this.vx *= drag; this.vy *= drag;

    const sp = Math.hypot(this.vx, this.vy);
    if (sp > 320) { this.vx *= 320 / sp; this.vy *= 320 / sp; }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this._collide(terrain);
  }

  // Sample points around the hull; push out of anything solid.
  _collide(terrain) {
    for (let iter = 0; iter < 3; iter++) {
      let pushed = false;
      for (let i = 0; i < 10; i++) {
        const a = i / 10 * TAU;
        const px = this.x + Math.cos(a) * this.radius;
        const py = this.y + Math.sin(a) * this.radius;
        if (terrain.isSolid(px, py)) {
          this.x -= Math.cos(a) * 2;
          this.y -= Math.sin(a) * 2;
          const vn = this.vx * Math.cos(a) + this.vy * Math.sin(a);
          if (vn > 0) {
            this.vx -= vn * Math.cos(a) * 1.4; // bounce-ish
            this.vy -= vn * Math.sin(a) * 1.4;
          }
          pushed = true;
        }
      }
      if (!pushed) break;
    }
  }

  _ai(dt, terrain, players) {
    // Find the nearest enemy: hunt it if close, otherwise roam
    let nearest = null, nd = Infinity;
    for (const p of players) {
      if (p === this || !p.alive) continue;
      const d = (p.x - this.x) ** 2 + (p.y - this.y) ** 2;
      if (d < nd) { nd = d; nearest = p; }
    }
    const hunting = nearest && nd < 600 * 600;
    const focus = hunting ? nearest : null;

    // Pick a random roaming waypoint occasionally
    this.thinkTimer -= dt;
    if (!hunting && this.thinkTimer <= 0) {
      this.thinkTimer = 1.5 + Math.random() * 2.5;
      let tx, ty, tries = 0;
      do {
        tx = 150 + Math.random() * (terrain.w - 300);
        ty = 150 + Math.random() * (terrain.h - 300);
      } while (tries++ < 25 && terrain.isSolid(tx, ty));
      this.targetX = tx; this.targetY = ty;
    }

    // Steer toward the focus (enemy or waypoint)
    const fx = focus ? focus.x : this.targetX;
    const fy = focus ? focus.y : this.targetY;
    const dx = fx - this.x, dy = fy - this.y;
    const dist = Math.hypot(dx, dy);
    let turn = 0, thrust = 0;
    if (dist > (hunting ? 90 : 70)) {
      const diff = wrapAngle(Math.atan2(dy, dx) - this.bodyAngle);
      turn = Math.max(-1, Math.min(1, diff * 2));
      thrust = Math.abs(diff) < 1 ? 1 : 0.3;
    }

    // Turret: track nearest enemy, fire when roughly lined up and unobstructed
    if (nearest) {
      const dist2d = Math.sqrt(nd);
      const lead = Math.min(0.25, (dist2d / 720) * 0.8); // lead moving targets
      const aimX = nearest.x + nearest.vx * lead;
      const aimY = nearest.y + nearest.vy * lead;
      const aim = Math.atan2(aimY - this.y, aimX - this.x);
      const diff = wrapAngle(aim - this.turretAngle);
      this.turretAngle += diff * Math.min(1, 5 * dt);
      this.fireDelay -= dt;
      const los = dist2d < 200 || hasLOS(terrain, this.x, this.y, aimX, aimY);
      if (this.fireDelay <= 0 && Math.abs(diff) < 0.15 && this.fireCooldown <= 0 && los && nd < 800 * 800) {
        this.fireDelay = 0.3 + Math.random() * 0.6;
        this.wantFire = aim + (Math.random() - 0.5) * 0.12; // imperfect aim
      }
    } else {
      this.turretAngle = this.bodyAngle;
    }
    return [turn, thrust];
  }
}

// Is the straight line from (x0,y0) to (x1,y1) free of rock?
function hasLOS(terrain, x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.ceil(d / 8);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (terrain.isSolid(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
  }
  return true;
}

function wrapAngle(a) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}
