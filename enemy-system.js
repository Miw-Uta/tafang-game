(function exposeEnemyDomain(root, factory) {
  const domain = factory();
  if (typeof module === 'object' && module.exports) module.exports = domain;
  root.EnemyDomain = domain;
})(typeof globalThis !== 'undefined' ? globalThis : window, function createEnemyDomain() {
  const STATUS_KEYS = ['slow', 'stun', 'taiji', 'weaken', 'silence', 'freeze', 'burn', 'poison', 'knockback'];
  const SPEED_LIMITS = Object.freeze({ min: 24, max: 86 });

  class EnemyDefinition {
    constructor(key, data) {
      if (!key || !data?.name || !data?.role) throw new Error(`Invalid enemy definition: ${key || 'unknown'}`);
      Object.assign(this, data, {
        key,
        unlockWave: data.unlockWave || 1,
        weight: data.weight || 1,
        modifiers: Object.freeze({ ...(data.modifiers || {}) }),
        abilities: Object.freeze([...(data.abilities || [])]),
        tags: Object.freeze([data.role, ...(data.tags || [])])
      });
      Object.freeze(this);
    }
  }

  class TraitDefinition {
    constructor(key, data) {
      if (!key || !data?.label) throw new Error(`Invalid enemy trait: ${key || 'unknown'}`);
      Object.assign(this, data, { key, modifiers: Object.freeze({ ...(data.modifiers || {}) }) });
      Object.freeze(this);
    }
  }

  class DefinitionCatalog {
    constructor(DefinitionClass) {
      this.DefinitionClass = DefinitionClass;
      this.definitions = new Map();
    }
    register(key, data) {
      if (this.definitions.has(key)) throw new Error(`Definition already exists: ${key}`);
      const definition = data instanceof this.DefinitionClass ? data : new this.DefinitionClass(key, data);
      this.definitions.set(key, definition);
      return definition;
    }
    get(key) {
      const definition = this.definitions.get(key);
      if (!definition) throw new Error(`Unknown definition: ${key}`);
      return definition;
    }
    values() { return [...this.definitions.values()]; }
    static fromConfig(DefinitionClass, config) {
      const catalog = new DefinitionCatalog(DefinitionClass);
      Object.entries(config).forEach(([key, value]) => catalog.register(key, value));
      return catalog;
    }
  }

  class StatusController {
    constructor(owner) {
      this.owner = owner;
      this.sources = new Map();
      STATUS_KEYS.forEach(key => { owner[key] = 0; });
    }
    apply(key, duration, source = null) {
      if (!STATUS_KEYS.includes(key)) throw new Error(`Unknown enemy status: ${key}`);
      if (this.owner.statusImmunity.includes(key) || (this.owner.shield > 0 && this.owner.shieldStatusImmunity.includes(key))) return 0;
      if (key === 'stun' && this.owner.type === 'boss' && (this.owner.stun > 0 || this.owner.stunRecovery > 0)) return 0;
      const resistance = ['slow', 'silence', 'freeze'].includes(key) ? this.owner.slowResist : 0;
      const adjusted = Math.max(0, duration * (1 - resistance));
      this.owner[key] = Math.max(this.owner[key] || 0, adjusted);
      if (source) this.sources.set(key, source);
      return adjusted;
    }
    sourceOf(key) { return this.sources.get(key) || null; }
    clear(key) { this.owner[key] = 0; this.sources.delete(key); }
    tick(dt) {
      this.owner.stunRecovery = Math.max(0, this.owner.stunRecovery - dt);
      STATUS_KEYS.forEach(key => {
        const previous = this.owner[key];
        if (this.owner[key] > 0) this.owner[key] = Math.max(0, this.owner[key] - dt);
        if (key === 'stun' && previous > 0 && !this.owner.stun && this.owner.type === 'boss') {
          this.owner.stunRecovery = Math.max(this.owner.stunRecovery, 1.5 - Math.max(0, dt - previous));
        }
        if (!this.owner[key]) this.sources.delete(key);
      });
    }
  }

  class Enemy {
    constructor(definition, { maxHp, baseSpeed, resist = {}, traits = [] } = {}) {
      if (!(definition instanceof EnemyDefinition)) throw new Error('Enemy requires an EnemyDefinition');
      this.definition = definition;
      this.archetype = definition.key;
      this.type = definition.role;
      this.kind = definition.icon;
      this.radius = definition.radius;
      this.rewardMultiplier = definition.reward;
      this.lifeCost = definition.lifeCost;
      this.max = maxHp;
      this.hp = maxHp;
      this.baseSpeed = baseSpeed;
      this.speed = baseSpeed;
      this.dist = 0;
      this.x = -30;
      this.y = 90;
      this.dead = false;
      this.armor = 0;
      this.slowResist = 0;
      this.evasion = 0;
      this.attackModeMultipliers = {};
      this.shieldModeMultipliers = {};
      this.regen = 0;
      this.enraged = false;
      this.shield = 0;
      this.maxShield = 0;
      this.statusImmunity = [];
      this.shieldStatusImmunity = [];
      this.shieldResist = {};
      this.shieldRegen = 0;
      this.shieldRechargeDelay = 0;
      this.shieldBroken = 0;
      this.stunRecovery = 0;
      this.combatTimer = 0;
      this.aura = null;
      this.auraDamageReduction = 0;
      this.phase = 0;
      this.resist = { ...resist };
      this.traits = [];
      this.statuses = new StatusController(this);
      this.applyModifiers(definition.modifiers);
      traits.forEach(trait => this.addTrait(trait));
      this.baseSpeed = Math.max(SPEED_LIMITS.min, Math.min(SPEED_LIMITS.max, this.baseSpeed));
      this.speed = this.baseSpeed;
    }

    applyModifiers(modifiers = {}) {
      if (modifiers.healthMultiplier) { this.max *= modifiers.healthMultiplier; this.hp = this.max; }
      if (modifiers.speedMultiplier) { this.baseSpeed *= modifiers.speedMultiplier; this.speed *= modifiers.speedMultiplier; }
      this.armor += modifiers.armor || 0;
      this.slowResist += modifiers.slowResist || 0;
      this.evasion = Math.max(this.evasion, modifiers.evasion || 0);
      if (modifiers.attackModeMultipliers) this.attackModeMultipliers = { ...this.attackModeMultipliers, ...modifiers.attackModeMultipliers };
      if (modifiers.shieldModeMultipliers) this.shieldModeMultipliers = { ...this.shieldModeMultipliers, ...modifiers.shieldModeMultipliers };
      if (modifiers.resist) this.resist = { ...this.resist, ...Object.fromEntries(Object.entries(modifiers.resist).map(([key, value]) => [key, Math.max(this.resist[key] || 0, value)])) };
      this.regen += this.max * (modifiers.regenRatio || 0);
      if (modifiers.shieldRatio) { this.maxShield += this.max * modifiers.shieldRatio; this.shield = this.maxShield; }
      if (modifiers.statusImmunity) this.statusImmunity = [...new Set([...this.statusImmunity, ...modifiers.statusImmunity])];
      if (modifiers.shieldStatusImmunity) this.shieldStatusImmunity = [...new Set([...this.shieldStatusImmunity, ...modifiers.shieldStatusImmunity])];
      if (modifiers.shieldResist) this.shieldResist = { ...this.shieldResist, ...modifiers.shieldResist };
      if (modifiers.shieldRegenRatio) this.shieldRegen += this.max * modifiers.shieldRegenRatio;
      if (modifiers.shieldRechargeDelay) this.shieldRechargeDelay = Math.max(this.shieldRechargeDelay, modifiers.shieldRechargeDelay);
      if (modifiers.aura) this.aura = { ...modifiers.aura };
      if (modifiers.phase) this.phase = { ...modifiers.phase };
      this.enraged ||= Boolean(modifiers.enraged);
    }

    addTrait(trait) {
      if (!(trait instanceof TraitDefinition) || this.traits.includes(trait.key)) return false;
      this.traits.push(trait.key);
      this.applyModifiers(trait.modifiers);
      return true;
    }

    applyStatus(key, duration, source = null) { return this.statuses.apply(key, duration, source); }

    receiveDamage(amount, lineage = 'base', attackMode = null) {
      if (this.dead || amount <= 0) return 0;
      const vulnerability = (this.taiji > 0 ? 1.3 : 1) * (1 - this.auraDamageReduction);
      const effectiveArmor = Math.max(0, this.armor - (this.weaken > 0 ? .3 : 0) - (this._synergyArmorBreak || 0));
      const resistance = Math.max(0, Math.min(.9, this.resist[lineage] || 0));
      const controlled = this.slow > 0 || this.stun > 0 || this.freeze > 0;
      const evasionMultiplier = controlled ? 1 : 1 - this.evasion;
      const roleMultiplier = attackMode === 'single' ? (this.type === 'boss' ? 1.9 : this.type === 'elite' ? 1.55 : 1) : 1;
      const modeMultiplier = attackMode ? this.attackModeMultipliers[attackMode] || 1 : 1;
      const dealt = amount * vulnerability * (1 - effectiveArmor) * (1 - resistance) * evasionMultiplier * roleMultiplier * modeMultiplier * (this.shieldBroken > 0 ? 1.15 : 1);
      const shieldModeMultiplier = (attackMode ? this.shieldModeMultipliers[attackMode] || 1 : 1) * (1 + Math.max(0, Math.min(.8, this._synergyShieldBreak || 0)));
      const shieldDamageMultiplier = shieldModeMultiplier * (1 - Math.max(0, Math.min(.8, this.shieldResist[lineage] || 0)));
      const shieldDealt = dealt * shieldDamageMultiplier;
      const absorbed = Math.min(this.shield, shieldDealt);
      this.shield -= absorbed;
      // Shield damage bonuses spend less of the incoming health damage on breaking the shield.
      const absorbedHealthDamage = absorbed === shieldDealt ? dealt : absorbed / shieldDamageMultiplier;
      this.hp -= Math.max(0, dealt - absorbedHealthDamage);
      this.combatTimer = 0;
      if (this.maxShield > 0 && this.shield <= 0 && absorbed > 0) this.shieldBroken = 2.5;
      return dealt;
    }

    update(dt, context) {
      if (this.dead) return { dead: true, escaped: false };
      const burnTime = Math.min(dt, this.burn);
      const poisonTime = Math.min(dt, this.poison);
      const lethalSource = burnTime > 0 ? this.statuses.sourceOf('burn') : poisonTime > 0 ? this.statuses.sourceOf('poison') : null;
      if (burnTime > 0) this.receiveDamage(burnTime * 11, 'fire', 'dot');
      if (poisonTime > 0) this.receiveDamage(poisonTime * 8, 'poison', 'dot');
      const rage = this.enraged && this.hp / this.max < .5 ? 1.45 : 1;
      let controlScale = this.stun > 0 ? 0 : this.freeze > 0 ? .22 : this.slow > 0 ? .48 : 1;
      this.statuses.tick(dt);
      this.shieldBroken = Math.max(0, this.shieldBroken - dt);
      this.combatTimer += dt;
      if (this.shield <= 0 && this.maxShield > 0 && this.shieldRegen > 0 && this.combatTimer >= this.shieldRechargeDelay) this.shield = Math.min(this.maxShield, this.shield + this.shieldRegen * dt);
      if (this.hp <= 0) {
        if (lethalSource) context.onDotLethal?.(lethalSource, this);
        return { dead: this.dead || this.hp <= 0, escaped: false };
      }
      if (this.phase && !this.phase.active && this.hp / this.max <= this.phase.threshold) {
        this.phase.active = true;
        if (this.phase.speedMultiplier) this.speed = Math.min(SPEED_LIMITS.max, this.baseSpeed * this.phase.speedMultiplier);
        if (this.phase.shieldRatio) { this.maxShield += this.max * this.phase.shieldRatio; this.shield = this.max * this.phase.shieldRatio; }
        if (this.phase.statusImmunity) {
          this.statusImmunity = [...new Set([...this.statusImmunity, ...this.phase.statusImmunity])];
          this.phase.statusImmunity.forEach(key => this.statuses.clear(key));
          controlScale = this.stun > 0 ? 0 : this.freeze > 0 ? .22 : this.slow > 0 ? .48 : 1;
        }
        context.onPhaseChange?.(this);
      }
      this.auraDamageReduction = 0;
      this.speed = Math.min(SPEED_LIMITS.max, this.baseSpeed * (this.phase?.active && this.phase.speedMultiplier || 1));
      if (context.enemies) context.enemies.forEach(other => {
        if (other === this || other.dead || !other.aura) return;
        const separation = Number.isFinite(other.x) && Number.isFinite(this.x) ? Math.hypot(other.x - this.x, other.y - this.y) : Math.abs(other.dist - this.dist);
        if (separation <= (other.aura.radius || 90)) {
          this.auraDamageReduction = Math.max(this.auraDamageReduction, other.aura.damageReduction || 0);
          if (other.aura.speedMultiplier) this.speed = Math.min(SPEED_LIMITS.max, this.baseSpeed * 1.35, this.speed * (1 + (other.aura.speedMultiplier - 1) * dt * 4));
        }
      });
      if (this.regen > 0) this.hp = Math.min(this.max, this.hp + this.regen * dt);
      this.dist += this.speed * rage * controlScale * dt;
      Object.assign(this, context.positionAt(this.dist));
      if (this.dist >= context.pathLength) {
        this.dead = true;
        context.onEscape?.(this);
        return { dead: true, escaped: true };
      }
      return { dead: false, escaped: false };
    }
  }

  class EnemyFactory {
    constructor(enemyCatalog, traitCatalog) {
      this.enemyCatalog = enemyCatalog;
      this.traitCatalog = traitCatalog;
    }
    create({ archetype, maxHp, baseSpeed, resist, traits = [] }) {
      const definition = this.enemyCatalog.get(archetype);
      const resolvedTraits = traits.map(trait => typeof trait === 'string' ? this.traitCatalog.get(trait) : trait);
      return new Enemy(definition, { maxHp, baseSpeed, resist, traits: resolvedTraits });
    }
  }

  class SpawnDirector {
    constructor(enemyCatalog, traitCatalog, factory, random = Math.random) {
      this.enemyCatalog = enemyCatalog;
      this.traitCatalog = traitCatalog;
      this.factory = factory;
      this.random = random;
    }
    roleFor(wave, spawnIndex) {
      if (wave >= 5 && wave % 5 === 0 && spawnIndex === 0) return 'boss';
      if (wave >= 2 && (spawnIndex % 5 === 4 || this.random() < Math.min(.28, wave * .018))) return 'elite';
      return 'normal';
    }
    weightedChoice(items) {
      const total = items.reduce((sum, item) => sum + item.weight, 0);
      let roll = this.random() * total;
      return items.find(item => (roll -= item.weight) <= 0) || items[0];
    }
    create({ wave, spawnIndex, hpScale, speedScale, resist, primaryTrait = null, neutral = false, archetype = null, roster = [] }) {
      const role = this.roleFor(wave, spawnIndex);
      const rosterPool = roster.length ? this.enemyCatalog.values().filter(item => roster.includes(item.key)) : [];
      const pool = rosterPool.length ? rosterPool : this.enemyCatalog.values().filter(item => item.role === role && item.unlockWave <= wave);
      const definition = archetype ? this.enemyCatalog.get(archetype) : this.weightedChoice(pool);
      const traits = [];
      if (primaryTrait) traits.push(primaryTrait);
      const traitPool = this.traitCatalog.values().map(item => item.key).filter(key => key !== primaryTrait);
      const traitSlots = neutral ? 0 : definition.traitCount;
      while (traits.length < traitSlots && traitPool.length) traits.push(traitPool.splice(Math.floor(this.random() * traitPool.length), 1)[0]);
      return this.factory.create({
        archetype: definition.key,
        maxHp: hpScale * definition.hp,
        baseSpeed: speedScale * definition.speed,
        resist,
        traits
      });
    }
  }

  return { SPEED_LIMITS, EnemyDefinition, TraitDefinition, DefinitionCatalog, StatusController, Enemy, EnemyFactory, SpawnDirector };
});
