import { BAND_COUNT } from '../lib/spectrum.js';
import { hsla, roundRect, TAU, clamp } from '../lib/helpers.js';

/**
 * Neon Tunnel — receding rounded frames, warped by the spectrum.
 */
export default {
  id: 'tunnel',
  name: 'Neon Tunnel',
  draw(s) {
    const { ctx, w, h, bands, bass, treble, level, beat, t } = s;
    const [h1, h2, h3] = s.palette.hues;
    const cx = w / 2;
    const cy = h * 0.44;
    const unit = Math.min(w, h);
    const count = 26;
    const travel = (t * 0.11 + level * 0.25) % 1;

    // vanishing glow
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, unit * 0.6);
    glow.addColorStop(0, hsla(h2, 100, 70, 0.2 + bass * 0.18));
    glow.addColorStop(0.2, hsla(h1, 100, 55, 0.06));
    glow.addColorStop(1, hsla(h1, 100, 50, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalCompositeOperation = 'lighter';

    for (let i = count - 1; i >= 0; i--) {
      const z = ((i / count) + travel) % 1;
      const depth = Math.pow(z, 1.7);
      const scale = 0.08 + depth * 1.35;
      const bw = unit * 0.52 * scale * (1 + bass * 0.1);
      const bh = unit * 0.34 * scale * (1 + treble * 0.16);
      const rot = z * 0.55 + t * 0.05;
      const alpha = Math.pow(1 - z, 1.25) * 0.6;
      const hue = i % 3 === 0 ? h2 : i % 3 === 1 ? h1 : h3;

      ctx.save();
      ctx.rotate(rot);
      const radius = Math.min(bw, bh) * 0.32;
      roundRect(ctx, -bw / 2, -bh / 2, bw, bh, radius);

      // corner notches react to bands
      const v = bands[(i * 5) % BAND_COUNT];
      ctx.strokeStyle = hsla(hue, 100, 66 + v * 16, alpha);
      ctx.lineWidth = Math.max(0.6, (1 - z) * 3.4);
      if (z < 0.45) {
        ctx.shadowColor = hsla(hue, 100, 60, 0.7);
        ctx.shadowBlur = 16 * (1 - z);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // inner echo
      if (z < 0.4) {
        roundRect(ctx, -bw / 2 + 8, -bh / 2 + 8, bw - 16, bh - 16, Math.max(2, radius - 6));
        ctx.strokeStyle = hsla(hue + 20, 100, 78, alpha * 0.35);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();
    }

    // radial rays
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * TAU + t * 0.05;
      const v = bands[(i * 3) % BAND_COUNT];
      const r0 = unit * (0.2 + v * 0.15);
      const r1 = unit * (0.55 + v * 0.25);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
      ctx.strokeStyle = hsla(h3, 100, 65, 0.04 + v * 0.1);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();

    // pulse at the vanishing point
    const pulse = clamp(beat);
    ctx.beginPath();
    ctx.arc(cx, cy, unit * (0.012 + pulse * 0.02), 0, TAU);
    ctx.fillStyle = hsla(h2, 100, 96, 0.9);
    ctx.shadowColor = hsla(h2, 100, 70, 1);
    ctx.shadowBlur = 24;
    ctx.fill();
    ctx.shadowBlur = 0;
  },
};
