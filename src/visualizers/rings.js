import { BAND_COUNT } from '../lib/spectrum.js';
import { hsla, TAU, clamp } from '../lib/helpers.js';

const ripples = [];
let wasBeat = false;

/**
 * Pulse Rings — expanding beat ripples around a circular spectrum.
 */
export default {
  id: 'rings',
  name: 'Pulse Rings',
  draw(s) {
    const { ctx, w, h, bands, bass, level, beat, dt, t } = s;
    const [h1, h2, h3] = s.palette.hues;
    const cx = w / 2;
    const cy = h * 0.44;
    const unit = Math.min(w, h);
    const baseR = unit * (0.11 + bass * 0.02);

    if (beat > 0.8 && !wasBeat) {
      wasBeat = true;
      ripples.push({ r: baseR * 1.1, life: 1, hue: h2, width: 1.5 + beat * 2 });
    }
    if (beat < 0.2) wasBeat = false;

    // ripples
    for (let i = ripples.length - 1; i >= 0; i--) {
      const p = ripples[i];
      p.r += (unit * 0.32 + p.r * 0.4) * dt;
      p.life -= dt * 0.42;
      if (p.life <= 0) {
        ripples.splice(i, 1);
        continue;
      }
      ctx.beginPath();
      ctx.arc(cx, cy, p.r, 0, TAU);
      ctx.strokeStyle = hsla(p.hue, 100, 68, p.life * 0.55);
      ctx.lineWidth = p.width * p.life;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, p.r * 0.985, 0, TAU);
      ctx.strokeStyle = hsla(p.hue, 100, 80, p.life * 0.18);
      ctx.lineWidth = 6 * p.life;
      ctx.stroke();
    }

    // circular spectrum
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalCompositeOperation = 'lighter';
    const spokes = 128;
    const inner = baseR * 1.08;
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * TAU - Math.PI / 2 + t * 0.04;
      const v = bands[Math.floor((i / spokes) * (BAND_COUNT - 1))];
      const len = unit * (0.008 + v * 0.16);
      const x = Math.cos(a);
      const y = Math.sin(a);
      const hue = h1 + (h3 - h1) * (i / spokes);
      ctx.beginPath();
      ctx.moveTo(x * inner, y * inner);
      ctx.lineTo(x * (inner + len), y * (inner + len));
      ctx.strokeStyle = hsla(hue, 100, 64 + v * 16, 0.35 + v * 0.6);
      ctx.lineWidth = Math.max(1, (TAU * inner) / spokes - 1.2);
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.restore();

    // inner core
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR);
    core.addColorStop(0, hsla(h2, 100, 85, 0.35 + level * 0.25));
    core.addColorStop(0.6, hsla(h1, 100, 60, 0.12));
    core.addColorStop(1, hsla(h1, 100, 50, 0));
    ctx.beginPath();
    ctx.arc(cx, cy, baseR, 0, TAU);
    ctx.fillStyle = core;
    ctx.fill();

    // rotating double ring with a gap
    ctx.save();
    ctx.translate(cx, cy);
    const r1 = baseR * 1.7;
    for (let k = 0; k < 2; k++) {
      ctx.beginPath();
      ctx.arc(0, 0, r1 + k * unit * 0.055, t * (k ? -0.25 : 0.18), t * (k ? -0.25 : 0.18) + TAU * 0.72);
      ctx.strokeStyle = hsla(k ? h3 : h2, 100, 72, clamp(0.1 + level * 0.3));
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();

    // center dot
    ctx.beginPath();
    ctx.arc(cx, cy, 2.5 + bass * 7, 0, TAU);
    ctx.fillStyle = hsla(h2, 100, 92, 0.9);
    ctx.shadowColor = hsla(h2, 100, 70, 1);
    ctx.shadowBlur = 20;
    ctx.fill();
    ctx.shadowBlur = 0;
  },
};
