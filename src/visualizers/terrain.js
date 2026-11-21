import { BAND_COUNT } from '../lib/spectrum.js';
import { hsla, mulberry32, TAU } from '../lib/helpers.js';

const rand = mulberry32(4242);
const stars = Array.from({ length: 90 }, () => ({
  x: rand(),
  y: rand() * 0.62,
  s: 0.4 + rand() * 1.2,
  a: 0.12 + rand() * 0.5,
}));

/**
 * Synth Terrain — a perspective wireframe landscape driven by spectral history.
 */
export default {
  id: 'terrain',
  name: 'Synth Terrain',
  draw(s) {
    const { ctx, w, h, level, beat, spectrum } = s;
    const [h1, h2, h3] = s.palette.hues;
    const rows = 36;
    const cols = 52;
    const horizonY = h * 0.2;
    const floorY = h * 0.78;

    // sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.7);
    sky.addColorStop(0, 'rgba(4,6,14,0.35)');
    sky.addColorStop(0.7, hsla(h1, 80, 20, 0.18));
    sky.addColorStop(1, 'rgba(4,5,10,0)');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h * 0.75);

    // stars
    for (const star of stars) {
      ctx.beginPath();
      ctx.arc(star.x * w, star.y * h, star.s, 0, TAU);
      ctx.fillStyle = `rgba(255,255,255,${star.a * (0.5 + level)})`;
      ctx.fill();
    }

    // glow at the horizon
    const horizon = ctx.createRadialGradient(w / 2, horizonY, 0, w / 2, horizonY, w * 0.55);
    horizon.addColorStop(0, hsla(h2, 100, 65, 0.16 + beat * 0.12));
    horizon.addColorStop(1, hsla(h2, 100, 60, 0));
    ctx.fillStyle = horizon;
    ctx.fillRect(0, 0, w, h * 0.7);

    const pointAt = (row, col) => {
      const d = row / (rows - 1);
      const depth = Math.pow(d, 1.7);
      const frame = spectrum.historyFrame(Math.floor((rows - 1 - row) * 2.2));
      const bandIndex = Math.floor((col / (cols - 1)) * (BAND_COUNT - 1));
      const v = frame[bandIndex];
      const spread = 0.14 + Math.pow(d, 1.45) * 1.05;
      const x = w / 2 + (col / (cols - 1) - 0.5) * w * spread;
      const y = horizonY + depth * (floorY - horizonY) - v * h * 0.2 * (0.35 + d);
      return [x, y, d, v];
    };

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = 'round';

    // ridges
    for (let r = 0; r < rows; r++) {
      const d = r / (rows - 1);
      ctx.beginPath();
      for (let c = 0; c < cols; c++) {
        const [x, y] = pointAt(r, c);
        if (c === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      const hue = h3 + (h1 - h3) * d;
      const alpha = 0.06 + Math.pow(d, 1.3) * 0.55;
      ctx.strokeStyle = hsla(hue, 95, 58 + d * 12, alpha);
      ctx.lineWidth = 0.7 + d * 1.4;
      ctx.stroke();
    }

    // mesh connectors
    for (let c = 0; c < cols; c += 7) {
      ctx.beginPath();
      for (let r = 0; r < rows; r++) {
        const [x, y] = pointAt(r, c);
        if (r === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = hsla(h2, 95, 65, 0.08);
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    ctx.restore();

    // horizon line
    const line = ctx.createLinearGradient(0, 0, w, 0);
    line.addColorStop(0, hsla(h2, 100, 70, 0));
    line.addColorStop(0.5, hsla(h2, 100, 78, 0.4 + beat * 0.25));
    line.addColorStop(1, hsla(h2, 100, 70, 0));
    ctx.fillStyle = line;
    ctx.fillRect(0, horizonY, w, 1);
  },
};
