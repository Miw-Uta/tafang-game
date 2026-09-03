(function exposeSynergyDomain(root, factory) {
  const domain = factory();
  if (typeof module === 'object' && module.exports) module.exports = domain;
  root.SynergyDomain = domain;
})(typeof globalThis !== 'undefined' ? globalThis : window, function createSynergyDomain() {
  class SynergyDefinition {
    constructor(key, data) {
      if (!key || !data?.name || !data?.tag || !Array.isArray(data?.tiers) || !data.tiers.length) {
        throw new Error(`Invalid synergy definition: ${key || 'unknown'}`);
      }
      const tiers = data.tiers.map(tier => Object.freeze({
        count: Math.max(1, Number(tier.count) || 1),
        damage: Math.max(0, Number(tier.damage) || 0),
        attackSpeed: Math.max(0, Number(tier.attackSpeed) || 0),
        range: Math.max(0, Number(tier.range) || 0),
        shieldBreak: Math.max(0, Number(tier.shieldBreak) || 0),
        armorBreak: Math.max(0, Number(tier.armorBreak) || 0),
        statusDuration: Math.max(0, Number(tier.statusDuration) || 0),
        spiritBonus: Math.max(0, Number(tier.spiritBonus) || 0),
        goldBonus: Math.max(0, Number(tier.goldBonus) || 0),
        bossDamage: Math.max(0, Number(tier.bossDamage) || 0)
      })).sort((left, right) => left.count - right.count);
      Object.assign(this, data, { key, scope: data.scope || 'members', tiers: Object.freeze(tiers) });
      Object.freeze(this);
    }

    tierFor(count) {
      return [...this.tiers].reverse().find(tier => count >= tier.count) || null;
    }

    nextTier(count) {
      return this.tiers.find(tier => count < tier.count) || null;
    }
  }

  class SynergyCatalog {
    constructor(config = {}) {
      this.definitions = new Map();
      Object.entries(config).forEach(([key, data]) => this.register(key, data));
    }

    register(key, data) {
      if (this.definitions.has(key)) throw new Error(`Synergy already exists: ${key}`);
      const definition = data instanceof SynergyDefinition ? data : new SynergyDefinition(key, data);
      this.definitions.set(key, definition);
      return definition;
    }

    values() { return [...this.definitions.values()]; }
  }

  class SynergySystem {
    constructor(config, { tagResolver, identityResolver = unit => unit.evo } = {}) {
      if (typeof tagResolver !== 'function') throw new Error('SynergySystem requires a tagResolver');
      this.catalog = config instanceof SynergyCatalog ? config : new SynergyCatalog(config);
      this.tagResolver = tagResolver;
      this.identityResolver = identityResolver;
    }

    evaluate(units) {
      const uniqueUnits = new Map();
      units.forEach(unit => uniqueUnits.set(this.identityResolver(unit), unit));
      return this.catalog.values().map(definition => {
        const members = [...uniqueUnits.values()].filter(unit => (this.tagResolver(unit) || []).includes(definition.tag));
        return Object.freeze({
          definition,
          count: members.length,
          members: Object.freeze(members),
          tier: definition.tierFor(members.length),
          nextTier: definition.nextTier(members.length)
        });
      });
    }

    modifiersFor(unit, evaluation, amplification = 1) {
      let damage = 0, attackSpeed = 0, range = 0, shieldBreak = 0, armorBreak = 0;
      let statusDuration = 0, spiritBonus = 0, goldBonus = 0, bossDamage = 0;
      const unitTags = new Set(this.tagResolver(unit) || []);
      evaluation.forEach(result => {
        if (!result.tier) return;
        if (result.definition.scope === 'members' && !unitTags.has(result.definition.tag)) return;
        damage += result.tier.damage * amplification;
        attackSpeed += result.tier.attackSpeed * amplification;
        range += result.tier.range * amplification;
        shieldBreak += result.tier.shieldBreak * amplification;
        armorBreak += result.tier.armorBreak * amplification;
        statusDuration += result.tier.statusDuration * amplification;
        spiritBonus += result.tier.spiritBonus * amplification;
        goldBonus += result.tier.goldBonus * amplification;
        bossDamage += result.tier.bossDamage * amplification;
      });
      return Object.freeze({
        damage: 1 + damage,
        cooldown: 1 / (1 + Math.min(.8, attackSpeed)),
        range: 1 + Math.min(.35, range),
        shieldBreak,
        armorBreak,
        statusDuration: 1 + Math.min(1, statusDuration),
        spiritBonus,
        goldBonus,
        bossDamage
      });
    }
  }

  return { SynergyDefinition, SynergyCatalog, SynergySystem };
});
