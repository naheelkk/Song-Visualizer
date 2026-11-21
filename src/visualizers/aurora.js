import { BAND_COUNT } from '../lib/spectrum.js';
import { hsla, roundRect } from '../lib/helpers.js';

/**
 * Aurora Bars — mirrored spectrum with a soft bloom and reflection.
 */
export default {
  id: 'aurora',
  name: 'Aurora Bars',
  draw(s) {
    const { ctx, w, h, bands, level, beat, t } = s;
    const [h1, h2, h3] = s.palette.hues;
    const n = 62;
    const pad = w * 0.07;
    const area = w - pad * 2;
    const baseline = h * 0.7;
    const maxH = Math.min(h * 0.4, 360);
    const gap = Math.max(1.5, (area / n) * 0.3);
    const bw = (area - gap * (n - 1)) / n;

    const glow = ctx.createRadialGradient(w / 2, baseline, 0, w / 2, baseline, area * 0.55);
    glow.addColorStop(0, hsla(h1, 90, 55, 0.07 + level * 0.14));
    glow.addColorStop(1, hsla(h1, 90, 50, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < n; i++) {
      const v = bands[Math.floor((i / n) * (BAND_COUNT - 1))];
      const shaped = Math.pow(v, 1.08);
      const bh = Math.max(2, shaped * maxH * (1 + beat * 0.03));
      const x = pad + i * (bw + gap);
      const top = baseline - bh;

      const grad = ctx.createLinearGradient(0, top, 0, baseline);
      grad.addColorStop(0, hsla(h2, 100, 74, 0.95));
      grad.addColorStop(0.45, hsla(h1, 96, 64, 0.8));
      grad.addColorStop(1, hsla(h3, 90, 56, 0.45));

      roundRect(ctx, x, top, bw, bh, bw * 0.5);
      ctx.fillStyle = grad;
      ctx.fill();

      // glowing cap
      if (bh > 10) {
        ctx.beginPath();
        ctx.arc(x + bw / 2, top + bw * 0.4, Math.max(1, bw * 0.28), 0, Math.PI * 2);
        ctx.fillStyle = hsla(h2, 100, 86, 0.55 + beat * 0.2);
        ctx.fill();
      }

      // reflection
      const rh = bh * 0.5;
      const refl = ctx.createLinearGradient(0, baseline + 2, 0, baseline + 2 + rh);
      refl.addColorStop(0, hsla(h1, 95, 65, 0.3));
      refl.addColorStop(1, hsla(h1, 95, 60, 0));
      roundRect(ctx, x, baseline + 2, bw, rh, bw * 0.5);
      ctx.fillStyle = refl;
      ctx.fill();
    }

    ctx.restore();

    // horizon line
    const line = ctx.createLinearGradient(pad, 0, pad + area, 0);
    line.addColorStop(0, hsla(h1, 90, 60, 0));
    line.addColorStop(0.5, hsla(h2, 100, 78, 0.4 + beat * 0.25));
    line.addColorStop(1, hsla(h1, 90, 60, 0));
    ctx.fillStyle = line;
    ctx.fillRect(pad, baseline, area, 1);

    // sweeping highlight
    const sw = (Math.sin(t * 0.35) * 0.5 + 0.5) * area;
    const sweep = ctx.createLinearGradient(pad + sw - 90, 0, pad + sw + 90, 0);
    sweep.addColorStop(0, hsla(h2, 100, 80, 0));
    sweep.addColorStop(0.5, hsla(h2, 100, 85, 0.05 + level * 0.06));
    sweep.addColorStop(1, hsla(h2, 100, 80, 0));
    ctx.fillStyle = sweep;
    ctx.fillRect(pad, h * 0.2, area, baseline - h * 0.2);
  },
};
