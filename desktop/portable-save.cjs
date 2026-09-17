const { createHash } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const SAVE_KEYS = Object.freeze(['tafang.campaignProgress', 'tafang.campaignCheckpoint', 'tafang.settings', 'tafang.fieldGuide.v1', 'tafang.audio.v1', 'tafang.guidePreference']);
const MAX_SAVE_BYTES = 512 * 1024;
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const checksum = values => createHash('sha256').update(JSON.stringify(values)).digest('hex');

function normalizeValues(values) {
  if (!isObject(values) || Object.keys(values).length !== SAVE_KEYS.length || Object.keys(values).some(key => !SAVE_KEYS.includes(key))) throw new Error('存档包含未知或缺失的项目。');
  const result = {};
  for (const key of SAVE_KEYS) {
    const raw = values[key];
    if (raw !== null && typeof raw !== 'string') throw new Error('存档项目格式错误。');
    if (raw !== null) {
      if (Buffer.byteLength(raw, 'utf8') > MAX_SAVE_BYTES / 2) throw new Error('存档项目过大。');
      const value = JSON.parse(raw);
      if (key === 'tafang.fieldGuide.v1') {
        if (!Array.isArray(value) || value.length > 16 || value.some(item => typeof item !== 'string' || !/^[a-z]+$/.test(item))) throw new Error('入门记录格式错误。');
      } else if (!isObject(value)) throw new Error('存档项目必须是对象。');
      if (key === 'tafang.audio.v1' && Object.entries(value).some(([name, setting]) => ['music','ambience'].includes(name) ? !Number.isFinite(setting) || setting < 0 || setting > 1 : !['musicMuted','ambienceMuted'].includes(name) || typeof setting !== 'boolean')) throw new Error('音量设置格式错误。');
      if (key === 'tafang.guidePreference' && Object.entries(value).some(([name, setting]) => name !== 'dismissed' || typeof setting !== 'boolean')) throw new Error('入门设置格式错误。');
      if (key === 'tafang.settings' && Object.entries(value).some(([name, setting]) => !['sound', 'reducedMotion'].includes(name) || typeof setting !== 'boolean')) throw new Error('设置项目格式错误。');
      if (key === 'tafang.campaignProgress' && Object.entries(value).some(([level, record]) => !/^[a-zA-Z][a-zA-Z0-9]*$/.test(level) || !isObject(record) || !Number.isFinite(record.completedAt) || (record.stars !== undefined && (!Number.isInteger(record.stars) || record.stars < 1 || record.stars > 3)))) throw new Error('战役进度格式错误。');
      if (key === 'tafang.campaignCheckpoint' && (value.version !== 1 || !Number.isSafeInteger(value.savedAt) || value.savedAt < 0 || !isObject(value.state) || typeof value.state.levelKey !== 'string' || !Array.isArray(value.state.towers))) throw new Error('续战格式不兼容。');
    }
    result[key] = raw;
  }
  return result;
}

function createSave(values, gameVersion, now = new Date()) {
  const normalized = normalizeValues(values);
  return { format: 'orangewood-save', version: 1, createdAt: now.toISOString(), gameVersion, values: normalized, sha256: checksum(normalized) };
}

function parseSave(raw) {
  if (typeof raw !== 'string' || Buffer.byteLength(raw, 'utf8') > MAX_SAVE_BYTES) throw new Error('存档为空或超过大小限制。');
  const save = JSON.parse(raw);
  if (!isObject(save) || save.format !== 'orangewood-save' || save.version !== 1 || !Number.isFinite(Date.parse(save.createdAt)) || typeof save.gameVersion !== 'string') throw new Error('这不是受支持的甜橙谷完整存档。');
  const values = normalizeValues(save.values);
  if (save.sha256 !== checksum(values)) throw new Error('存档校验失败，文件可能已损坏。');
  return { ...save, values };
}

async function writeSaveAtomic(filename, save) {
  const data = JSON.stringify(save, null, 2);
  parseSave(data);
  await fs.mkdir(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.${process.pid}.tmp`;
  try {
    await fs.writeFile(temporary, data, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    await fs.rename(temporary, filename);
  } finally { await fs.rm(temporary, { force: true }); }
}

module.exports = { SAVE_KEYS, MAX_SAVE_BYTES, normalizeValues, createSave, parseSave, writeSaveAtomic };
