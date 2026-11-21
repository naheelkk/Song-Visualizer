import { hsla, TAU } from '../lib/helpers.js';

/**
 * Filigree — layered, mirrored oscilloscope ribbons with a woven glow.
 */
export default {
  id: 'filigree',
  name: 'Filigree',
  draw(s) {
    const { ctx, w, h, wave, bass, treble, level, beat, t } = s;
    const [h1, h2, h3] = s.palette.hues;
    const mid = h / 2;
    const amp = Math.min(h * 0.3, w * 0.2) * (0.7 + bass * 0.8);

    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, hsla(h1, 60, 6, 1));
    bg.addColorStop(0.5, hsla(h3, 60, 9, 1));
    bg.addColorStop(1, hsla(h1, 60, 6, 1));
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = hsla(h2, 70, 70, 0.05);
    ctx.lineWidth = 1;
    const step = Math.max(28, w / 22);
    for (let x = 0; x <= w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, mid - h * 0.34);
      ctx.lineTo(x, mid + h * 0.34);
      ctx.stroke();
    }
    for (let i = -3; i <= 3; i++) {
      const y = mid + (i / 3) * h * 0.3;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Center axis
    ctx.strokeStyle = hsla(h2, 90, 75, 0.14 + level * 0.2);
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(w, mid);
    ctx.stroke();

    const count = wave.length;
    const sampleY = (i, phase, stretch) => {
      const index = Math.floor((i / w) * (count - 1));
      return mid + wave[index] * amp * stretch + Math.sin(i * 0.02 + t * 1.6 + phase) * h * 0.006;
    };

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Layered ribbons
    for (let pass = 0; pass < 5; pass++) {
      const stretch = 1 - pass * 0.13;
      const phase = pass * 0.8;
      const alpha = 0.4 - pass * 0.055;
      const hue = pass % 2 ? h1 : h2;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 2) {
        const y = sampleY(x, phase, stretch);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = hsla(hue, 100, 70 - pass * 4, alpha * (0.7 + level * 0.6));
      ctx.lineWidth = pass === 0 ? 2.4 : 1.1;
      ctx.shadowColor = hsla(hue, 100, 65, 0.8);
      ctx.shadowBlur = pass === 0 ? 16 : 6;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Mirrored fill
    ctx.beginPath();
    for (let x = 0; x <= w; x += 2) {
      const y = sampleY(x, 0, 1);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    for (let x = w; x >= 0; x -= 2) {
      ctx.lineTo(x, mid - (sampleY(x, 0, 1) - mid));
    }
    ctx.closePath();
    const fill = ctx.createLinearGradient(0, mid - amp, 0, mid + amp);
    fill.addColorStop(0, hsla(h1, 100, 65, 0.03));
    fill.addColorStop(0.5, hsla(h2, 100, 70, 0.16 + level * 0.12));
    fill.addColorStop(1, hsla(h3, 100, 65, 0.03));
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.restore();

    // Highlighter beads riding the loudest samples
    let peakIndex = 0;
    let peak = 0;
    for (let i = 0; i < count; i++) {
      const v = Math.abs(wave[i]);
      if (v > peak) {
        peak = v;
        peakIndex = i;
      }
    }
    const px = (peakIndex / (count - 1)) * w;
    const py = mid + wave[peakIndex] * amp;
    const bead = ctx.createRadialGradient(px, py, 0, px, py, 22 + treble * 26);
    bead.addColorStop(0, 'rgba(255,255,255,0.9)');
    bead.addColorStop(0.3, hsla(h2, 100, 75, 0.55));
    bead.addColorStop(1, hsla(h2, 100, 70, 0));
    ctx.beginPath();
    ctx.arc(px, py, 22 + treble * 26, 0, TAU);
    ctx.fillStyle = bead;
    ctx.fill();

    // Beat ring
    ctx.beginPath();
    ctx.arc(px, py, 16 + beat * 46, 0, TAU);
    ctx.strokeStyle = hsla(h2, 100, 85, 0.18 + beat * 0.3);
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Tick marks
    ctx.save();
    ctx.fillStyle = hsla(h2, 70, 80, 0.22);
    const tick = Math.max(1, Math.floor(w / 120));
    for (let i = 0; i < 120; i++) {
      const bh = 2 + Math.abs(wave[Math.floor((i / 120) * (count - 1))]) * 60;
      ctx.fillRect((i / 120) * w, mid - h * 0.36, tick, bh * 0.4);
    }
    ctx.restore();
  },
};
