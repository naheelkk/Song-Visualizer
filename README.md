# Prism — audio visualizer & player

A modern, local-first music player with 23 real-time visualizer scenes. Ships as a Windows desktop app (Electron) and runs unchanged in the browser from the same codebase.

![Prism](https://img.shields.io/badge/audio-MP3%20%C2%B7%20FLAC%20%C2%B7%20WAV%20%C2%B7%20OGG%20%C2%B7%20OPUS%20%C2%B7%20M4A%20%C2%B7%20AAC%20%C2%B7%20AIFF-7c5cff)

## Windows app

```bash
npm install
npm run app:dev      # desktop window with hot reload
npm run dist:win     # build the installer + portable exe
```

`dist:win` writes:

- `release/Prism-Setup-1.0.0.exe` — per-user installer (choose install folder, desktop/Start-menu shortcuts)
- `release/Prism-Portable-1.0.0.exe` — single portable executable
- `release/win-unpacked/Prism.exe` — unpacked build

The window is frameless with a draggable top bar and custom minimize / maximize / close controls. Window size and position are remembered between launches. `npm start` runs the last production build directly in Electron.

The builds are **not code-signed**, so Windows SmartScreen may show “Windows protected your PC” on first launch — choose **More info → Run anyway**.

## Browser version

```bash
npm install
npm run dev
```

Open the printed URL, then drag audio anywhere onto the page or use **Add audio**.

```bash
npm run build && npm run preview   # production web build
```

## Features

- **Any format the browser can decode** — playback streams through an `<audio>` element, and falls back to Web Audio `decodeAudioData` when the element can't handle the codec. MP3, FLAC, WAV, OGG/Opus, M4A/AAC, AIFF, WebM and more (exact list depends on Chromium's codecs).
- **23 visualizers** — Aurora Bars, Polar Bloom, Neon Scope, Particle Field, Synth Terrain, Pulse Rings, Liquid Orb, Warp Drive, Neon Tunnel, Kaleidoscope, LED Matrix, Orbit Scope, Synth Sunset, Silk Ribbons, Spectrogram, Nebula Sphere, Neon City, Ripple Tank, Vortex, Storm, Sonar, Crystal, Filigree.
- **Six-band equalizer** — Flat, Bass, Vocal, Electronic, Rock, Lo-Fi and Night presets plus per-band sliders, an EQ curve graph, bypass and reset. The EQ sits before the analyser, so the visuals react to the shaped sound. Settings persist between sessions.
- **In sync with the song** — the analyser taps the graph before the DAC, so scenes are automatically held back by the device's combined `baseLatency` + `outputLatency`. Beat detection, bands and waveform all move together, and the delay is re-measured every couple of seconds.
- **Live wave in the player** — the now-playing bar carries an audio-reactive mirrored waveform drawn from the same latency-compensated signal as the scenes, with a slow standing ripple when paused.
- **Hide the player** — collapse the whole player bar to a small floating control (button, `H`, or the switch in the EQ panel) when you just want visuals. `Esc` or the expand button brings it back.
- **Real player** — drag & drop, queue, next/previous, shuffle, repeat (queue/one), seekable waveform, volume/mute, autoplay next.
- **Metadata** — reads ID3v2 (MP3) and FLAC tags including embedded cover art; falls back to "Artist - Title" filenames.
- **Adaptive look** — each track derives a color palette that drives the UI and all scenes.
- **Keyboard-first** — see shortcuts below. Works on mobile browsers too.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play / pause |
| `←` / `→` | Seek 5 seconds |
| `Shift + ←` / `Shift + →` | Previous / next track |
| `↑` / `↓` | Volume |
| `M` | Mute |
| `V` / `[` `]` | Next / previous scene |
| `1` – `9` | Jump to scene |
| `E` | Equalizer & settings panel |
| `H` | Hide / show the player bar |
| `P` | Queue panel |
| `F` | Fullscreen |
| `Esc` | Close panel / show player |

## Structure

```
index.html
vite.config.js            relative base for file:// loading in Electron
electron/
  main.cjs                window, IPC, state persistence, smoke test
  preload.cjs             safe desktop bridge (window controls only)
  dev.mjs                 Vite + Electron dev launcher
build/
  icon.png                app icon
  make-icon.mjs           dependency-free icon generator
src/
  main.js                 app state, transport, EQ panel, queue, shortcuts
  styles.css
  lib/
    engine.js             audio element + decoded-buffer playback, EQ chain, analyser routing
    eq.js                 band definitions and presets
    spectrum.js           log-spaced bands, energy, beat detection, latency delay, history
    metadata.js           ID3v2 / FLAC tag + artwork parsing, peaks
    helpers.js
  visualizers/
    index.js              scene registry
    *.js                  one file per scene
```

Each scene exports `{ id, name, draw(frame) }`, where `frame` includes the canvas, dimensions, time, smoothed `bands`, `wave`, energy values, beat pulse, spectral history and the active palette. Add a file and register it in `src/visualizers/index.js` to extend the list.

## Checks

`PRISM_SMOKE_TEST=1 npx electron .` (or `npm run app:dev` in development) launches the app, generates a short WAV, sends it through the real import/playback pipeline, verifies the canvas, scene count and window bridge, prints a `SMOKE_RESULT` line and quits. The same flag works against the packaged `release/win-unpacked/Prism.exe`.

## Notes

- Everything happens locally; files never leave the device.
- Formats Chromium cannot decode (for example WMA) will show a decode error instead of playing.
- Waveform peaks are precomputed for files under 48 MB / 15 minutes; longer tracks use a progress-style seek bar.
