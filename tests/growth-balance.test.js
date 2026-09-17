const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

function game(randomValue = 0) {
  const elements = new Map();
  const classList = () => {
    const values = new Set();
    return { add: value => values.add(value), remove: value => values.delete(value), contains: value => values.has(value), toggle() {} };
  };
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      id, textContent: '', innerHTML: '', hidden: false, disabled: false,
      style: {}, dataset: {}, classList: classList(),
      addEventListener() {}, setAttribute() {}, setPointerCapture() {},
      querySelectorAll: () => [],
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 540 })
    });
    return elements.get(id);
  };
  element('game').getContext = () => new Proxy({}, { get: () => () => {} });
  const document = { body: { classList: classList(), dataset: {} }, getElementById: element, querySelector: () => element('query'), querySelectorAll: () => [] };
  const isolatedMath = Object.create(Math);
  isolatedMath.random = () => randomValue;
  const context = vm.createContext({
    console, document, window: { matchMedia: () => ({ matches: false }), addEventListener() {} },
    Math: isolatedMath, performance: { now: () => 0 }, requestAnimationFrame() {}, setTimeout, clearTimeout
  });
  for (const file of ['content-system.js', 'game-content.js', 'enemy-system.js', 'evolution-system.js', 'tower-system.js', 'synergy-system.js', 'campaign-system.js', 'game.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  return source => JSON.parse(vm.runInContext(`JSON.stringify((() => { ${source} })())`, context));
}

test('cultivation crosses a growth threshold once and preserves surplus', () => {
  const run = game();
  const result = run(`
    selectedTower = towerFactory.create({ col: 1, row: 6, level: 2, growth: 11 });
    towers = [selectedTower]; coins = 0; germinationOffers = [{ kind: 'cultivate', level: 3 }];
    const accepted = claimGermination(0), first = selectedTower.snapshot();
    const repeated = claimGermination(0);
    return { accepted, repeated, first, current: selectedTower.snapshot(), offers: germinationOffers.length };
  `);
  assert.equal(result.accepted, true);
  assert.equal(result.first.level, 3);
  assert.equal(result.first.growth, 2);
  assert.equal(result.repeated, false);
  assert.deepEqual(result.current, result.first);
  assert.equal(result.offers, 0);
});

test('cultivation opens the existing primary and branch evolution decisions', () => {
  for (const [level, evo, tier, stage] of [[4, 'base', 0, 'primary'], [9, 'fire', 1, 'branch']]) {
    const run = game();
    const result = run(`
      selectedTower = towerFactory.create({ col: 1, row: 6, level: ${level}, evo: '${evo}', evoTier: ${tier}, evolutionPath: ${tier ? `'${evo}'` : 'null'}, growth: growthThreshold(${level}) - 1 });
      towers = [selectedTower]; coins = 0; paused = false; germinationOffers = [{ kind: 'cultivate', level: 2 }];
      const accepted = claimGermination(0);
      return { accepted, level: selectedTower.level, growth: selectedTower.growth, stage: pendingEvolutionStage, pending: pendingEvolution === selectedTower, paused, offers: germinationOffers.length };
    `);
    assert.deepEqual(result, { accepted: true, level: level + 1, growth: 1, stage, pending: true, paused: true, offers: 0 });
  }
});

test('cultivation rejects absent, recalled, max-level or unresolved targets without consuming the offer', () => {
  const targets = [
    'selectedTower = null;',
    "selectedTower = towerFactory.create({ col: 1, row: 6, level: 2 }); towers = [];",
    "selectedTower = towerFactory.create({ col: 1, row: 6, level: 20, evo: 'fireBranch1', evoTier: 2, evolutionPath: 'fire' }); towers = [selectedTower];",
    'selectedTower = towerFactory.create({ col: 1, row: 6, level: 5 }); towers = [selectedTower];'
  ];
  for (const setup of targets) {
    const run = game();
    const result = run(`
      coins = 73; reserve = {}; germinationOffers = [{ kind: 'cultivate', level: 5 }]; ${setup}
      const before = JSON.stringify({ coins, reserve, germinationOffers, growthCycles });
      const accepted = claimGermination(0);
      return { accepted, unchanged: before === JSON.stringify({ coins, reserve, germinationOffers, growthCycles }), message: $('message').textContent };
    `);
    assert.equal(result.accepted, false);
    assert.equal(result.unchanged, true);
    assert.match(result.message, /培育|进化/);
  }
});

test('cultivation can reach the level cap and cannot be undone into duplicated resources', () => {
  const run = game();
  const result = run(`
    towers = [towerFactory.create({ col: 1, row: 6, level: 2 }), towerFactory.create({ col: 1, row: 0, level: 2 })];
    autoMerge();
    const merged = towers[0];
    coins = 0; germinationOffers = [{ kind: 'cultivate', level: 1 }]; claimGermination(0); undoAutoMerge();
    const undoInvalidated = towers.length === 1 && towers[0] === merged;
    selectedTower = towerFactory.create({ col: 1, row: 6, level: 19, evo: 'fireBranch1', evoTier: 2, evolutionPath: 'fire', growth: growthThreshold(19)-1 });
    towers = [selectedTower]; germinationOffers = [{ kind: 'cultivate', level: 5 }]; claimGermination(0);
    return { undoInvalidated, level: selectedTower.level, growth: selectedTower.growth, finalWave, pending: pendingEvolution };
  `);
  assert.deepEqual(result, { undoInvalidated: true, level: 20, growth: 0, finalWave: true, pending: null });
});

test('paid growth has a reproducible opening and each root keeps its own sequence', () => {
  const outcomes = [0, .99].map(random => game(random)(`
    return Array.from({ length: 8 }, () => nextGerminationOffer());
  `));
  assert.deepEqual(outcomes[0], outcomes[1]);
  assert.deepEqual(outcomes[0].slice(0, 3).map(offer => offer.kind), ['seed', 'seed', 'seed']);
  const result = game()(`
    growthMode = 'sprout'; for (let i = 0; i < 3; i++) nextGerminationOffer();
    growthMode = 'refine'; const first = nextGerminationOffer();
    growthMode = 'balanced'; const balanced = nextGerminationOffer();
    growthMode = 'refine'; const second = nextGerminationOffer();
    return { first: first.level, second: second.level, balanced: balanced.level, total: growthCycles.total };
  `);
  assert.deepEqual(result, { first: 3, second: 4, balanced: 1, total: 6 });
});

test('reroll changes delivery only, never resource grade or paid progression', () => {
  const result = game(.99)(`
    coins = 200; growthMode = 'refine';
    germinationOffers = [{ kind: 'seed', level: 1, claimed: true }, { kind: 'seed', level: 1 }, { kind: 'cultivate', level: 3 }];
    const cycles = JSON.stringify(growthCycles);
    const accepted = refreshGermination(), first = germinationOffers.map(offer => ({ ...offer }));
    for (let i = 0; i < 4; i++) refreshGermination();
    return { accepted, first, levels: germinationOffers.map(offer => offer.level), unchanged: cycles === JSON.stringify(growthCycles), coins };
  `);
  assert.equal(result.accepted, true);
  assert.deepEqual(result.first, [{ kind: 'cultivate', level: 1 }, { kind: 'seed', level: 3 }]);
  assert.deepEqual(result.levels, [1, 3]);
  assert.equal(result.unchanged, true);
  assert.equal(result.coins, 100);
});

test('reroll cannot spend resources during an unresolved evolution', () => {
  const result = game()(`
    coins = 80; germinationOffers = [{ kind: 'seed', level: 2 }]; pendingEvolution = towers[0];
    const before = JSON.stringify({ coins, germinationOffers, growthCycles });
    return { accepted: refreshGermination(), unchanged: before === JSON.stringify({ coins, germinationOffers, growthCycles }) };
  `);
  assert.deepEqual(result, { accepted: false, unchanged: true });
});
