const assert = require('node:assert/strict');
const { SynergyDefinition, SynergyCatalog, SynergySystem } = require('../synergy-system.js');

const config = {
  forge: { name: '锻造', tag: 'faction:forge', tiers: [{ count: 2, damage: .1 }, { count: 4, damage: .25 }] },
  caster: { name: '术士', tag: 'role:chain', tiers: [{ count: 2, attackSpeed: .12 }] },
  oracle: { name: '神谕', tag: 'role:omni', scope: 'all', tiers: [{ count: 1, damage: .05 }] }
};
const catalog = new SynergyCatalog(config);
assert(catalog.values()[0] instanceof SynergyDefinition);
assert.equal(catalog.values()[0].tierFor(3).damage, .1);
assert.equal(catalog.values()[0].nextTier(3).count, 4);

const tags = {
  metal: ['faction:forge','role:single'],
  fire: ['faction:forge','role:chain'],
  thunder: ['role:chain'],
  fusion: ['role:omni']
};
const system = new SynergySystem(config, { tagResolver: unit => tags[unit.evo] });
const metal = { evo: 'metal' }, duplicateMetal = { evo: 'metal' }, fire = { evo: 'fire' }, thunder = { evo: 'thunder' }, fusion = { evo: 'fusion' };
const evaluation = system.evaluate([metal, duplicateMetal, fire, thunder, fusion]);

assert.equal(evaluation.find(result => result.definition.key === 'forge').count, 2, 'duplicate forms should count once');
assert.equal(evaluation.find(result => result.definition.key === 'caster').count, 2);
assert.equal(system.modifiersFor(metal, evaluation).damage, 1.15, 'member and global bonuses should stack');
assert.equal(system.modifiersFor(metal, evaluation).cooldown, 1);
assert.equal(system.modifiersFor(fire, evaluation).cooldown, 1 / 1.12);
assert.equal(system.modifiersFor(fire, evaluation, 1.25).damage, 1.1875);
assert.equal(system.modifiersFor(fire, evaluation, 1.25).cooldown, 1 / 1.15);

assert.throws(() => new SynergySystem(config), /tagResolver/);
assert.throws(() => new SynergyCatalog({ broken: { name: '坏定义', tiers: [] } }), /Invalid synergy/);

console.log('synergy-system: unique forms, tiers, scopes and amplification passed');
