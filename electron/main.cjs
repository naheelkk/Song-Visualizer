const { app, BrowserWindow, Menu, ipcMain, screen, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const isDev = !app.isPackaged;
const devUrl = process.env.VITE_DEV_SERVER_URL;
let mainWindow = null;
let saveTimer = null;

const stateFile = () => path.join(app.getPath('userData'), 'window-state.json');

function readWindowState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
  } catch {
    return {};
  }
}

function validBounds(bounds) {
  if (!bounds) return null;
  const values = [bounds.x, bounds.y, bounds.width, bounds.height];
  if (!values.every(Number.isFinite)) return null;
  if (bounds.width < 960 || bounds.height < 620) return null;

  return screen.getAllDisplays().some((display) => {
    const area = display.workArea;
    const overlapX =
      bounds.x < area.x + area.width - 80 && bounds.x + bounds.width > area.x + 80;
    const overlapY =
      bounds.y < area.y + area.height - 80 && bounds.y + bounds.height > area.y + 80;
    return overlapX && overlapY;
  })
    ? bounds
    : null;
}

function persistWindowState(win) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!win || win.isDestroyed()) return;
    try {
      fs.mkdirSync(path.dirname(stateFile()), { recursive: true });
      fs.writeFileSync(
        stateFile(),
        JSON.stringify({ bounds: win.getNormalBounds(), maximized: win.isMaximized() }),
      );
    } catch {
      /* persistence is best-effort */
    }
  }, 400);
}

function sendMaximizedState(win) {
  if (!win.isDestroyed()) {
    win.webContents.send('window:maximized', win.isMaximized());
  }
}

function defaultBounds() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  return {
    width: Math.max(960, Math.min(1440, width - 80)),
    height: Math.max(620, Math.min(900, height - 80)),
  };
}

function createWindow() {
  const saved = readWindowState();
  const bounds = validBounds(saved.bounds) || defaultBounds();
  const state = { bounds, maximized: Boolean(saved.maximized) };

  const win = new BrowserWindow({
    ...bounds,
    minWidth: 960,
    minHeight: 620,
    show: false,
    frame: false,
    backgroundColor: '#05060a',
    title: 'Prism',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  mainWindow = win;
  if (state.maximized) win.maximize();

  win.once('ready-to-show', () => {
    win.show();
    if (process.env.PRISM_SMOKE_TEST) runSmokeTest(win);
  });

  win.on('maximize', () => sendMaximizedState(win));
  win.on('unmaximize', () => sendMaximizedState(win));
  win.on('resize', () => persistWindowState(win));
  win.on('move', () => persistWindowState(win));
  win.on('close', () => persistWindowState(win));

  // Keep the app self-contained: external links go to the default browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    const isDevNavigation = isDev && devUrl && url.startsWith(devUrl);
    if (!isDevNavigation) event.preventDefault();
  });

  if (isDev && devUrl) {
    win.loadURL(devUrl);
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  return win;
}

/** Optional launch check: PRISM_SMOKE_TEST=1 npm run app:dev */
async function runSmokeTest(win) {
  try {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const result = await win.webContents.executeJavaScript(`(async () => {
      // Generate a short tone and feed it through the real file pipeline.
      function toneFile(seconds) {
        const rate = 44100;
        const frames = rate * seconds;
        const buffer = new ArrayBuffer(44 + frames * 2);
        const view = new DataView(buffer);
        const write = (offset, text) => {
          for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
        };
        write(0, 'RIFF');
        view.setUint32(4, 36 + frames * 2, true);
        write(8, 'WAVE');
        write(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, rate, true);
        view.setUint32(28, rate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        write(36, 'data');
        view.setUint32(40, frames * 2, true);
        for (let i = 0; i < frames; i++) {
          view.setInt16(44 + i * 2, Math.sin((2 * Math.PI * 440 * i) / rate) * 0.35 * 32767, true);
        }
        return new File([buffer], 'smoke-test.wav', { type: 'audio/wav' });
      }

      await window.__prism.addFiles([toneFile(2)]);
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const canvas = document.getElementById('stage');
      const engine = window.__prism.engine;
      let analyserMax = 0;
      if (engine.analyser) {
        const data = new Uint8Array(engine.analyser.frequencyBinCount);
        engine.analyser.getByteFrequencyData(data);
        for (const value of data) if (value > analyserMax) analyserMax = value;
      }
      return {
        title: document.title,
        scenes: window.__prism.scenes.length,
        chips: document.querySelectorAll('.chip').length,
        desktopBridge: Boolean(window.prismDesktop),
        desktopClass: document.body.classList.contains('is-desktop'),
        controlsVisible: !document.getElementById('windowControls').hidden,
        trackTitle: document.getElementById('trackTitle').textContent,
        trackFormat: document.getElementById('formatBadge').textContent,
        ready: engine.ready,
        mode: engine.mode,
        playing: engine.playing,
        time: Number(engine.currentTime.toFixed(2)),
        analyserMax,
        level: Number(window.__prism.spectrum.level.toFixed(3)),
        canvas: canvas ? [canvas.width, canvas.height] : null,
        playerWave: (() => {
          const wave = document.getElementById('playerWave');
          return wave ? [wave.width, wave.height] : null;
        })()
      };
    })()`);
    console.log(`SMOKE_RESULT ${JSON.stringify(result)}`);

    await win.webContents.executeJavaScript(
      `document.querySelector('[data-win-action="maximize"]').click()`,
    );
    await new Promise((resolve) => setTimeout(resolve, 350));
    const maximized = win.isMaximized();
    await win.webContents.executeJavaScript(
      `document.querySelector('[data-win-action="maximize"]').click()`,
    );
    await new Promise((resolve) => setTimeout(resolve, 350));
    console.log(`SMOKE_WINDOW ${JSON.stringify({ maximized, restored: !win.isMaximized() })}`);
  } catch (error) {
    console.error(`SMOKE_ERROR ${error && error.message ? error.message : error}`);
    process.exitCode = 1;
  } finally {
    setTimeout(() => app.quit(), 400);
  }
}

function windowFromEvent(event) {
  return BrowserWindow.fromWebContents(event.sender);
}

ipcMain.on('window:minimize', (event) => windowFromEvent(event)?.minimize());
ipcMain.on('window:toggle-maximize', (event) => {
  const win = windowFromEvent(event);
  if (!win) return;
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
});
ipcMain.on('window:close', (event) => windowFromEvent(event)?.close());
ipcMain.handle('window:is-maximized', (event) => windowFromEvent(event)?.isMaximized() ?? false);

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    app.setAppUserModelId('com.prism.visualizer');
    Menu.setApplicationMenu(null);
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
