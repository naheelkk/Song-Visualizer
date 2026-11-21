import { BAND_COUNT } from '../lib/spectrum.js';
import { hsla, roundRect } from '../lib/helpers.js';

const peaks = new Float32Array(96);

/**
 * LED Matrix — a retro dot display whose columns follow the spectrum.
 */
export default {
  id: 'matrix',
  name: 'LED Matrix',
  draw(s) {
    const { ctx, w, h, bands, level, beat, dt } = s;
    const [h1, h2, h3] = s.palette.hues;
    const cols = Math.max(24, Math.min(72, Math.floor(w / 17)));
    const rows = 22;
    const width = Math.min(w * 0.88, 1060);
    const left = (w - width) / 2;
    const cell = width / cols;
    const rowH = cell * 1.18;
    const bottom = h * 0.78;
    const top = bottom - rows * rowH;
    const dot = cell * 0.56;

    // panel backdrop
    const panel = ctx.createLinearGradient(0, top - 30, 0, bottom + 30);
    panel.addColorStop(0, 'rgba(8,10,18,0.0)');
    panel.addColorStop(0.5, hsla(h1, 80, 22, 0.14));
    panel.addColorStop(1, 'rgba(8,10,18,0.0)');
    ctx.fillStyle = panel;
    ctx.fillRect(left - 20, top - 30, width + 40, bottom - top + 60);

    // inactive grid
    ctx.beginPath();
    for (let c = 0; c < cols; c++) {
      const x = left + c * cell + (cell - dot) / 2;
      for (let r = 0; r < rows; r++) {
        const y = bottom - (r + 1) * rowH + (rowH - dot) / 2;
        roundRect(ctx, x, y, dot, dot, dot * 0.22);
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    ctx.fill();

    // lit columns
    const lit = new Float32Array(cols);
    for (let c = 0; c < cols; c++) {
      const idx = Math.floor((c / (cols - 1)) * (BAND_COUNT - 1));
      lit[c] = Math.min(rows, Math.pow(bands[idx], 0.9) * rows * 1.2);
    }

    for (let c = 0; c < cols; c++) {
      const u = c / (cols - 1);
      const hue = u < 0.5 ? h3 + (h1 - h3) * (u * 2) : h1 + (h2 - h1) * ((u - 0.5) * 2);
      const x = left + c * cell + (cell - dot) / 2;
      const count = lit[c];
      if (count < 0.4) continue;
      ctx.beginPath();
      for (let r = 0; r < Math.ceil(count); r++) {
        const y = bottom - (r + 1) * rowH + (rowH - dot) / 2;
        roundRect(ctx, x, y, dot, dot, dot * 0.22);
      }
      ctx.fillStyle = hsla(hue, 96, 58 + Math.min(1, count / rows) * 16, 0.92);
      ctx.fill();
    }

    // peak caps with gravity
    ctx.save();
    for (let c = 0; c < cols; c++) {
      peaks[c] = Math.max(lit[c], (peaks[c] ?? 0) - dt * rows * 0.55);
      if (peaks[c] < 0.5) continue;
      const u = c / (cols - 1);
      const hue = u < 0.5 ? h3 + (h1 - h3) * (u * 2) : h1 + (h2 - h1) * ((u - 0.5) * 2);
      const x = left + c * cell + (cell - dot) / 2;
      const r = Math.min(rows - 1, Math.floor(peaks[c]));
      const y = bottom - (r + 1) * rowH + (rowH - dot) / 2;
      ctx.beginPath();
      roundRect(ctx, x, y, dot, dot, dot * 0.22);
      ctx.fillStyle = hsla(hue, 100, 90, 0.9);
      ctx.shadowColor = hsla(hue, 100, 70, 0.9);
      ctx.shadowBlur = 12;
      ctx.fill();
    }
    ctx.restore();

    // glow wash behind panel
    const wash = ctx.createRadialGradient(w / 2, bottom, 0, w / 2, bottom, width * 0.6);
    wash.addColorStop(0, hsla(h1, 100, 60, 0.05 + level * 0.1));
    wash.addColorStop(1, hsla(h1, 100, 60, 0));
    ctx.fillStyle = wash;
    ctx.fillRect(0, top - 60, w, h);

    // baseline and readout ticks
    ctx.fillStyle = hsla(h2, 100, 80, 0.18 + beat * 0.2);
    ctx.fillRect(left, bottom + 6, width, 1);
    for (let c = 0; c <= 8; c++) {
      const x = left + (width / 8) * c;
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(x, bottom + 10, 1, 4);
    }
  },
};
