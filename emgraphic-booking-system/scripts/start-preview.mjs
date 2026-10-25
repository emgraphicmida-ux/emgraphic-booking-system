import { existsSync, readFileSync, openSync, closeSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(project, '.env');
const config = existsSync(configPath) ? readFileSync(configPath, 'utf8') : '';
const port = Number(config.match(/^\s*PORT\s*=\s*["']?(\d+)/m)?.[1] || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT in .env');
const base = 'http://127.0.0.1:' + port;

async function apiReady() {
  try {
    const res = await fetch(base + '/api/time', { signal: AbortSignal.timeout(1000) });
    return res.ok && (await res.json()).timeZone === 'Asia/Baku';
  } catch { return false; }
}
async function portInUse() {
  return new Promise(resolve => {
    const socket = createConnection({ host: '127.0.0.1', port });
    let settled = false;
    const done = value => { if (!settled) { settled = true; socket.destroy(); resolve(value); } };
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
    socket.setTimeout(700, () => done(true));
  });
}
async function verify() {
  const page = await fetch(base, { signal: AbortSignal.timeout(3000) });
  const availability = await fetch(base + '/api/availability', { signal: AbortSignal.timeout(3000) });
  if (!page.ok || !availability.ok || !(await availability.json()).success) {
    throw new Error('Server started, but the page or booking API failed. Check .preview.stderr.log.');
  }
}
async function main() {
  if (!await apiReady()) {
    if (await portInUse()) throw new Error('Port ' + port + ' is used by another or unresponsive application. No process was stopped.');
    if (!existsSync(path.join(project, 'server.js')) || !existsSync(path.join(project, 'dist/index.html'))) {
      throw new Error('Build files missing. Run npm install and npm run build first.');
    }
    if (!/^\s*ADMIN_KEY\s*=\s*\S+/m.test(config)) throw new Error('Set ADMIN_KEY in .env before starting.');
    const stdout = openSync(path.join(project, '.preview.stdout.log'), 'a');
    const stderr = openSync(path.join(project, '.preview.stderr.log'), 'a');
    let child, spawnError;
    try {
      child = spawn(process.execPath, ['server.js'], {
        cwd: project, detached: true, windowsHide: true,
        env: { ...process.env, PORT: String(port), NODE_ENV: 'production' },
        stdio: ['ignore', stdout, stderr],
      });
      child.once('error', error => { spawnError = error; });
      child.unref();
      if (child.pid) writeFileSync(path.join(project, '.preview.pid'), String(child.pid));
    } finally { closeSync(stdout); closeSync(stderr); }
    let ready = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      if (spawnError) throw spawnError;
      if (await apiReady()) { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    if (!ready) throw new Error('Server did not start. See .preview.stderr.log.');
  }
  await verify();
  console.log('Preview ready: http://localhost:' + port + '/');
  console.log('Admin panel: http://localhost:' + port + '/admin');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
