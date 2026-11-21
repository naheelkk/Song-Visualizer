/**
 * Desktop development: start Vite, then launch Electron pointed at the server.
 * Quitting the Electron window shuts the dev server down again.
 */
import { spawn } from 'node:child_process';
import electron from 'electron';
import { createServer } from 'vite';

const server = await createServer({
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: false,
  },
});

await server.listen();
const url =
  server.resolvedUrls?.local?.[0] || `http://127.0.0.1:${server.config.server.port}/`;

console.log(`\n  Prism desktop dev server: ${url}\n`);

const child = spawn(electron, ['.'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_DEV_SERVER_URL: url },
});

let closing = false;
async function shutdown(code = 0) {
  if (closing) return;
  closing = true;
  try {
    await server.close();
  } catch {
    /* already closed */
  }
  process.exit(code);
}

child.on('close', (code) => shutdown(code ?? 0));
child.on('error', (error) => {
  console.error('Failed to launch Electron:', error);
  shutdown(1);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    child.kill();
    shutdown(0);
  });
}
