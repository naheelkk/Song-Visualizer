import { BAND_COUNT } from '../lib/spectrum.js';
import { hsla } from '../lib/helpers.js';

/**
 * Silk Ribbons — translucent ribbons flowing out of spectral history.
 */
export default {
  id: 'ribbons',
  name: 'Silk Ribbons',
  draw(s) {
    const { ctx, w, h, level, beat, t, spectrum } = s;
    const [h1, h2, h3] = s.palette.hues;
    const layers = 7;
    const steps = 110;

    const glow = ctx.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, w * 0.6);
    glow.addColorStop(0, hsla(h1, 100, 60, 0.08 + level * 0.1));
    glow.addColorStop(1, hsla(h1, 100, 60, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (let layer = 0; layer < layers; layer++) {
      const frame = spectrum.historyFrame(layer * 7 + 2);
      const baseY = h * (0.24 + layer * 0.078);
      const phase = layer * 1.35;
      const amp = h * (0.035 + level * 0.05) * (0.55 + layer * 0.12);
      const thick = 2 + layer * 1.4 + level * 6;
      const hue = [h1, h2, h3][layer % 3];

      const ys = [];
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const band = frame[Math.floor(u * (BAND_COUNT - 1))];
        const y =
          baseY +
          Math.sin(u * 7.5 + t * (0.6 + layer * 0.08) + phase) * amp * (1 + band * 1.8) +
          Math.sin(u * 18 - t * 0.9 + phase * 2) * amp * 0.22 +
          (band - 0.25) * h * 0.12;
        ys.push(y);
      }

      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, hsla(hue, 100, 66, 0));
      grad.addColorStop(0.25, hsla(hue, 100, 68, 0.18));
      grad.addColorStop(0.5, hsla(hue, 100, 76, 0.34));
      grad.addColorStop(0.75, hsla(hue, 100, 68, 0.18));
      grad.addColorStop(1, hsla(hue, 100, 66, 0));

      // filled ribbon
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const x = (i / steps) * w;
        if (i === 0) ctx.moveTo(x, ys[i]);
        else ctx.lineTo(x, ys[i]);
      }
      for (let i = steps; i >= 0; i--) {
        const x = (i / steps) * w;
        ctx.lineTo(x, ys[i] - thick * (0.6 + Math.sin((i / steps) * Math.PI) * 1.6));
      }
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // bright leading edge
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const x = (i / steps) * w;
        if (i === 0) ctx.moveTo(x, ys[i]);
        else ctx.lineTo(x, ys[i]);
      }
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.1 + level * 0.8;
      ctx.shadowColor = hsla(hue, 100, 65, 0.8);
      ctx.shadowBlur = 16;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.restore();

    // drifting particles along the silk
    for (let i = 0; i < 60; i++) {
      const u = (i / 60 + t * 0.012) % 1;
      const layer = i % layers;
      const frame = spectrum.historyFrame(layer * 7 + 2);
      const band = frame[Math.floor(u * (BAND_COUNT - 1))];
      const x = u * w;
      const y =
        h * (0.24 + layer * 0.078) +
        Math.sin(u * 7.5 + t * (0.6 + layer * 0.08) + layer * 1.35) * h * (0.035 + level * 0.05) * (0.55 + layer * 0.12) * (1 + band * 1.8) +
        (band - 0.25) * h * 0.12;
      ctx.beginPath();
      ctx.arc(x, y, 0.6 + band * (1.6 + beat), 0, Math.PI * 2);
      ctx.fillStyle = hsla(layer % 2 ? h2 : h3, 100, 84, 0.2 + band * 0.5);
      ctx.fill();
    }
  },
};
