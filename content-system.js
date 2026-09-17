(function exposeContentDomain(root, factory) {
  const domain = factory();
  if (typeof module === 'object' && module.exports) module.exports = domain;
  root.ContentDomain = domain;
})(typeof globalThis !== 'undefined' ? globalThis : window, function createContentDomain() {
  const freezeArray = value => Object.freeze([...(value || [])]);
  const freezeObject = value => Object.freeze({ ...(value || {}) });
  function smoothRoute(points, steps = 8) {
    if (points.length < 3) return points.map(point => [...point]);
    const result = [[...points[0]]];
    for (let index = 0; index < points.length - 1; index++) {
      const p0 = points[Math.max(0, index - 1)], p1 = points[index], p2 = points[index + 1], p3 = points[Math.min(points.length - 1, index + 2)];
      for (let step = 1; step <= steps; step++) {
        const t = step / steps, t2 = t * t, t3 = t2 * t;
        result.push([
          .5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2*p0[0] - 5*p1[0] + 4*p2[0] - p3[0]) * t2 + (-p0[0] + 3*p1[0] - 3*p2[0] + p3[0]) * t3),
          .5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2*p0[1] - 5*p1[1] + 4*p2[1] - p3[1]) * t2 + (-p0[1] + 3*p1[1] - 3*p2[1] + p3[1]) * t3)
        ]);
      }
    }
    return result;
  }
  function roundOrthogonalRoute(points, radius = 22, steps = 5) {
    if (points.length < 3) return points.map(point => [...point]);
    const result = [[...points[0]]];
    for (let index = 1; index < points.length - 1; index++) {
      const previous = points[index - 1], corner = points[index], next = points[index + 1];
      const incomingLength = Math.hypot(corner[0] - previous[0], corner[1] - previous[1]);
      const outgoingLength = Math.hypot(next[0] - corner[0], next[1] - corner[1]);
      const turnRadius = Math.min(radius, incomingLength / 2, outgoingLength / 2);
      const incoming = [(corner[0] - previous[0]) / incomingLength, (corner[1] - previous[1]) / incomingLength];
      const outgoing = [(next[0] - corner[0]) / outgoingLength, (next[1] - corner[1]) / outgoingLength];
      const entry = [corner[0] - incoming[0] * turnRadius, corner[1] - incoming[1] * turnRadius];
      const exit = [corner[0] + outgoing[0] * turnRadius, corner[1] + outgoing[1] * turnRadius];
      result.push(entry);
      for (let step = 1; step <= steps; step++) {
        const progress = step / steps, inverse = 1 - progress;
        result.push([
          inverse * inverse * entry[0] + 2 * inverse * progress * corner[0] + progress * progress * exit[0],
          inverse * inverse * entry[1] + 2 * inverse * progress * corner[1] + progress * progress * exit[1]
        ]);
      }
    }
    result.push([...points.at(-1)]);
    return result;
  }
  function pointSegmentDistance(x, y, start, end) {
    const dx = end[0] - start[0], dy = end[1] - start[1], denominator = dx * dx + dy * dy;
    const progress = denominator ? Math.max(0, Math.min(1, ((x - start[0]) * dx + (y - start[1]) * dy) / denominator)) : 0;
    return Math.hypot(x - start[0] - dx * progress, y - start[1] - dy * progress);
  }
  function automaticBuildSlots(routes, width, height, cellSize, clearance, blockedCells) {
    const blocked = new Set(blockedCells.map(cell => `${cell[0]},${cell[1]}`)), slots = [];
    for (let row = 0; row < Math.floor(height / cellSize); row++) for (let col = 0; col < Math.floor(width / cellSize); col++) {
      if (blocked.has(`${col},${row}`)) continue;
      const x = col * cellSize + cellSize / 2, y = row * cellSize + cellSize / 2;
      const distance = Math.min(...routes.flatMap(route => route.slice(1).map((point, index) => pointSegmentDistance(x, y, route[index], point))));
      if (distance >= clearance) slots.push([col, row]);
    }
    return slots;
  }

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
      const sourceRoutes = data.routes || (data.path ? [data.path] : []);
      if (!Array.isArray(sourceRoutes) || !sourceRoutes.length || sourceRoutes.some(route => !Array.isArray(route) || route.length < 2)) throw new Error(`Map requires at least one route: ${key}`);
      this.width = data.width || 960; this.height = data.height || 540; this.cellSize = data.cellSize || 60;
      if (data.routeStyle === 'orthogonal' && sourceRoutes.some(route => route.slice(1).some((point,index) => point[0] !== route[index][0] && point[1] !== route[index][1]))) throw new Error(`Orthogonal route contains a diagonal segment: ${key}`);
      this.routeControls = Object.freeze(sourceRoutes.map(route => Object.freeze(route.map(point => Object.freeze([...point])))));
      this.routes = Object.freeze(sourceRoutes.map(route => Object.freeze((data.routeStyle === 'orthogonal' ? roundOrthogonalRoute(route, data.cornerRadius || 22, data.curveSteps || 5) : smoothRoute(route, data.curveSteps || 8)).map(point => Object.freeze(point)))));
      this.path = this.routes[0];
      this.routeLengths = Object.freeze(this.routes.map(route => route.slice(1).reduce((sum, point, index) => sum + Math.hypot(point[0] - route[index][0], point[1] - route[index][1]), 0)));
      this.blockedCells = Object.freeze((data.blockedCells || []).map(cell => Object.freeze([...cell])));
      const buildSlots = data.buildSlots === 'auto' ? automaticBuildSlots(this.routes, this.width, this.height, this.cellSize, data.buildClearance || 55, this.blockedCells) : (data.buildSlots || []);
      this.buildSlots = Object.freeze(buildSlots.map(slot => Object.freeze([...slot])));
      this.initialSlot = Object.freeze([...(data.initialSlot || this.buildSlots[0] || [1, 6])]);
      this.ritualSite = data.ritualSite ? Object.freeze([...data.ritualSite]) : null;
      const routePlan = data.routePlan || [{ from: 1, weights: sourceRoutes.map(() => 1) }];
      if (!routePlan.length || routePlan.some(plan => !Number.isInteger(plan.from) || plan.from < 1 || !Array.isArray(plan.weights) || plan.weights.length !== sourceRoutes.length || plan.weights.some(weight => !Number.isInteger(weight) || weight < 0) || !plan.weights.some(Boolean))) throw new Error(`Invalid route plan: ${key}`);
      this.routePlan = Object.freeze([...routePlan].sort((left,right) => left.from - right.from).map(plan => Object.freeze({ from: plan.from, weights: Object.freeze([...plan.weights]) })));
      this.specialSlots = Object.freeze((data.specialSlots || []).map(slot => Object.freeze({ ...slot })));
      if (this.buildSlots.length && !this.buildSlots.some(slot => slot[0] === this.initialSlot[0] && slot[1] === this.initialSlot[1])) throw new Error(`Initial slot is not buildable: ${key}`);
      if (this.specialSlots.some(special => !this.buildSlots.some(slot => slot[0] === special.col && slot[1] === special.row))) throw new Error(`Special slot is not buildable: ${key}`);
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
      this.spawnPlan = Object.freeze((data.spawnPlan || []).map(spawn => Object.freeze({ archetype:spawn.archetype, traits:freezeArray(spawn.traits) })));
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

  class CampaignProgress {
    constructor(levels, { read = () => null, write = () => {}, now = Date.now } = {}) {
      this.levels = levels;
      this.read = read;
      this.write = write;
      this.now = now;
      this.records = {};
      this.storageAvailable = true;
      try {
        const saved = JSON.parse(this.read() || '{}');
        if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
          for (const key of this.order()) {
            const record = saved[key];
            if (record && typeof record === 'object' && !Array.isArray(record) && Number.isFinite(record.completedAt)) this.records[key] = { ...record };
          }
        }
      } catch { this.storageAvailable = false; }
    }
    order() { return this.levels.keys(); }
    load() { return Object.fromEntries(Object.entries(this.records).map(([key, record]) => [key, { ...record }])); }
    has(key) { return Object.prototype.hasOwnProperty.call(this.records, key); }
    isUnlocked(key) {
      const index = this.order().indexOf(key);
      return index >= 0 && (index === 0 || this.has(key) || this.has(this.order()[index - 1]));
    }
    next(key) { const index = this.order().indexOf(key); return index >= 0 ? this.order()[index + 1] || null : null; }
    completedCount() { return this.order().filter(key => this.has(key)).length; }
    nextUncompleted() { return this.order().find(key => !this.has(key) && this.isUnlocked(key)) || this.order().at(-1); }
    markComplete(key, { score = 0, lives = 1, waves = 0, stars: earnedStars, choice } = {}) {
      if (!this.isUnlocked(key)) return null;
      const previous = this.records[key];
      const fullLives = this.levels.get(key).startingLives;
      score = Number.isFinite(score) ? score : 0;
      lives = Number.isFinite(lives) ? lives : 1;
      waves = Number.isFinite(waves) ? waves : 0;
      const stars = Number.isFinite(earnedStars) ? Math.max(1, Math.min(3, Math.floor(earnedStars))) : lives >= fullLives ? 3 : lives >= Math.ceil(fullLives * .5) ? 2 : 1;
      const record = {
        ...(typeof choice === 'string' ? {choice} : previous?.choice ? {choice:previous.choice} : {}),
        completedAt: previous?.completedAt ?? this.now(),
        updatedAt: this.now(),
        score: Math.max(previous?.score || 0, Math.max(0, Math.floor(score) || 0)),
        lives: Math.max(previous?.lives || 0, Math.max(0, Math.floor(lives) || 0)),
        stars: Math.max(previous?.stars || 1, stars),
        waves: Math.max(previous?.waves || 0, Math.max(0, Math.floor(waves) || 0))
      };
      this.records[key] = record;
      try { this.write(JSON.stringify(this.records)); this.storageAvailable = true; }
      catch { this.storageAvailable = false; }
      return { ...record, firstClear: !previous, nextLevelKey: this.next(key) };
    }
  }

  return { ContentDefinition, ContentCatalog, MapDefinition, WaveDefinition, LevelDefinition, GameModeDefinition, ContentRegistry, GameSession, CampaignProgress };
});
