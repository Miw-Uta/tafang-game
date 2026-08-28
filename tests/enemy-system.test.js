const assert = require('node:assert/strict');
const {
  EnemyDefinition, TraitDefinition, DefinitionCatalog, EnemyFactory, SpawnDirector
} = require('../enemy-system.js');

function fixture(random = () => 0) {
  const enemies = DefinitionCatalog.fromConfig(EnemyDefinition, {
    scout: { name: '斥候', role: 'normal', icon: '斥', hp: 1, speed: 1, reward: 1, radius: 12, traitCount: 1, lifeCost: 1 },
    guardian: { name: '守卫', role: 'elite', icon: '卫', hp: 2, speed: .8, reward: 2, radius: 20, traitCount: 2, lifeCost: 1, unlockWave: 2, modifiers: { shieldRatio: .2 } },
    tyrant: { name: '暴君', role: 'boss', icon: '王', hp: 7, speed: .6, reward: 8, radius: 28, traitCount: 2, lifeCost: 3, unlockWave: 5 }
  });
  const traits = DefinitionCatalog.fromConfig(TraitDefinition, {
    armored: { label: '重甲', modifiers: { armor: .2 } },
    resistant: { label: '抗性', modifiers: { slowResist: .5 } },
    fortified: { label: '强韧', modifiers: { healthMultiplier: 1.5 } }
  });
  const factory = new EnemyFactory(enemies, traits);
  return { enemies, traits, factory, director: new SpawnDirector(enemies, traits, factory, random) };
}

function testDefinitionsAndTraits() {
  const { enemies, factory } = fixture();
  assert.ok(Object.isFrozen(enemies.get('scout')));
  const enemy = factory.create({ archetype: 'scout', maxHp: 100, baseSpeed: 50, traits: ['armored', 'fortified'] });
  assert.equal(enemy.max, 150);
  assert.equal(enemy.hp, 150);
  assert.equal(enemy.armor, .2);
  assert.deepEqual(enemy.traits, ['armored', 'fortified']);
}

function testDamageAndStatusOwnership() {
  const { factory } = fixture();
  const enemy = factory.create({ archetype: 'scout', maxHp: 100, baseSpeed: 50, resist: { fire: .25 }, traits: ['armored', 'resistant'] });
  assert.equal(enemy.receiveDamage(100, 'fire'), 60);
  assert.equal(enemy.hp, 40);
  assert.equal(enemy.applyStatus('slow', 4), 2);
  assert.equal(enemy.slow, 2);
  assert.throws(() => enemy.applyStatus('missing', 1), /Unknown enemy status/);
}

function testShieldAbsorbsBeforeHealth() {
  const { factory } = fixture();
  const enemy = factory.create({ archetype: 'guardian', maxHp: 100, baseSpeed: 40 });
  assert.equal(enemy.shield, 20);
  enemy.receiveDamage(15);
  assert.equal(enemy.hp, 100);
  assert.equal(enemy.shield, 5);
  enemy.receiveDamage(10);
  assert.equal(enemy.hp, 95);
  assert.equal(enemy.shield, 0);
}

function testUpdateAndEscapeEvents() {
  const { factory } = fixture();
  const source = { id: 'fire-tower' };
  const enemy = factory.create({ archetype: 'scout', maxHp: 5, baseSpeed: 10 });
  let lethalSource = null;
  enemy.applyStatus('burn', 2, source);
  enemy.update(1, { positionAt: distance => ({ x: distance, y: 0 }), pathLength: 100, onDotLethal: value => { lethalSource = value; } });
  assert.equal(lethalSource, source);

  const runner = factory.create({ archetype: 'scout', maxHp: 10, baseSpeed: 20 });
  let escaped = false;
  runner.update(1, { positionAt: distance => ({ x: distance, y: 0 }), pathLength: 10, onEscape: () => { escaped = true; } });
  assert.equal(escaped, true);
  assert.equal(runner.dead, true);
}

function testSpawnDirector() {
  const { director } = fixture();
  const boss = director.create({ wave: 5, spawnIndex: 0, hpScale: 100, speedScale: 50, resist: {}, primaryTrait: 'armored' });
  assert.equal(boss.archetype, 'tyrant');
  assert.equal(boss.type, 'boss');
  assert.ok(boss.traits.includes('armored'));
}

testDefinitionsAndTraits();
testDamageAndStatusOwnership();
testShieldAbsorbsBeforeHealth();
testUpdateAndEscapeEvents();
testSpawnDirector();
console.log('enemy-system: 5 tests passed');
