import { BAND_COUNT } from '../lib/spectrum.js';
import { hsla, mulberry32, TAU, clamp } from '../lib/helpers.js';

const rand = mulberry32(7734);

/**
 * Sonar — a radar sweep that pings to the shape of the spectrum.
 */
export default {
  id: 'sonar',
  name: 'Sonar',
  draw(s) {
    const { ctx, w, h, bands, bass, treble, level, beat, t, dt } = s;
    const [h1, h2, h3] = s.palette.hues;
    const cx = w / 2;
    const cy = h / 2;
    const R = Math.min(w, h) * 0.4;
    const sweep = t * 0.9;

    if (!this.blips) this.blips = [];
    if (!this.nextPing) this.nextPing = 0;

    ctx.fillStyle = hsla(h1, 45, 4, 1);
    ctx.fillRect(0, 0, w, h);

    // Ambient center glow
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    glow.addColorStop(0, hsla(h2, 90, 50, 0.12 + level * 0.12));
    glow.addColorStop(1, hsla(h2, 90, 50, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalCompositeOperation = 'lighter';

    // Sweep trail: thin slices behind the radar arm, fading with age.
    const trail = 1.35;
    const wedges = 46;
    const step = trail / wedges;
    for (let i = 0; i < wedges; i++) {
      const end = sweep - i * step;
      const fade = (1 - i / wedges) * (0.045 + level * 0.05);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, R, end - step, end);
      ctx.closePath();
      ctx.fillStyle = hsla(h2, 100, 65, fade);
      ctx.fill();
    }

    // Sweep line
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(sweep) * R, Math.sin(sweep) * R);
    ctx.strokeStyle = hsla(h2, 100, 78, 0.55 + treble * 0.35);
    ctx.lineWidth = 1.6;
    ctx.shadowColor = hsla(h2, 100, 70, 0.9);
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Rings
    for (let i = 1; i <= 4; i++) {
      const band = bands[Math.floor((i / 5) * (BAND_COUNT - 1))];
      const ringR = (R * i) / 4 + band * R * 0.03 + (i === 1 ? beat * R * 0.02 : 0);
      ctx.beginPath();
      ctx.arc(0, 0, ringR, 0, TAU);
      ctx.strokeStyle = hsla(i % 2 ? h3 : h2, 90, 70, 0.1 + band * 0.22);
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Cross hairs
    ctx.shadowBlur = 0;
    ctx.strokeStyle = hsla(h2, 60, 70, 0.07);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * R, Math.sin(a) * R);
      ctx.lineTo(-Math.cos(a) * R, -Math.sin(a) * R);
      ctx.stroke();
    }

    // Ping spawns: map loud bands to blips
    if (t > this.nextPing) {
      this.nextPing = t + 0.055;
      let loudest = 0;
      let loudestIndex = -1;
      for (let i = 2; i < BAND_COUNT - 2; i++) {
        if (bands[i] > loudest) {
          loudest = bands[i];
          loudestIndex = i;
        }
      }
      if (loudest > 0.24 && loudestIndex >= 0) {
        const norm = loudestIndex / (BAND_COUNT - 1);
        this.blips.push({
          angle: sweep + (rand() - 0.5) * 0.18,
          radius: R * (0.18 + norm * 0.78),
          life: 1,
          hue: h3 + (h1 - h3) * norm,
          size: 2 + loudest * 5,
          strength: loudest,
        });
      }
    }

    // Blips
    for (let i = this.blips.length - 1; i >= 0; i--) {
      const blip = this.blips[i];
      blip.life -= dt * 0.36;
      if (blip.life <= 0) {
        this.blips.splice(i, 1);
        continue;
      }
      const x = Math.cos(blip.angle) * blip.radius;
      const y = Math.sin(blip.angle) * blip.radius;
      const a = blip.life;
      ctx.beginPath();
      ctx.arc(x, y, blip.size * (0.6 + (1 - a) * 0.9), 0, TAU);
      ctx.fillStyle = hsla(blip.hue, 100, 75, a * 0.9);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, blip.size * (2.2 + (1 - a) * 2.4), 0, TAU);
      ctx.strokeStyle = hsla(blip.hue, 100, 75, a * 0.3);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, blip.size * 4, 0, TAU);
      ctx.fillStyle = hsla(blip.hue, 100, 70, a * 0.07);
      ctx.fill();
    }
    ctx.restore();

    // Center hub
    const hub = Math.min(w, h) * (0.012 + bass * 0.01);
    ctx.beginPath();
    ctx.arc(cx, cy, hub, 0, TAU);
    ctx.fillStyle = hsla(h2, 100, 85, 0.9);
    ctx.shadowColor = hsla(h2, 100, 70, 1);
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Readout text
    ctx.save();
    ctx.font = `600 ${Math.max(10, Math.min(w, h) * 0.018)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.fillStyle = hsla(h2, 80, 85, 0.55);
    ctx.textAlign = 'center';
    ctx.fillText(
      `${Math.round(clamp(level) * 100).toString().padStart(3, '0')}  ${String(this.blips.length).padStart(2, '0')} CONTACTS`,
      cx,
      cy + R + Math.min(w, h) * 0.07,
    );
    ctx.restore();
  },
};
