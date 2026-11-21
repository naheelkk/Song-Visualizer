import { BAND_COUNT } from '../lib/spectrum.js';
import { hsla, mulberry32, TAU } from '../lib/helpers.js';

const rand = mulberry32(99217);
const ripples = [];
let wasBeat = false;
let lastAmbient = -10;

/**
 * Ripple Tank — a shimmering water surface with beat-born ripples.
 */
export default {
  id: 'ripples',
  name: 'Ripple Tank',
  draw(s) {
    const { ctx, w, h, bands, bass, treble, level, beat, dt, t } = s;
    const [h1, h2, h3] = s.palette.hues;
    const unit = Math.min(w, h);
    const cx = w / 2;
    const cy = h * 0.43;
    const maxR = Math.hypot(w, h) * 0.55;

    const backdrop = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
    backdrop.addColorStop(0, hsla(h1, 80, 24, 0.24 + bass * 0.1));
    backdrop.addColorStop(0.45, hsla(h1, 85, 12, 0.12));
    backdrop.addColorStop(1, 'rgba(3,4,9,0)');
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, w, h);

    if (beat > 0.8 && !wasBeat) {
      wasBeat = true;
      ripples.push({
        x: cx + (rand() - 0.5) * w * 0.62,
        y: cy + (rand() - 0.5) * h * 0.36,
        age: 0,
        speed: unit * (0.5 + rand() * 0.45),
        life: 1,
        hue: rand() < 0.5 ? h2 : h3,
        power: 0.8 + bass,
      });
    }
    if (beat < 0.2) wasBeat = false;

    if (t - lastAmbient > 2.6) {
      lastAmbient = t;
      if (ripples.length < 5) {
        ripples.push({
          x: cx + (rand() - 0.5) * w * 0.6,
          y: cy + (rand() - 0.5) * h * 0.34,
          age: 0,
          speed: unit * (0.3 + rand() * 0.2),
          life: 0.65,
          hue: h2,
          power: 0.5,
        });
      }
    }

    for (let i = ripples.length - 1; i >= 0; i--) {
      const ripple = ripples[i];
      ripple.age += dt;
      ripple.life -= dt * 0.33;
      if (ripple.life <= 0) ripples.splice(i, 1);
    }

    const cols = Math.min(56, Math.max(28, Math.floor(w / 24)));
    const rows = Math.min(30, Math.max(16, Math.floor(h / 32)));
    const gridW = w * 0.86;
    const gridH = h * 0.68;
    const left = (w - gridW) / 2;
    const top = h * 0.08;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = left + (c / (cols - 1)) * gridW;
        const y = top + (r / (rows - 1)) * gridH;
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);
        const band = bands[Math.floor(((angle + Math.PI) / TAU) * (BAND_COUNT - 1))];
        const falloff = Math.exp(-dist / (unit * 0.7));

        let wave =
          Math.sin(dist * 0.032 - t * 2.1 + band * 2.5) *
          falloff *
          (0.35 + level * 1.6) *
          (0.4 + band * 1.5);

        for (const ripple of ripples) {
          const rr = Math.hypot(x - ripple.x, y - ripple.y);
          const front = rr - ripple.age * ripple.speed;
          wave +=
            Math.sin(front * 0.05) *
            ripple.life *
            Math.exp(-Math.abs(front) / (unit * 0.09)) *
            ripple.power *
            0.9;
        }

        const lit = Math.max(0, wave);
        const size = 0.5 + lit * 2.6 + bass * 0.4;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, TAU);
        ctx.fillStyle = hsla(
          h2 + (band - 0.5) * 24,
          100,
          55 + lit * 26,
          0.06 + falloff * 0.1 + lit * 0.5 + treble * 0.05,
        );
        ctx.fill();
      }
    }

    // Expanding rings
    for (const ripple of ripples) {
      for (let k = 0; k < 2; k++) {
        const radius = ripple.age * ripple.speed * (1 - k * 0.12) + 4;
        ctx.beginPath();
        ctx.arc(ripple.x, ripple.y, radius, 0, TAU);
        ctx.strokeStyle = hsla(ripple.hue, 100, 72, ripple.life * (k ? 0.14 : 0.3));
        ctx.lineWidth = k ? 4 : 1;
        ctx.stroke();
      }
    }

    // Stationary concentric sheen
    for (let i = 1; i <= 7; i++) {
      const radius = unit * (0.045 + i * 0.045) * (1 + bass * 0.06 + Math.sin(t * 0.7 + i) * 0.006);
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, TAU);
      ctx.strokeStyle = hsla(i % 2 ? h1 : h3, 100, 76, 0.06 + level * 0.1);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();

    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, unit * 0.16);
    core.addColorStop(0, hsla(h2, 100, 90, 0.28 + bass * 0.35));
    core.addColorStop(0.5, hsla(h1, 100, 65, 0.08));
    core.addColorStop(1, hsla(h1, 100, 60, 0));
    ctx.beginPath();
    ctx.arc(cx, cy, unit * 0.16, 0, TAU);
    ctx.fillStyle = core;
    ctx.fill();

    // Vertical light streak through the surface
    const streak = ctx.createLinearGradient(cx - unit * 0.1, 0, cx + unit * 0.1, 0);
    streak.addColorStop(0, hsla(h2, 100, 80, 0));
    streak.addColorStop(0.5, hsla(h2, 100, 85, 0.03 + level * 0.05));
    streak.addColorStop(1, hsla(h2, 100, 80, 0));
    ctx.fillStyle = streak;
    ctx.fillRect(cx - unit * 0.1, 0, unit * 0.2, h);
  },
};
