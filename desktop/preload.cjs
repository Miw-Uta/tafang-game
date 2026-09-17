const { ipcRenderer } = require('electron');

// No filesystem, shell, arbitrary IPC, or Node API is exposed to the game page.
const keys = ['tafang.campaignProgress', 'tafang.campaignCheckpoint', 'tafang.settings', 'tafang.fieldGuide.v1', 'tafang.audio.v1', 'tafang.guidePreference'];
const pendingKey = 'orangewood.pendingImport';
function validValues(values) {
  return values && Object.keys(values).length === keys.length && keys.every(key => values[key] === null || typeof values[key] === 'string');
}
// Restore at document start, after the previous page's pagehide autosave ran.
// Applying before navigation would allow that autosave to overwrite the import.
const pendingImport = sessionStorage.getItem(pendingKey);
if (pendingImport) {
  const previous = Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)]));
  try {
    const values = JSON.parse(pendingImport);
    if (!validValues(values)) throw new Error('Invalid save payload');
    keys.forEach(key => values[key] === null ? localStorage.removeItem(key) : localStorage.setItem(key, values[key]));
    sessionStorage.removeItem(pendingKey);
  } catch (error) {
    keys.forEach(key => previous[key] === null ? localStorage.removeItem(key) : localStorage.setItem(key, previous[key]));
    sessionStorage.removeItem(pendingKey);
    ipcRenderer.send('orangewood:restore-error', String(error.message).slice(0, 200));
  }
}
ipcRenderer.on('orangewood:save-request', (_event, { id, action, values }) => {
  if (typeof id !== 'string' || !['collect', 'apply'].includes(action)) return;
  try {
    const previous = Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)]));
    if (action === 'collect') {
      ipcRenderer.send('orangewood:save-reply', { id, values: previous });
      return;
    }
    if (!validValues(values)) throw new Error('Invalid save payload');
    sessionStorage.setItem(pendingKey, JSON.stringify(values));
    ipcRenderer.send('orangewood:save-reply', { id, ok: true });
  } catch (error) {
    ipcRenderer.send('orangewood:save-reply', { id, error: String(error.message).slice(0, 200) });
  }
});
