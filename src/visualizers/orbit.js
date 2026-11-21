import { BAND_COUNT } from '../lib/spectrum.js';
import { hsla, TAU, clamp } from '../lib/helpers.js';

/**
 * Orbit Scope — an XY waveform trace reflected into a symmetric mandala.
 */
export default {
  id: 'orbit',
  name: 'Orbit Scope',
  draw(s) {
    const { ctx, w, h, wave, bands, bass, treble, level, beat, t } = s;
    const [h1, h2, h3] = s.palette.hues;
    const cx = w / 2;
    const cy = h * 0.44;
    const unit = Math.min(w, h);
    const scale = unit * (0.24 + bass * 0.04);
    const n = wave.length;

    // halo
    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale * 2.3);
    halo.addColorStop(0, hsla(h1, 100, 65, 0.1 + level * 0.14));
    halo.addColorStop(0.5, hsla(h3, 100, 60, 0.04));
    halo.addColorStop(1, hsla(h1, 100, 50, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);

    // outer compass ring
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-t * 0.07);
    ctx.beginPath();
    ctx.arc(0, 0, scale * 1.45, 0, TAU);
    ctx.strokeStyle = hsla(h2, 100, 76, 0.12);
    ctx.lineWidth = 1;
    ctx.stroke();
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * TAU;
      const v = bands[Math.floor((i / 96) * (BAND_COUNT - 1))];
      const len = unit * 0.006 + v * unit * 0.05;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * scale * 1.45, Math.sin(a) * scale * 1.45);
      ctx.lineTo(Math.cos(a) * (scale * 1.45 + len), Math.sin(a) * (scale * 1.45 + len));
      ctx.strokeStyle = hsla(h3, 100, 70, 0.08 + v * 0.3);
      ctx.stroke();
    }
    ctx.restore();

    // build the trace
    const offset = Math.floor(n * 0.28 + Math.sin(t * 0.35) * n * 0.12);
    const path = new Path2D();
    const points = 560;
    const amp = scale * (0.78 + level * 0.22);
    for (let i = 0; i < points; i++) {
      const idx = Math.floor((i / points) * n);
      const x = wave[idx];
      const y = wave[(idx + offset) % n];
      const px = cx + x * amp * 1.9;
      const py = cy + y * amp * 1.9;
      if (i === 0) path.moveTo(px, py);
      else path.lineTo(px, py);
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    for (let copy = 0; copy < 3; copy++) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((copy / 3) * TAU + t * (copy === 0 ? 0.05 : -0.03));
      ctx.translate(-cx, -cy);
      ctx.strokeStyle = hsla(copy === 0 ? h2 : h1, 100, 70, copy === 0 ? 0.85 : 0.2);
      ctx.lineWidth = copy === 0 ? 1.8 : 1;
      ctx.shadowColor = hsla(copy === 0 ? h2 : h1, 100, 62, 0.9);
      ctx.shadowBlur = copy === 0 ? 26 : 12;
      ctx.stroke(path);
      ctx.restore();
    }
    ctx.restore();

    // trace head
    const headX = cx + wave[0] * amp * 1.9;
    const headY = cy + wave[offset % n] * amp * 1.9;
    ctx.beginPath();
    ctx.arc(headX, headY, 2 + beat * 3, 0, TAU);
    ctx.fillStyle = hsla(h2, 100, 95, 0.95);
    ctx.shadowColor = hsla(h2, 100, 70, 1);
    ctx.shadowBlur = 18;
    ctx.fill();
    ctx.shadowBlur = 0;

    // center axis
    ctx.beginPath();
    ctx.moveTo(cx, cy - 3);
    ctx.lineTo(cx, cy + 3);
    ctx.moveTo(cx - 3, cy);
    ctx.lineTo(cx + 3, cy);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // level label
    ctx.font = '9px Inter, sans-serif';
    ctx.fillStyle = hsla(h2, 100, 82, clamp(0.2 + treble * 0.3));
    ctx.textAlign = 'center';
    ctx.fillText('XY', cx, cy + scale * 1.65);
  },
};
