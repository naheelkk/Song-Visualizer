import { hsla, mulberry32 } from '../lib/helpers.js';

const rand = mulberry32(90210);

function makeBolt(x0, y0, x1, y1, spread, depth) {
  let points = [
    { x: x0, y: y0 },
    { x: x1, y: y1 },
  ];
  for (let d = 0; d < depth; d++) {
    const next = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const mx = (a.x + b.x) / 2 + (rand() - 0.5) * spread;
      const my = (a.y + b.y) / 2 + (rand() - 0.5) * spread;
      next.push({ x: mx, y: my }, b);
    }
    points = next;
    spread *= 0.55;
  }
  return points;
}

function drawBolt(ctx, points, width, color, alpha) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/**
 * Storm — lightning that strikes on treble energy and bass impacts.
 */
export default {
  id: 'storm',
  name: 'Storm',
  draw(s) {
    const { ctx, w, h, bass, treble, level, beat, t, dt, playing } = s;
    const [h1, h2, h3] = s.palette.hues;

    if (!this.bolts) this.bolts = [];
    if (!this.rain) {
      this.rain = Array.from({ length: 110 }, () => ({
        x: rand(),
        y: rand(),
        len: 0.02 + rand() * 0.09,
        speed: 0.35 + rand() * 0.7,
        drift: (rand() - 0.5) * 0.12,
      }));
    }
    if (!this.lastBolt) this.lastBolt = -10;

    const flash = this.flash || 0;

    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, hsla(h1, 55, 6, 1));
    sky.addColorStop(0.55, hsla(h3, 60, 10, 1));
    sky.addColorStop(1, hsla(h2, 55, 15, 1));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Storm clouds
    for (let i = 0; i < 5; i++) {
      const cx = w * (0.1 + i * 0.2) + Math.sin(t * 0.2 + i) * w * 0.02;
      const cy = h * 0.08 + Math.sin(i * 2.1) * h * 0.03;
      const r = Math.min(w, h) * (0.16 + (i % 3) * 0.05);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, hsla(h3, 45, 30, 0.3 + flash * 0.4));
      g.addColorStop(1, hsla(h3, 45, 20, 0));
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }

    // Rain
    ctx.save();
    ctx.strokeStyle = hsla(h2, 40, 80, 0.16 + treble * 0.2);
    ctx.lineWidth = 1;
    for (const drop of this.rain) {
      const speed = drop.speed * (0.5 + level * 1.4);
      drop.y += dt * speed;
      drop.x += dt * drop.drift;
      if (drop.y > 1) {
        drop.y = -0.1;
        drop.x = rand();
      }
      if (drop.x > 1) drop.x -= 1;
      if (drop.x < 0) drop.x += 1;
      const x = drop.x * w;
      const y = drop.y * h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - drop.drift * w * 0.1, y + drop.len * h);
      ctx.stroke();
    }
    ctx.restore();

    // Spawn bolts: loud treble rips, or a low ambient strike now and then.
    if (this.nextAmbient == null) this.nextAmbient = 0.8;
    const strike = treble > 0.33 || beat > 0.42;
    const due = t > this.nextAmbient;
    const gap = strike ? 0.16 : 0.5;
    if (playing && (strike || due) && t - this.lastBolt > gap) {
      this.lastBolt = t;
      if (due) this.nextAmbient = t + 1.2 + rand() * 2.4;
      const power = due && !strike ? 0.65 : 1;
      this.flash = Math.min(1, (this.flash || 0) + (0.35 + treble * 0.55) * power);
      const count = treble > 0.72 ? 2 : 1;
      for (let b = 0; b < count; b++) {
        const x0 = w * (0.1 + rand() * 0.8);
        const x1 = x0 + (rand() - 0.5) * w * 0.35;
        const y1 = h * (0.62 + rand() * 0.3);
        const points = makeBolt(x0, -h * 0.05, x1, y1, Math.min(w, h) * 0.16, 6);
        this.bolts.push({
          points,
          life: 0.85 + power * 0.15,
          hue: h2 + rand() * 30,
          width: (1.5 + treble * 2.4) * power * (Math.min(w, h) / 760),
        });
        if (rand() > 0.45) {
          const mid = points[Math.floor(points.length * 0.45)];
          this.bolts.push({
            points: makeBolt(
              mid.x,
              mid.y,
              mid.x + (rand() - 0.5) * w * 0.3,
              mid.y + h * (0.1 + rand() * 0.2),
              Math.min(w, h) * 0.08,
              4,
            ),
            life: 0.7,
            hue: h2 + rand() * 30,
            width: 0.8,
          });
        }
      }
    }

    this.flash = Math.max(0, (this.flash || 0) - dt * 2.4);

    // Bolts
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = hsla(h2, 100, 70, 0.8);
    for (const bolt of this.bolts) {
      bolt.life -= dt * 2.2;
      if (bolt.life <= 0) continue;
      const alpha = Math.min(1, bolt.life) * (0.5 + level * 0.5);
      ctx.shadowBlur = 22 + treble * 34;
      drawBolt(ctx, bolt.points, bolt.width * 4, hsla(bolt.hue, 100, 70, 1), alpha * 0.22);
      drawBolt(ctx, bolt.points, bolt.width * 1.6, hsla(bolt.hue, 100, 85, 1), alpha * 0.55);
      drawBolt(ctx, bolt.points, bolt.width * 0.7, 'rgba(255,255,255,1)', alpha);
    }
    ctx.restore();
    this.bolts = this.bolts.filter((b) => b.life > 0).slice(-24);

    // Flash
    if (this.flash > 0.01) {
      ctx.fillStyle = hsla(h2, 80, 90, this.flash * 0.16);
      ctx.fillRect(0, 0, w, h);
    }

    // Ground glow
    const groundH = h * 0.16;
    const ground = ctx.createLinearGradient(0, h - groundH, 0, h);
    ground.addColorStop(0, hsla(h1, 80, 25, 0));
    ground.addColorStop(1, hsla(h1, 80, 40, 0.35 + bass * 0.3));
    ctx.fillStyle = ground;
    ctx.fillRect(0, h - groundH, w, groundH);

    // Horizon line
    ctx.beginPath();
    ctx.moveTo(0, h - groundH);
    ctx.lineTo(w, h - groundH);
    ctx.strokeStyle = hsla(h2, 100, 70, 0.18 + level * 0.25);
    ctx.lineWidth = 1.2;
    ctx.stroke();
  },
};
