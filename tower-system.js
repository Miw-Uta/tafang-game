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
      const candidates = enemies
        .filter(enemy => !enemy.dead && Math.hypot(enemy.x - position.x, enemy.y - position.y) < radius)
      const progress = enemy => enemy.routeProgress ?? enemy.dist ?? 0;
      const priority = tower.targeting || 'front';
      const prioritized = priority === 'demolish' ? candidates.filter(enemy => enemy.isStructure) : candidates.filter(enemy => !enemy.isStructure);
      return prioritized.sort((left, right) => {
        if (priority === 'back') return progress(left) - progress(right);
        if (priority === 'strong') return (right.hp - left.hp) || progress(right) - progress(left);
        if (priority === 'weak') return (left.hp / Math.max(1, left.max || left.hp)) - (right.hp / Math.max(1, right.max || right.hp)) || progress(right) - progress(left);
        return progress(right) - progress(left);
      });
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
    constructor({ col, row, level = 1, evo = 'base', evoTier = 0, cool = 0, evolutionPath = null, growth = 0, targeting = 'front' } = {}) {
      if (!Number.isInteger(col) || !Number.isInteger(row)) throw new Error('Tower requires integer grid coordinates');
      this.col = col;
      this.row = row;
      this.level = level;
      this.evo = evo;
      this.evoTier = evoTier;
      this.cool = cool;
      this.evolutionPath = evolutionPath;
      this.growth = Math.max(0, Number(growth) || 0);
      this.targeting = targeting || 'front';
      this.attackAnimation = null;
      this.attackSequence = 0;
    }

    get definitionKey() { return this.evo; }

    branch(branchResolver) {
      return this.evo === 'base' ? (this.evolutionPath || 'base') : branchResolver(this.evo);
    }

    canMergeWith(other, { branchResolver = key => key, identityResolver = null, maxLevel, progressiveMerge = false }) {
      const identityOf = identityResolver || (tower => tower.branch(branchResolver));
      return other instanceof Tower && other !== this && this.level < maxLevel && identityOf(this) === identityOf(other) &&
        (progressiveMerge ? other.level <= this.level : this.level === other.level);
    }

    absorb(other, rules) {
      if (!this.canMergeWith(other, rules)) return false;
      if (rules.progressiveMerge) {
        const sameLevel = this.level === other.level;
        const resonanceBonus = sameLevel ? Math.max(0, Number(rules.resonanceBonus?.(this.level, this) || 0)) : 0;
        const materialValue = Math.max(1, Number(rules.mergeMaterialValue?.(other, this) || other.level));
        this.growth += materialValue + resonanceBonus;
        this.lastAbsorbKind = sameLevel && resonanceBonus > 0 ? 'resonance' : 'material';
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

    evolveTo(definitionKey, { tier = this.evoTier + 1, path = this.evolutionPath } = {}) {
      this.evo = definitionKey;
      this.evoTier = tier;
      this.evolutionPath = path;
      this.cool = 0;
      return this;
    }

    relocate(col, row) { this.col = col; this.row = row; return this; }

    beginAttack(definition, targets = [], options = {}) {
      if (this.attackAnimation && this.attackAnimation.age < this.attackAnimation.duration * .62) {
        this.queuedAttack = { definition, targets: [...targets], options };
        return this.attackAnimation;
      }
      const weapon = definition?.combat?.weapon || 'seedshot';
      const durations = { boomerang: .52, rocket: .42, waterjet: .62, scatter: .4, drill: .42, meteor: 1.2, lightning: .42, mine: 1, sunbeam: 1.02, shadowOrbit: .62, quake: .82 };
      const duration = definition?.combat?.animationDuration || durations[weapon] || .36;
      const releaseAt = Math.max(.04, Math.min(duration - .02, Number(options.releaseAt ?? definition?.combat?.releaseAt ?? duration * .4)));
      this.attackSequence += 1;
      this.attackAnimation = {
        weapon, age: 0, duration,
        target: targets[0] || null, sequence: this.attackSequence,
        releaseAt, released: false,
        onRelease: options.onRelease,
        motion: { anticipation: 0, strike: 0, recovery: 0 }
      };
      const tween = typeof globalThis !== 'undefined' ? globalThis.TWEEN : null;
      if (tween?.Tween && tween?.Group) {
        const motion = this.attackAnimation.motion;
        const group = new tween.Group();
        const prep = Math.min(150, duration * 1000 * .22);
        const burst = Math.min(150, duration * 1000 * .24);
        const hold = Math.min(90, duration * 1000 * .12);
        const recover = Math.max(80, duration * 1000 - prep - burst - hold);
        const easing = tween.Easing?.Quadratic?.InOut || (value => value);
        const snap = tween.Easing?.Cubic?.Out || easing;
        const returnEase = tween.Easing?.Cubic?.InOut || easing;
        const prepTween = new tween.Tween(motion, group).to({ anticipation: 1 }, prep).easing(easing);
        const burstTween = new tween.Tween(motion, group).to({ strike: 1 }, burst).easing(snap);
        const holdTween = new tween.Tween(motion, group).to({ strike: 1 }, hold).easing(value => value);
        const recoverTween = new tween.Tween(motion, group).to({ recovery: 1 }, recover).easing(returnEase);
        prepTween.chain(burstTween); burstTween.chain(holdTween); holdTween.chain(recoverTween);
        this.attackAnimation.timeline = group;
        prepTween.start(0);
      }
      options.onStart?.(this.attackAnimation);
      return this.attackAnimation;
    }

    updateAttackAnimation(dt) {
      if (!this.attackAnimation) return;
      this.attackAnimation.age += dt;
      if (this.attackAnimation.timeline?.update) this.attackAnimation.timeline.update(this.attackAnimation.age * 1000);
      if (!this.attackAnimation.released && this.attackAnimation.age >= this.attackAnimation.releaseAt) {
        this.attackAnimation.released = true;
        this.attackAnimation.onRelease?.(this.attackAnimation);
      }
      if (this.attackAnimation.age > this.attackAnimation.duration + .16) {
        const queued = this.queuedAttack;
        this.attackAnimation = null;
        this.queuedAttack = null;
        if (queued) this.beginAttack(queued.definition, queued.targets, queued.options);
      }
    }

    updateCombat(dt, context) {
      this.updateAttackAnimation(dt);
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
      this.beginAttack(definition, targets);
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
        , growth: this.growth, targeting: this.targeting || 'front'
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
