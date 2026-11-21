import { BAND_COUNT } from '../lib/spectrum.js';
import { hsla, roundRect } from '../lib/helpers.js';

const surface = document.createElement('canvas');
let sctx = null;
let lutKey = '';
let lut = [];

function buildLut(h1, h2) {
  lut = [];
  for (let i = 0; i < 40; i++) {
    const p = i / 39;
    const hue = h1 + (h2 - h1) * Math.min(1, p * 1.5);
    const light = 4 + Math.pow(p, 0.85) * 62;
    lut.push(hsla(hue, 92, light, 0.12 + p * 0.88));
  }
}

/**
 * Spectrogram — a scrolling heat map of frequency over time.
 */
export default {
  id: 'spectrogram',
  name: 'Spectrogram',
  draw(s) {
    const { ctx, w, h, bands, level, beat, t } = s;
    const [h1, h2] = s.palette.hues;
    const colH = 3;
    const surfaceH = BAND_COUNT * colH;

    if (surface.width !== Math.max(2, Math.round(w)) || surface.height !== surfaceH) {
      surface.width = Math.max(2, Math.round(w));
      surface.height = surfaceH;
      sctx = surface.getContext('2d');
      sctx.fillStyle = '#06070d';
      sctx.fillRect(0, 0, surface.width, surface.height);
    }
    if (!sctx) return;

    const key = `${h1.toFixed(1)}-${h2.toFixed(1)}`;
    if (key !== lutKey) {
      lutKey = key;
      buildLut(h1, h2);
    }

    // scroll left by one pixel and paint the newest column
    sctx.drawImage(surface, -1, 0);

    const x = surface.width - 1;
    for (let b = 0; b < BAND_COUNT; b++) {
      const v = bands[b];
      const idx = Math.min(lut.length - 1, Math.floor(Math.pow(v, 0.8) * lut.length));
      const y = surface.height - (b + 1) * colH;
      sctx.fillStyle = v < 0.02 ? '#07080f' : lut[idx];
      sctx.fillRect(x, y, 1, colH);
    }

    // composite the scrolling map
    const top = h * 0.19;
    const height = h * 0.6;
    ctx.save();
    roundRect(ctx, w * 0.04, top, w * 0.92, height, 16);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(surface, w * 0.04, top, w * 0.92, height);
    ctx.imageSmoothingEnabled = true;

    // frequency grid
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) {
      const y = top + (height / 6) * i;
      ctx.beginPath();
      ctx.moveTo(w * 0.04, y);
      ctx.lineTo(w * 0.96, y);
      ctx.stroke();
    }
    // scan glow
    const scan = ctx.createLinearGradient(w * 0.94, 0, w * 0.96, 0);
    scan.addColorStop(0, hsla(h2, 100, 78, 0));
    scan.addColorStop(1, hsla(h2, 100, 86, 0.25 + beat * 0.3));
    ctx.fillStyle = scan;
    ctx.fillRect(w * 0.94, top, w * 0.02, height);
    ctx.restore();

    // frame
    ctx.save();
    roundRect(ctx, w * 0.04, top, w * 0.92, height, 16);
    ctx.strokeStyle = hsla(h1, 90, 70, 0.16 + level * 0.1);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // labels
    ctx.font = '9px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.textAlign = 'left';
    const labels = ['16k', '8k', '2k', '500', '120', '30'];
    labels.forEach((label, i) => {
      const y = top + (height / 6) * i + 10;
      ctx.fillText(`${label} Hz`, w * 0.04 + 10, y);
    });

    // bright outer halo to separate from stage
    const halo = ctx.createLinearGradient(0, top - 40, 0, top);
    halo.addColorStop(0, hsla(h1, 95, 55, 0));
    halo.addColorStop(1, hsla(h1, 95, 55, 0.12 + level * 0.1));
    ctx.fillStyle = halo;
    ctx.fillRect(w * 0.04, top - 40, w * 0.92, 40);

    // moving readout
    ctx.textAlign = 'right';
    ctx.fillStyle = hsla(h2, 100, 82, 0.4 + level * 0.3);
    ctx.fillText(`LIVE ${(t * 1).toFixed(1)}s`, w * 0.96 - 12, top + height - 12);
  },
};
