const assert = require('node:assert/strict');
const { EvolutionTree, EvolutionDefinition } = require('../evolution-system.js');

const tree = new EvolutionTree({
  base: { name: '种子' },
  fire: { name: '火', parent: null },
  fireA: { name: '火甲', parent: 'fire' },
  fireB: { name: '火乙', parent: 'fire' },
  water: { name: '水' }
});

const base = { evo: 'base', level: 5, evoTier: 0, evolutionPath: null };
assert.equal(tree.stageFor(base), 'primary');
assert.equal(tree.validateChoice(base, 'primary', 'fire').ok, true);
assert.equal(tree.validateChoice(base, 'branch', 'fireA').ok, false);

const evolved = { evo: 'fire', level: 10, evoTier: 1, evolutionPath: 'fire' };
assert.equal(tree.stageFor(evolved), 'branch');
assert.deepEqual(tree.choices('branch', 'fire', ['fireA', 'fireB', 'water'], 3, () => 0), ['fireA', 'fireB']);
assert.equal(tree.validateChoice(evolved, 'branch', 'water').ok, false);

console.log('evolution-system: 2 tests passed');

assert.deepEqual(tree.roots(), ['fire', 'water']);
assert.deepEqual(tree.children('fire'), ['fireA', 'fireB']);
assert.deepEqual(tree.lineage('fireA'), ['fire', 'fireA']);
assert(tree.get('fireA') instanceof EvolutionDefinition);

const decision = tree.begin(evolved, 'branch', () => 0);
assert.deepEqual(decision.choices(['fireA', 'fireB'], 3), ['fireA', 'fireB']);
assert.equal(decision.commit('water').ok, false);
assert.equal(decision.commit('fireA').ok, true);
assert.equal(decision.commit('fireB').reason, 'already-committed');
assert.equal(evolved.evo, 'fireA');

const fusionTree = new EvolutionTree({ base: { name: '种子' }, relic: { name: '遗物', fusion: true } });
assert.equal(fusionTree.stageFor({ evo: 'relic', level: 99, evoTier: 1 }), null);
console.log('evolution-system: graph and decision tests passed');
