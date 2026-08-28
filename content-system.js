(function exposeContentDomain(root, factory) {
  const domain = factory();
  if (typeof module === 'object' && module.exports) module.exports = domain;
  root.ContentDomain = domain;
})(typeof globalThis !== 'undefined' ? globalThis : window, function createContentDomain() {
  const freezeArray = value => Object.freeze([...(value || [])]);
  const freezeObject = value => Object.freeze({ ...(value || {}) });

  class ContentDefinition {
    constructor(key, data = {}) {
      if (!key || !data.name) throw new Error(`Invalid content definition: ${key || 'unknown'}`);
      Object.assign(this, data, { key, tags: freezeArray(data.tags) });
    }
  }

  class ContentCatalog {
    constructor(DefinitionClass = ContentDefinition) {
      this.DefinitionClass = DefinitionClass;
      this.definitions = new Map();
    }
    register(key, data) {
      if (this.definitions.has(key)) throw new Error(`Content already exists: ${key}`);
      const definition = data instanceof this.DefinitionClass ? data : new this.DefinitionClass(key, data);
      this.definitions.set(key, definition);
      return definition;
    }
    registerAll(config = {}) { Object.entries(config).forEach(([key, data]) => this.register(key, data)); return this; }
    get(key) {
      const definition = this.definitions.get(key);
      if (!definition) throw new Error(`Unknown content: ${key}`);
      return definition;
    }
    has(key) { return this.definitions.has(key); }
    values() { return [...this.definitions.values()]; }
    keys() { return [...this.definitions.keys()]; }
  }

  class MapDefinition extends ContentDefinition {
    constructor(key, data) {
      super(key, data);
      if (!Array.isArray(data.path) || data.path.length < 2) throw new Error(`Map requires a path: ${key}`);
      this.width = data.width || 960; this.height = data.height || 540; this.cellSize = data.cellSize || 60;
      this.path = Object.freeze(data.path.map(point => Object.freeze([...point])));
      this.palette = freezeObject(data.palette);
      this.bonus = freezeArray(data.bonus);
      Object.freeze(this);
    }
    get pathLength() {
      return this.path.slice(1).reduce((sum, point, index) => sum + Math.hypot(point[0] - this.path[index][0], point[1] - this.path[index][1]), 0);
    }
  }

  class WaveDefinition {
    constructor(data = {}, number = 1) {
      this.number = number;
      this.enemyCount = Math.max(1, data.enemyCount ?? 8 + number * 3);
      this.hpScale = data.hpScale ?? 1;
      this.speedScale = data.speedScale ?? 1;
      this.spawnInterval = data.spawnInterval ?? Math.max(.7, 1.05 - number * .01);
      this.eventKey = data.eventKey || 'calm';
      this.traitKey = data.traitKey || null;
      this.roster = freezeArray(data.roster);
      this.boss = data.boss || null;
      this.reward = data.reward ?? 20 + number * 4;
      Object.freeze(this);
    }
  }

  class LevelDefinition extends ContentDefinition {
    constructor(key, data) {
      super(key, data);
      if (!data.mapKey) throw new Error(`Level requires mapKey: ${key}`);
      this.mapKey = data.mapKey;
      this.startingLives = data.startingLives || 12;
      this.objectives = freezeArray(data.objectives || ['survive']);
      this.waves = Object.freeze((data.waves || []).map((wave, index) => new WaveDefinition(wave, index + 1)));
      this.rewards = freezeObject(data.rewards);
      Object.freeze(this);
    }
  }

  class GameModeDefinition extends ContentDefinition {
    constructor(key, data) {
      super(key, data);
      this.kind = data.kind || key;
      this.levelRequired = Boolean(data.levelRequired);
      this.autoAdvance = data.autoAdvance !== false;
      Object.freeze(this);
    }
  }

  class ContentRegistry {
    constructor() {
      this.maps = new ContentCatalog(MapDefinition);
      this.levels = new ContentCatalog(LevelDefinition);
      this.modes = new ContentCatalog(GameModeDefinition);
      this.events = new ContentCatalog(ContentDefinition);
    }
    validate() {
      for (const level of this.levels.values()) if (!this.maps.has(level.mapKey)) throw new Error(`Level ${level.key} references unknown map ${level.mapKey}`);
      return this;
    }
  }

  class GameSession {
    constructor(registry, options = {}) { this.registry = registry; this.reset(options); }
    reset({ modeKey = 'endless', levelKey = null, mapKey = null } = {}) {
      this.mode = this.registry.modes.get(modeKey);
      this.level = levelKey ? this.registry.levels.get(levelKey) : null;
      if (this.mode.levelRequired && !this.level) throw new Error(`Mode ${modeKey} requires a level`);
      this.map = this.registry.maps.get(this.level?.mapKey || mapKey || this.registry.maps.keys()[0]);
      this.waveNumber = 1; this.status = 'preparing'; this.completedWaves = 0;
      this.lives = this.level?.startingLives || 12;
      return this;
    }
    waveAt(number = this.waveNumber) {
      if (this.mode.kind === 'campaign') return this.level.waves[number - 1] || null;
      const eventKeys = this.registry.events.keys();
      return new WaveDefinition({ eventKey: eventKeys[(number - 1) % eventKeys.length] }, number);
    }
    get currentWave() { return this.waveAt(); }
    get isFinite() { return this.mode.kind === 'campaign'; }
    startWave() {
      if (!this.currentWave || this.status === 'won' || this.status === 'lost') return false;
      this.status = 'running'; return true;
    }
    completeWave({ finalEvolution = false } = {}) {
      if (this.status !== 'running') return { completed: false, won: false };
      this.completedWaves = this.waveNumber;
      const campaignComplete = this.isFinite && this.waveNumber >= this.level.waves.length;
      if (campaignComplete || (!this.isFinite && finalEvolution)) {
        this.status = 'won'; return { completed: true, won: true, campaignComplete };
      }
      this.waveNumber += 1; this.status = 'preparing';
      return { completed: true, won: false, nextWave: this.waveNumber };
    }
    loseLife(amount = 1) { this.lives = Math.max(0, this.lives - amount); if (!this.lives) this.status = 'lost'; return this.lives; }
    abandon() { this.status = 'abandoned'; return this.snapshot(); }
    selectMap(key) {
      if (this.mode.levelRequired) return false;
      this.map = this.registry.maps.get(key); return true;
    }
    snapshot() { return { modeKey: this.mode.key, levelKey: this.level?.key || null, mapKey: this.map.key, waveNumber: this.waveNumber, lives: this.lives, status: this.status }; }
  }

  return { ContentDefinition, ContentCatalog, MapDefinition, WaveDefinition, LevelDefinition, GameModeDefinition, ContentRegistry, GameSession };
});
