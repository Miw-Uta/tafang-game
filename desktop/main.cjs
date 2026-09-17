const { app, BrowserWindow, Menu, dialog, ipcMain, protocol, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { START_URL, CONTENT_SECURITY_POLICY, isGamePage, resolveAsset } = require('./security.cjs');
const { MAX_SAVE_BYTES, createSave, parseSave, writeSaveAtomic } = require('./portable-save.cjs');

app.setName('Orangewood');
app.setPath('userData', !app.isPackaged && process.env.ORANGEWOOD_TEST_PROFILE ? path.resolve(process.env.ORANGEWOOD_TEST_PROFILE) : path.join(app.getPath('appData'), 'Orangewood'));
protocol.registerSchemesAsPrivileged([{ scheme: 'orangewood', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
let window, busy = false;
const pending = new Map();
const locked = app.requestSingleInstanceLock();
if (!locked) app.quit();
app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });

ipcMain.on('orangewood:save-reply', (event, reply) => {
  if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || !isGamePage(event.senderFrame.url)) return;
  const request = pending.get(reply?.id);
  if (!request) return;
  pending.delete(reply.id); clearTimeout(request.timeout);
  reply.error ? request.reject(new Error(reply.error)) : request.resolve(reply);
});
ipcMain.on('orangewood:restore-error', (event, message) => {
  if (window && event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame && isGamePage(event.senderFrame.url)) dialog.showErrorBox('存档未恢复', `原进度已保留，请检查存储空间。\n${String(message).slice(0, 200)}`);
});

function rendererSave(action, values) {
  return new Promise((resolve, reject) => {
    if (!window || window.isDestroyed() || !isGamePage(window.webContents.getURL())) return reject(new Error('游戏页面尚未就绪。'));
    const id = randomUUID();
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error('存档操作超时，请稍后重试。')); }, 5000);
    pending.set(id, { resolve, reject, timeout });
    window.webContents.send('orangewood:save-request', { id, action, values });
  });
}

async function saveAction(action) {
  if (busy) return;
  busy = true;
  try { await action(); }
  catch (error) { await dialog.showMessageBox(window, { type: 'error', title: '存档操作未完成', message: error.message }); }
  finally { busy = false; }
}

async function exportSave() {
  const { canceled, filePath } = await dialog.showSaveDialog(window, { title: '导出完整存档', defaultPath: `orangewood-save-${new Date().toISOString().slice(0, 10)}.json`, filters: [{ name: '甜橙谷存档', extensions: ['json'] }] });
  if (canceled || !filePath) return;
  const { values } = await rendererSave('collect');
  await writeSaveAtomic(filePath, createSave(values, app.getVersion()));
  await dialog.showMessageBox(window, { type: 'info', message: '完整存档已导出。', detail: '包含战役进度、波前续战与设置。战斗中导出会保留最近一次波前整备点。' });
}

async function importSave() {
  const { canceled, filePaths } = await dialog.showOpenDialog(window, { title: '导入完整存档', properties: ['openFile'], filters: [{ name: '甜橙谷存档', extensions: ['json'] }] });
  if (canceled || !filePaths[0]) return;
  if ((await fs.stat(filePaths[0])).size > MAX_SAVE_BYTES) throw new Error('存档文件超过大小限制。');
  const save = parseSave(await fs.readFile(filePaths[0], 'utf8'));
  const result = await dialog.showMessageBox(window, { type: 'question', title: '恢复存档', message: '导入后将重新载入游戏并替换当前进度。', detail: `存档时间：${new Date(save.createdAt).toLocaleString()}\n当前进度将自动备份到存档目录。`, buttons: ['取消', '备份并导入'], defaultId: 0, cancelId: 0, noLink: true });
  if (result.response !== 1) return;
  const current = await rendererSave('collect');
  const backup = path.join(app.getPath('userData'), 'save-backups', `before-import-${Date.now()}.json`);
  await writeSaveAtomic(backup, createSave(current.values, app.getVersion()));
  await rendererSave('apply', save.values);
  window.webContents.reload();
}

function installMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: '甜橙谷', submenu: [
      { label: '导出完整存档…', accelerator: 'CmdOrCtrl+Shift+S', click: () => saveAction(exportSave) },
      { label: '导入完整存档…', click: () => saveAction(importSave) },
      { label: '打开存档目录', click: () => shell.openPath(app.getPath('userData')) },
      { type: 'separator' }, { role: 'quit', label: '退出游戏' }
    ] },
    { label: '画面', submenu: [{ role: 'togglefullscreen', label: '全屏 / 窗口', accelerator: 'F11' }] },
    { label: '帮助', submenu: [{ label: '操作与版本', click: () => dialog.showMessageBox(window, { type: 'info', title: '甜橙谷 · 黑潮纪事', message: `甜橙谷 ${app.getVersion()}`, detail: 'F11 切换全屏 · P 暂停 · 空格释放战技 · Esc 取消操作\n存档在本机保存。完整存档可通过游戏菜单导入、导出。\n当前构建未连接 Steamworks 或 Steam 云。' }) }] }
  ]));
}

async function createWindow() {
  const webRoot = path.join(app.getAppPath(), 'dist');
  await fs.access(path.join(webRoot, 'index.html'));
  protocol.handle('orangewood', async request => {
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('', { status: 405 });
    try {
      const file = resolveAsset(webRoot, request.url);
      const content = await fs.readFile(file);
      const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
      const headers = new Headers({ 'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      headers.set('Content-Security-Policy', CONTENT_SECURITY_POLICY);
      headers.set('X-Content-Type-Options', 'nosniff');
      headers.set('Cache-Control', 'no-cache');
      return new Response(request.method === 'HEAD' ? null : content, { status: 200, headers });
    } catch { return new Response('Not found', { status: 404 }); }
  });
  window = new BrowserWindow({
    title: '甜橙谷 · 黑潮纪事', width: 1440, height: 960, minWidth: 960, minHeight: 640,
    backgroundColor: '#102720', show: false, icon: path.join(__dirname, 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, allowRunningInsecureContent: false, spellcheck: false }
  });
  const session = window.webContents.session;
  session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  session.setPermissionCheckHandler(() => false);
  session.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !/^(orangewood:|blob:|data:)/.test(details.url) }));
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => { if (!isGamePage(url)) event.preventDefault(); });
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.webContents.on('render-process-gone', (_event, details) => { if (details.reason !== 'clean-exit') dialog.showErrorBox('画面进程意外退出', '请重新启动游戏。已经保存的波前整备点仍在存档中。'); });
  window.once('ready-to-show', () => window.show());
  window.on('closed', () => { window = null; });
  installMenu();
  await window.loadURL(START_URL);
}

if (locked) app.whenReady().then(createWindow).catch(error => { dialog.showErrorBox('甜橙谷无法启动', `${error.message}\n开发环境请先运行 npm run build。`); app.quit(); });
app.on('window-all-closed', () => app.quit());
