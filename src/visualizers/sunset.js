import { BAND_COUNT } from '../lib/spectrum.js';
import { hsla, mulberry32, TAU } from '../lib/helpers.js';

const rand = mulberry32(31337);
const stars = Array.from({ length: 120 }, () => ({
  x: rand(),
  y: rand() * 0.62,
  s: 0.3 + rand(),
  a: 0.15 + rand() * 0.6,
}));

/**
 * Synth Sunset — a retro sun, scrolling grid and spectral ridgelines.
 */
export default {
  id: 'sunset',
  name: 'Synth Sunset',
  draw(s) {
    const { ctx, w, h, bands, bass, level, beat, t } = s;
    const [h1, h2, h3] = s.palette.hues;
    const horizon = h * 0.6;
    const unit = Math.min(w, h);
    const cx = w / 2;

    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#05030c');
    sky.addColorStop(0.55, hsla(h1, 55, 13, 1));
    sky.addColorStop(1, hsla(h1 + 20, 65, 24, 1));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, horizon + 2);

    // stars
    for (const star of stars) {
      const twinkle = 0.6 + Math.sin(t * 1.6 + star.x * 20) * 0.4;
      ctx.beginPath();
      ctx.arc(star.x * w, star.y * horizon, star.s, 0, TAU);
      ctx.fillStyle = `rgba(255,255,255,${star.a * twinkle * (0.6 + level * 0.4)})`;
      ctx.fill();
    }

    // sun glow
    const sunR = unit * (0.19 + bass * 0.012);
    const sunY = horizon - sunR * 0.42;
    const glow = ctx.createRadialGradient(cx, sunY, sunR * 0.4, cx, sunY, sunR * 2.6);
    glow.addColorStop(0, hsla(h2, 100, 65, 0.3 + level * 0.15));
    glow.addColorStop(0.45, hsla(h1 + 20, 100, 55, 0.12));
    glow.addColorStop(1, hsla(h1, 100, 50, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, horizon + 4);

    // sun
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, sunY, sunR, 0, TAU);
    ctx.clip();
    const sun = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
    sun.addColorStop(0, hsla(h2, 100, 86, 0.98));
    sun.addColorStop(0.45, hsla(h1 + 18, 100, 66, 0.98));
    sun.addColorStop(1, hsla(h3, 100, 55, 0.95));
    ctx.fillStyle = sun;
    ctx.fillRect(cx - sunR, sunY - sunR, sunR * 2, sunR * 2);

    // retro cut stripes, thicker near the bottom of the sun
    const stripes = 9;
    for (let i = 0; i < stripes; i++) {
      const p = i / stripes;
      const y = sunY - sunR * 0.02 + sunR * Math.pow(p, 1.5) * 1.05;
      const thickness = 1 + i * 1.7;
      ctx.fillStyle = `rgba(8,4,16,${0.25 + p * 0.6})`;
      ctx.fillRect(cx - sunR, y, sunR * 2, thickness);
    }
    ctx.restore();

    // sun rim
    ctx.beginPath();
    ctx.arc(cx, sunY, sunR, 0, TAU);
    ctx.strokeStyle = hsla(h2, 100, 78, 0.35 + beat * 0.3);
    ctx.lineWidth = 1;
    ctx.stroke();

    // mountains
    const ridge = (amplitude, offset, fillTop, fillBottom, rimAlpha) => {
      ctx.beginPath();
      ctx.moveTo(0, horizon);
      const steps = 90;
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const idx = Math.floor(u * (BAND_COUNT - 1));
        const v = bands[Math.min(BAND_COUNT - 1, Math.max(0, idx + offset))];
        const jag = Math.sin(u * 26 + offset) * 0.015 + Math.sin(u * 11 - offset) * 0.02;
        const y = horizon - (v * 0.11 + jag + 0.012) * h * amplitude;
        ctx.lineTo(u * w, y);
      }
      ctx.lineTo(w, horizon);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, horizon - h * 0.2, 0, horizon);
      grad.addColorStop(0, fillTop);
      grad.addColorStop(1, fillBottom);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = hsla(h2, 100, 70, rimAlpha);
      ctx.lineWidth = 1;
      ctx.stroke();
    };

    ridge(1.1, 18, hsla(h1, 70, 12, 0.95), hsla(h1, 70, 8, 1), 0.14);
    ridge(0.8, 0, 'rgba(4,3,10,0.98)', '#030208', 0.25);

    // floor
    const floor = ctx.createLinearGradient(0, horizon, 0, h);
    floor.addColorStop(0, hsla(h1 + 10, 55, 8, 1));
    floor.addColorStop(1, '#040208');
    ctx.fillStyle = floor;
    ctx.fillRect(0, horizon, w, h - horizon);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, horizon, w, h - horizon);
    ctx.clip();
    ctx.globalCompositeOperation = 'lighter';

    // sun reflection
    const reflect = ctx.createLinearGradient(0, horizon, 0, h * 0.94);
    reflect.addColorStop(0, hsla(h2, 100, 65, 0.22 + beat * 0.08));
    reflect.addColorStop(1, hsla(h2, 100, 60, 0));
    ctx.fillStyle = reflect;
    const refW = sunR * (0.8 + level * 0.2);
    ctx.fillRect(cx - refW, horizon, refW * 2, h * 0.94 - horizon);
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 12; i++) {
      const y = horizon + h * 0.34 * Math.pow(i / 12, 1.4) + 6;
      ctx.fillStyle = hsla(h1 + 10, 55, 7, 0.92);
      ctx.fillRect(cx - refW, y, refW * 2, 2 + i * 0.7);
    }
    ctx.globalCompositeOperation = 'lighter';

    // grid
    const scroll = (t * 0.16) % 1;
    for (let i = 0; i < 16; i++) {
      const p = (i + scroll) / 16;
      const y = horizon + (h - horizon) * Math.pow(p, 2.6);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.strokeStyle = hsla(h2, 100, 65, 0.04 + p * 0.22);
      ctx.lineWidth = 0.6 + p * 1.1;
      ctx.stroke();
    }
    for (let k = -22; k <= 22; k++) {
      const xEnd = cx + k * (w * 0.085);
      ctx.beginPath();
      ctx.moveTo(cx, horizon);
      ctx.lineTo(xEnd, h);
      ctx.strokeStyle = hsla(h2, 100, 62, 0.04 + Math.max(0, 0.16 - Math.abs(k) * 0.006));
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();

    // horizon glow line
    ctx.fillStyle = hsla(h2, 100, 78, 0.3 + beat * 0.3);
    ctx.fillRect(0, horizon, w, 1);
  },
};
