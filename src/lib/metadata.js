/* Lightweight tag reading for MP3 (ID3v2) and FLAC (Vorbis comments + PICTURE).
   Everything else falls back to parsing the filename. No dependencies. */

const MIME_BY_EXT = {
  mp3: 'audio/mpeg',
  mp2: 'audio/mpeg',
  flac: 'audio/flac',
  wav: 'audio/wav',
  wave: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  m4a: 'audio/mp4',
  m4b: 'audio/mp4',
  mp4a: 'audio/mp4',
  aac: 'audio/aac',
  aiff: 'audio/aiff',
  aif: 'audio/aiff',
  aifc: 'audio/aiff',
  webm: 'audio/webm',
  weba: 'audio/webm',
  wma: 'audio/x-ms-wma',
  mka: 'audio/x-matroska',
};

export const AUDIO_EXTENSIONS = Object.keys(MIME_BY_EXT);

export function extensionOf(name = '') {
  const match = /\.([a-z0-9]{1,6})$/i.exec(name);
  return match ? match[1].toLowerCase() : '';
}

export function mimeFor(file) {
  const ext = extensionOf(file.name);
  if (file.type && file.type.startsWith('audio/')) return file.type;
  return MIME_BY_EXT[ext] || file.type || '';
}

export function formatLabel(file) {
  const ext = extensionOf(file.name);
  return (ext || 'audio').toUpperCase();
}

export function isAudioFile(file) {
  if (!file) return false;
  if (file.type && file.type.startsWith('audio/')) return true;
  return Boolean(MIME_BY_EXT[extensionOf(file.name)]);
}

function parseFilename(name) {
  let base = name.replace(/\.[^.]+$/, '').replace(/_/g, ' ').trim();
  base = base.replace(/^\s*\d{1,3}\s*[.)\-–—]\s*/, '');
  const parts = base.split(/\s+[-–—]\s+/);
  if (parts.length >= 2) {
    return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };
  }
  return { artist: '', title: base || 'Untitled' };
}

export async function readMetadata(file) {
  const info = { title: '', artist: '', album: '', art: null, artBlob: null };
  const ext = extensionOf(file.name);
  try {
    if (ext === 'mp3' || ext === 'mp2' || file.type === 'audio/mpeg') {
      Object.assign(info, await readID3(file));
    } else if (ext === 'flac') {
      Object.assign(info, await readFlac(file));
    }
  } catch {
    /* malformed tags are not fatal */
  }

  const fallback = parseFilename(file.name);
  const clean = (s) => (typeof s === 'string' ? s.replace(/\u0000/g, '').trim() : '');
  return {
    title: clean(info.title) || fallback.title,
    artist: clean(info.artist) || fallback.artist || 'Unknown artist',
    album: clean(info.album),
    art: info.art || null,
    artBlob: info.artBlob || null,
  };
}

function memsetArt(bytes, mime) {
  try {
    const blob = new Blob([bytes], { type: mime || 'image/jpeg' });
    return {
      url: URL.createObjectURL(blob),
      blob,
    };
  } catch {
    return null;
  }
}

/* ---------------- ID3v2 ---------------- */

const syncsafe = (view, offset) =>
  (view.getUint8(offset) & 0x7f) * 0x200000 +
  (view.getUint8(offset + 1) & 0x7f) * 0x4000 +
  (view.getUint8(offset + 2) & 0x7f) * 0x80 +
  (view.getUint8(offset + 3) & 0x7f);

async function readID3(file) {
  const slice = file.slice(0, Math.min(file.size, 6 * 1024 * 1024));
  const view = new DataView(await slice.arrayBuffer());
  if (view.byteLength < 10) return {};
  if (String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2)) !== 'ID3') return {};

  const major = view.getUint8(3);
  const flags = view.getUint8(5);
  const tagSize = syncsafe(view, 6);
  let off = 10;
  const end = Math.min(view.byteLength, 10 + tagSize);
  const out = {};

  if (flags & 0x40) {
    // Extended header
    if (major === 4) off += syncsafe(view, off);
    else off += view.getUint32(off) + 4;
  }

  let guard = 0;
  while (off + 10 <= end && guard++ < 400) {
    const id = String.fromCharCode(
      view.getUint8(off),
      view.getUint8(off + 1),
      view.getUint8(off + 2),
      view.getUint8(off + 3),
    );
    if (!/^[A-Z0-9]{4}$/.test(id)) break;

    let size;
    if (major === 4) size = syncsafe(view, off + 4);
    else size = view.getUint32(off + 4);
    const body = off + 10;
    if (size <= 0 || body + size > view.byteLength) break;

    if (id === 'TIT2') out.title = readID3Text(view, body, size);
    else if (id === 'TPE1') out.artist = readID3Text(view, body, size);
    else if (id === 'TALB') out.album = readID3Text(view, body, size);
    else if (id === 'APIC') {
      const artObj = readID3Picture(view, body, size);
      if (artObj) {
        out.art = artObj.url;
        out.artBlob = artObj.blob;
      }
    }
    off = body + size;
  }
  return out;
}

function readID3Text(view, start, length) {
  if (length < 2) return '';
  const encoding = view.getUint8(start);
  const labels = { 0: 'iso-8859-1', 1: 'utf-16le', 2: 'utf-16be', 3: 'utf-8' };
  const bytes = new Uint8Array(view.buffer, view.byteOffset + start + 1, length - 1);
  try {
    return new TextDecoder(labels[encoding] || 'iso-8859-1').decode(bytes).replace(/\u0000+$/g, '').trim();
  } catch {
    return '';
  }
}

function readID3Picture(view, start, length) {
  const encoding = view.getUint8(start);
  const end = start + length;
  let p = start + 1;

  let mimeEnd = p;
  while (mimeEnd < end && view.getUint8(mimeEnd) !== 0) mimeEnd++;
  let mime = '';
  for (let i = p; i < mimeEnd; i++) mime += String.fromCharCode(view.getUint8(i));
  p = mimeEnd + 1;
  p += 1; // picture type

  if (encoding === 1 || encoding === 2) {
    while (p + 1 < end && !(view.getUint8(p) === 0 && view.getUint8(p + 1) === 0)) p += 2;
    p += 2;
  } else {
    while (p < end && view.getUint8(p) !== 0) p++;
    p += 1;
  }
  if (p >= end) return null;

  const bytes = new Uint8Array(view.buffer, view.byteOffset + p, end - p);
  return memsetArt(bytes, mime);
}

/* ---------------- FLAC ---------------- */

async function readFlac(file) {
  const slice = file.slice(0, Math.min(file.size, 8 * 1024 * 1024));
  const bytes = new Uint8Array(await slice.arrayBuffer());
  if (bytes.length < 8) return {};
  if (String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== 'fLaC') return {};

  const out = {};
  let off = 4;
  for (let i = 0; i < 128 && off + 4 <= bytes.length; i++) {
    const header = bytes[off];
    const last = (header & 0x80) !== 0;
    const type = header & 0x7f;
    const size = (bytes[off + 1] << 16) | (bytes[off + 2] << 8) | bytes[off + 3];
    const body = off + 4;
    if (body + size > bytes.length) break;

    if (type === 4) parseVorbisComments(bytes, body, size, out);
    else if (type === 6) {
      const artObj = parseFlacPicture(bytes, body, size);
      if (artObj) {
        out.art = artObj.url;
        out.artBlob = artObj.blob;
      }
    }

    off = body + size;
    if (last) break;
  }
  return out;
}

function parseVorbisComments(bytes, base, size, out) {
  const view = new DataView(bytes.buffer, bytes.byteOffset + base, size);
  let p = 0;
  const vendorLength = view.getUint32(p, true);
  p += 4 + vendorLength;
  if (p + 4 > size) return;
  const count = view.getUint32(p, true);
  p += 4;

  const decoder = new TextDecoder('utf-8');
  for (let i = 0; i < count && i < 200 && p + 4 <= size; i++) {
    const len = view.getUint32(p, true);
    p += 4;
    if (p + len > size) break;
    const entry = decoder.decode(new Uint8Array(bytes.buffer, bytes.byteOffset + base + p, len));
    p += len;
    const eq = entry.indexOf('=');
    if (eq < 0) continue;
    const key = entry.slice(0, eq).toUpperCase();
    const value = entry.slice(eq + 1);
    if (key === 'TITLE') out.title = value;
    else if (key === 'ARTIST') out.artist = value;
    else if (key === 'ALBUM') out.album = value;
    else if (key === 'METADATA_BLOCK_PICTURE' && !out.art) {
      const picture = base64ToBytes(value);
      if (picture) {
        const artObj = parseFlacPicture(picture, 0, picture.length);
        if (artObj) {
          out.art = artObj.url;
          out.artBlob = artObj.blob;
        }
      }
    }
  }
}

function base64ToBytes(value) {
  try {
    const clean = value.replace(/\s+/g, '');
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function parseFlacPicture(bytes, base, size) {
  if (size < 36) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset + base, size);
  let p = 4; // picture type (front cover, etc.)
  const mimeLength = view.getUint32(p);
  p += 4;
  if (p + mimeLength + 4 > size) return null;
  let mime = new TextDecoder('utf-8').decode(new Uint8Array(bytes.buffer, bytes.byteOffset + base + p, mimeLength));
  p += mimeLength;
  const descLength = view.getUint32(p);
  p += 4 + descLength;
  p += 16; // width, height, depth, colors
  if (p + 4 > size) return null;
  const dataLength = view.getUint32(p);
  p += 4;
  if (!dataLength || p + dataLength > size) return null;
  if (!mime.startsWith('image/')) mime = 'image/jpeg';
  return memsetArt(new Uint8Array(bytes.buffer, bytes.byteOffset + base + p, dataLength), mime);
}

/** Peak envelope used by the seek-bar waveform. */
export function computePeaks(audioBuffer, count = 640) {
  const channels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const data = [];
  for (let c = 0; c < Math.min(channels, 2); c++) data.push(audioBuffer.getChannelData(c));
  const peaks = new Float32Array(count);
  const step = Math.max(1, Math.floor(length / count));
  let maxOverall = 0;

  for (let i = 0; i < count; i++) {
    const start = i * step;
    const stop = Math.min(length, start + step);
    let max = 0;
    for (let j = start; j < stop; j += 2) {
      for (let c = 0; c < data.length; c++) {
        const v = Math.abs(data[c][j]);
        if (v > max) max = v;
      }
    }
    peaks[i] = max;
    if (max > maxOverall) maxOverall = max;
  }

  if (maxOverall > 0.001 && maxOverall < 0.5) {
    const gain = 1 / maxOverall;
    for (let i = 0; i < count; i++) peaks[i] = Math.min(1, peaks[i] * gain * 0.9);
  }
  return peaks;
}
