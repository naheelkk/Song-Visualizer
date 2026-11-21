import { hsla } from '../lib/helpers.js';

/**
 * Neon Scope — layered oscilloscope traces with a faint measurement grid.
 */
export default {
  id: 'scope',
  name: 'Neon Scope',
  draw(s) {
    const { ctx, w, h, wave, level, bass, beat, t } = s;
    const [h1, h2, h3] = s.palette.hues;
    const cy = h * 0.44;

    // grid
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.045)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 8; i++) {
      const x = (w / 8) * i;
      ctx.beginPath();
      ctx.moveTo(x, cy - h * 0.22);
      ctx.lineTo(x, cy + h * 0.22);
      ctx.stroke();
    }
    for (let i = -2; i <= 2; i++) {
      const y = cy + i * (h * 0.085);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.restore();

    const layers = [
      { amp: 0.5, width: 1.2, alpha: 0.32, hue: h3, blur: 14, scale: 1 },
      { amp: 1.0, width: 2.4, alpha: 0.95, hue: h1, blur: 26, scale: 1 },
      { amp: 1.5, width: 1.2, alpha: 0.35, hue: h2, blur: 20, scale: -1 },
    ];

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (const layer of layers) {
      const amp = h * (0.1 + level * 0.06) * layer.amp;
      ctx.beginPath();
      const steps = wave.length;
      for (let i = 0; i < steps; i += 2) {
        const x = (i / (steps - 1)) * w;
        const y =
          cy +
          wave[i] * amp * layer.scale +
          Math.sin((i / steps) * Math.PI * 2 + t * 0.6) * 1.5;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, hsla(layer.hue - 25, 100, 62, layer.alpha * 0.5));
      grad.addColorStop(0.5, hsla(layer.hue, 100, 72, layer.alpha));
      grad.addColorStop(1, hsla(layer.hue + 25, 100, 62, layer.alpha * 0.5));

      ctx.strokeStyle = grad;
      ctx.lineWidth = layer.width;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.shadowColor = hsla(layer.hue, 100, 60, 0.8);
      ctx.shadowBlur = layer.blur;
      ctx.stroke();
    }
    ctx.restore();

    // Center axis and playhead-style pulse
    const axis = ctx.createLinearGradient(0, 0, w, 0);
    axis.addColorStop(0, hsla(h1, 90, 70, 0));
    axis.addColorStop(0.5, hsla(h2, 100, 85, 0.22 + beat * 0.2));
    axis.addColorStop(1, hsla(h1, 90, 70, 0));
    ctx.fillStyle = axis;
    ctx.fillRect(0, cy, w, 1);

    // Peak markers
    const px = w * (0.5 + Math.sin(t * 0.5) * 0.22);
    const py = cy - (bass * h * 0.18 + 12);
    ctx.beginPath();
    ctx.arc(px, py, 2.2 + beat * 2.5, 0, Math.PI * 2);
    ctx.fillStyle = hsla(h2, 100, 90, 0.7);
    ctx.shadowColor = hsla(h2, 100, 70, 0.9);
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Scale ticks at edges
    ctx.font = '9px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.textAlign = 'left';
    ctx.fillText('L', 14, cy - h * 0.2);
    ctx.textAlign = 'right';
    ctx.fillText('R', w - 14, cy - h * 0.2);
  },
};
