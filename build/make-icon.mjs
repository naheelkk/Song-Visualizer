/**
 * Generates build/icon.png (512x512) with no image dependencies.
 * A dark rounded tile with a glowing violet→cyan prism outline.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SIZE = 512;
const SS = 3;
const W = SIZE * SS;
const here = dirname(fileURLToPath(import.meta.url));

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const mix = (a, b, t) => a + (b - a) * t;

// ---------- geometry ----------
const P = { r: 0.22 };

function roundedRectDistance(x, y) {
  const qx = Math.abs(x - 0.5) - (0.5 - P.r);
  const qy = Math.abs(y - 0.5) - (0.5 - P.r);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inside = Math.min(Math.max(qx, qy), 0);
  return outside + inside - P.r;
}

const V = [
  [0.5, 0.205],
  [0.815, 0.795],
  [0.185, 0.795],
];

function segmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = clamp01(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

function triangleDistance(x, y) {
  let d = Infinity;
  for (let i = 0; i < 3; i++) {
    const a = V[i];
    const b = V[(i + 1) % 3];
    d = Math.min(d, segmentDistance(x, y, a[0], a[1], b[0], b[1]));
  }
  return d;
}

function insideTriangle(x, y) {
  const [a, b, c] = V;
  const d1 = (x - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (y - b[1]);
  const d2 = (x - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (y - c[1]);
  const d3 = (x - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (y - a[1]);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

// ---------- rasterize ----------
const out = new Uint8ClampedArray(SIZE * SIZE * 4);
const samples = SS * SS;

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;

    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const nx = (x * SS + sx + 0.5) / W;
        const ny = (y * SS + sy + 0.5) / W;

        if (roundedRectDistance(nx, ny) > 0) continue;
        a += 1;

        let cr = 7;
        let cg = 8;
        let cb = 15;

        // ambient glows
        const d1 = Math.hypot(nx - 0.24, ny - 0.16);
        const g1 = Math.max(0, 1 - d1 / 0.72);
        const glow1 = g1 * g1 * 0.65;
        cr += 124 * glow1;
        cg += 58 * glow1;
        cb += 237 * glow1;

        const d2 = Math.hypot(nx - 0.83, ny - 0.9);
        const g2 = Math.max(0, 1 - d2 / 0.7);
        const glow2 = g2 * g2 * 0.4;
        cr += 34 * glow2;
        cg += 211 * glow2;
        cb += 238 * glow2;

        // prism gradient
        const t = clamp01((ny - V[0][1]) / (V[1][1] - V[0][1]));
        const pr = mix(196, 34, t);
        const pg = mix(181, 211, t);
        const pb = mix(253, 238, t);

        const d = triangleDistance(nx, ny);
        const half = 0.019;

        if (insideTriangle(nx, ny)) {
          cr += pr * 0.055;
          cg += pg * 0.055;
          cb += pb * 0.055;
        }

        // soft bloom around the prism
        const bloom = Math.exp(-Math.pow(d / (half * 4.5), 2)) * 0.34;
        cr += pr * bloom;
        cg += pg * bloom;
        cb += pb * bloom;

        // bright outline
        if (d < half) {
          const edge = 1 - Math.pow(d / half, 6);
          cr = mix(cr, pr, edge);
          cg = mix(cg, pg, edge);
          cb = mix(cb, pb, edge);
        }

        // inner spark line
        const dLine = segmentDistance(nx, ny, 0.5, 0.475, 0.5, 0.705);
        if (dLine < 0.0105) {
          const edge = 1 - Math.pow(dLine / 0.0105, 4);
          cr = mix(cr, 235, edge * 0.9);
          cg = mix(cg, 228, edge * 0.9);
          cb = mix(cb, 255, edge * 0.9);
        }

        // subtle glass rim
        const rim = 1 - clamp01(Math.abs(roundedRectDistance(nx, ny)) / 0.0055);
        if (rim > 0) {
          cr += (255 - cr) * rim * 0.16;
          cg += (255 - cg) * rim * 0.16;
          cb += (255 - cb) * rim * 0.16;
        }

        r += cr;
        g += cg;
        b += cb;
      }
    }

    const i = (y * SIZE + x) * 4;
    if (a === 0) continue;
    out[i] = r / a;
    out[i + 1] = g / a;
    out[i + 2] = b / a;
    out[i + 3] = Math.round((a / samples) * 255);
  }
}

// ---------- PNG ----------
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA

const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
for (let y = 0; y < SIZE; y++) {
  const row = y * (SIZE * 4 + 1);
  raw[row] = 0;
  Buffer.from(out.buffer, y * SIZE * 4, SIZE * 4).copy(raw, row + 1);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

mkdirSync(here, { recursive: true });
writeFileSync(join(here, 'icon.png'), png);
console.log(`Wrote ${join(here, 'icon.png')} (${png.length} bytes)`);
