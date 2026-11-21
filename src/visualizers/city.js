import { BAND_COUNT } from '../lib/spectrum.js';
import { hsla, mulberry32, TAU, clamp } from '../lib/helpers.js';

const rand = mulberry32(55231);

function makeSkyline(count, minH, maxH, widthMin, widthMax) {
  const list = [];
  let x = -0.02;
  for (let i = 0; i < count && x < 1.03; i++) {
    const width = widthMin + rand() * (widthMax - widthMin);
    const height = minH + rand() * (maxH - minH);
    list.push({
      x,
      w: width,
      h: height,
      antenna: rand() < 0.3,
      seed: Math.floor(rand() * 1e6),
      hueMix: rand(),
    });
    x += width + 0.004 + rand() * 0.014;
  }
  return list;
}

const backLayer = makeSkyline(34, 0.1, 0.3, 0.022, 0.055);
const frontLayer = makeSkyline(26, 0.13, 0.36, 0.03, 0.065);

const stars = Array.from({ length: 110 }, () => ({
  x: rand(),
  y: rand() * 0.5,
  s: 0.35 + rand() * 1.1,
  a: 0.15 + rand() * 0.55,
}));

function noise2(x, y, seed) {
  let h = (seed + x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Neon City — a skyline that lights up with the spectrum.
 */
export default {
  id: 'city',
  name: 'Neon City',
  draw(s) {
    const { ctx, w, h, bands, bass, mid, treble, level, beat, t } = s;
    const [h1, h2, h3] = s.palette.hues;
    const unit = Math.min(w, h);
    const baseY = h * 0.69;
    const waterY = baseY + h * 0.012;

    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, baseY);
    sky.addColorStop(0, '#05040b');
    sky.addColorStop(0.55, hsla(h1, 60, 11, 0.98));
    sky.addColorStop(1, hsla(h1 + 15, 80, 22, 0.98));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, baseY);

    for (const star of stars) {
      const twinkle = 0.55 + 0.45 * Math.sin(t * 1.4 + star.x * 30);
      ctx.beginPath();
      ctx.arc(star.x * w, star.y * h, star.s, 0, TAU);
      ctx.fillStyle = `rgba(255,255,255,${star.a * twinkle})`;
      ctx.fill();
    }

    // Moon
    const moonX = w * 0.78;
    const moonY = h * 0.17;
    const moonR = unit * 0.032;
    const moonGlow = ctx.createRadialGradient(moonX, moonY, moonR * 0.3, moonX, moonY, moonR * 4);
    moonGlow.addColorStop(0, hsla(h2, 80, 80, 0.18));
    moonGlow.addColorStop(1, hsla(h2, 80, 70, 0));
    ctx.fillStyle = moonGlow;
    ctx.fillRect(moonX - moonR * 4, moonY - moonR * 4, moonR * 8, moonR * 8);
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR, 0, TAU);
    ctx.fillStyle = 'rgba(248, 244, 255, 0.9)';
    ctx.shadowColor = hsla(h2, 100, 85, 0.6);
    ctx.shadowBlur = 24;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Searchlights
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 2; i++) {
      const originX = w * (i ? 0.68 : 0.24);
      const angle = -Math.PI / 2 + Math.sin(t * 0.22 + i * 2.1) * 0.4;
      const length = unit * 0.9;
      ctx.beginPath();
      ctx.moveTo(originX, baseY);
      ctx.lineTo(originX + Math.cos(angle - 0.05) * length, baseY + Math.sin(angle - 0.05) * length);
      ctx.lineTo(originX + Math.cos(angle + 0.05) * length, baseY + Math.sin(angle + 0.05) * length);
      ctx.closePath();
      const beam = ctx.createLinearGradient(originX, baseY, originX + Math.cos(angle) * length, baseY + Math.sin(angle) * length);
      beam.addColorStop(0, hsla(h2, 100, 75, 0.05 + treble * 0.12));
      beam.addColorStop(1, hsla(h2, 100, 75, 0));
      ctx.fillStyle = beam;
      ctx.fill();
    }
    ctx.restore();

    // Skyline layers
    const drawLayer = (list, layer) => {
      const isBack = layer === 0;
      const layerColor = isBack ? 'rgba(6,5,14,0.93)' : 'rgba(3,3,8,0.98)';
      const windowAlpha = isBack ? 0.45 : 0.95;
      const bandOffset = isBack ? 8 : 0;

      for (const building of list) {
        const x = building.x * w;
        const bw = building.w * w;
        const bh = building.h * h;
        const top = baseY - bh;

        ctx.fillStyle = layerColor;
        ctx.fillRect(x, top, bw, bh);

        // Rim light
        ctx.fillStyle = hsla(h1, 90, 68, isBack ? 0.12 : 0.22);
        ctx.fillRect(x, top, bw, 1);

        if (building.antenna) {
          const ax = x + bw * 0.5;
          const ah = bh * 0.18;
          ctx.strokeStyle = hsla(h2, 100, 75, 0.35);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(ax, top);
          ctx.lineTo(ax, top - ah);
          ctx.stroke();
          const lit = 0.5 + beat * 0.5;
          ctx.beginPath();
          ctx.arc(ax, top - ah, 1.3 + beat * 1.6, 0, TAU);
          ctx.fillStyle = hsla(h2, 100, 85, lit);
          ctx.fill();
        }

        // Windows
        const cols = Math.max(1, Math.floor(bw / (isBack ? 7 : 9)));
        const rows = Math.max(1, Math.floor(bh / (isBack ? 11 : 13)));
        const cellW = bw / cols;
        const cellH = bh / rows;
        const winW = Math.max(1, cellW * 0.42);
        const winH = Math.max(1, cellH * 0.34);
        const band = bands[Math.min(BAND_COUNT - 1, Math.max(0, Math.floor(building.x * BAND_COUNT) + bandOffset))];

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const n = noise2(c, r, building.seed);
            const lit = n > 0.52;
            if (!lit) continue;
            const flicker = 0.5 + 0.5 * Math.sin(t * (1 + n * 2) + n * 40);
            const audio = 0.2 + band * 1.1;
            const alpha = clamp(windowAlpha * (0.12 + audio * 0.55 + flicker * 0.15));
            const wx = x + c * cellW + (cellW - winW) / 2;
            const wy = top + r * cellH + (cellH - winH) / 2;
            const hue = n > 0.82 ? h2 : building.hueMix > 0.5 ? h1 : h3;
            ctx.fillStyle = hsla(hue, 100, 60 + n * 22, alpha);
            ctx.fillRect(wx, wy, winW, winH);
          }
        }

        // Rooftop glow
        ctx.fillStyle = hsla(h1, 100, 62, isBack ? 0.04 : 0.09 + bass * 0.1);
        ctx.fillRect(x, top - 1, bw, 2);
      }
    };

    drawLayer(backLayer, 0);
    drawLayer(frontLayer, 1);

    // Water
    const water = ctx.createLinearGradient(0, waterY, 0, h * 0.94);
    water.addColorStop(0, hsla(h1 + 10, 70, 10, 1));
    water.addColorStop(0.6, hsla(h1, 70, 5, 1));
    water.addColorStop(1, '#030208');
    ctx.fillStyle = water;
    ctx.fillRect(0, waterY, w, Math.max(0, h * 0.94 - waterY));

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, waterY, w, h - waterY);
    ctx.clip();
    ctx.globalCompositeOperation = 'lighter';

    for (const building of frontLayer) {
      const x = building.x * w;
      const bw = building.w * w;
      const bh = building.h * h;
      const reflection = ctx.createLinearGradient(0, waterY, 0, waterY + bh * 0.6);
      reflection.addColorStop(0, hsla(h2, 100, 65, 0.12 + level * 0.08));
      reflection.addColorStop(1, hsla(h2, 100, 55, 0));
      ctx.fillStyle = reflection;
      ctx.fillRect(x, waterY, bw, bh * 0.6);
    }

    // Moon reflection
    const moonRef = ctx.createLinearGradient(0, waterY, 0, waterY + h * 0.2);
    moonRef.addColorStop(0, hsla(h2, 100, 80, 0.16 + beat * 0.08));
    moonRef.addColorStop(1, hsla(h2, 100, 80, 0));
    ctx.fillStyle = moonRef;
    ctx.fillRect(moonX - moonR * 1.4, waterY, moonR * 2.8, h * 0.2);

    // Ripples on the water
    for (let i = 0; i < 9; i++) {
      const y = waterY + (h * 0.24) * Math.pow(i / 9, 1.5) + 4;
      const offset = Math.sin(t * 1.1 + i) * 6;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += 12) {
        ctx.lineTo(x, y + Math.sin(x * 0.02 + t * 1.4 + i) * (1.2 + level * 2.4));
      }
      ctx.strokeStyle = hsla(h2, 100, 68, 0.05 + level * 0.08 + i * 0.008);
      ctx.lineWidth = 1;
      ctx.stroke();
      void offset;
    }
    ctx.restore();

    // Waterline glow
    const line = ctx.createLinearGradient(0, 0, w, 0);
    line.addColorStop(0, hsla(h2, 100, 70, 0));
    line.addColorStop(0.5, hsla(h2, 100, 82, 0.35 + beat * 0.25));
    line.addColorStop(1, hsla(h2, 100, 70, 0));
    ctx.fillStyle = line;
    ctx.fillRect(0, waterY, w, 1);

    // Sky glow pulse
    const pulse = ctx.createRadialGradient(w / 2, baseY, 0, w / 2, baseY, w * 0.7);
    pulse.addColorStop(0, hsla(h1, 100, 60, 0.05 + beat * 0.08));
    pulse.addColorStop(1, hsla(h1, 100, 60, 0));
    ctx.fillStyle = pulse;
    ctx.fillRect(0, baseY - h * 0.3, w, h * 0.3);

    void mid;
  },
};
