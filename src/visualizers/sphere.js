import { BAND_COUNT } from '../lib/spectrum.js';
import { hsla, TAU } from '../lib/helpers.js';

const COUNT = 820;
const points = [];

// Fibonacci sphere for an even point distribution.
for (let i = 0; i < COUNT; i++) {
  const y = 1 - (i / (COUNT - 1)) * 2;
  const radius = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = i * 2.399963229728653;
  points.push({ x: Math.cos(theta) * radius, y, z: Math.sin(theta) * radius });
}

const state = { yaw: 0, pitch: 0 };

/**
 * Nebula Sphere — a point-cloud globe displaced by the spectrum.
 */
export default {
  id: 'sphere',
  name: 'Nebula Sphere',
  draw(s) {
    const { ctx, w, h, bands, bass, mid, treble, level, beat, dt, t } = s;
    const [h1, h2, h3] = s.palette.hues;
    const cx = w / 2;
    const cy = h * 0.43;
    const unit = Math.min(w, h);
    const R = unit * (0.24 + bass * 0.025);
    const fov = unit * 1.5;

    state.yaw += dt * (0.22 + level * 0.35);
    state.pitch = Math.sin(t * 0.13) * 0.32;
    const cosY = Math.cos(state.yaw);
    const sinY = Math.sin(state.yaw);
    const cosP = Math.cos(state.pitch);
    const sinP = Math.sin(state.pitch);

    const aura = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.8);
    aura.addColorStop(0, hsla(h1, 100, 60, 0.12 + level * 0.12));
    aura.addColorStop(0.5, hsla(h3, 100, 55, 0.04));
    aura.addColorStop(1, hsla(h1, 100, 50, 0));
    ctx.fillStyle = aura;
    ctx.fillRect(0, 0, w, h);

    // Background dust
    for (let i = 0; i < 70; i++) {
      const a = (i / 70) * TAU + t * 0.02;
      const r = unit * (0.4 + ((i * 37) % 50) / 50 * 0.32);
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.8, 0.4 + (i % 3) * 0.4, 0, TAU);
      ctx.fillStyle = hsla(h2, 100, 80, 0.08 + level * 0.1);
      ctx.fill();
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < COUNT; i++) {
      const p = points[i];
      const latBand = bands[Math.floor(((p.y + 1) / 2) * (BAND_COUNT - 1))];
      const lonBand = bands[Math.floor((((p.x + 1) / 2) * 0.35 + ((p.z + 1) / 2) * 0.6) * (BAND_COUNT - 1))];
      const displacement = 1 + latBand * 0.2 + lonBand * 0.1 + beat * 0.02;

      let x = p.x * displacement;
      let y = p.y * displacement;
      let z = p.z * displacement;

      // yaw
      const rx = x * cosY - z * sinY;
      z = x * sinY + z * cosY;
      x = rx;

      // pitch
      const ry = y * cosP - z * sinP;
      z = y * sinP + z * cosP;
      y = ry;

      const depth = fov / (fov * 1.6 - z * R);
      const sx = cx + x * R * depth;
      const sy = cy + y * R * depth * 0.98;
      const front = (z + 1) / 2;

      const hue = h3 + (h1 - h3) * ((p.y + 1) / 2) + lonBand * 20;
      const band = latBand;
      ctx.beginPath();
      ctx.arc(sx, sy, (0.5 + band * 2.1) * (0.5 + front * 0.9), 0, TAU);
      ctx.fillStyle = hsla(hue, 100, 58 + front * 22, 0.08 + front * 0.55 * (0.4 + band));
      ctx.fill();
    }

    // Orbital rings
    ctx.translate(cx, cy);
    ctx.rotate(-0.25 + Math.sin(t * 0.1) * 0.08);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(0, 0, R * (1.15 + i * 0.1), R * (0.3 + i * 0.05), 0, 0, TAU);
      ctx.strokeStyle = hsla(i === 1 ? h2 : h3, 100, 72, 0.1 + treble * 0.1);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();

    // Core
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.8);
    core.addColorStop(0, hsla(h2, 100, 96, 0.3 + bass * 0.35));
    core.addColorStop(0.4, hsla(h1, 100, 70, 0.12));
    core.addColorStop(1, hsla(h1, 100, 60, 0));
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.8, 0, TAU);
    ctx.fillStyle = core;
    ctx.fill();

    // Horizon marker and level ticks
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.28, 0, TAU);
    ctx.strokeStyle = hsla(h1, 100, 78, 0.08 + mid * 0.16);
    ctx.lineWidth = 1;
    ctx.stroke();

    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * TAU;
      const v = bands[(i * 2) % BAND_COUNT];
      const r0 = R * 1.34;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      ctx.lineTo(Math.cos(a) * (r0 + v * unit * 0.035), Math.sin(a) * (r0 + v * unit * 0.035));
      ctx.strokeStyle = hsla(h2, 100, 76, 0.06 + v * 0.25);
      ctx.stroke();
    }
  },
};
