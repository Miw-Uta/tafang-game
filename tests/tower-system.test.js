const assert = require('node:assert/strict');
const {
  TowerCatalog,
  TowerFactory,
  AttackPatternRegistry
} = require('../tower-system.js');

function createFixture() {
  const catalog = TowerCatalog.fromConfig({
    base: { name: '种子塔', attackMode: 'single', damage: 10, rangeCells: 3, rate: 1 },
    wood: { name: '木塔', attackMode: 'pierce', damage: 9, rangeCells: 5, rate: .6, combat: { lineWidth: 18 } },
    water: { name: '水塔', attackMode: 'chain', damage: 8, rangeCells: 5, rate: .5, combat: { maxTargets: 2 } },
    fire: { name: '火塔', attackMode: 'splash', damage: 12, rangeCells: 4, rate: .8, combat: { splashRadius: 30 } }
  });
  return { catalog, factory: new TowerFactory(catalog), patterns: AttackPatternRegistry.createDefault() };
}

function combatContext(catalog, patterns, enemies, damageLog, visualLog) {
  return {
    catalog, patterns, enemies,
    positionOf: tower => ({ x: tower.col * 60 + 30, y: tower.row * 60 + 30 }),
    rangeOf: () => 300,
    damage: (tower, enemy, definition) => damageLog.push([tower, enemy, definition]),
    visualize: (tower, enemy) => visualLog.push([tower, enemy])
  };
}

function testCatalogAndFactory() {
  const { catalog, factory } = createFixture();
  assert.equal(catalog.get('water').kind, 'element');
  assert.ok(Object.isFrozen(catalog.get('water')));
  assert.throws(() => factory.create({ col: 0, row: 0, evo: 'missing' }), /Unknown tower/);
  assert.equal(factory.create({ col: 2, row: 3 }).snapshot().evo, 'base');
}

function testMergeRulesAndEvolution() {
  const { factory } = createFixture();
  const left = factory.create({ col: 0, row: 0, level: 4 });
  const right = factory.create({ col: 1, row: 0, level: 4 });
  const rules = { branchResolver: key => key, maxLevel: 20 };
  assert.equal(left.absorb(right, rules), true);
  assert.equal(left.level, 5);
  left.evolveTo('water', { tier: 1, path: 'water' });
  assert.deepEqual([left.evo, left.evoTier, left.evolutionPath], ['water', 1, 'water']);
  assert.equal(left.canMergeWith(factory.create({ col: 2, row: 0, level: 5, evo: 'fire' }), rules), false);
}

function testAttackStrategies() {
  const { catalog, factory, patterns } = createFixture();
  const enemies = [
    { id: 'rear', x: 35, y: 30, dist: 10 },
    { id: 'front', x: 55, y: 30, dist: 90 },
    { id: 'middle', x: 45, y: 30, dist: 50 }
  ];
  const damageLog = [], visualLog = [];
  const water = factory.create({ col: 0, row: 0, evo: 'water' });
  const targets = water.updateCombat(.1, combatContext(catalog, patterns, enemies, damageLog, visualLog));
  assert.deepEqual(targets.map(enemy => enemy.id), ['front', 'middle']);
  assert.equal(damageLog.length, 2);
  assert.equal(visualLog.length, 2);
  assert.equal(water.cool, .5);
  assert.equal(water.updateCombat(.1, combatContext(catalog, patterns, enemies, damageLog, visualLog)).length, 0);
}

function testSplashClustersAroundLeadTarget() {
  const { catalog, factory, patterns } = createFixture();
  const enemies = [
    { id: 'lead', x: 100, y: 100, dist: 100 },
    { id: 'near', x: 120, y: 100, dist: 80 },
    { id: 'far', x: 170, y: 100, dist: 60 }
  ];
  const fire = factory.create({ col: 1, row: 1, evo: 'fire' });
  const targets = fire.updateCombat(.1, combatContext(catalog, patterns, enemies, [], []));
  assert.deepEqual(targets.map(enemy => enemy.id), ['lead', 'near']);
}

function testPierceUsesARealAttackLine() {
  const { catalog, factory, patterns } = createFixture();
  const wood = factory.create({ col: 0, row: 0, evo: 'wood' });
  const enemies = [
    { id: 'focus', x: 200, y: 30, dist: 100 },
    { id: 'inline', x: 140, y: 38, dist: 80 },
    { id: 'off-axis', x: 140, y: 90, dist: 70 }
  ];
  const targets = patterns.get('pierce').select(wood, enemies, catalog.get('wood'), combatContext(catalog, patterns, enemies, [], []));
  assert.deepEqual(targets.map(enemy => enemy.id), ['focus', 'inline']);
}

testCatalogAndFactory();
testMergeRulesAndEvolution();
testAttackStrategies();
testSplashClustersAroundLeadTarget();
testPierceUsesARealAttackLine();
console.log('tower-system: 5 tests passed');
