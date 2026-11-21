import { BAND_COUNT } from '../lib/spectrum.js';
import { hsla, TAU } from '../lib/helpers.js';

/**
 * Polar Bloom — a radial spectrum with petals, rings and a breathing core.
 */
export default {
  id: 'polar',
  name: 'Polar Bloom',
  draw(s) {
    const { ctx, w, h, bands, bass, mid, treble, level, beat, t } = s;
    const [h1, h2, h3] = s.palette.hues;
    const cx = w / 2;
    const cy = h * 0.44;
    const unit = Math.min(w, h);
    const R = unit * (0.15 + bass * 0.018);

    ctx.save();
    ctx.translate(cx, cy);

    // Core glow
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 2.4);
    core.addColorStop(0, hsla(h2, 100, 72, 0.28 + level * 0.25));
    core.addColorStop(0.35, hsla(h1, 95, 60, 0.12));
    core.addColorStop(1, hsla(h3, 90, 50, 0));
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 0, R * 2.4, 0, TAU);
    ctx.fill();

    ctx.rotate(t * 0.07);
    ctx.globalCompositeOperation = 'lighter';

    // Spokes
    const spokes = 150;
    ctx.beginPath();
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * TAU;
      const v = bands[Math.floor((i / spokes) * (BAND_COUNT - 1))];
      const len = R * (0.25 + v * 1.35) * (1 + beat * 0.05);
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      ctx.moveTo(ca * R * 0.96, sa * R * 0.96);
      ctx.lineTo(ca * (R * 0.96 + len), sa * (R * 0.96 + len));
    }
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, unit * 0.0022);
    ctx.strokeStyle = hsla(h2, 100, 72, 0.65);
    ctx.shadowColor = hsla(h1, 100, 60, 0.6);
    ctx.shadowBlur = 18;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Inner petals
    ctx.rotate(-t * 0.16);
    const petals = 9;
    for (let p = 0; p < petals; p++) {
      const a = (p / petals) * TAU + Math.sin(t * 0.3) * 0.1;
      const v = bands[18 + p * 7];
      const len = R * (0.55 + v * 0.85);
      const spread = 0.16 + v * 0.14;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a - spread) * R * 0.35, Math.sin(a - spread) * R * 0.35);
      ctx.quadraticCurveTo(
        Math.cos(a) * len * 0.8,
        Math.sin(a) * len * 0.8,
        Math.cos(a) * len,
        Math.sin(a) * len,
      );
      ctx.quadraticCurveTo(
        Math.cos(a + spread) * R * 0.75,
        Math.sin(a + spread) * R * 0.75,
        Math.cos(a + spread) * R * 0.35,
        Math.sin(a + spread) * R * 0.35,
      );
      ctx.fillStyle = hsla(p % 2 ? h3 : h1, 95, 62, 0.055 + v * 0.09);
      ctx.fill();
      ctx.strokeStyle = hsla(p % 2 ? h3 : h2, 100, 70, 0.14 + v * 0.2);
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Orbiting energy nodes
    for (let i = 0; i < 42; i++) {
      const a = (i / 42) * TAU + t * (0.12 + (i % 3) * 0.03);
      const v = bands[(i * 2) % BAND_COUNT];
      const orbit = R * (1.5 + (i % 5) * 0.12) + v * R * 0.5;
      const x = Math.cos(a) * orbit;
      const y = Math.sin(a) * orbit;
      const radius = 0.7 + v * 2.6;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, TAU);
      ctx.fillStyle = hsla(i % 3 === 0 ? h3 : h2, 100, 78, 0.2 + v * 0.65);
      ctx.fill();
    }
    ctx.restore();

    // Rings
    ctx.save();
    ctx.translate(cx, cy);
    const rings = [
      { r: R * 1.02, a: 0.22, lw: 1 },
      { r: R * 1.55, a: 0.12, lw: 1 },
      { r: R * 2.1 + mid * R * 0.2, a: 0.08, lw: 1 },
    ];
    for (const ring of rings) {
      ctx.beginPath();
      ctx.arc(0, 0, ring.r, 0, TAU);
      ctx.strokeStyle = hsla(h1, 90, 70, ring.a);
      ctx.lineWidth = ring.lw;
      ctx.stroke();
    }

    // Tick ring reacting to treble
    const ticks = 72;
    for (let i = 0; i < ticks; i++) {
      const a = (i / ticks) * TAU;
      const len = R * (0.06 + treble * 0.16) * (i % 4 === 0 ? 1.8 : 1);
      const rad = R * 1.22;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
      ctx.lineTo(Math.cos(a) * (rad + len), Math.sin(a) * (rad + len));
      ctx.strokeStyle = hsla(h2, 100, 72, 0.1 + treble * 0.25);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();

    // Central disc
    const disc = ctx.createRadialGradient(cx - R * 0.2, cy - R * 0.25, 0, cx, cy, R * 0.85);
    disc.addColorStop(0, hsla(h2, 100, 96, 0.9));
    disc.addColorStop(0.35, hsla(h1, 100, 72, 0.55));
    disc.addColorStop(1, hsla(h1, 90, 45, 0.06));
    ctx.beginPath();
    ctx.arc(cx, cy, R * (0.7 + beat * 0.06), 0, TAU);
    ctx.fillStyle = disc;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.72, 0, TAU);
    ctx.strokeStyle = hsla(h2, 100, 88, 0.35);
    ctx.lineWidth = 1;
    ctx.stroke();
  },
};
