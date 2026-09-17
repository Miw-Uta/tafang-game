const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { parseSave, createSave, writeSaveAtomic } = require('../desktop/portable-save.cjs');

const root = path.resolve(__dirname, '..');
async function eventually(read, check, description) {
  for (let index = 0; index < 100; index++) {
    try { const value = await read(); if (check(value)) return value; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out: ${description}`);
}

(async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'orangewood-desktop-'));
  const exportPath = path.join(profile, 'exported-save.json');
  let application;
  const errors = [];
  try {
    application = await _electron.launch({
      executablePath: process.env.ELECTRON_EXECUTABLE || require('electron'), args: [root], cwd: root,
      env: { ...process.env, ORANGEWOOD_TEST_PROFILE: profile, XDG_CONFIG_HOME: path.join(profile, 'config'), XDG_CACHE_HOME: path.join(profile, 'cache') }, timeout: 30000
    });
    const page = await application.firstWindow();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.waitForSelector('#hubCampaignBtn');
    assert.match(await page.title(), /甜橙谷/);
    assert.equal(await page.evaluate(() => location.href), 'orangewood://game/index.html');
    assert.deepEqual(await page.evaluate(() => ({ require: typeof require, process: typeof process })), { require: 'undefined', process: 'undefined' });
    const preferences = await application.evaluate(({ BrowserWindow }) => {
      const web = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
      return { sandbox: web.sandbox, contextIsolation: web.contextIsolation, nodeIntegration: web.nodeIntegration, webSecurity: web.webSecurity };
    });
    assert.deepEqual(preferences, { sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true });
    await page.locator('#hubCampaignBtn').click();
    await page.locator('[data-mission="groveGate"]').click();
    await page.locator('[data-action="deploy"]').click();
    await page.waitForFunction(() => !!window.CampaignSave?.peek());
    await page.evaluate(() => localStorage.setItem('tafang.guidePreference', JSON.stringify({ dismissed: true })));
    await page.screenshot({ path: path.join(root, 'artifacts', 'desktop-battle.png') });

    // Drive the native menu. Only the OS file picker is substituted; IPC,
    // validation, backups, preload, pagehide and reload are the real code.
    await application.evaluate(({ dialog, Menu }, exportPath) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: exportPath });
      dialog.showMessageBox = async () => ({ response: 1 });
      Menu.getApplicationMenu().items[0].submenu.items.find(item => item.label === '导出完整存档…').click();
    }, exportPath);
    const exported = await eventually(() => fs.readFile(exportPath, 'utf8'), raw => !!parseSave(raw), 'native save export');
    const original = parseSave(exported);
    assert.ok(JSON.parse(original.values['tafang.campaignCheckpoint']).state.towers.length > 0);
    const importedValues = { ...original.values, 'tafang.settings': JSON.stringify({ sound: false, reducedMotion: true }), 'tafang.guidePreference': JSON.stringify({ dismissed: false }) };
    const importedPath = path.join(profile, 'imported-save.json');
    await writeSaveAtomic(importedPath, createSave(importedValues, '1.0.0'));
    await application.evaluate(({ dialog, Menu }, filePath) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] });
      Menu.getApplicationMenu().items[0].submenu.items.find(item => item.label === '导入完整存档…').click();
    }, importedPath);
    await eventually(() => page.evaluate(() => localStorage.getItem('tafang.guidePreference')), raw => raw === importedValues['tafang.guidePreference'], 'native save import after reload');
    assert.equal(await page.evaluate(() => localStorage.getItem('tafang.settings')), importedValues['tafang.settings']);
    const userData = await application.evaluate(({ app }) => app.getPath('userData'));
    const backups = await fs.readdir(path.join(userData, 'save-backups'));
    assert.equal(backups.length, 1);
    const backup = parseSave(await fs.readFile(path.join(userData, 'save-backups', backups[0]), 'utf8'));
    assert.equal(backup.values['tafang.guidePreference'], original.values['tafang.guidePreference']);
    await page.reload();
    await page.waitForSelector('#hubCampaignBtn');
    assert.equal(await page.evaluate(() => localStorage.getItem('tafang.settings')), importedValues['tafang.settings']);
    assert.equal(await page.evaluate(() => !!window.CampaignSave?.peek()), true);
    await page.evaluate(() => window.open('https://example.com'));
    assert.equal(application.windows().length, 1);
    assert.deepEqual(errors, []);
    const report = { generatedAt: new Date().toISOString(), electron: await application.evaluate(() => process.versions.electron), testedHost: `${process.platform}-${process.arch}`, packagedExecutable: await application.evaluate(({ app }) => app.isPackaged), checks: { isolatedWindow: true, offlineAssets: true, campaignBoot: true, fullSaveExport: true, fullSaveImport: true, importBackup: true, persistenceAfterReload: true, popupDenied: true }, pageErrors: errors };
    report.packages = {};
    for (const platform of ['linux', 'win']) {
      const version = require('../package.json').version;
      const filename = path.join(root, 'release', `Orangewood-${version}-${platform}-x64.build.json`);
      try {
        const build = JSON.parse(await fs.readFile(filename, 'utf8'));
        report.packages[platform] = { ...build.archive, nativeBuild: build.nativeBuild, runtimeVerified: report.packagedExecutable && (platform === 'win' ? process.platform === 'win32' : process.platform === 'linux') };
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    await fs.writeFile(path.join(root, 'artifacts', 'desktop-verification.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    if (application) await application.close();
    await fs.rm(profile, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
