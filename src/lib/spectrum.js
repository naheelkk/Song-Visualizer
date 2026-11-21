import { clamp } from './helpers.js';

export const BAND_COUNT = 96;
export const HISTORY_LEN = 180;
const DELAY_FRAMES = 48;

function buildRanges(binCount, sampleRate) {
  const nyquist = sampleRate / 2;
  const fMin = 32;
  const fMax = Math.min(16500, nyquist * 0.92);
  const ratio = fMax / fMin;
  const ranges = new Array(BAND_COUNT);
  for (let i = 0; i < BAND_COUNT; i++) {
    const f0 = fMin * Math.pow(ratio, i / BAND_COUNT);
    const f1 = fMin * Math.pow(ratio, (i + 1) / BAND_COUNT);
    const a = clamp(Math.floor((f0 / nyquist) * binCount), 0, binCount - 1);
    const b = clamp(Math.floor((f1 / nyquist) * binCount), a + 1, binCount);
    ranges[i] = [a, b];
  }
  return ranges;
}

/**
 * Turns raw analyser output into smoothed, log-spaced bands plus
 * energy/beat/history data shared by every visualizer.
 */
export class Spectrum {
  constructor(analyser = null, sampleRate = 44100) {
    this.ranges = buildRanges(1024, sampleRate);
    this.bands = new Float32Array(BAND_COUNT);
    this.scratchBands = new Float32Array(BAND_COUNT);
    this.history = Array.from({ length: HISTORY_LEN }, () => new Float32Array(BAND_COUNT));
    this.head = 0;

    this.latency = 0;
    this._delayFrames = [];
    this._delayHead = 0;
    this._delayCount = 0;

    this.bass = 0;
    this.mid = 0;
    this.treble = 0;
    this.level = 0;
    this.energy = 0;
    this.beat = 0;
    this.beatStrength = 0;
    this.beatAge = 10;
    this.bassAvg = 0;
    this.time = 0;

    this.setAnalyser(analyser, sampleRate);
  }

  setAnalyser(analyser, sampleRate = 44100) {
    this.analyser = analyser;
    const bins = analyser ? analyser.frequencyBinCount : 1024;
    const fftSize = analyser ? analyser.fftSize : 2048;
    this.freq = new Uint8Array(bins);
    this.rawWave = new Uint8Array(fftSize);
    this.waveLength = fftSize / 2;
    this.wave = new Float32Array(this.waveLength);
    this.liveWave = new Float32Array(this.waveLength);
    this.ranges = buildRanges(bins, sampleRate);
    this._buildDelayFrames();
  }

  _buildDelayFrames() {
    this._delayFrames = Array.from({ length: DELAY_FRAMES }, () => ({
      t: -1e9,
      bands: new Float32Array(BAND_COUNT),
      wave: new Float32Array(this.waveLength),
    }));
    this._delayHead = 0;
    this._delayCount = 0;
  }

  /**
   * Hold visual data back by the audio output latency. The analyser taps the
   * graph before the DAC, so without this scenes run slightly ahead of sound.
   */
  setLatency(seconds) {
    this.latency = clamp(Number(seconds) || 0, 0, 0.35);
  }

  /** Latest history frame. age = 0 is now, higher is further back in time. */
  historyFrame(age = 0) {
    const i = (this.head - 1 - age + HISTORY_LEN * 2) % HISTORY_LEN;
    return this.history[i];
  }

  update(dt, playing) {
    dt = Math.min(Math.max(dt, 0.001), 0.05);
    this.time += dt;
    const analyser = this.analyser;
    const live = Boolean(analyser) && playing;
    const wave = this.liveWave;

    if (analyser) {
      analyser.getByteFrequencyData(this.freq);
      if (live) analyser.getByteTimeDomainData(this.rawWave);
    }

    if (live) {
      for (let i = 0; i < wave.length; i++) {
        wave[i] = (this.rawWave[i] - 128) / 128;
      }
    } else {
      // Gentle, self-animating idle signal so the stage never looks dead.
      const t = this.time;
      for (let i = 0; i < wave.length; i++) {
        const x = i / wave.length;
        wave[i] =
          Math.sin(x * 18 + t * 1.1) * 0.02 +
          Math.sin(x * 41 - t * 0.7) * 0.012 +
          Math.sin(x * 7 + t * 0.35) * 0.016;
      }
    }

    const t = this.time;
    for (let i = 0; i < BAND_COUNT; i++) {
      if (live) {
        const range = this.ranges[i];
        let max = 0;
        for (let j = range[0]; j < range[1]; j++) {
          const v = this.freq[j];
          if (v > max) max = v;
        }
        const u = i / (BAND_COUNT - 1);
        this.scratchBands[i] = Math.pow(max / 255, 1.35) * (1 + u * 0.5);
      } else {
        const u = i / (BAND_COUNT - 1);
        const breathe = 0.5 + 0.5 * Math.sin(u * 7.5 - t * 1.15);
        const shimmer = 0.5 + 0.5 * Math.sin(u * 23 + t * 0.55 + 1.7);
        this.scratchBands[i] = 0.055 + 0.075 * breathe * (1 - u * 0.65) + 0.022 * shimmer;
      }
    }

    let targetBands = this.scratchBands;
    let targetWave = wave;

    if (this.latency > 0.002) {
      const now = performance.now() / 1000;
      const head = this._delayFrames[this._delayHead];
      head.t = now;
      head.bands.set(this.scratchBands);
      head.wave.set(wave);
      this._delayHead = (this._delayHead + 1) % DELAY_FRAMES;
      this._delayCount = Math.min(this._delayCount + 1, DELAY_FRAMES);

      const wanted = now - this.latency;
      let chosen = null;
      for (let k = 1; k <= this._delayCount; k++) {
        const frame = this._delayFrames[(this._delayHead - k + DELAY_FRAMES * 2) % DELAY_FRAMES];
        if (frame.t <= wanted) {
          chosen = frame;
          break;
        }
      }
      if (!chosen) {
        chosen = this._delayFrames[(this._delayHead - this._delayCount + DELAY_FRAMES * 2) % DELAY_FRAMES];
      }
      targetBands = chosen.bands;
      targetWave = chosen.wave;
    }

    this.wave.set(targetWave);

    const attack = 1 - Math.exp(-dt * 55);
    const decay = 1 - Math.exp(-dt * 8);
    let sum = 0;

    for (let i = 0; i < BAND_COUNT; i++) {
      const target = targetBands[i];
      const k = target > this.bands[i] ? attack : decay;
      const next = this.bands[i] + (target - this.bands[i]) * k;
      this.bands[i] = clamp(next, 0, 1.35);
      sum += this.bands[i];
    }

    const mean = sum / BAND_COUNT;
    const avg = (a, b) => {
      let s = 0;
      for (let i = a; i < b; i++) s += this.bands[i];
      return s / (b - a);
    };

    const bass = avg(0, 20);
    const mid = avg(20, 56);
    const treble = avg(56, BAND_COUNT);
    const smooth = 1 - Math.exp(-dt * 14);
    this.bass += (bass - this.bass) * smooth;
    this.mid += (mid - this.mid) * smooth;
    this.treble += (treble - this.treble) * smooth;
    this.energy = mean;
    this.level += (clamp(this.bass * 0.55 + this.mid * 0.32 + this.treble * 0.3) - this.level) * (1 - Math.exp(-dt * 12));

    this.bassAvg += (this.bass - this.bassAvg) * (1 - Math.exp(-dt * 2.2));
    this.beatAge += dt;

    const punch = this.bass - this.bassAvg;
    if (live && this.beatAge > 0.15 && this.bass > 0.18 && punch > 0.045) {
      this.beatAge = 0;
      this.beat = 1;
      this.beatStrength = clamp(punch * 2.2);
    } else if (!live) {
      this.beat = 0;
    }
    this.beat = Math.max(0, this.beat - dt * 2.8);

    const frame = this.history[this.head];
    frame.set(this.bands);
    this.head = (this.head + 1) % HISTORY_LEN;
  }
}
