import { scenes } from './visualizers/index.js';
import { AudioEngine } from './lib/engine.js';
import { formatTime, hashString, hsla, clamp, roundRect } from './lib/helpers.js';
import { readMetadata, isAudioFile, mimeFor, formatLabel } from './lib/metadata.js';
import { EQ_BANDS, EQ_PRESETS, EQ_MIN, EQ_MAX, defaultEq } from './lib/eq.js';
import {
  saveTracks,
  loadTracks,
  deleteTrack,
  clearAllTracks,
  updateTrackMetadata,
  syncTrackOrder,
} from './lib/storage.js';

const $ = (id) => document.getElementById(id);

const stage = $('stage');
const sctx = stage.getContext('2d');
const empty = $('empty');
const sceneBar = $('sceneBar');
const sceneName = $('sceneName');
const sceneKicker = $('sceneKicker');
const sceneChips = $('sceneChips');
const player = $('player');
const coverImg = $('coverImg');
const trackTitle = $('trackTitle');
const trackSub = $('trackSub');
const formatBadge = $('formatBadge');
const btnPlay = $('btnPlay');
const btnPrev = $('btnPrev');
const btnNext = $('btnNext');
const btnShuffle = $('btnShuffle');
const btnRepeat = $('btnRepeat');
const btnMute = $('btnMute');
const btnQueue = $('btnQueue');
const btnClearQueue = $('btnClearQueue');
const btnDrawerShuffle = $('btnDrawerShuffle');
const btnDrawerClose = $('btnDrawerClose');
const volume = $('volume');
const seek = $('seek');
const seekCanvas = $('seekCanvas');
const seekCtx = seekCanvas.getContext('2d');
const seekPlayhead = $('seekPlayhead');
const seekTip = $('seekTip');
const timeCur = $('timeCur');
const timeDur = $('timeDur');
const playerWave = $('playerWave');
const waveCtx = playerWave.getContext('2d');
const drawer = $('drawer');
const scrim = $('scrim');
const queueList = $('queueList');
const queueCount = $('queueCount');
const fileInput = $('fileInput');
const dropOverlay = $('dropOverlay');
const toast = $('toast');
const btnEq = $('btnEq');
const eqPanel = $('eqPanel');
const btnEqClose = $('btnEqClose');
const eqPresets = $('eqPresets');
const eqSliders = $('eqSliders');
const eqToggle = $('eqToggle');
const eqReset = $('eqReset');
const eqCurve = $('eqCurve');
const hidePlayerToggle = $('hidePlayerToggle');
const btnHidePlayer = $('btnHidePlayer');
const miniPlayer = $('miniPlayer');
const miniPlay = $('miniPlay');
const miniShow = $('miniShow');

const engine = new AudioEngine();
const spectrum = engine.spectrum;

const PALETTES = [
  [262, 191, 320],
  [12, 42, 333],
  [172, 205, 282],
  [92, 168, 205],
  [44, 188, 318],
  [220, 285, 22],
  [332, 266, 190],
  [201, 164, 48],
  [286, 210, 44],
  [350, 30, 205],
];

const state = {
  tracks: [],
  index: -1,
  lastTrackId: null,
  scene: 0,
  shuffle: false,
  repeat: 'off',
  volume: 0.8,
  muted: false,
  eq: defaultEq(),
  hidePlayer: false,
};

let palette = { hues: PALETTES[0] };
let elapsed = 0;
let stageW = 1;
let stageH = 1;
let loadSeq = 0;
let dragDepth = 0;
let toastTimer = 0;
let lastSecond = -1;
let lastDuration = -1;
let lastSeekDraw = 0;
let seekSize = { w: 0, h: 0, dpr: 0 };
let waveSize = { w: 0, h: 0, dpr: 0 };

/* ---------------- Settings ---------------- */

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('prism.settings.v1') || '{}');
    if (Number.isFinite(saved.volume)) state.volume = clamp(saved.volume);
    if (Number.isInteger(saved.scene) && saved.scene >= 0 && saved.scene < scenes.length) {
      state.scene = saved.scene;
    }
    if (['off', 'all', 'one'].includes(saved.repeat)) state.repeat = saved.repeat;
    if (typeof saved.shuffle === 'boolean') state.shuffle = saved.shuffle;
    if (typeof saved.hidePlayer === 'boolean') state.hidePlayer = saved.hidePlayer;
    if (typeof saved.lastTrackId === 'string') state.lastTrackId = saved.lastTrackId;
    if (saved.eq && typeof saved.eq === 'object') {
      const rawGains = Array.isArray(saved.eq.gains) ? saved.eq.gains : [];
      state.eq = {
        enabled: saved.eq.enabled !== false,
        preset: typeof saved.eq.preset === 'string' ? saved.eq.preset : 'custom',
        gains: EQ_BANDS.map((_, index) => {
          const value = Number(rawGains[index]);
          return Number.isFinite(value) ? clamp(value, EQ_MIN, EQ_MAX) : 0;
        }),
      };
    }
  } catch {
    /* ignore bad saved state */
  }
}

function saveSettings() {
  try {
    localStorage.setItem(
      'prism.settings.v1',
      JSON.stringify({
        volume: state.volume,
        scene: state.scene,
        repeat: state.repeat,
        shuffle: state.shuffle,
        eq: state.eq,
        hidePlayer: state.hidePlayer,
        lastTrackId: state.tracks[state.index]?.id || state.lastTrackId || null,
      }),
    );
  } catch {
    /* private mode */
  }
}

/* ---------------- Palette ---------------- */

function applyPalette(hues) {
  palette = { hues };
  const [h1, h2] = hues;
  const root = document.documentElement.style;
  root.setProperty('--accent', `hsl(${h1} 92% 68%)`);
  root.setProperty('--accent-2', `hsl(${h2} 92% 64%)`);
  root.setProperty('--accent-soft', `hsla(${h1} 100% 62% / 0.16)`);
  root.setProperty('--accent-2-soft', `hsla(${h2} 100% 62% / 0.14)`);
}

/* ---------------- Scene rail ---------------- */

function buildSceneChips() {
  sceneChips.replaceChildren();
  scenes.forEach((scene, i) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = scene.name;
    chip.setAttribute('role', 'tab');
    chip.setAttribute('aria-selected', 'false');
    chip.addEventListener('click', () => setScene(i, true));
    sceneChips.appendChild(chip);
  });
}

function setScene(index, scroll = false) {
  state.scene = (index + scenes.length) % scenes.length;
  const scene = scenes[state.scene];
  sceneName.textContent = scene.name;
  sceneKicker.textContent = `Scene ${String(state.scene + 1).padStart(2, '0')} / ${scenes.length}`;
  [...sceneChips.children].forEach((chip, i) => {
    const active = i === state.scene;
    chip.classList.toggle('is-active', active);
    chip.setAttribute('aria-selected', String(active));
    if (active && scroll) {
      chip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  });
  saveSettings();
}

/* ---------------- Track lifecycle ---------------- */

function uid() {
  return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

async function addFiles(fileList) {
  const files = Array.from(fileList || []);
  const audioFiles = files.filter(isAudioFile);
  if (!audioFiles.length) {
    showToast(
      files.length
        ? 'Those files are not audio. Try MP3, FLAC, WAV, OGG, OPUS, M4A, AAC or AIFF.'
        : 'No files found.',
      3600,
    );
    return;
  }

  try {
    await engine.ensureContext();
  } catch {
    showToast('This browser does not support the Web Audio API.', 4000);
    return;
  }

  showToast(`Reading ${audioFiles.length === 1 ? 'track' : `${audioFiles.length} tracks`}…`, 1400);

  const startIndex = state.tracks.length;
  const created = await Promise.all(
    audioFiles.map(async (file, i) => {
      let meta = { title: file.name.replace(/\.[^.]+$/, ''), artist: 'Unknown artist', album: '', art: null, artBlob: null };
      try {
        meta = await readMetadata(file);
      } catch {
        /* keep filename fallback */
      }
      return {
        id: uid(),
        file,
        url: URL.createObjectURL(file),
        mime: mimeFor(file),
        format: formatLabel(file),
        title: meta.title,
        artist: meta.artist,
        album: meta.album,
        art: meta.art,
        artBlob: meta.artBlob || null,
        peaks: null,
        duration: 0,
        order: startIndex + i,
        addedAt: Date.now() + i,
      };
    }),
  );

  const wasEmpty = state.tracks.length === 0;
  state.tracks.push(...created);
  renderQueue();
  updateEmpty();

  saveTracks(created).catch((err) => console.warn('Could not save tracks to IndexedDB:', err));

  if (wasEmpty) {
    await playIndex(0);
  } else {
    showToast(
      `${created.length} track${created.length === 1 ? '' : 's'} added to the queue`,
      2200,
    );
  }
}

function selectTrack(track) {
  trackTitle.textContent = track.title;
  trackSub.textContent = track.artist + (track.album ? ` · ${track.album}` : '');
  formatBadge.textContent = track.format;
  document.title = `${track.title} — Prism`;

  if (track.art) {
    coverImg.src = track.art;
    coverImg.hidden = false;
  } else {
    coverImg.removeAttribute('src');
    coverImg.hidden = true;
  }

  const seed = hashString(`${track.title}${track.artist}${track.format}`);
  applyPalette(PALETTES[seed % PALETTES.length]);
  drawEqCurve();
}

async function playIndex(index, { autoplay = true } = {}) {
  const track = state.tracks[index];
  if (!track) return;

  const seq = ++loadSeq;
  state.index = index;
  state.lastTrackId = track.id;
  saveSettings();
  selectTrack(track);
  renderQueue();
  scrollQueueActive();
  player.classList.add('is-loading');

  const ok = await engine.load(track);
  if (seq !== loadSeq) return;
  player.classList.remove('is-loading');

  if (!ok) {
    engine.pause();
    showToast(
      `Couldn't decode “${track.title}” (${track.format}) in this browser.`,
      4200,
    );
    updateTransport();
    return;
  }

  if (engine.duration > 0 && (!track.duration || track.duration !== engine.duration)) {
    track.duration = engine.duration;
    updateTrackMetadata(track.id, { duration: track.duration }).catch(console.warn);
  }

  renderQueue();
  updateTransport();

  if (autoplay) {
    const started = await engine.play();
    if (seq !== loadSeq) return;
    if (!started) showToast('Press play to start the audio.', 2600);
  }
  updateTransport();
  pokeActivity();
}

function nextIndex({ auto = false } = {}) {
  const n = state.tracks.length;
  if (!n) return -1;
  if (state.shuffle && n > 1) {
    let pick = state.index;
    while (pick === state.index) pick = Math.floor(Math.random() * n);
    return pick;
  }
  const next = state.index + 1;
  if (next >= n) {
    if (auto && state.repeat !== 'all') return -1;
    return 0;
  }
  return next;
}

function playNext(options = {}) {
  const index = nextIndex(options);
  if (index >= 0) playIndex(index);
  else updateTransport();
}

async function playPrevious() {
  if (!state.tracks.length) return;
  if (engine.ready && engine.currentTime > 3) {
    await engine.seek(0);
    updateTransport();
    return;
  }
  const n = state.tracks.length;
  playIndex(state.index <= 0 ? n - 1 : state.index - 1);
}

function removeTrack(index) {
  const track = state.tracks[index];
  if (!track) return;
  if (track.url) URL.revokeObjectURL(track.url);
  if (track.art) URL.revokeObjectURL(track.art);
  state.tracks.splice(index, 1);

  deleteTrack(track.id).catch(console.warn);
  syncTrackOrder(state.tracks).catch(console.warn);

  if (state.index === index) {
    engine.pause();
    engine.token += 1;
    engine.track = null;
    engine.ready = false;
    if (!state.tracks.length) {
      resetPlayer();
    } else {
      playIndex(Math.min(index, state.tracks.length - 1));
    }
  } else if (state.index > index) {
    state.index -= 1;
  }

  saveSettings();
  renderQueue();
  updateEmpty();
}

function clearQueue() {
  if (!state.tracks.length) return;
  state.tracks.forEach((track) => {
    if (track.url) URL.revokeObjectURL(track.url);
    if (track.art) URL.revokeObjectURL(track.art);
  });
  state.tracks = [];
  state.lastTrackId = null;
  saveSettings();
  clearAllTracks().catch(console.warn);
  resetPlayer();
  showToast('Queue cleared', 1800);
}

function resetPlayer() {
  state.index = -1;
  engine.pause();
  engine.token += 1;
  engine.track = null;
  engine.ready = false;
  engine.duration = 0;
  engine.peaks = null;
  loadSeq += 1;
  player.classList.remove('is-loading', 'is-playing');
  trackTitle.textContent = 'Nothing playing';
  trackSub.textContent = 'Drop a track to begin';
  formatBadge.textContent = 'AUDIO';
  coverImg.hidden = true;
  coverImg.removeAttribute('src');
  document.title = 'Prism — Audio Visualizer';
  applyPalette(PALETTES[0]);
  updateTransport();
  updateEmpty();
  renderQueue();
}

async function shufflePlayQueue() {
  const n = state.tracks.length;
  if (!n) return;

  state.shuffle = true;
  btnShuffle.classList.add('is-on');
  btnShuffle.setAttribute('aria-pressed', 'true');
  saveSettings();

  let pick = 0;
  if (n > 1) {
    pick = Math.floor(Math.random() * n);
    if (pick === state.index && n > 1) {
      pick = (pick + 1) % n;
    }
  }

  showToast('Shuffle play', 1500);
  await playIndex(pick, { autoplay: true });
  pokeActivity();
}

/* ---------------- Queue UI ---------------- */

function renderQueue() {
  queueList.replaceChildren();
  const n = state.tracks.length;
  queueCount.textContent = n ? `${n} track${n === 1 ? '' : 's'} in queue` : 'No tracks yet';
  if (btnClearQueue) {
    btnClearQueue.hidden = n === 0;
  }
  if (btnDrawerShuffle) {
    btnDrawerShuffle.hidden = n === 0;
  }
  const drawerAdd = $('drawerAdd');
  if (drawerAdd) {
    drawerAdd.classList.toggle('is-full', n === 0);
    const span = drawerAdd.querySelector('span');
    if (span) {
      span.textContent = n === 0 ? 'Add audio files' : 'Add audio';
    }
  }

  if (!n) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'queue-empty';
    emptyItem.textContent = 'Your queue is empty. Drop audio files anywhere, or use “Add audio files” above.';
    queueList.appendChild(emptyItem);
    return;
  }

  state.tracks.forEach((track, i) => {
    const li = document.createElement('li');
    li.className = 'queue-item';
    li.dataset.index = String(i);
    li.tabIndex = 0;
    li.classList.toggle('is-active', i === state.index);
    li.title = `${track.title} — ${track.artist}`;

    const art = document.createElement('div');
    art.className = 'queue-art';
    if (track.art) {
      const img = document.createElement('img');
      img.src = track.art;
      img.alt = '';
      art.appendChild(img);
    } else {
      art.textContent = String(i + 1).padStart(2, '0');
    }

    const text = document.createElement('div');
    text.className = 'queue-text';
    const title = document.createElement('div');
    title.className = 'queue-name';
    title.textContent = track.title;
    const artist = document.createElement('div');
    artist.className = 'queue-artist';
    artist.textContent = `${track.artist} · ${track.format}`;
    text.append(title, artist);

    const dur = document.createElement('span');
    dur.className = 'queue-dur';
    dur.textContent = track.duration ? formatTime(track.duration) : '—';

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'queue-remove';
    remove.setAttribute('aria-label', `Remove ${track.title}`);
    remove.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    remove.addEventListener('click', (event) => {
      event.stopPropagation();
      removeTrack(i);
    });

    li.addEventListener('click', () => playIndex(i));
    li.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        playIndex(i);
      }
    });

    li.append(art, text, dur, remove);
    queueList.appendChild(li);
  });

  scrollQueueActive();
}

function scrollQueueActive() {
  if (!drawer.classList.contains('is-open')) return;
  const active = queueList.querySelector('.queue-item.is-active');
  if (active) active.scrollIntoView({ block: 'nearest' });
}

function updateEmpty() {
  empty.classList.toggle('is-hidden', state.tracks.length > 0);
}

function setDrawer(open) {
  drawer.classList.toggle('is-open', open);
  scrim.classList.toggle('is-open', open);
  drawer.setAttribute('aria-hidden', String(!open));
  btnQueue.classList.toggle('is-on', open);
  if (open) {
    setEqPanel(false);
    renderQueue();
    scrollQueueActive();
  }
  pokeActivity();
}

/* ---------------- Equalizer & view panel ---------------- */

let eqCurveCtx = null;
let eqCurveSize = { w: 0, h: 0, dpr: 0 };

function signedDb(value) {
  const rounded = Math.round(value);
  return rounded > 0 ? `+${rounded}` : String(rounded);
}

function buildEqUI() {
  eqPresets.replaceChildren();
  for (const preset of EQ_PRESETS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'eq-preset';
    button.dataset.preset = preset.id;
    button.textContent = preset.name;
    button.addEventListener('click', () => applyEqPreset(preset));
    eqPresets.appendChild(button);
  }

  eqSliders.replaceChildren();
  EQ_BANDS.forEach((band, index) => {
    const row = document.createElement('div');
    row.className = 'eq-band';

    const label = document.createElement('span');
    label.className = 'eq-hz';
    label.textContent = band.label;

    const input = document.createElement('input');
    input.type = 'range';
    input.className = 'eq-range';
    input.min = String(EQ_MIN);
    input.max = String(EQ_MAX);
    input.step = '1';
    input.setAttribute('aria-label', `${band.freq} Hz`);

    const value = document.createElement('span');
    value.className = 'eq-value';

    input.addEventListener('input', () => {
      state.eq.gains[index] = Number(input.value);
      state.eq.preset = 'custom';
      state.eq.enabled = true;
      engine.setEq(state.eq);
      syncEqUI();
      saveSettings();
    });

    row.append(label, input, value);
    eqSliders.appendChild(row);
  });
}

function syncEqUI() {
  eqPanel.classList.toggle('is-bypassed', !state.eq.enabled);
  eqToggle.setAttribute('aria-checked', String(state.eq.enabled));
  eqToggle.setAttribute('aria-label', state.eq.enabled ? 'Disable equalizer' : 'Enable equalizer');

  [...eqSliders.children].forEach((row, index) => {
    const input = row.querySelector('input');
    const value = row.querySelector('.eq-value');
    const gain = state.eq.gains[index] ?? 0;
    input.value = String(gain);
    value.textContent = signedDb(gain);
  });

  [...eqPresets.children].forEach((button) => {
    button.classList.toggle('is-active', button.dataset.preset === state.eq.preset);
  });

  hidePlayerToggle.setAttribute('aria-checked', String(state.hidePlayer));
  drawEqCurve();
}

function applyEqPreset(preset) {
  state.eq.gains = [...preset.gains];
  state.eq.preset = preset.id;
  state.eq.enabled = true;
  engine.setEq(state.eq);
  syncEqUI();
  saveSettings();
}

function approximateEqCurve(freqs) {
  const bandLogs = EQ_BANDS.map((band) => Math.log10(band.freq));
  const gains = state.eq.gains;
  const values = new Float32Array(freqs.length);

  for (let i = 0; i < freqs.length; i++) {
    const log = Math.log10(freqs[i]);
    if (log <= bandLogs[0]) {
      values[i] = gains[0];
    } else if (log >= bandLogs[bandLogs.length - 1]) {
      values[i] = gains[gains.length - 1];
    } else {
      let band = 0;
      while (band < bandLogs.length - 2 && log > bandLogs[band + 1]) band++;
      const span = bandLogs[band + 1] - bandLogs[band];
      const t = clamp((log - bandLogs[band]) / span);
      const smooth = t * t * (3 - 2 * t);
      values[i] = gains[band] + (gains[band + 1] - gains[band]) * smooth;
    }
  }
  return values;
}

function drawEqCurve() {
  if (!eqPanel.classList.contains('is-open')) return;
  const rect = eqCurve.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  if (!eqCurveCtx) eqCurveCtx = eqCurve.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(rect.width);
  const h = Math.round(rect.height);
  if (eqCurveSize.w !== w || eqCurveSize.h !== h || eqCurveSize.dpr !== dpr) {
    eqCurve.width = Math.round(w * dpr);
    eqCurve.height = Math.round(h * dpr);
    eqCurveSize = { w, h, dpr };
  }

  const ctx = eqCurveCtx;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const [h1, h2] = palette.hues;
  const mid = h * 0.56;
  const maxDb = 16;
  const yFor = (db) => clamp(mid - (db / maxDb) * (mid - 12), 4, h - 18);
  const xFor = (freq) => (Math.log10(freq / 20) / Math.log10(20000 / 20)) * w;

  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  for (const freq of [100, 1000, 10000]) {
    const x = xFor(freq);
    ctx.beginPath();
    ctx.moveTo(x, 6);
    ctx.lineTo(x, h - 16);
    ctx.stroke();
  }
  for (const db of [-12, 0, 12]) {
    const y = yFor(db);
    ctx.strokeStyle = db === 0 ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  const points = 160;
  const freqs = new Float32Array(points);
  for (let i = 0; i < points; i++) {
    freqs[i] = 20 * Math.pow(1000, i / (points - 1));
  }
  const curve = approximateEqCurve(freqs);
  const offset = state.eq.enabled ? 0 : 0.03;

  // filled boost/cut area
  ctx.beginPath();
  for (let i = 0; i < points; i++) {
    const x = xFor(freqs[i]);
    const y = yFor(curve[i] + offset);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  for (let i = points - 1; i >= 0; i--) {
    ctx.lineTo(xFor(freqs[i]), yFor(0));
  }
  ctx.closePath();
  const fill = ctx.createLinearGradient(0, 8, 0, h - 18);
  fill.addColorStop(0, hsla(h1, 100, 65, state.eq.enabled ? 0.2 : 0.07));
  fill.addColorStop(1, hsla(h2, 100, 65, state.eq.enabled ? 0.04 : 0.02));
  ctx.fillStyle = fill;
  ctx.fill();

  // curve
  ctx.beginPath();
  for (let i = 0; i < points; i++) {
    const x = xFor(freqs[i]);
    const y = yFor(curve[i] + offset);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  const stroke = ctx.createLinearGradient(0, 0, w, 0);
  stroke.addColorStop(0, hsla(h2, 100, 70, state.eq.enabled ? 0.95 : 0.35));
  stroke.addColorStop(0.5, hsla(h1, 100, 72, state.eq.enabled ? 0.95 : 0.35));
  stroke.addColorStop(1, hsla(h2, 100, 70, state.eq.enabled ? 0.95 : 0.35));
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.shadowColor = hsla(h1, 100, 65, state.eq.enabled ? 0.5 : 0.15);
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // band nodes
  const nodeFreqs = new Float32Array(EQ_BANDS.length);
  EQ_BANDS.forEach((band, index) => {
    nodeFreqs[index] = band.freq;
  });
  const nodeValues = approximateEqCurve(nodeFreqs);
  EQ_BANDS.forEach((band, index) => {
    const x = xFor(band.freq);
    const y = yFor(nodeValues[index] + offset);
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = state.eq.enabled ? '#fff' : 'rgba(255,255,255,0.5)';
    ctx.shadowColor = hsla(h1, 100, 70, 0.7);
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
  });
}

function setEqPanel(open) {
  eqPanel.classList.toggle('is-open', open);
  eqPanel.setAttribute('aria-hidden', String(!open));
  btnEq.classList.toggle('is-on', open);
  if (open) {
    drawEqCurve();
    requestAnimationFrame(drawEqCurve);
  }
  pokeActivity();
}

function setHidePlayer(hidden, notify = true) {
  state.hidePlayer = hidden;
  document.body.classList.toggle('player-hidden', hidden);
  miniPlayer.hidden = !hidden;
  hidePlayerToggle.setAttribute('aria-checked', String(hidden));
  btnHidePlayer.classList.toggle('is-on', hidden);
  if (hidden) setEqPanel(false);
  saveSettings();
  if (hidden && notify) showToast('Player hidden — press H to bring it back', 2400);
}

/* ---------------- Transport UI ---------------- */

function updateTransport() {
  const cur = engine.currentTime;
  const dur = engine.duration || 0;
  const second = Math.floor(cur);
  if (second !== lastSecond) {
    timeCur.textContent = formatTime(cur);
    lastSecond = second;
  }
  const durSecond = Math.floor(dur);
  if (durSecond !== lastDuration) {
    timeDur.textContent = formatTime(dur);
    lastDuration = durSecond;
  }

  const progress = dur > 0 ? cur / dur : 0;
  seekPlayhead.style.left = `${(clamp(progress) * 100).toFixed(3)}%`;
  seek.setAttribute('aria-valuenow', String(Math.round(clamp(progress) * 100)));
  seek.setAttribute('aria-valuetext', formatTime(cur));

  const playing = engine.playing;
  player.classList.toggle('is-playing', playing);
  btnPlay.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  miniPlay.classList.toggle('is-playing', playing);
  miniPlay.setAttribute('aria-label', playing ? 'Pause' : 'Play');
}

function drawSeek(force = false) {
  const now = performance.now();
  if (!force && now - lastSeekDraw < 55) return;
  lastSeekDraw = now;

  const rect = seek.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(rect.width);
  const h = Math.round(rect.height);
  if (seekSize.w !== w || seekSize.h !== h || seekSize.dpr !== dpr) {
    seekCanvas.width = Math.round(w * dpr);
    seekCanvas.height = Math.round(h * dpr);
    seekSize = { w, h, dpr };
  }

  seekCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  seekCtx.clearRect(0, 0, w, h);
  const mid = h / 2;
  const progress = engine.duration ? clamp(engine.currentTime / engine.duration) : 0;
  const split = w * progress;
  const peaks = engine.peaks;

  const accent = seekCtx.createLinearGradient(0, 0, w, 0);
  accent.addColorStop(0, hsla(palette.hues[2], 95, 66, 0.9));
  accent.addColorStop(0.5, hsla(palette.hues[0], 95, 70, 0.95));
  accent.addColorStop(1, hsla(palette.hues[1], 95, 70, 0.9));

  if (peaks && peaks.length) {
    const bars = Math.max(40, Math.floor(w / 3));
    const per = peaks.length / bars;
    const bw = 2;
    const step = w / bars;
    const barH = (value) => Math.max(2, Math.pow(value, 0.72) * (h - 12));

    for (let i = 0; i < bars; i++) {
      let max = 0;
      const start = Math.floor(i * per);
      const end = Math.max(start + 1, Math.floor((i + 1) * per));
      for (let j = start; j < end && j < peaks.length; j++) {
        if (peaks[j] > max) max = peaks[j];
      }
      const bh = barH(max);
      const x = i * step;
      const played = x + bw / 2 <= split;
      seekCtx.fillStyle = played ? accent : 'rgba(255,255,255,0.16)';
      roundRect(seekCtx, x, mid - bh / 2, bw, bh, 1);
      seekCtx.fill();
    }
  } else {
    roundRect(seekCtx, 0, mid - 1.5, w, 3, 2);
    seekCtx.fillStyle = 'rgba(255,255,255,0.14)';
    seekCtx.fill();
    if (progress > 0) {
      const grad = seekCtx.createLinearGradient(0, 0, Math.max(1, split), 0);
      grad.addColorStop(0, hsla(palette.hues[2], 95, 66, 0.9));
      grad.addColorStop(1, hsla(palette.hues[1], 95, 70, 0.9));
      roundRect(seekCtx, 0, mid - 1.5, Math.max(2, split), 3, 2);
      seekCtx.fillStyle = grad;
      seekCtx.fill();
    }
  }
}

/* ---------------- Now-playing wave ---------------- */

function resizePlayerWave() {
  const rect = playerWave.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  if (waveSize.w === w && waveSize.h === h && waveSize.dpr === dpr) return;
  playerWave.width = Math.round(w * dpr);
  playerWave.height = Math.round(h * dpr);
  waveSize = { w, h, dpr };
}

function drawPlayerWave() {
  if (state.hidePlayer) return;
  if (playerWave.clientWidth !== waveSize.w || playerWave.clientHeight !== waveSize.h) {
    resizePlayerWave();
  }
  const { w, h, dpr } = waveSize;
  if (!w || !h) return;

  waveCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  waveCtx.clearRect(0, 0, w, h);

  const wave = spectrum.wave;
  const last = wave.length - 1;
  const mid = h * 0.52;
  const amp = Math.min(h * 0.26, 20) * (0.4 + spectrum.level * 1.5 + spectrum.bass * 0.3);
  const [h1, h2, h3] = palette.hues;
  const step = 3;
  const count = Math.max(4, Math.floor(w / step));
  const at = (u) => wave[Math.min(last, Math.max(0, Math.round(u * last)))];
  const playing = engine.playing;
  // When paused, keep a slow standing ripple so the bar never looks dead.
  const shape = (u) => {
    if (playing) return at(u);
    return (
      Math.sin(u * 20 + elapsed * 1.1) * 0.42 +
      Math.sin(u * 47 - elapsed * 0.8) * 0.16
    );
  };

  const grad = waveCtx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, hsla(h3, 100, 62, 0.12));
  grad.addColorStop(0.5, hsla(h1, 100, 70, 0.22));
  grad.addColorStop(1, hsla(h2, 100, 66, 0.12));

  // Mirrored ribbon: the loud waveform hugs its reflection.
  waveCtx.beginPath();
  for (let i = 0; i <= count; i++) {
    const u = i / count;
    const y = mid - Math.abs(shape(u)) * amp;
    if (i === 0) waveCtx.moveTo(0, y);
    else waveCtx.lineTo(u * w, y);
  }
  for (let i = count; i >= 0; i--) {
    const u = i / count;
    waveCtx.lineTo(u * w, mid + Math.abs(shape(u)) * amp);
  }
  waveCtx.closePath();
  waveCtx.fillStyle = grad;
  waveCtx.fill();

  waveCtx.save();
  waveCtx.globalCompositeOperation = 'lighter';
  for (let pass = 0; pass < 2; pass++) {
    waveCtx.beginPath();
    for (let i = 0; i <= count; i++) {
      const u = i / count;
      const sway = Math.sin(u * 7 + elapsed * (pass ? -0.9 : 1.2) + pass * 1.8);
      const v = shape(u) * (pass ? 0.72 : 1) + sway * (0.02 + spectrum.level * 0.05);
      const y = mid + v * amp;
      if (i === 0) waveCtx.moveTo(0, y);
      else waveCtx.lineTo(u * w, y);
    }
    waveCtx.strokeStyle = pass ? hsla(h2, 100, 74, 0.14) : hsla(h1, 100, 78, 0.26);
    waveCtx.lineWidth = pass ? 1 : 1.5;
    waveCtx.stroke();
  }
  waveCtx.restore();
}

function setVolume(value) {
  state.volume = clamp(value);
  engine.setVolume(state.volume);
  volume.value = String(Math.round(state.volume * 100));
  volume.style.setProperty('--vol', `${Math.round(state.volume * 100)}%`);
  saveSettings();
}

function setMuted(muted) {
  state.muted = muted;
  engine.setMuted(muted);
  btnMute.classList.toggle('is-muted', muted);
  btnMute.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
}

/* ---------------- Seek interaction ---------------- */

let scrubbing = false;

function seekFromEvent(event) {
  const rect = seek.getBoundingClientRect();
  const ratio = clamp((event.clientX - rect.left) / rect.width);
  if (!engine.ready) return;
  return ratio * (engine.duration || 0);
}

function handleSeekMove(event) {
  const rect = seek.getBoundingClientRect();
  const ratio = clamp((event.clientX - rect.left) / rect.width);
  seekTip.style.left = `${ratio * 100}%`;
  const time = engine.duration ? ratio * engine.duration : 0;
  seekTip.textContent = formatTime(time);
}

seek.addEventListener('pointerdown', async (event) => {
  if (!engine.ready) return;
  scrubbing = true;
  pokeActivity();
  seek.setPointerCapture(event.pointerId);
  handleSeekMove(event);
  const time = seekFromEvent(event);
  if (time != null) await engine.seek(time);
  updateTransport();
  drawSeek(true);
});

seek.addEventListener('pointermove', (event) => {
  handleSeekMove(event);
  pokeActivity();
  if (!scrubbing) return;
  const time = seekFromEvent(event);
  if (time != null) engine.seek(time);
  updateTransport();
  drawSeek(true);
});

function endScrub(event) {
  if (!scrubbing) return;
  scrubbing = false;
  try {
    seek.releasePointerCapture(event.pointerId);
  } catch {
    /* already released */
  }
  pokeActivity();
}

seek.addEventListener('pointerup', endScrub);
seek.addEventListener('pointercancel', endScrub);
seek.addEventListener('mouseleave', () => {
  if (!scrubbing) seekTip.style.opacity = '0';
});
seek.addEventListener('mouseenter', () => {
  if (engine.duration) seekTip.style.opacity = '';
});

/* ---------------- File input / drag & drop ---------------- */

function openFilePicker() {
  fileInput.click();
}

[$('btnAdd'), $('btnEmptyAdd'), $('drawerAdd')].forEach((button) => {
  button.addEventListener('click', openFilePicker);
});

fileInput.addEventListener('change', () => {
  addFiles(fileInput.files);
  fileInput.value = '';
});

window.addEventListener('dragenter', (event) => {
  if (!event.dataTransfer || ![...event.dataTransfer.types].includes('Files')) return;
  event.preventDefault();
  dragDepth += 1;
  dropOverlay.classList.add('is-active');
});

window.addEventListener('dragover', (event) => {
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
});

window.addEventListener('dragleave', (event) => {
  if (!event.dataTransfer) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) dropOverlay.classList.remove('is-active');
});

window.addEventListener('drop', (event) => {
  event.preventDefault();
  dragDepth = 0;
  dropOverlay.classList.remove('is-active');
  if (event.dataTransfer?.files?.length) addFiles(event.dataTransfer.files);
});

window.addEventListener('blur', () => {
  dragDepth = 0;
  dropOverlay.classList.remove('is-active');
});

/* ---------------- Auto-hide controls during playback ---------------- */

let idleTimer = null;
let isHoveringControls = false;
const IDLE_TIMEOUT_MS = 3500;

function isOverlayActive() {
  return (
    drawer.classList.contains('is-open') ||
    eqPanel.classList.contains('is-open') ||
    dropOverlay.classList.contains('is-active')
  );
}

function setIdle(idle) {
  if (idle) {
    if (!engine.playing || isOverlayActive() || isHoveringControls || scrubbing) return;
    document.body.classList.add('is-idle');
  } else {
    document.body.classList.remove('is-idle');
  }
}

function pokeActivity() {
  setIdle(false);
  clearTimeout(idleTimer);
  if (engine.playing && !isOverlayActive() && !isHoveringControls && !scrubbing) {
    idleTimer = window.setTimeout(() => setIdle(true), IDLE_TIMEOUT_MS);
  }
}

// User activity listeners
['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((eventName) => {
  window.addEventListener(eventName, pokeActivity, { passive: true });
});

// Do not hide when the cursor is over interactive controls
[player, sceneBar, document.querySelector('.topbar'), eqPanel, drawer].forEach((el) => {
  if (!el) return;
  el.addEventListener('pointerenter', () => {
    isHoveringControls = true;
    pokeActivity();
  });
  el.addEventListener('pointerleave', () => {
    isHoveringControls = false;
    pokeActivity();
  });
});

/* ---------------- Transport bindings ---------------- */

async function togglePlayback() {
  if (!state.tracks.length) {
    openFilePicker();
    return;
  }
  if (!engine.ready) {
    playIndex(Math.max(0, state.index));
    return;
  }
  if (engine.playing) {
    engine.pause();
  } else {
    const ok = await engine.play();
    if (!ok) showToast('Playback was blocked. Tap play again.', 2600);
  }
  updateTransport();
  pokeActivity();
}

btnPlay.addEventListener('click', togglePlayback);
miniPlay.addEventListener('click', togglePlayback);
miniShow.addEventListener('click', () => setHidePlayer(false));
btnHidePlayer.addEventListener('click', () => setHidePlayer(true));
hidePlayerToggle.addEventListener('click', () => setHidePlayer(!state.hidePlayer));

btnEq.addEventListener('click', () => setEqPanel(!eqPanel.classList.contains('is-open')));
btnEqClose.addEventListener('click', () => setEqPanel(false));

eqToggle.addEventListener('click', () => {
  state.eq.enabled = !state.eq.enabled;
  engine.setEq(state.eq);
  syncEqUI();
  saveSettings();
});

eqReset.addEventListener('click', () => applyEqPreset(EQ_PRESETS[0]));

document.addEventListener('pointerdown', (event) => {
  if (!eqPanel.classList.contains('is-open')) return;
  if (event.target instanceof Node && (eqPanel.contains(event.target) || btnEq.contains(event.target))) {
    return;
  }
  setEqPanel(false);
});

btnNext.addEventListener('click', () => playNext());
btnPrev.addEventListener('click', playPrevious);

btnShuffle.addEventListener('click', () => {
  state.shuffle = !state.shuffle;
  btnShuffle.classList.toggle('is-on', state.shuffle);
  btnShuffle.setAttribute('aria-pressed', String(state.shuffle));
  showToast(state.shuffle ? 'Shuffle on' : 'Shuffle off', 1400);
  saveSettings();
});

btnRepeat.addEventListener('click', () => {
  state.repeat = state.repeat === 'off' ? 'all' : state.repeat === 'all' ? 'one' : 'off';
  btnRepeat.classList.toggle('is-on', state.repeat !== 'off');
  btnRepeat.classList.toggle('is-repeat-one', state.repeat === 'one');
  btnRepeat.setAttribute('aria-label', `Repeat ${state.repeat}`);
  showToast(
    state.repeat === 'off' ? 'Repeat off' : state.repeat === 'all' ? 'Repeat queue' : 'Repeat one',
    1400,
  );
  saveSettings();
});

btnMute.addEventListener('click', () => setMuted(!state.muted));

volume.addEventListener('input', () => setVolume(Number(volume.value) / 100));

btnQueue.addEventListener('click', () => setDrawer(!drawer.classList.contains('is-open')));
btnDrawerClose.addEventListener('click', () => setDrawer(false));
btnClearQueue?.addEventListener('click', clearQueue);
btnDrawerShuffle?.addEventListener('click', shufflePlayQueue);
scrim.addEventListener('click', () => setDrawer(false));

$('btnFullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    showToast('Fullscreen is unavailable in this browser.', 2400);
  }
});

/* ---------------- Keyboard ---------------- */

document.addEventListener('keydown', (event) => {
  const target = event.target;
  if (target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
    return;
  }
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.code === 'Space' && target instanceof HTMLElement && target.closest('button, a')) {
    return;
  }

  switch (event.code) {
    case 'Space':
      event.preventDefault();
      btnPlay.click();
      break;
    case 'ArrowRight':
      if (event.shiftKey) playNext();
      else if (engine.ready) engine.seek(engine.currentTime + 5);
      event.preventDefault();
      break;
    case 'ArrowLeft':
      if (event.shiftKey) playPrevious();
      else if (engine.ready) engine.seek(engine.currentTime - 5);
      event.preventDefault();
      break;
    case 'ArrowUp':
      event.preventDefault();
      setVolume(state.volume + 0.05);
      break;
    case 'ArrowDown':
      event.preventDefault();
      setVolume(state.volume - 0.05);
      break;
    case 'KeyM':
      setMuted(!state.muted);
      break;
    case 'KeyS':
      btnShuffle.click();
      break;
    case 'KeyV':
      setScene(state.scene + (event.shiftKey ? -1 : 1), true);
      break;
    case 'KeyF':
      $('btnFullscreen').click();
      break;
    case 'KeyP':
      setDrawer(!drawer.classList.contains('is-open'));
      break;
    case 'KeyE':
      setEqPanel(!eqPanel.classList.contains('is-open'));
      break;
    case 'KeyH':
      setHidePlayer(!state.hidePlayer);
      break;
    case 'Escape':
      if (eqPanel.classList.contains('is-open')) {
        setEqPanel(false);
      } else if (drawer.classList.contains('is-open')) {
        setDrawer(false);
      } else if (state.hidePlayer) {
        setHidePlayer(false);
      }
      break;
    case 'BracketRight':
      setScene(state.scene + 1, true);
      break;
    case 'BracketLeft':
      setScene(state.scene - 1, true);
      break;
    default:
      if (/^Digit[1-9]$/.test(event.code)) {
        const index = Number(event.code.slice(5)) - 1;
        if (index < scenes.length) setScene(index, true);
      }
  }
});

/* ---------------- Engine events ---------------- */

engine.onended = () => {
  pokeActivity();
  if (state.repeat === 'one') {
    engine.seek(0).then(() => engine.play());
    updateTransport();
    return;
  }
  playNext({ auto: true });
};

engine.onpeaks = () => {
  drawSeek(true);
  if (engine.track?.id) {
    updateTrackMetadata(engine.track.id, {
      peaks: engine.track.peaks,
      duration: engine.track.duration,
    }).catch(console.warn);
  }
};

/* ---------------- Toast ---------------- */

function showToast(message, duration = 2200) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), duration);
}

/* ---------------- Canvas stage ---------------- */

function resizeStage() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const maxPixels = 3300;
  const w = Math.max(1, window.innerWidth);
  const h = Math.max(1, window.innerHeight);
  const effective = Math.min(dpr, maxPixels / w);
  stageW = w;
  stageH = h;
  stage.width = Math.round(w * effective);
  stage.height = Math.round(h * effective);
  stage.dataset.dpr = String(effective);
  seekSize = { w: 0, h: 0, dpr: 0 };
  drawSeek(true);
  resizePlayerWave();
  drawEqCurve();
  const activeChip = sceneChips.querySelector('.chip.is-active');
  activeChip?.scrollIntoView({ inline: 'center', block: 'nearest' });
}

function drawStage(dt) {
  const dpr = Number(stage.dataset.dpr) || 1;
  sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  sctx.clearRect(0, 0, stageW, stageH);

  const scene = scenes[state.scene];
  const frame = {
    ctx: sctx,
    w: stageW,
    h: stageH,
    dpr,
    t: elapsed,
    dt,
    bands: spectrum.bands,
    wave: spectrum.wave,
    bass: spectrum.bass,
    mid: spectrum.mid,
    treble: spectrum.treble,
    level: spectrum.level,
    energy: spectrum.energy,
    beat: spectrum.beat,
    beatStrength: spectrum.beatStrength,
    playing: engine.playing,
    spectrum,
    palette,
  };

  try {
    scene.draw(frame);
  } catch (error) {
    console.error(`Scene ${scene.id} failed`, error);
  }
}

let lastFrame = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - lastFrame) / 1000));
  lastFrame = now;
  elapsed += dt;

  spectrum.update(dt, engine.playing);
  drawStage(dt);
  updateTransport();
  drawSeek();
  drawPlayerWave();

  requestAnimationFrame(frame);
}

/* ---------------- Desktop window chrome ---------------- */

function initDesktopChrome() {
  const desktop = window.prismDesktop;
  if (!desktop) return;

  document.body.classList.add('is-desktop');
  const controls = $('windowControls');
  controls.hidden = false;

  const maxButton = controls.querySelector('[data-win-action="maximize"]');
  controls
    .querySelector('[data-win-action="minimize"]')
    .addEventListener('click', () => desktop.minimize());
  maxButton.addEventListener('click', () => desktop.toggleMaximize());
  controls
    .querySelector('[data-win-action="close"]')
    .addEventListener('click', () => desktop.close());

  const setMaximized = (value) => {
    const maximized = Boolean(value);
    document.body.classList.toggle('is-maximized', maximized);
    maxButton.setAttribute('aria-label', maximized ? 'Restore window' : 'Maximize window');
    maxButton.title = maximized ? 'Restore' : 'Maximize';
  };

  desktop.onMaximizedChange?.(setMaximized);
  Promise.resolve(desktop.isMaximized?.())
    .then(setMaximized)
    .catch(() => {});

  document.querySelector('.topbar')?.addEventListener('dblclick', (event) => {
    if (event.target instanceof Element && event.target.closest('button, a, input')) return;
    desktop.toggleMaximize();
  });
}

async function initStoredTracks() {
  try {
    const stored = await loadTracks();
    if (!stored || !stored.length) return;

    state.tracks.push(...stored);
    renderQueue();
    updateEmpty();

    let targetIndex = 0;
    if (state.lastTrackId) {
      const found = state.tracks.findIndex((t) => t.id === state.lastTrackId);
      if (found >= 0) targetIndex = found;
    }

    await playIndex(targetIndex, { autoplay: false });
  } catch (error) {
    console.warn('Failed restoring stored tracks:', error);
  }
}

/* ---------------- Init ---------------- */

loadSettings();
initDesktopChrome();
buildSceneChips();
setScene(state.scene);
requestAnimationFrame(() => {
  const activeChip = sceneChips.querySelector('.chip.is-active');
  activeChip?.scrollIntoView({ inline: 'center', block: 'nearest' });
});
applyPalette(PALETTES[0]);
buildEqUI();
engine.setEq(state.eq);
syncEqUI();
setHidePlayer(state.hidePlayer, false);

btnShuffle.classList.toggle('is-on', state.shuffle);
btnShuffle.setAttribute('aria-pressed', String(state.shuffle));
btnRepeat.classList.toggle('is-on', state.repeat !== 'off');
btnRepeat.classList.toggle('is-repeat-one', state.repeat === 'one');
btnRepeat.setAttribute('aria-label', `Repeat ${state.repeat}`);
volume.value = String(Math.round(state.volume * 100));
volume.style.setProperty('--vol', `${Math.round(state.volume * 100)}%`);
engine.setVolume(state.volume);
window.addEventListener('resize', resizeStage);
document.addEventListener('fullscreenchange', resizeStage);
resizeStage();
renderQueue();
updateEmpty();
updateTransport();

initStoredTracks();

requestAnimationFrame((now) => {
  lastFrame = now;
  frame(now);
});

// Debug / automation surface.
window.__prism = {
  addFiles,
  playIndex,
  setScene,
  clearQueue,
  shufflePlayQueue,
  loadTracks,
  engine,
  spectrum,
  state,
  scenes,
};
