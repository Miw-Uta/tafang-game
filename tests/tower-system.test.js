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
  const branchOne = factory.create({ col: 2, row: 0, level: 10, evo: 'water', evoTier: 2, evolutionPath: 'water' });
  const branchTwo = factory.create({ col: 3, row: 0, level: 10, evo: 'fire', evoTier: 2, evolutionPath: 'water' });
  const exactRules = { identityResolver: tower => tower.evo, maxLevel: 20 };
  assert.equal(branchOne.canMergeWith(branchTwo, exactRules), false);
  const accelerated = factory.create({ col: 4, row: 0, level: 10 });
  const feeder = factory.create({ col: 5, row: 0, level: 10 });
  assert.equal(accelerated.absorb(feeder, { identityResolver: tower => tower.evo, maxLevel: 20, mergeGain: level => level < 15 ? 2 : 3 }), true);
  assert.equal(accelerated.level, 12);
  const cultivator = factory.create({ col: 6, row: 0, level: 6 });
  const lowSeed = factory.create({ col: 7, row: 0, level: 2 });
  assert.equal(cultivator.canMergeWith(lowSeed, { identityResolver: tower => tower.evo, maxLevel: 20, progressiveMerge: true }), true);
  assert.equal(cultivator.absorb(lowSeed, { identityResolver: tower => tower.evo, maxLevel: 20, progressiveMerge: true, growthThreshold: level => level, mergeMaterialValue: tower => tower.level }), true);
  assert.equal(cultivator.level, 6);
  assert.equal(cultivator.growth, 2);
  const resonant = factory.create({ col: 8, row: 0, level: 6 });
  const twin = factory.create({ col: 9, row: 0, level: 6 });
  assert.equal(resonant.absorb(twin, { identityResolver: tower => tower.evo, maxLevel: 20, progressiveMerge: true, growthThreshold: level => level, mergeMaterialValue: tower => tower.level, resonanceBonus: level => Math.ceil(level * .5) }), true);
  assert.equal(resonant.level, 7);
  assert.equal(resonant.lastAbsorbKind, 'resonance');
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
  assert.equal(water.attackAnimation.weapon, 'seedshot');
  assert.equal(water.attackAnimation.target.id, 'front');
  water.updateAttackAnimation(.2);
  assert.ok(water.attackAnimation.age >= .2);
  const firstSequence = water.attackAnimation.sequence;
  water.beginAttack(catalog.get('water'), [enemies[1]]);
  assert.equal(water.attackAnimation.sequence, firstSequence);
  assert.equal(water.queuedAttack.targets[0].id, 'front');
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

function testFocusRetainsAreaAttacksAndPrioritySurvivesStorage() {
  const { catalog, factory, patterns } = createFixture();
  const tower = factory.create({ col: 0, row: 0, evo: 'water', targetPriority: 'strong' });
  const enemies = [
    { id: 'lead', x: 100, y: 30, dist: 100, hp: 20 },
    { id: 'boss', x: 110, y: 30, dist: 80, hp: 500 },
    { id: 'focus', x: 120, y: 30, dist: 10, hp: 80 }
  ];
  const context = combatContext(catalog, patterns, enemies, [], []);
  assert.equal(patterns.get('chain').select(tower, enemies, catalog.get('water'), context)[0].id, 'boss');
  tower.manualTarget = enemies[2];
  assert.deepEqual(patterns.get('chain').select(tower, enemies, catalog.get('water'), context).map(e => e.id), ['focus', 'boss']);
  assert.equal(factory.create(tower.snapshot()).targetPriority, 'strong');
  const fire = factory.create({ col: 0, row: 0, evo: 'fire' });
  fire.manualTarget = enemies[2];
  assert.equal(patterns.get('splash').select(fire, enemies, catalog.get('fire'), context).length, 3);
  const structure = { x: 120, y: 30, hp: 90, isStructure: true };
  fire.manualTarget = structure;
  assert.deepEqual(patterns.get('splash').select(fire, [...enemies, structure], catalog.get('fire'), context), [structure]);
}

function testCounterPriorityTargetsSupportEnemies() {
  const { catalog, factory, patterns } = createFixture();
  const tower = factory.create({ col: 0, row: 0, evo: 'water', targetPriority: 'counter' });
  const enemies = [
    { id: 'plain', x: 100, y: 30, dist: 100, hp: 40, max: 40, type: 'normal' },
    { id: 'shield', x: 110, y: 30, dist: 90, hp: 100, max: 100, maxShield: 40, shield: 40, type: 'elite' },
    { id: 'aura', x: 120, y: 30, dist: 80, hp: 60, max: 60, aura: { radius: 100 }, type: 'elite' }
  ];
  const selected = patterns.get('chain').select(tower, enemies, catalog.get('water'), combatContext(catalog, patterns, enemies, [], []));
  assert.deepEqual(selected.map(enemy => enemy.id), ['aura', 'shield']);
  assert.equal(factory.create(tower.snapshot()).targetPriority, 'counter');
}

testCatalogAndFactory();
testMergeRulesAndEvolution();
testAttackStrategies();
testSplashClustersAroundLeadTarget();
testPierceUsesARealAttackLine();
testFocusRetainsAreaAttacksAndPrioritySurvivesStorage();
testCounterPriorityTargetsSupportEnemies();
console.log('tower-system: 7 tests passed');
