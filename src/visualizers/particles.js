import { BAND_COUNT } from '../lib/spectrum.js';
import { hsla, TAU, mulberry32, clamp } from '../lib/helpers.js';

const rand = mulberry32(90817);
const dust = [];
let burst = [];
let wasBeat = false;
let emitAcc = 0;
let seeded = false;

function seedDust() {
  dust.length = 0;
  for (let i = 0; i < 260; i++) {
    dust.push({
      a: rand() * TAU,
      orbit: 0.22 + Math.pow(rand(), 0.7) * 0.95,
      speed: (rand() - 0.5) * 0.5,
      size: 0.5 + rand() * 1.7,
      hue: rand(),
      wobble: rand() * TAU,
    });
  }
  seeded = true;
}

/**
 * Particle Field — an orbiting dust cloud with bass-driven shockwaves.
 */
export default {
  id: 'particles',
  name: 'Particle Field',
  draw(s) {
    if (!seeded) seedDust();

    const { ctx, w, h, bands, bass, treble, level, beat, dt, t } = s;
    const [h1, h2, h3] = s.palette.hues;
    const cx = w / 2;
    const cy = h * 0.44;
    const maxR = Math.min(w * 0.42, h * 0.4);

    // ambient core
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.8);
    core.addColorStop(0, hsla(h2, 100, 78, 0.1 + bass * 0.22));
    core.addColorStop(0.3, hsla(h1, 95, 60, 0.05 + bass * 0.08));
    core.addColorStop(1, hsla(h1, 95, 50, 0));
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, w, h);

    // beat shockwaves
    if (beat > 0.82 && !wasBeat) {
      wasBeat = true;
      for (let i = 0; i < 34; i++) {
        const a = rand() * TAU;
        burst.push({
          a,
          r: maxR * 0.08,
          v: maxR * (0.35 + rand() * 1.2) * (0.6 + bass),
          decay: 0.25 + rand() * 0.3,
          life: 1,
          size: 0.6 + rand() * 1.8,
          hue: rand() < 0.5 ? h2 : h3,
        });
      }
    }
    if (beat < 0.2) wasBeat = false;

    emitAcc += (level * 55 + 4) * dt;
    while (emitAcc > 1 && burst.length < 420) {
      emitAcc -= 1;
      const a = rand() * TAU;
      burst.push({
        a,
        r: maxR * (0.12 + rand() * 0.12),
        v: maxR * (0.08 + rand() * 0.35),
        decay: 0.35 + rand() * 0.4,
        life: 1,
        size: 0.4 + rand() * 1.2,
        hue: rand() < 0.5 ? h2 : h1,
      });
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // orbiting dust
    for (const p of dust) {
      p.a += (p.speed * (0.4 + level * 2.2) + 0.06) * dt;
      const band = bands[Math.floor(((p.a / TAU + 1) % 1) * (BAND_COUNT - 1))];
      const r = maxR * (p.orbit + band * 0.22) + Math.sin(t * 0.8 + p.wobble) * 4;
      const x = cx + Math.cos(p.a) * r;
      const y = cy + Math.sin(p.a) * r;
      const size = p.size * (0.55 + band * 1.4);
      ctx.beginPath();
      ctx.arc(x, y, size, 0, TAU);
      ctx.fillStyle =
        p.hue > 0.72
          ? hsla(h2, 100, 78, 0.16 + band * 0.55)
          : hsla(h1, 100, 74, 0.1 + band * 0.4);
      ctx.fill();
    }

    // burst particles
    const alive = [];
    for (const p of burst) {
      p.life -= p.decay * dt;
      if (p.life <= 0) continue;
      p.r += p.v * dt * (1 + bass * 0.35);
      const x = cx + Math.cos(p.a) * p.r;
      const y = cy + Math.sin(p.a) * p.r;
      const px = cx + Math.cos(p.a) * Math.max(0, p.r - p.v * dt * 2.2);
      const py = cy + Math.sin(p.a) * Math.max(0, p.r - p.v * dt * 2.2);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(x, y);
      ctx.strokeStyle = hsla(p.hue, 100, 70, clamp(p.life) * 0.75);
      ctx.lineWidth = p.size * (0.4 + p.life * 0.9);
      ctx.lineCap = 'round';
      ctx.stroke();
      alive.push(p);
    }
    if (alive.length !== burst.length) burst = alive;

    // core
    const radius = maxR * (0.075 + bass * 0.03);
    const disc = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    disc.addColorStop(0, 'rgba(255,255,255,0.9)');
    disc.addColorStop(0.35, hsla(h2, 100, 80, 0.8));
    disc.addColorStop(1, hsla(h1, 100, 60, 0));
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, TAU);
    ctx.fillStyle = disc;
    ctx.fill();
    ctx.restore();

    // orbit gauge
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-t * 0.22);
    const arcs = 4;
    for (let i = 0; i < arcs; i++) {
      const start = (i / arcs) * TAU;
      ctx.beginPath();
      ctx.arc(0, 0, maxR * (0.55 + i * 0.14) + treble * 6, start, start + 0.5 + bands[20 + i * 8] * 0.9);
      ctx.strokeStyle = hsla(i % 2 ? h2 : h3, 100, 72, 0.1 + treble * 0.2);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();

  },
};
