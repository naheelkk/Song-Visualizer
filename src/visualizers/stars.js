import { hsla, mulberry32, TAU, clamp } from '../lib/helpers.js';

const rand = mulberry32(77231);
const COUNT = 440;
const field = Array.from({ length: COUNT }, () => ({
  x: rand(),
  y: rand(),
  z: 0.04 + rand() * 0.96,
  s: 0.4 + rand() * 1.6,
}));

/**
 * Warp Drive — a starfield that accelerates with the music.
 */
export default {
  id: 'stars',
  name: 'Warp Drive',
  draw(s) {
    const { ctx, w, h, level, bass, beat, treble, dt, t } = s;
    const [h1, h2, h3] = s.palette.hues;
    const cx = w / 2;
    const cy = h * 0.44;
    const fov = Math.min(w, h) * 0.42;
    const speed = 0.1 + level * 0.62 + beat * 0.3;

    // nebula
    const neb = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.55);
    neb.addColorStop(0, hsla(h1, 90, 45, 0.14 + level * 0.08));
    neb.addColorStop(0.4, hsla(h3, 90, 40, 0.05));
    neb.addColorStop(1, 'rgba(3,4,10,0)');
    ctx.fillStyle = neb;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    for (const star of field) {
      const prevZ = star.z;
      star.z -= speed * dt * 0.55;
      if (star.z <= 0.03) {
        star.z = 1;
        star.x = rand();
        star.y = rand();
        star.s = 0.4 + rand() * 1.6;
      }

      const depth = 1 - star.z;
      const scale = fov / star.z;
      const sx = cx + (star.x - 0.5) * scale;
      const sy = cy + (star.y - 0.5) * scale * 0.72;
      if (sx < -w * 0.4 || sx > w * 1.4 || sy < -h * 0.4 || sy > h * 1.4) continue;

      const pScale = fov / Math.min(1, prevZ);
      const px = cx + (star.x - 0.5) * pScale;
      const py = cy + (star.y - 0.5) * pScale * 0.72;

      const alpha = clamp(depth * 1.4) * 0.85;
      const hue = h2 + (h1 - h2) * ((star.x + star.y) * 0.5) + Math.sin(t * 0.2) * 6;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(sx, sy);
      ctx.strokeStyle = hsla(hue, 100, 62 + depth * 26, alpha);
      ctx.lineWidth = Math.max(0.4, star.s * (0.25 + depth * 1.9));
      ctx.stroke();
    }
    ctx.restore();

    // core flare
    const flare = ctx.createRadialGradient(cx, cy, 0, cx, cy, fov * 0.5);
    flare.addColorStop(0, hsla(h2, 100, 92, 0.25 + bass * 0.35));
    flare.addColorStop(0.15, hsla(h1, 100, 70, 0.12));
    flare.addColorStop(1, hsla(h1, 100, 60, 0));
    ctx.fillStyle = flare;
    ctx.fillRect(0, 0, w, h);

    ctx.beginPath();
    ctx.arc(cx, cy, 2 + bass * 5, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fill();

    // outer navigation ring
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.1);
    ctx.beginPath();
    ctx.arc(0, 0, fov * 0.95, 0.2, 2.6);
    ctx.arc(0, 0, fov * 0.95, 3.0, 5.5);
    ctx.strokeStyle = hsla(h3, 100, 72, 0.1 + treble * 0.2);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  },
};
