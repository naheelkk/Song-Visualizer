import { Spectrum } from './spectrum.js';
import { computePeaks } from './metadata.js';
import { clamp } from './helpers.js';
import { EQ_BANDS, EQ_MIN, EQ_MAX, defaultEq } from './eq.js';

/**
 * Playback engine.
 *  - "element" mode streams through an <audio> element (most formats).
 *  - "buffer"  mode decodes with Web Audio when the element can't handle
 *    the codec, so unusual formats still play and visualize.
 * Both paths feed the same analyser, so scenes behave identically.
 */
export class AudioEngine {
  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'metadata';
    this.audio.crossOrigin = 'anonymous';

    this.ctx = null;
    this.analyser = null;
    this.gain = null;
    this.source = null;
    this.filters = null;
    this.eqInput = null;
    this.eq = defaultEq();
    this.latencyMs = 0;
    this.spectrum = new Spectrum(null);

    this.track = null;
    this.mode = 'element';
    this.playing = false;
    this.ready = false;
    this.volume = 0.8;
    this.muted = false;

    this.buffer = null;
    this.bufferNode = null;
    this.bufferStart = 0;
    this.bufferOffset = 0;
    this.offset = 0;
    this.duration = 0;
    this.peaks = null;

    this.token = 0;
    this.loading = false;

    this.onended = null;
    this.onerror = null;
    this.onpeaks = null;

    this.audio.addEventListener('ended', () => {
      if (this.mode !== 'element' || this.loading) return;
      this.playing = false;
      this.offset = this.duration;
      this.onended?.();
    });
  }

  get effectiveVolume() {
    return this.muted ? 0 : this.volume;
  }

  get currentTime() {
    if (this.mode === 'buffer') {
      if (this.bufferNode && this.playing && this.ctx) {
        return clamp(this.bufferOffset + (this.ctx.currentTime - this.bufferStart), 0, this.duration);
      }
      return clamp(this.offset, 0, this.duration || 0);
    }
    return clamp(this.audio.currentTime || 0, 0, this.duration || 0);
  }

  async ensureContext() {
    if (!this.ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) throw new Error('Web Audio is not supported in this browser.');
      const ctx = new Ctor();
      this.ctx = ctx;
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.55;
      this.analyser.minDecibels = -88;
      this.analyser.maxDecibels = -18;
      this.gain = ctx.createGain();
      this.gain.gain.value = this.effectiveVolume;
      this.audio.volume = 1;

      // Graphic EQ sits before the analyser so scenes react to the shaped sound.
      this.filters = EQ_BANDS.map((band) => {
        const filter = ctx.createBiquadFilter();
        filter.type = band.kind;
        filter.frequency.value = band.freq;
        filter.Q.value = 1.05;
        return filter;
      });
      for (let i = 0; i < this.filters.length - 1; i++) {
        this.filters[i].connect(this.filters[i + 1]);
      }
      this.eqInput = this.filters[0];
      this._applyEq(true);

      this.source = ctx.createMediaElementSource(this.audio);
      this.source.connect(this.eqInput);
      this.filters[this.filters.length - 1].connect(this.analyser);
      this.analyser.connect(this.gain);
      this.gain.connect(ctx.destination);
      this.spectrum.setAnalyser(this.analyser, ctx.sampleRate);
      this._updateLatency();
    }
    if (this.ctx.state !== 'running') {
      try {
        await this.ctx.resume();
      } catch {
        /* user gesture may still be required */
      }
    }
    this._updateLatency();
    if (!this._latencyTimer && typeof window !== 'undefined') {
      this._latencyTimer = window.setInterval(() => this._updateLatency(), 2000);
    }
    return this.ctx;
  }

  _updateLatency() {
    if (!this.ctx) return;
    const base = Number(this.ctx.baseLatency) || 0;
    const output = Number(this.ctx.outputLatency) || 0;
    this.latencyMs = (base + output) * 1000;
    this.spectrum.setLatency(base + output);
  }

  setEq(eq) {
    const gains = EQ_BANDS.map((_, index) => {
      const value = Number(eq?.gains?.[index]);
      return Number.isFinite(value) ? clamp(value, EQ_MIN, EQ_MAX) : 0;
    });
    this.eq = {
      enabled: eq?.enabled !== false,
      preset: eq?.preset || 'custom',
      gains,
    };
    this._applyEq();
  }

  _applyEq(immediate = false) {
    if (!this.filters || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.filters.forEach((filter, index) => {
      const gain = this.eq.enabled ? this.eq.gains[index] : 0;
      if (immediate) filter.gain.value = gain;
      else filter.gain.setTargetAtTime(gain, now, 0.03);
    });
  }

  canStream(track) {
    if (!track.mime) return false;
    try {
      return this.audio.canPlayType(track.mime) !== '';
    } catch {
      return false;
    }
  }

  async load(track) {
    const token = ++this.token;
    this.loading = true;
    this.ready = false;
    this.pause();
    this._stopBuffer();
    this.track = track;
    this.mode = 'element';
    this.buffer = null;
    this.peaks = track.peaks || null;
    this.duration = track.duration || 0;
    this.offset = 0;

    const streamable = this.canStream(track);
    let ok = false;

    if (streamable) {
      this.audio.src = track.url;
      this.audio.load();
      ok = await this._waitForMetadata(token);
    }

    if (token !== this.token) return false;

    if (!ok) {
      ok = await this._loadDecoded(track, token);
    } else {
      this.duration = Number.isFinite(this.audio.duration) && this.audio.duration > 0
        ? this.audio.duration
        : this.duration;
      track.duration = this.duration;
      this._preparePeaks(track, token);
    }

    this.loading = false;
    this.ready = ok;
    return ok;
  }

  _waitForMetadata(token) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.audio.removeEventListener('loadedmetadata', onMeta);
        this.audio.removeEventListener('error', onError);
        this.audio.removeEventListener('abort', onError);
        resolve(ok && token === this.token);
      };
      const onMeta = () => finish(Number.isFinite(this.audio.duration) && this.audio.duration > 0);
      const onError = () => finish(false);
      const timer = setTimeout(() => finish(false), 6000);
      this.audio.addEventListener('loadedmetadata', onMeta);
      this.audio.addEventListener('error', onError);
      this.audio.addEventListener('abort', onError);
      if (this.audio.readyState >= 1 && Number.isFinite(this.audio.duration)) finish(true);
    });
  }

  async _loadDecoded(track, token) {
    if (!this.ctx) return false;
    try {
      this.audio.pause();
      this.audio.removeAttribute('src');
      this.audio.load();
      const raw = await track.file.arrayBuffer();
      if (token !== this.token) return false;
      const buffer = await this.ctx.decodeAudioData(raw);
      if (token !== this.token) return false;
      this.mode = 'buffer';
      this.buffer = buffer;
      this.duration = buffer.duration;
      this.peaks = computePeaks(buffer, 640);
      track.peaks = this.peaks;
      track.duration = this.duration;
      this.onpeaks?.();
      return true;
    } catch {
      return false;
    }
  }

  async _preparePeaks(track, token) {
    if (!this.ctx || track.peaks) return;
    if (track.file.size > 48 * 1024 * 1024 || this.duration > 15 * 60) return;
    try {
      const raw = await track.file.arrayBuffer();
      if (token !== this.token) return;
      const buffer = await this.ctx.decodeAudioData(raw);
      if (token !== this.token) return;
      this.peaks = computePeaks(buffer, 640);
      track.peaks = this.peaks;
      this.onpeaks?.();
    } catch {
      /* waveform stays a progress bar */
    }
  }

  async play() {
    if (!this.track || !this.ready) return false;
    await this.ensureContext();
    if (this.mode === 'buffer') {
      if (!this.buffer) return false;
      if (this.offset >= this.duration - 0.05) this.offset = 0;
      this._startBuffer(this.offset);
    } else {
      try {
        await this.audio.play();
      } catch {
        return false;
      }
    }
    this.playing = true;
    return true;
  }

  pause() {
    if (this.mode === 'buffer') {
      const at = this.currentTime;
      this.playing = false;
      this.offset = at;
      this._stopBuffer();
    } else {
      this.playing = false;
      this.audio.pause();
    }
  }

  async toggle() {
    if (this.playing) {
      this.pause();
      return false;
    }
    return this.play();
  }

  async seek(time) {
    const target = clamp(time, 0, Math.max(0, this.duration - 0.03));
    if (this.mode === 'buffer') {
      this.offset = target;
      if (this.playing) {
        await this.ensureContext();
        this._startBuffer(target);
      }
    } else if (this.audio.readyState > 0) {
      try {
        this.audio.currentTime = target;
      } catch {
        /* ignore seek race while loading */
      }
    }
  }

  setVolume(value) {
    this.volume = clamp(value);
    if (this.gain && this.ctx) {
      this.gain.gain.setTargetAtTime(this.effectiveVolume, this.ctx.currentTime, 0.02);
    } else {
      this.audio.volume = this.effectiveVolume;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.gain && this.ctx) {
      this.gain.gain.setTargetAtTime(this.effectiveVolume, this.ctx.currentTime, 0.02);
    } else {
      this.audio.volume = this.effectiveVolume;
    }
  }

  _startBuffer(offset) {
    if (!this.ctx || !this.buffer) return;
    this._stopBuffer();
    const node = this.ctx.createBufferSource();
    node.buffer = this.buffer;
    node.connect(this.eqInput || this.analyser);
    const start = clamp(offset, 0, Math.max(0, this.buffer.duration - 0.02));
    node.start(0, start);

    this.bufferNode = node;
    this.bufferStart = this.ctx.currentTime;
    this.bufferOffset = start;
    this.playing = true;

    node.onended = () => {
      if (this.bufferNode !== node) return;
      this.bufferNode = null;
      this.playing = false;
      this.offset = this.duration;
      this.onended?.();
    };
  }

  _stopBuffer() {
    const node = this.bufferNode;
    if (!node) return;
    this.bufferNode = null;
    node.onended = null;
    try {
      node.stop();
    } catch {
      /* already stopped */
    }
    node.disconnect();
  }
}
