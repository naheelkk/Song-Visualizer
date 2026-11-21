import { BAND_COUNT } from '../lib/spectrum.js';
import { hsla, mulberry32, TAU } from '../lib/helpers.js';

const rand = mulberry32(48151);
const ARMS = 3;
const PER_ARM = 300;
const particles = [];

for (let arm = 0; arm < ARMS; arm++) {
  for (let i = 0; i < PER_ARM; i++) {
    const progress = i / (PER_ARM - 1);
    particles.push({
      arm,
      progress,
      jitter: (rand() - 0.5) * 0.2,
      radiusJitter: 1 + (rand() - 0.5) * 0.05,
      size: 0.5 + rand() * 1.7,
      hueOffset: (rand() - 0.5) * 18,
      twinkle: rand() * TAU,
    });
  }
}

/**
 * Vortex — a rotating spectrum galaxy with three spiral arms.
 */
export default {
  id: 'spiral',
  name: 'Vortex',
  draw(s) {
    const { ctx, w, h, bands, bass, level, treble, beat, t } = s;
    const [h1, h2, h3] = s.palette.hues;
    const cx = w / 2;
    const cy = h * 0.44;
    const unit = Math.min(w, h);
    const R = unit * (0.34 + bass * 0.03);
    const rotation = t * 0.14;

    const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.3);
    aura.addColorStop(0, hsla(h1, 100, 55, 0.16 + level * 0.1));
    aura.addColorStop(0.5, hsla(h3, 100, 50, 0.05));
    aura.addColorStop(1, hsla(h1, 100, 50, 0));
    ctx.fillStyle = aura;
    ctx.fillRect(0, 0, w, h);

    // Background stars
    for (let i = 0; i < 130; i++) {
      const a = (i * 2.399) % TAU;
      const r = unit * (0.42 + ((i * 61) % 100) / 100 * 0.5);
      const tw = 0.4 + 0.6 * Math.sin(t * 1.3 + i);
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.65, 0.4 + (i % 4) * 0.3, 0, TAU);
      ctx.fillStyle = hsla(h2, 80, 85, 0.05 + tw * 0.14);
      ctx.fill();
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Arm haze
    for (let arm = 0; arm < ARMS; arm++) {
      ctx.beginPath();
      for (let i = 0; i <= 60; i++) {
        const p = i / 60;
        const angle = (arm / ARMS) * TAU + rotation + p * 3.4;
        const radius = R * (0.08 + p * 0.92);
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius * 0.44;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      const grad = ctx.createLinearGradient(cx - R, cy, cx + R, cy);
      grad.addColorStop(0, hsla(h2, 100, 65, 0.1 + level * 0.08));
      grad.addColorStop(1, hsla(h3, 100, 65, 0.01));
      ctx.strokeStyle = grad;
      ctx.lineWidth = unit * 0.03;
      ctx.filter = 'blur(6px)';
      ctx.stroke();
      ctx.filter = 'none';
    }

    // Stars along the arms
    for (const particle of particles) {
      const band = bands[Math.min(BAND_COUNT - 1, Math.floor(particle.progress * (BAND_COUNT - 1)))];
      const angle =
        (particle.arm / ARMS) * TAU +
        rotation +
        particle.progress * 3.4 +
        particle.jitter * (0.3 + band);
      const radius =
        R * (0.07 + particle.progress * 0.93) * particle.radiusJitter * (1 + band * 0.06);
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius * 0.44 + Math.sin(angle * 3 + t) * R * 0.012;
      const front = (Math.sin(angle) + 1) / 2;
      const size = particle.size * (0.4 + band * 1.9) * (0.6 + front * 0.8);
      const hue = h3 + (h1 - h3) * particle.progress + particle.hueOffset;
      const twinkle = 0.55 + 0.45 * Math.sin(t * 2 + particle.twinkle);
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.35, size), 0, TAU);
      ctx.fillStyle = hsla(hue, 100, 64 + front * 20, (0.1 + band * 0.5) * twinkle);
      ctx.fill();
    }
    ctx.restore();

    // Accretion core
    const coreR = unit * (0.035 + bass * 0.012);
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 3.4);
    core.addColorStop(0, 'rgba(255,255,255,0.95)');
    core.addColorStop(0.18, hsla(h2, 100, 88, 0.9));
    core.addColorStop(0.4, hsla(h1, 100, 62, 0.35));
    core.addColorStop(1, hsla(h1, 100, 55, 0));
    ctx.beginPath();
    ctx.arc(cx, cy, coreR * 3.4, 0, TAU);
    ctx.fillStyle = core;
    ctx.fill();

    // Core ring
    ctx.beginPath();
    ctx.arc(cx, cy, coreR * (1.7 + beat * 0.15), 0, TAU);
    ctx.strokeStyle = hsla(h2, 100, 84, 0.4 + beat * 0.35);
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Elliptical orbit guides
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, R * (0.45 + i * 0.35), R * (0.2 + i * 0.15), 0, 0, TAU);
      ctx.strokeStyle = hsla(i ? h3 : h2, 100, 72, 0.07 + treble * 0.08);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  },
};
