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
        attackSpeed: Math.max(0, Number(tier.attackSpeed) || 0)
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
      let damage = 0, attackSpeed = 0;
      const unitTags = new Set(this.tagResolver(unit) || []);
      evaluation.forEach(result => {
        if (!result.tier) return;
        if (result.definition.scope === 'members' && !unitTags.has(result.definition.tag)) return;
        damage += result.tier.damage * amplification;
        attackSpeed += result.tier.attackSpeed * amplification;
      });
      return Object.freeze({
        damage: 1 + damage,
        cooldown: 1 / (1 + Math.min(.8, attackSpeed))
      });
    }
  }

  return { SynergyDefinition, SynergyCatalog, SynergySystem };
});
