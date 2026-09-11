// Destructible terrain: offscreen canvas for pixels + Uint8 alpha mirror
// for O(1) solidity queries.
class Terrain {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d');
    this.alpha = new Uint8Array(w * h);
    this._generate();
  }

  _generate() {
    const { w, h, ctx, alpha } = this;

    // Base rock: value-noise shading
    const img = ctx.createImageData(w, h);
    const d = img.data;
    const grid = 48;
    const gw = Math.ceil(w / grid) + 1;
    const gh = Math.ceil(h / grid) + 1;
    const cells = new Float32Array(gw * gh);
    for (let i = 0; i < cells.length; i++) cells[i] = Math.random();
    const smooth = t => t * t * (3 - 2 * t);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const gx = x / grid, gy = y / grid;
        const x0 = gx | 0, y0 = gy | 0;
        const fx = smooth(gx - x0), fy = smooth(gy - y0);
        const a = cells[y0 * gw + x0],     b = cells[y0 * gw + x0 + 1];
        const c = cells[(y0 + 1) * gw + x0], e = cells[(y0 + 1) * gw + x0 + 1];
        const n = a + (b - a) * fx + (c - a) * fy + (a - b - c + e) * fx * fy;
        const i = (y * w + x) * 4;
        d[i]     = 92 + n * 74;   // r
        d[i + 1] = 84 + n * 62;   // g
        d[i + 2] = 70 + n * 50;   // b
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    alpha.fill(255);

    // Soft lighter/darker blobs for texture
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      const r = 40 + Math.random() * 180;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, Math.random() < 0.5 ? 'rgba(40,35,28,0.35)' : 'rgba(195,178,150,0.28)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    }

    // Carve the arena: big lumpy central cavity + tunnels
    const cx = w / 2, cy = h / 2;
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * 6.2832;
      const t = Math.sqrt(Math.random());
      const x = cx + Math.cos(a) * t * w * 0.34;
      const y = cy + Math.sin(a) * t * h * 0.34;
      this.carve(x, y, 110 + Math.random() * 90, false);
    }
    for (let t = 0; t < 6; t++) {
      let a = Math.random() * 6.2832;
      let x = cx + Math.cos(a) * 80, y = cy + Math.sin(a) * 80;
      for (let s = 0; s < 18; s++) {
        a += (Math.random() - 0.5) * 0.9;
        x += Math.cos(a) * 80;
        y += Math.sin(a) * 80;
        if (x < 120 || y < 120 || x > w - 120 || y > h - 120) break;
        this.carve(x, y, 80 + Math.random() * 35, false);
      }
    }
    // Guarantee the map center is clear (safe fallback respawn spot)
    this.carve(cx, cy, 140, false);
  }

  // Carve a (optionally jagged) hole at x,y with radius r
  carve(x, y, r, jagged = true) {
    const { w, h, ctx, alpha } = this;
    const circles = jagged ? this._jaggedCircles(x, y, r) : [[x, y, r]];

    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';
    for (const [cx, cy, cr] of circles) {
      ctx.beginPath(); ctx.arc(cx, cy, cr, 0, 6.2832); ctx.fill();
    }
    ctx.restore();

    for (const [cx, cy, cr] of circles) {
      const x0 = Math.max(0, (cx - cr) | 0), x1 = Math.min(w - 1, (cx + cr) | 0);
      const y0 = Math.max(0, (cy - cr) | 0), y1 = Math.min(h - 1, (cy + cr) | 0);
      const cr2 = cr * cr;
      for (let py = y0; py <= y1; py++) {
        for (let px = x0; px <= x1; px++) {
          const dx = px - cx, dy = py - cy;
          if (dx * dx + dy * dy <= cr2) alpha[py * w + px] = 0;
        }
      }
    }
  }

  _jaggedCircles(x, y, r) {
    const cs = [[x, y, r * 0.7]];
    const n = 5 + (r * 0.05 | 0);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.2832;
      const d = r * (0.4 + Math.random() * 0.6);
      cs.push([x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.25 + Math.random() * 0.35)]);
    }
    return cs;
  }

  isSolid(x, y) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return true;
    return this.alpha[y * this.w + x] > 0;
  }
}
