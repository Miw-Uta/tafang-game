(function exposeCheckpointDomain(root, factory) {
  const domain = factory();
  if (typeof module === 'object' && module.exports) module.exports = domain;
  root.CheckpointDomain = domain;
})(typeof globalThis !== 'undefined' ? globalThis : window, function createCheckpointDomain() {
  const VERSION = 1;
  const tacticsDomain = typeof module === 'object' && module.exports ? require('./tactics-system.js') : globalThis.TacticsDomain;
  const STORAGE_KEY = 'tafang.campaignCheckpoint';
  const MAX_BYTES = 128 * 1024;
  const STAT_KEYS = ['livesLost', 'maxCombo', 'maxLineages', 'maxSynergies', 'maxEvolvedLevel', 'mapCleared', 'controls', 'recalls', 'redeployments', 'focusedBossKills', 'forgedBossKills', 'bossKills', 'fusions', 'surgeKills', 'merges', 'wavesCleared'];
  const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
  const number = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const keys = (value, allowed) => object(value) && Object.keys(value).every(key => allowed.includes(key));
  const clone = value => JSON.parse(JSON.stringify(value));

  class CampaignCheckpointStore {
    constructor(registry, { evolutionKeys = [], read, write, remove, now = Date.now } = {}) {
      this.registry = registry;
      this.evolutionKeys = new Set(evolutionKeys);
      this.read = read || (() => globalThis.localStorage.getItem(STORAGE_KEY));
      this.write = write || (value => globalThis.localStorage.setItem(STORAGE_KEY, value));
      this.remove = remove || (() => globalThis.localStorage.removeItem(STORAGE_KEY));
      this.now = now;
      this.storageAvailable = true;
      this.error = null;
      this.current = null;
      try {
        const raw = this.read();
        if (raw === null || raw === undefined || raw === '') return;
        if (typeof raw !== 'string' || raw.length > MAX_BYTES) { this.error = 'invalid-checkpoint'; return; }
        const envelope = JSON.parse(raw);
        if (!keys(envelope, ['version', 'savedAt', 'state']) || envelope.version !== VERSION || !integer(envelope.savedAt, 0, Number.MAX_SAFE_INTEGER) || !this.valid(envelope.state)) {
          this.error = 'invalid-checkpoint'; return;
        }
        this.current = clone(envelope);
      } catch (error) {
        this.error = error instanceof SyntaxError ? 'invalid-checkpoint' : 'storage-unavailable';
        if (this.error === 'storage-unavailable') this.storageAvailable = false;
      }
    }

    valid(state) {
      if (!keys(state, ['levelKey', 'waveIndex', 'completedWaves', 'lives', 'score', 'coins', 'kills', 'towers', 'reserve', 'standby', 'growthMode', 'growthCycles', 'germinationOffers', 'surgeCharge', 'tactics', 'mapObjects', 'mapUnlockedSlots', 'discoveredEvolutions', 'campaign', 'modifiers', 'missionDecisions'])) return false;
      if (typeof state.levelKey !== 'string' || !this.registry.levels.has(state.levelKey)) return false;
      const level = this.registry.levels.get(state.levelKey), map = this.registry.maps.get(level.mapKey);
      if (!integer(state.waveIndex, 0, level.waves.length - 1) || state.completedWaves !== state.waveIndex) return false;
      if (!integer(state.lives, 1, level.startingLives) || !number(state.coins, 0, 1e9) || !integer(state.score, 0, 1e12) || !integer(state.kills, 0, 1e9)) return false;
      if (!Array.isArray(state.towers) || state.towers.length > 8 || !Array.isArray(state.standby) || state.standby.length > 128) return false;
      const validTower = (tower, standby) => {
        if (!keys(tower, ['col', 'row', 'level', 'evo', 'evoTier', 'cool', 'evolutionPath', 'growth', 'targetPriority', 'campaignRecalled'])) return false;
        const optional = (key, check) => tower[key] === undefined ? standby : check(tower[key]);
        return integer(tower.level, 1, 20) && this.evolutionKeys.has(tower.evo)
          && optional('col', value => integer(value, 0, Math.floor(map.width / map.cellSize) - 1))
          && optional('row', value => integer(value, 0, Math.floor(map.height / map.cellSize) - 1))
          && optional('evoTier', value => integer(value, 0, 2))
          && optional('cool', value => number(value, -1e6, 1e6))
          && optional('evolutionPath', value => value === null || this.evolutionKeys.has(value))
          && optional('growth', value => number(value, 0, 1000))
          && optional('targetPriority', value => ['front', 'back', 'strong', 'weak', 'counter'].includes(value))
          && (tower.campaignRecalled === undefined || typeof tower.campaignRecalled === 'boolean');
      };
      if (!state.towers.every(tower => validTower(tower, false)) || !state.standby.every(tower => validTower(tower, true))) return false;
      const cells = new Set(state.towers.map(tower => `${tower.col},${tower.row}`));
      if (cells.size !== state.towers.length) return false;
      if (!object(state.reserve) || Object.keys(state.reserve).length > 20 || !Object.entries(state.reserve).every(([key, value]) => /^(?:[1-9]|1[0-9]|20)$/.test(key) && integer(value, 0, 10000))) return false;
      if (!['sprout', 'balanced', 'refine'].includes(state.growthMode) || !keys(state.growthCycles, ['sprout', 'balanced', 'refine', 'total']) || !['sprout', 'balanced', 'refine', 'total'].every(key => integer(state.growthCycles[key], 0, 1e9))) return false;
      if (!Array.isArray(state.germinationOffers) || state.germinationOffers.length > 3 || !state.germinationOffers.every(offer => keys(offer, ['kind', 'level', 'claimed']) && ['seed', 'cultivate'].includes(offer.kind) && integer(offer.level, 1, 5) && (offer.claimed === undefined || typeof offer.claimed === 'boolean'))) return false;
      if (!number(state.surgeCharge, 0, 100)) return false;
      if (state.tactics !== undefined && !(tacticsDomain || globalThis.TacticsDomain)?.validSnapshot(state.tactics)) return false;
      const mapSpecs = map.objectives || [];
      if (!Array.isArray(state.mapObjects) || state.mapObjects.length !== mapSpecs.length || !state.mapObjects.every((item, index) => keys(item, ['id', 'hp', 'cleared']) && item.id === `${map.key}-${index}` && number(item.hp, -1e12, mapSpecs[index].hp || 180) && typeof item.cleared === 'boolean' && item.cleared === (item.hp <= 0))) return false;
      const allowedUnlocks = new Set(mapSpecs.flatMap((spec, index) => state.mapObjects[index].cleared ? (spec.unlocks || []).map(slot => slot.join(',')) : []));
      if (!Array.isArray(state.mapUnlockedSlots) || state.mapUnlockedSlots.length > 144 || new Set(state.mapUnlockedSlots).size !== state.mapUnlockedSlots.length || !state.mapUnlockedSlots.every(slot => allowedUnlocks.has(slot))) return false;
      const buildSlots = new Set(map.buildSlots.map(slot => slot.join(',')));
      state.mapUnlockedSlots.forEach(slot => buildSlots.add(slot));
      if (state.towers.some(tower => !buildSlots.has(`${tower.col},${tower.row}`) || mapSpecs.some((spec, index) => !state.mapObjects[index].cleared && tower.col === spec.col && tower.row === spec.row))) return false;
      if (!Array.isArray(state.discoveredEvolutions) || state.discoveredEvolutions.length > this.evolutionKeys.size || new Set(state.discoveredEvolutions).size !== state.discoveredEvolutions.length || !state.discoveredEvolutions.every(key => this.evolutionKeys.has(key))) return false;
      if (!keys(state.campaign, ['stats', 'lastObservedLives']) || !keys(state.campaign.stats, STAT_KEYS) || !STAT_KEYS.every(key => integer(state.campaign.stats[key], 0, 1e9)) || !integer(state.campaign.lastObservedLives, 1, level.startingLives) || state.campaign.stats.wavesCleared !== state.completedWaves) return false;
      if (!keys(state.modifiers, ['damage', 'hp', 'difficulty', 'support']) || !number(state.modifiers.damage, .1, 10) || !number(state.modifiers.hp, .1, 10) || !['story', 'normal', 'veteran'].includes(state.modifiers.difficulty) || !['seeds', 'charge', 'power'].includes(state.modifiers.support)) return false;
      if (!object(state.missionDecisions) || Object.keys(state.missionDecisions).length > 32 || !Object.entries(state.missionDecisions).every(([key, value]) => /^[a-zA-Z0-9:_-]{1,64}$/.test(key) && !['__proto__', 'prototype', 'constructor'].includes(key) && typeof value === 'string' && /^[a-zA-Z0-9:_-]{1,64}$/.test(value))) return false;
      return true;
    }

    save(state) {
      try {
        if (!this.valid(state)) { this.error = 'invalid-checkpoint'; return false; }
        const envelope = { version: VERSION, savedAt: this.now(), state };
        if (!integer(envelope.savedAt, 0, Number.MAX_SAFE_INTEGER)) { this.error = 'invalid-checkpoint'; return false; }
        const raw = JSON.stringify(envelope);
        if (raw.length > MAX_BYTES) { this.error = 'invalid-checkpoint'; return false; }
        this.current = JSON.parse(raw);
        try { this.write(raw); this.storageAvailable = true; this.error = null; return true; }
        catch { this.storageAvailable = false; this.error = 'storage-unavailable'; return false; }
      } catch { this.error = 'invalid-checkpoint'; return false; }
    }

    load() { return this.current ? clone(this.current.state) : null; }
    get savedAt() { return this.current?.savedAt || null; }
    clear() {
      this.current = null;
      try { this.remove(); this.storageAvailable = true; this.error = null; return true; }
      catch { this.storageAvailable = false; this.error = 'storage-unavailable'; return false; }
    }
  }

  return { CampaignCheckpointStore, VERSION, STORAGE_KEY, MAX_BYTES };
});
