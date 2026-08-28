(function exposeTowerDomain(root, factory) {
  const domain = factory();
  if (typeof module === 'object' && module.exports) module.exports = domain;
  root.TowerDomain = domain;
})(typeof globalThis !== 'undefined' ? globalThis : window, function createTowerDomain() {
  class TowerDefinition {
    constructor(key, data) {
      if (!key || !data?.name || !data?.attackMode) throw new Error(`Invalid tower definition: ${key || 'unknown'}`);
      Object.assign(this, data, {
        key,
        tags: Object.freeze([...(data.tags || [])]),
        combat: Object.freeze({ ...(data.combat || {}) })
      });
      Object.freeze(this);
    }
  }

  class TowerCatalog {
    constructor() { this.definitions = new Map(); }

    register(key, data) {
      if (this.definitions.has(key)) throw new Error(`Tower definition already exists: ${key}`);
      const definition = data instanceof TowerDefinition ? data : new TowerDefinition(key, data);
      this.definitions.set(key, definition);
      return definition;
    }

    get(key) {
      const definition = this.definitions.get(key);
      if (!definition) throw new Error(`Unknown tower definition: ${key}`);
      return definition;
    }

    has(key) { return this.definitions.has(key); }
    values() { return [...this.definitions.values()]; }

    static fromConfig(config, branchResolver = key => key) {
      const catalog = new TowerCatalog();
      Object.entries(config).forEach(([key, data]) => {
        const lineage = branchResolver(key);
        const kind = data.fusion ? 'fusion' : key === 'base' ? 'seed' : data.parent ? 'branch' : 'element';
        catalog.register(key, {
          ...data,
          lineage,
          kind,
          tags: [kind, lineage, data.rare ? 'rare' : 'common'].filter(Boolean)
        });
      });
      return catalog;
    }
  }

  class AttackPattern {
    constructor(key, label, defaultLimit) {
      this.key = key;
      this.label = label;
      this.defaultLimit = defaultLimit;
    }

    candidates(tower, enemies, context) {
      const position = context.positionOf(tower);
      const radius = context.rangeOf(tower);
      return enemies
        .filter(enemy => !enemy.dead && Math.hypot(enemy.x - position.x, enemy.y - position.y) < radius)
        .sort((left, right) => right.dist - left.dist);
    }

    select(tower, enemies, definition, context) {
      return this.candidates(tower, enemies, context).slice(0, definition.combat.maxTargets || this.defaultLimit);
    }
  }

  class SplashAttackPattern extends AttackPattern {
    select(tower, enemies, definition, context) {
      const candidates = this.candidates(tower, enemies, context);
      if (!candidates.length) return [];
      const focus = candidates[0];
      const radius = definition.combat.splashRadius || 72;
      const limit = definition.combat.maxTargets || this.defaultLimit;
      return candidates.filter(enemy => Math.hypot(enemy.x - focus.x, enemy.y - focus.y) < radius).slice(0, limit);
    }
  }

  class LineAttackPattern extends AttackPattern {
    select(tower, enemies, definition, context) {
      const candidates = this.candidates(tower, enemies, context);
      if (!candidates.length) return [];
      const origin = context.positionOf(tower);
      const focus = candidates[0];
      const dx = focus.x - origin.x, dy = focus.y - origin.y;
      const length = Math.max(1, Math.hypot(dx, dy));
      const limit = definition.combat.maxTargets || this.defaultLimit;
      const width = definition.combat.lineWidth || 42;
      return candidates.filter(enemy => {
        const ex = enemy.x - origin.x, ey = enemy.y - origin.y;
        const projection = (ex * dx + ey * dy) / length;
        const perpendicular = Math.abs(ex * dy - ey * dx) / length;
        return projection >= 0 && perpendicular <= width;
      }).slice(0, limit);
    }
  }

  class AttackPatternRegistry {
    constructor() { this.patterns = new Map(); }
    register(pattern) { this.patterns.set(pattern.key, pattern); return this; }
    get(key) {
      const pattern = this.patterns.get(key);
      if (!pattern) throw new Error(`Unknown attack pattern: ${key}`);
      return pattern;
    }

    static createDefault() {
      return new AttackPatternRegistry()
        .register(new AttackPattern('single', '单体重击', 1))
        .register(new AttackPattern('chain', '连锁攻击', 3))
        .register(new LineAttackPattern('pierce', '直线穿透', 5))
        .register(new SplashAttackPattern('splash', '范围溅射', 6))
        .register(new AttackPattern('omni', '全域攻击', 12));
    }
  }

  class Tower {
    constructor({ col, row, level = 1, evo = 'base', evoTier = 0, cool = 0, evolutionPath = null, growth = 0 } = {}) {
      if (!Number.isInteger(col) || !Number.isInteger(row)) throw new Error('Tower requires integer grid coordinates');
      this.col = col;
      this.row = row;
      this.level = level;
      this.evo = evo;
      this.evoTier = evoTier;
      this.cool = cool;
      this.evolutionPath = evolutionPath;
      this.growth = Math.max(0, Number(growth) || 0);
    }

    get definitionKey() { return this.evo; }

    branch(branchResolver) {
      return this.evo === 'base' ? (this.evolutionPath || 'base') : branchResolver(this.evo);
    }

    canMergeWith(other, { branchResolver = key => key, identityResolver = null, maxLevel, cultivation = false }) {
      const identityOf = identityResolver || (tower => tower.branch(branchResolver));
      return other instanceof Tower && other !== this && this.level < maxLevel && identityOf(this) === identityOf(other) &&
        (cultivation ? other.level <= this.level : this.level === other.level);
    }

    absorb(other, rules) {
      if (!this.canMergeWith(other, rules)) return false;
      if (rules.cultivation) {
        const sameLevel = this.level === other.level;
        const resonanceBonus = sameLevel ? Math.max(0, Number(rules.resonanceBonus?.(this.level, this) || 0)) : 0;
        const cultivationValue = Math.max(1, Number(rules.cultivationValue?.(other, this) || other.level));
        this.growth += cultivationValue + resonanceBonus;
        this.lastAbsorbKind = sameLevel && resonanceBonus > 0 ? 'resonance' : 'cultivation';
        const threshold = rules.growthThreshold || (level => Math.max(1, level));
        while (this.level < (rules.maxLevel || Infinity) && this.growth >= threshold(this.level, this)) {
          this.growth -= threshold(this.level, this);
          this.level += 1;
        }
      } else {
        const gain = Math.max(1, Number(rules.mergeGain?.(this.level, this, other) || 1));
        this.level = Math.min(rules.maxLevel || this.level + gain, this.level + gain);
      }
      this.cool = 0;
      return true;
    }

    sacrificeValue(rules = {}) {
      const efficiency = rules.efficiency || .6;
      const tierBonus = Math.max(0, this.evoTier || 0) * (rules.tierBonus || .15);
      const fusionBonus = rules.isFusion?.(this) ? (rules.fusionBonus || .25) : 0;
      return Math.max(1, Math.floor(this.level * (efficiency + tierBonus + fusionBonus)));
    }

    evolveTo(definitionKey, { tier = this.evoTier + 1, path = this.evolutionPath } = {}) {
      this.evo = definitionKey;
      this.evoTier = tier;
      this.evolutionPath = path;
      this.cool = 0;
      return this;
    }

    relocate(col, row) { this.col = col; this.row = row; return this; }

    updateCombat(dt, context) {
      this.cool -= dt;
      if (this.cool > 0) return [];
      const definition = context.catalog.get(this.definitionKey);
      const pattern = context.patterns.get(definition.attackMode);
      const targets = pattern.select(this, context.enemies, definition, context);
      if (!targets.length) return targets;

      const cooldownMultiplier = context.cooldownMultiplier?.(this, definition) || 1;
      this.cool = definition.rate * cooldownMultiplier;
      if (context.launch) {
        context.launch(this, targets, definition);
        return targets;
      }
      targets.forEach(target => context.damage(this, target, definition));
      if (definition.attackMode === 'chain' || definition.attackMode === 'pierce') {
        targets.forEach(target => context.visualize(this, target, definition));
      } else {
        context.visualize(this, targets[0], definition);
      }
      return targets;
    }

    snapshot() {
      return {
        col: this.col, row: this.row, level: this.level, evo: this.evo,
        evoTier: this.evoTier, cool: this.cool, evolutionPath: this.evolutionPath
        , growth: this.growth
      };
    }
  }

  class TowerFactory {
    constructor(catalog) { this.catalog = catalog; }
    create(state) {
      this.catalog.get(state?.evo || 'base');
      return new Tower(state);
    }
  }

  return {
    TowerDefinition,
    TowerCatalog,
    AttackPattern,
    SplashAttackPattern,
    LineAttackPattern,
    AttackPatternRegistry,
    Tower,
    TowerFactory
  };
});
