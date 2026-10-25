import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!process.argv[2]) throw new Error('Specify an output directory outside the project.');
const output = path.resolve(process.argv[2]);
const outputRelative = path.relative(project, output);
if (!outputRelative || (!outputRelative.startsWith('..' + path.sep) && outputRelative !== '..' && !path.isAbsolute(outputRelative))) throw new Error('Output must be outside the project.');
for (const name of ['package-lock.json', 'server.js', 'dist/index.html']) {
  if (!fs.statSync(path.join(project, name)).isFile()) throw new Error('Build the project first.');
}
const manifestPackage = JSON.parse(fs.readFileSync(path.join(project, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(project, 'package-lock.json'), 'utf8'));
const lockedPackage = lock.packages?.[''];
if (lock.lockfileVersion !== 3 || !lockedPackage) throw new Error('A current npm package-lock.json is required.');
for (const field of ['dependencies', 'devDependencies']) {
  const expected = Object.entries(manifestPackage[field] || {});
  if (expected.length !== Object.keys(lockedPackage[field] || {}).length || expected.some(([name, value]) => lockedPackage[field]?.[name] !== value)) {
    throw new Error('package.json and package-lock.json differ; run npm install, npm ci and verification before release.');
  }
}
for (const name of ['body-parser', 'ip-address']) {
  const version = manifestPackage.overrides?.[name];
  const found = Object.entries(lock.packages).filter(([location]) => location.endsWith('/node_modules/' + name) || location === 'node_modules/' + name);
  if (!version || !found.length || found.some(([, details]) => details.version !== version)) throw new Error('Required security override is missing from lock: ' + name);
}
fs.mkdirSync(output, { recursive: true });
const staging = fs.mkdtempSync(path.join(output, 'release-'));
// Explicit allowlist: never copy .env, customer data, device keys or Windows dependencies.
const entries = [
  'package.json', 'package-lock.json', '.env.example', '.gitignore', 'server.js', 'server.ts', 'dist', 'src', 'server',
  'scripts', 'tests', 'index.html', 'tsconfig.json', 'vite.config.ts',
  'ecosystem.config.cjs', 'nginx.conf.example', 'deploy-vps.sh',
  'README.md', 'DEPLOY_GUIDE_AZ.md', 'ORACLE_DEPLOY_AZ.md',
];
if (fs.existsSync(path.join(project, 'public'))) entries.push('public');
const manifest = [];
function copy(relative) {
  const source = path.join(project, relative);
  const stat = fs.lstatSync(source);
  const basename = path.basename(relative);
  if (stat.isSymbolicLink()) throw new Error('Symlinks are not allowed in a release: ' + relative);
  if ((basename.startsWith('.env') && basename !== '.env.example') ||
      (basename === 'data' && relative !== path.join('src', 'data')) ||
      ['node_modules', '.git', '.device-cookie-key'].includes(basename) || basename.startsWith('.preview')) {
    throw new Error('Private/runtime path in release: ' + relative);
  }
  const target = path.join(staging, relative);
  if (stat.isDirectory()) {
    fs.mkdirSync(target, { recursive: true });
    for (const child of fs.readdirSync(source)) copy(path.join(relative, child));
  } else if (stat.isFile()) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (relative.endsWith('.sh')) fs.writeFileSync(target, fs.readFileSync(source, 'utf8').replaceAll('\r\n', '\n'));
    else fs.copyFileSync(source, target);
    manifest.push(relative.replaceAll(path.sep, '/'));
  } else throw new Error('Unsupported release entry: ' + relative);
}
for (const name of entries) copy(name);
const archive = path.join(output, 'emgraphic-oracle-release.tar.gz');
const result = spawnSync('tar', ['-czf', archive, '-C', staging, ...entries], { encoding: 'utf8', windowsHide: true });
if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr);
const digest = createHash('sha256').update(fs.readFileSync(archive)).digest('hex');
fs.writeFileSync(archive + '.sha256', digest + '  ' + path.basename(archive) + '\n');
fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify({ files: manifest.sort(), sha256: digest }, null, 2) + '\n');
if (path.dirname(staging) !== output || !path.basename(staging).startsWith('release-')) throw new Error('Invalid staging cleanup path.');
fs.rmSync(staging, { recursive: true });
console.log('Oracle release prepared: ' + archive);
console.log('Files: ' + manifest.length + '; excludes credentials and customer data.');
