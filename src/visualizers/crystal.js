import { BAND_COUNT } from '../lib/spectrum.js';
import { hsla, TAU } from '../lib/helpers.js';

const RINGS = 8;
const SIDES = 14;
const TILT = 0.32;

/**
 * Crystal — a rotating wireframe crystal whose silhouette is the spectrum.
 */
export default {
  id: 'crystal',
  name: 'Crystal',
  draw(s) {
    const { ctx, w, h, bands, bass, treble, level, beat, t } = s;
    const [h1, h2, h3] = s.palette.hues;
    const cx = w / 2;
    const cy = h / 2;
    const unit = Math.min(w, h);
    const R = unit * 0.235;
    const H = unit * 0.3;
    const rotation = t * 0.42;
    const cosT = Math.cos(TILT);
    const sinT = Math.sin(TILT);
    const dist = unit * 1.5;

    ctx.fillStyle = hsla(h1, 50, 5, 1);
    ctx.fillRect(0, 0, w, h);

    // Backdrop halo
    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, unit * 0.6);
    halo.addColorStop(0, hsla(h2, 90, 50, 0.16 + level * 0.16));
    halo.addColorStop(0.6, hsla(h3, 90, 45, 0.05));
    halo.addColorStop(1, hsla(h3, 90, 45, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);

    // Build the lattice
    const rings = [];
    for (let r = 0; r < RINGS; r++) {
      const v = r / (RINGS - 1);
      const band = bands[Math.min(BAND_COUNT - 1, Math.floor(v * (BAND_COUNT - 1)))];
      const profile = 0.16 + 0.84 * Math.pow(Math.sin(Math.PI * v), 1.45);
      const radius = R * profile * (0.82 + band * 0.5 + bass * 0.06);
      const y = (v - 0.5) * 2 * H;
      const twist = rotation + v * 0.5;
      const points = [];
      for (let i = 0; i < SIDES; i++) {
        const angle = twist + (i / SIDES) * TAU;
        const px = Math.cos(angle) * radius;
        const pz = Math.sin(angle) * radius;
        const py = y * cosT - pz * sinT;
        const pz2 = y * sinT + pz * cosT;
        const scale = dist / (dist + pz2);
        points.push({
          x: cx + px * scale,
          y: cy + py * scale,
          depth: (pz2 / R + 1) / 2,
          band,
        });
      }
      rings.push(points);
    }

    const edges = [];
    for (let r = 0; r < RINGS; r++) {
      const ring = rings[r];
      for (let i = 0; i < SIDES; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % SIDES];
        edges.push([a, b, r / (RINGS - 1)]);
        if (r < RINGS - 1) {
          edges.push([a, rings[r + 1][i], r / (RINGS - 1)]);
        }
      }
    }
    edges.sort((p, q) => p[0].depth + p[1].depth - (q[0].depth + q[1].depth));

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [a, b, height] of edges) {
      const depth = (a.depth + b.depth) / 2;
      const energy = (a.band + b.band) / 2;
      const hue = h3 + (h1 - h3) * height;
      const alpha = (0.06 + depth * 0.5) * (0.5 + energy * 0.9);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = hsla(hue, 100, 62 + depth * 26, alpha);
      ctx.lineWidth = 0.7 + depth * 1.4 + energy * 1.4;
      ctx.stroke();
    }
    ctx.restore();

    // Vertex sparks
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const ring of rings) {
      for (const p of ring) {
        const size = 0.6 + p.band * 2.6 * p.depth;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, TAU);
        ctx.fillStyle = hsla(h2, 100, 85, 0.12 + p.depth * 0.5);
        ctx.fill();
      }
    }
    ctx.restore();

    // Core
    const coreR = unit * (0.03 + bass * 0.012 + beat * 0.01);
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 6);
    core.addColorStop(0, 'rgba(255,255,255,0.98)');
    core.addColorStop(0.2, hsla(h2, 100, 85, 0.75));
    core.addColorStop(0.5, hsla(h1, 100, 60, 0.2));
    core.addColorStop(1, hsla(h1, 100, 55, 0));
    ctx.beginPath();
    ctx.arc(cx, cy, coreR * 6, 0, TAU);
    ctx.fillStyle = core;
    ctx.fill();

    // Orbiting shards
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 18; i++) {
      const orbit = t * (0.35 + (i % 5) * 0.08) + i * 0.9;
      const rad = R * (1.15 + (i % 4) * 0.13) + treble * unit * 0.02;
      const x = cx + Math.cos(orbit) * rad;
      const y = cy + Math.sin(orbit * 1.3) * rad * 0.4;
      const size = 1 + (i % 3) * 0.9 + bands[(i * 5) % BAND_COUNT] * 2.5;
      ctx.beginPath();
      ctx.moveTo(x, y - size);
      ctx.lineTo(x + size, y);
      ctx.lineTo(x, y + size);
      ctx.lineTo(x - size, y);
      ctx.closePath();
      ctx.fillStyle = hsla(i % 2 ? h2 : h3, 100, 72, 0.18 + (i % 3) * 0.1);
      ctx.fill();
    }
    ctx.restore();
  },
};
