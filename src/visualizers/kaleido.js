import { BAND_COUNT } from '../lib/spectrum.js';
import { hsla, TAU, clamp } from '../lib/helpers.js';

/**
 * Kaleidoscope — mirrored spectral petals repeated around a rotating axis.
 */
export default {
  id: 'kaleido',
  name: 'Kaleidoscope',
  draw(s) {
    const { ctx, w, h, bands, bass, treble, level, beat, t } = s;
    const [h1, h2, h3] = s.palette.hues;
    const cx = w / 2;
    const cy = h * 0.44;
    const unit = Math.min(w, h);
    const base = unit * (0.08 + bass * 0.02);
    const amp = unit * (0.26 + level * 0.1);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalCompositeOperation = 'lighter';

    const segments = 14;
    const steps = 30;

    for (let layer = 1; layer >= 0; layer--) {
      const count = layer === 0 ? segments : Math.round(segments / 2);
      const spin = t * (layer === 0 ? 0.07 : -0.11) + (layer ? Math.PI / count : 0);
      const segAngle = TAU / count;
      const layerBase = base * (layer ? 0.9 : 1);

      for (let k = 0; k < count; k++) {
        const start = k * segAngle + spin;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        for (let j = 0; j <= steps; j++) {
          const u = j / steps;
          const mirrored = 1 - Math.abs(2 * u - 1);
          const band = bands[Math.floor(Math.pow(mirrored, 0.85) * (BAND_COUNT - 1))];
          const r =
            layerBase +
            amp * (0.25 + band * 1.15) +
            Math.sin(u * Math.PI) * amp * (layer ? 0.12 : 0.22);
          const a = start + u * segAngle;
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();

        const hue = [h1, h2, h3][(k + layer) % 3];
        const grad = ctx.createRadialGradient(0, 0, layerBase * 0.2, 0, 0, base + amp * 1.4);
        grad.addColorStop(0, hsla(hue, 100, 78, 0.1));
        grad.addColorStop(0.6, hsla(hue, 100, 62, 0.07 + level * 0.05));
        grad.addColorStop(1, hsla(hue + 16, 100, 55, layer ? 0.02 : 0.09));
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.strokeStyle = hsla(hue, 100, 74, layer ? 0.12 + beat * 0.1 : 0.25 + treble * 0.3);
        ctx.lineWidth = layer ? 0.7 : 1.1;
        ctx.stroke();
      }
    }

    // thin radial spokes for structure
    for (let k = 0; k < segments; k++) {
      const a = (k / segments) * TAU + t * 0.07;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * base * 0.6, Math.sin(a) * base * 0.6);
      ctx.lineTo(Math.cos(a) * (base + amp * 1.35), Math.sin(a) * (base + amp * 1.35));
      ctx.strokeStyle = hsla(h2, 100, 80, 0.07);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();

    // center jewel
    const jewel = ctx.createRadialGradient(cx, cy, 0, cx, cy, base * 1.5);
    jewel.addColorStop(0, hsla(h2, 100, 94, 0.95));
    jewel.addColorStop(0.4, hsla(h1, 100, 70, clamp(0.4 + beat * 0.3)));
    jewel.addColorStop(1, hsla(h1, 100, 50, 0));
    ctx.beginPath();
    ctx.arc(cx, cy, base * (1.2 + beat * 0.15), 0, TAU);
    ctx.fillStyle = jewel;
    ctx.fill();

    // halo ring
    ctx.beginPath();
    ctx.arc(cx, cy, base + amp * 1.45, t * 0.05, t * 0.05 + TAU);
    ctx.strokeStyle = hsla(h3, 100, 72, 0.12 + level * 0.15);
    ctx.lineWidth = 1;
    ctx.stroke();
  },
};
