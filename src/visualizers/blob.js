import { BAND_COUNT } from '../lib/spectrum.js';
import { hsla, TAU } from '../lib/helpers.js';

/**
 * Liquid Orb — an organic, morphing sphere with layered spectra.
 */
export default {
  id: 'blob',
  name: 'Liquid Orb',
  draw(s) {
    const { ctx, w, h, bands, bass, treble, level, beat, t } = s;
    const [h1, h2, h3] = s.palette.hues;
    const cx = w / 2;
    const cy = h * 0.44;
    const unit = Math.min(w, h);
    const R = unit * (0.145 + bass * 0.03);
    const N = 150;

    // aura
    const aura = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 3.2);
    aura.addColorStop(0, hsla(h1, 100, 60, 0.1 + level * 0.12));
    aura.addColorStop(0.55, hsla(h3, 100, 60, 0.045));
    aura.addColorStop(1, hsla(h1, 100, 50, 0));
    ctx.fillStyle = aura;
    ctx.fillRect(0, 0, w, h);

    const angleFor = (i) => (i / N) * TAU;

    const buildPath = (layer, timeOffset) => {
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const idx = i % N;
        const a = angleFor(idx) + timeOffset;
        const band = bands[Math.floor(((idx / N + layer * 0.17) % 1) * (BAND_COUNT - 1))];
        const wobble =
          Math.sin(a * 3 + t * 0.8 + layer * 1.9) * 0.045 +
          Math.sin(a * 5 - t * 1.15 + layer) * 0.028 +
          Math.sin(a * 9 + t * 0.4) * 0.012;
        const r = R * (0.52 + layer * 0.16 + band * 0.4 + wobble + beat * 0.02);
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    };

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (let layer = 2; layer >= 0; layer--) {
      const hue = [h1, h2, h3][layer];
      buildPath(layer, t * (0.04 + layer * 0.015) + layer * 0.4);
      const grad = ctx.createRadialGradient(
        cx - R * 0.35,
        cy - R * 0.4,
        R * 0.05,
        cx,
        cy,
        R * (1.55 - layer * 0.18),
      );
      grad.addColorStop(0, hsla(hue, 100, 88, 0.32 + level * 0.08));
      grad.addColorStop(0.45, hsla(hue, 100, 64, 0.16 + level * 0.1));
      grad.addColorStop(1, hsla(hue + 20, 100, 50, 0.03));
      ctx.fillStyle = grad;
      ctx.fill();

      if (layer === 0) {
        ctx.strokeStyle = hsla(h2, 100, 80, 0.35 + beat * 0.25);
        ctx.lineWidth = 1.2;
        ctx.shadowColor = hsla(h2, 100, 70, 0.7);
        ctx.shadowBlur = 20;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }
    ctx.restore();

    // Spectral ticks orbiting the orb
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.12);
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * TAU;
      const v = bands[(i * 3) % BAND_COUNT];
      const r0 = R * 1.65;
      const r1 = r0 + v * R * 0.35;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
      ctx.strokeStyle = hsla(h3, 100, 74, 0.06 + v * 0.35);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();

    // Highlight
    const shine = ctx.createRadialGradient(
      cx - R * 0.4,
      cy - R * 0.45,
      0,
      cx - R * 0.4,
      cy - R * 0.45,
      R * 0.42,
    );
    shine.addColorStop(0, 'rgba(255,255,255,0.4)');
    shine.addColorStop(0.4, hsla(h2, 100, 90, 0.1));
    shine.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = shine;
    ctx.beginPath();
    ctx.arc(cx - R * 0.4, cy - R * 0.45, R * 0.42, 0, TAU);
    ctx.fill();

    // Floating specks
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * TAU + t * (0.08 + (i % 4) * 0.02);
      const r = R * (1.9 + (i % 5) * 0.18) + Math.sin(t + i) * 8;
      const size = 0.6 + treble * 4 * ((i * 7) % 5) / 5;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, Math.max(0.4, size), 0, TAU);
      ctx.fillStyle = hsla(i % 2 ? h2 : h3, 100, 82, 0.25 + level * 0.4);
      ctx.fill();
    }
  },
};
