(function exposeTactics(root, factory) {
  const domain = factory();
  if (typeof module === 'object' && module.exports) module.exports = domain;
  root.TacticsDomain = domain;
})(typeof globalThis !== 'undefined' ? globalThis : window, function createTacticsDomain() {
  'use strict';
  const MAX_ENERGY = 100;
  const ENERGY_PER_SECOND = 1.8;
  const ABILITIES = Object.freeze({
    bramble: Object.freeze({ key: 'bramble', name: '缚根结界', shortcut: 'Q', cost: 35, cooldown: 14, duration: 6, radius: 92, color: '#9cdeae', glyph: '根', description: '结界内持续减速，拖住快敌；首领与抗性敌人仍保留控制抗性。', summary: '6 秒路障 · 持续减速', target: 'road' }),
    rally: Object.freeze({ key: 'rally', name: '橙光战歌', shortcut: 'W', cost: 45, cooldown: 22, duration: 8, radius: 138, color: '#ffd082', glyph: '歌', description: '圈内守卫攻击间隔减少 35%，持续 8 秒；移动离圈即失去加成。', summary: '8 秒鼓舞 · 攻击间隔 −35%', target: 'tower' }),
    flare: Object.freeze({ key: 'flare', name: '照夜萤火', shortcut: 'E', cost: 55, cooldown: 26, duration: 6, radius: 106, color: '#b7c6ff', glyph: '萤', description: '立即削去圈内敌人当前护盾的 60%（首领 30%），持续破甲与 30% 易伤；命中正在施法的首领可打断，并打开 3 秒额外增伤 15% 的破绽。', summary: '破盾 / 破甲 · 打断首领读条', target: 'road' })
  });
  const abilityKeys = Object.keys(ABILITIES);
  const hasAbility = key => Object.prototype.hasOwnProperty.call(ABILITIES, key);
  const finite = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
  const exactKeys = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(value, key));
  const clone = value => JSON.parse(JSON.stringify(value));
  const pointOf = entity => ({ x: entity.x ?? entity.col * 60 + 30, y: entity.y ?? entity.row * 60 + 30 });
  const inside = (zone, point) => Math.hypot(zone.x - point.x, zone.y - point.y) <= ABILITIES[zone.key].radius;

  function segmentDistance(point, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const ratio = Math.max(0, Math.min(1, ((point.x - a[0]) * dx + (point.y - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(point.x - a[0] - ratio * dx, point.y - a[1] - ratio * dy);
  }

  function validSnapshot(state) {
    if (!exactKeys(state, ['version', 'energy', 'cooldowns', 'zones', 'casts']) || state.version !== 1 || !finite(state.energy, 0, MAX_ENERGY)) return false;
    if (!exactKeys(state.cooldowns, abilityKeys) || !abilityKeys.every(key => finite(state.cooldowns[key], 0, ABILITIES[key].cooldown))) return false;
    if (!Number.isSafeInteger(state.casts) || state.casts < 0 || state.casts > 1e9 || !Array.isArray(state.zones) || state.zones.length > abilityKeys.length) return false;
    const seen = new Set();
    return state.zones.every(zone => {
      if (!exactKeys(zone, ['key', 'x', 'y', 'remaining']) || !hasAbility(zone.key) || seen.has(zone.key)) return false;
      seen.add(zone.key);
      return finite(zone.x, 0, 960) && finite(zone.y, 0, 540) && finite(zone.remaining, Number.MIN_VALUE, ABILITIES[zone.key].duration)
        && state.cooldowns[zone.key] >= zone.remaining;
    });
  }

  class BattleTactics {
    constructor() { this.reset(); }
    reset() {
      this.energy = MAX_ENERGY;
      this.cooldowns = Object.fromEntries(abilityKeys.map(key => [key, 0]));
      this.zones = [];
      this.casts = 0;
    }
    check(key, point, context = {}) {
      if (!hasAbility(key)) return { ok: false, reason: '未知战术。' };
      if (context.paused || context.blocked || context.won || context.lives <= 0) return { ok: false, reason: '暂停或对话期间无法释放战术。' };
      if (!context.running) return { ok: false, reason: '敌潮开始后才能释放战术；整备期间不回复指令。' };
      const ability = ABILITIES[key];
      if (this.cooldowns[key] > 0) return { ok: false, reason: `${ability.name}还需 ${Math.ceil(this.cooldowns[key])} 秒冷却。` };
      if (this.energy + 1e-8 < ability.cost) return { ok: false, reason: `需要 ${ability.cost} 点指令，当前 ${Math.floor(this.energy)} 点。` };
      if (!point || !finite(point.x, 0, context.width || 960) || !finite(point.y, 0, context.height || 540)) return { ok: false, reason: '请选择战场内的落点。' };
      const zone = { key, x: point.x, y: point.y };
      const towers = (context.towers || []).filter(tower => inside(zone, pointOf(tower)));
      const enemies = (context.enemies || []).filter(enemy => !enemy.dead && enemy.hp > 0 && inside(zone, pointOf(enemy)));
      if (ability.target === 'tower' && !towers.length) return { ok: false, reason: '战歌至少需要覆盖一座守卫。' };
      if (ability.target === 'road' && !(context.paths || []).some(path => path.slice(1).some((end, index) => segmentDistance(point, path[index], end) <= ability.radius * .8))) return { ok: false, reason: '请把结界放在敌军行进的道路上。' };
      return { ok: true, towers: towers.length, enemies: enemies.length, reason: ability.target === 'tower' ? `覆盖 ${towers.length} 座守卫 · 攻击间隔 −35%` : enemies.length ? `覆盖 ${enemies.length} 名敌军${key === 'flare' ? ' · 削盾并暴露弱点' : ' · 持续减速'}` : '提前封锁道路，等待敌军进入' };
    }
    cast(key, point, context) {
      const result = this.check(key, point, context);
      if (!result.ok) return result;
      const ability = ABILITIES[key];
      this.energy = Math.max(0, this.energy - ability.cost);
      this.cooldowns[key] = ability.cooldown;
      const zone = { key, x: point.x, y: point.y, remaining: ability.duration };
      this.zones.push(zone);
      this.casts++;
      const shieldTargets = key === 'flare' ? (context.enemies || []).filter(enemy => !enemy.dead && enemy.hp > 0 && enemy.shield > 0 && inside(zone, pointOf(enemy))) : [];
      return { ...result, zone: { ...zone }, shieldTargets };
    }
    tick(dt, context = {}) {
      if (!Number.isFinite(dt) || dt <= 0 || !context.running || context.paused || context.blocked || context.won || context.lives <= 0) return;
      this.energy = Math.min(MAX_ENERGY, this.energy + dt * ENERGY_PER_SECOND);
      abilityKeys.forEach(key => { this.cooldowns[key] = Math.max(0, this.cooldowns[key] - dt); });
      this.zones.forEach(zone => { zone.remaining = Math.max(0, zone.remaining - dt); });
      this.zones = this.zones.filter(zone => zone.remaining > 0);
    }
    enemyEffects(enemy) {
      if (enemy.dead || enemy.hp <= 0) return [];
      const effects = new Set();
      this.zones.forEach(zone => {
        if (!inside(zone, pointOf(enemy))) return;
        if (zone.key === 'bramble') effects.add('slow');
        if (zone.key === 'flare') { effects.add('weaken'); effects.add('taiji'); }
      });
      return [...effects];
    }
    cooldownMultiplier(point) { return this.zones.some(zone => zone.key === 'rally' && inside(zone, point)) ? .65 : 1; }
    endWave() { this.zones = []; }
    snapshot() { return clone({ version: 1, energy: this.energy, cooldowns: this.cooldowns, zones: this.zones, casts: this.casts }); }
    restore(state) {
      if (!validSnapshot(state)) return false;
      const value = clone(state);
      this.energy = value.energy; this.cooldowns = value.cooldowns; this.zones = value.zones; this.casts = value.casts;
      return true;
    }
  }
  return { BattleTactics, ABILITIES, MAX_ENERGY, ENERGY_PER_SECOND, validSnapshot, segmentDistance };
});
