const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { SAVE_KEYS, MAX_SAVE_BYTES, createSave, parseSave, writeSaveAtomic } = require('../desktop/portable-save.cjs');
const { START_URL, isGamePage, resolveAsset } = require('../desktop/security.cjs');

const profile = () => ({
  'tafang.campaignProgress': JSON.stringify({ groveGate: { completedAt: 1700000000000, stars: 3, score: 9000 } }),
  'tafang.campaignCheckpoint': null,
  'tafang.settings': JSON.stringify({ sound: false, reducedMotion: true }),
  'tafang.fieldGuide.v1': JSON.stringify(['scout', 'deploy']),
  'tafang.audio.v1': JSON.stringify({ music: .5, ambience: .25, musicMuted: false, ambienceMuted: true }),
  'tafang.guidePreference': JSON.stringify({ dismissed: true })
});

test('desktop asset resolver blocks foreign origins, encoded traversal and Windows separators', () => {
  const root = path.resolve('dist');
  assert.equal(resolveAsset(root, `${START_URL}?v=123`), path.join(root, 'index.html'));
  assert.equal(resolveAsset(root, 'orangewood://game/resources/vendor/tween.umd.js'), path.join(root, 'resources/vendor/tween.umd.js'));
  for (const url of ['file:///etc/passwd', 'https://example.com/index.html', 'orangewood://evil/index.html', 'orangewood://game/%2e%2e%2fpackage.json', 'orangewood://game/%5c..%5csecret', 'orangewood://game/%00', 'orangewood://user@game/index.html']) assert.throws(() => resolveAsset(root, url));
  assert.equal(isGamePage(START_URL), true);
  assert.equal(isGamePage('orangewood://game/frame.html'), false);
  assert.equal(isGamePage('https://game/index.html'), false);
});

test('full save round trips all storage slots and rejects corruption, unknown keys and incompatible formats', () => {
  const save = createSave(profile(), '1.0.0', new Date('2026-09-17T00:00:00.000Z'));
  assert.deepEqual(parseSave(JSON.stringify(save)).values, profile());
  const changed = structuredClone(save); changed.values['tafang.campaignProgress'] = '{}';
  assert.throws(() => parseSave(JSON.stringify(changed)), /校验失败/);
  assert.throws(() => createSave({ ...profile(), secret: 'x' }, '1.0.0'), /未知/);
  assert.throws(() => parseSave(JSON.stringify({ ...save, version: 10 })), /不.*支持/);
  assert.throws(() => parseSave('x'.repeat(MAX_SAVE_BYTES + 1)), /大小/);
  assert.throws(() => createSave({ ...profile(), 'tafang.campaignProgress': '{broken' }, '1.0.0'));
  assert.throws(() => createSave({ ...profile(), 'tafang.settings': '{"sound":"false"}' }, '1.0.0'), /设置/);
});

test('save file replacement is atomic and invalid input cannot overwrite the prior backup', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'orangewood-save-test-'));
  try {
    const destination = path.join(directory, 'save.json');
    const original = createSave(profile(), '1.0.0');
    await writeSaveAtomic(destination, original);
    await assert.rejects(writeSaveAtomic(destination, { ...original, sha256: 'broken' }));
    assert.deepEqual(parseSave(await fs.readFile(destination, 'utf8')), original);
    const replacement = createSave({ ...profile(), 'tafang.campaignProgress': '{}' }, '1.0.0');
    await writeSaveAtomic(destination, replacement);
    assert.deepEqual(parseSave(await fs.readFile(destination, 'utf8')), replacement);
    assert.deepEqual(await fs.readdir(directory), ['save.json']);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('import is applied on the next document before game boot, surviving old-page autosave', async () => {
  const source = await fs.readFile(path.join(__dirname, '../desktop/preload.cjs'), 'utf8');
  const storage = initial => {
    const data = new Map(Object.entries(initial));
    return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
  };
  const localStorage = storage(profile()), sessionStorage = storage({}), replies = [];
  let handler;
  const context = { localStorage, sessionStorage, require: name => { assert.equal(name, 'electron'); return { ipcRenderer: { on: (_channel, fn) => { handler = fn; }, send: (channel, payload) => replies.push({ channel, payload }) } }; } };
  vm.runInNewContext(source, { ...context });
  const imported = { ...profile(), 'tafang.campaignProgress': '{}', 'tafang.settings': null };
  handler(null, { id: 'import-1', action: 'apply', values: imported });
  assert.equal(replies[0].payload.ok, true);
  assert.equal(localStorage.getItem('tafang.campaignProgress'), profile()['tafang.campaignProgress']);
  localStorage.setItem('tafang.campaignProgress', profile()['tafang.campaignProgress']);
  vm.runInNewContext(source, { ...context });
  assert.deepEqual(Object.fromEntries(SAVE_KEYS.map(key => [key, localStorage.getItem(key)])), imported);
  assert.equal(sessionStorage.getItem('orangewood.pendingImport'), null);
});

test('desktop preload collects only game saves and never exposes Node or arbitrary IPC to page', async () => {
  const source = await fs.readFile(path.join(__dirname, '../desktop/preload.cjs'), 'utf8');
  let handler, response;
  const values = profile();
  vm.runInNewContext(source, { localStorage: { getItem: key => values[key] ?? 'private-data' }, sessionStorage: { getItem: () => null }, require: () => ({ ipcRenderer: { on: (_channel, fn) => { handler = fn; }, send: (_channel, reply) => { response = reply; } } }) });
  handler(null, { id: 'test', action: 'collect' });
  assert.deepEqual(Object.keys(response.values), SAVE_KEYS);
  assert.equal(source.includes('contextBridge.exposeInMainWorld'), false);
});
