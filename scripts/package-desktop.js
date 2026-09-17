const fs = require('node:fs/promises');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');

const root = path.resolve(__dirname, '..');
const target = process.argv[2];
const stage = path.join(root, 'artifacts', 'desktop-app');
const run = (file, args) => {
  const result = spawnSync(process.execPath, [file, ...args], { cwd: root, stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Build step failed: ${file} (exit ${result.status})`);
};

(async () => {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 12)) throw new Error('Desktop packaging requires Node.js 22.12.0 or newer.');
  if (!['windows', 'linux'].includes(target)) throw new Error('Usage: node scripts/package-desktop.js windows|linux [--dir]');
  run(path.join(root, 'scripts/build.js'), []);
  await fs.rm(stage, { recursive: true, force: true });
  await fs.mkdir(stage, { recursive: true });
  await fs.cp(path.join(root, 'dist'), path.join(stage, 'dist'), { recursive: true });
  await fs.cp(path.join(root, 'desktop'), path.join(stage, 'desktop'), { recursive: true, filter: source => !source.endsWith('builder.cjs') });
  const metadata = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  await fs.writeFile(path.join(stage, 'package.json'), JSON.stringify({ name: 'orangewood', version: metadata.version, description: '甜橙谷 · 黑潮纪事', main: 'desktop/main.cjs', author: metadata.author || 'Orangewood contributors', license: metadata.license }, null, 2));
  const builder = require.resolve('electron-builder/cli.js');
  run(builder, ['--config', 'desktop/builder.cjs', target === 'windows' ? '--win' : '--linux', '--x64', ...(process.argv.includes('--dir') ? ['--dir'] : []), '--publish', 'never']);
  const packedFiles = require('@electron/asar').listPackage(path.join(root, 'release', target === 'windows' ? 'win-unpacked' : 'linux-unpacked', 'resources', 'app.asar'));
  if (packedFiles.some(file => /^\/node_modules\/|\/tests\/|\/\.git\//.test(file))) throw new Error('Desktop archive unexpectedly contains development dependencies or repository files.');
  const platform = target === 'windows' ? 'win' : 'linux';
  const baseName = `Orangewood-${metadata.version}-${platform}-x64`;
  const archive = `${baseName}.${target === 'windows' ? 'zip' : 'tar.gz'}`;
  const report = { generatedAt: new Date().toISOString(), version: metadata.version, target: `${platform}-x64`, nativeBuild: (target === 'windows' && process.platform === 'win32') || (target === 'linux' && process.platform === 'linux'), steamworksConfigured: false, content: JSON.parse(await fs.readFile(path.join(stage, 'dist/release.json'), 'utf8')) };
  if (!process.argv.includes('--dir')) {
    const bytes = await fs.readFile(path.join(root, 'release', archive));
    report.archive = { file: archive, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  }
  await fs.writeFile(path.join(root, 'release', `${baseName}.build.json`), JSON.stringify(report, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
