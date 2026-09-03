const assert = require('node:assert/strict');
const {
  SPEED_LIMITS, EnemyDefinition, TraitDefinition, DefinitionCatalog, EnemyFactory, SpawnDirector
} = require('../enemy-system.js');

function fixture(random = () => 0) {
  const enemies = DefinitionCatalog.fromConfig(EnemyDefinition, {
    scout: { name: '斥候', role: 'normal', icon: '斥', hp: 1, speed: 1, reward: 1, radius: 12, traitCount: 1, lifeCost: 1 },
    runner: { name: '疾行者', role: 'normal', icon: '疾', hp: 1, speed: 1.2, reward: 1, radius: 12, traitCount: 1, lifeCost: 1, modifiers: { evasion: .5 } },
    healer: { name: '再生者', role: 'elite', icon: '愈', hp: 2, speed: .8, reward: 2, radius: 18, traitCount: 1, lifeCost: 1, modifiers: { regenRatio: .1, resist: { fire: .2, poison: .2 } } },
    guardian: { name: '守卫', role: 'elite', icon: '卫', hp: 2, speed: .8, reward: 2, radius: 20, traitCount: 2, lifeCost: 1, unlockWave: 2, modifiers: { shieldRatio: .2, shieldModeMultipliers: { chain: 1.5 }, shieldStatusImmunity: ['stun'], shieldRechargeDelay: 2, shieldRegenRatio: .1 } },
    tyrant: { name: '暴君', role: 'boss', icon: '王', hp: 7, speed: .6, reward: 8, radius: 28, traitCount: 2, lifeCost: 3, unlockWave: 5 }
  });
  const traits = DefinitionCatalog.fromConfig(TraitDefinition, {
    armored: { label: '重甲', modifiers: { armor: .2, resist: { metal: .12 } } },
    resistant: { label: '抗性', modifiers: { slowResist: .5, resist: { water: .24 } } },
    fortified: { label: '强韧', modifiers: { healthMultiplier: 1.5, attackModeMultipliers: { splash: .6, chain: .8, omni: .7 } } }
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

function testTraitAndArchetypeResistances() {
  const { factory } = fixture();
  const enemy = factory.create({ archetype: 'scout', maxHp: 100, baseSpeed: 40, resist: {}, traits: ['armored'] });
  const armoredDamage = enemy.receiveDamage(100, 'metal');
  assert.equal(armoredDamage, 70.4);
  assert.equal(enemy.resist.metal, .12);
  const resistant = factory.create({ archetype: 'scout', maxHp: 100, baseSpeed: 40, resist: {}, traits: ['resistant'] });
  assert.equal(resistant.receiveDamage(100, 'water'), 76);
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

function testShieldRulesAndRecovery() {
  const { factory } = fixture();
  const enemy = factory.create({ archetype: 'guardian', maxHp: 100, baseSpeed: 40 });
  assert.equal(enemy.applyStatus('stun', 2), 0, 'active shield should block configured control');
  enemy.receiveDamage(25);
  assert.equal(enemy.shield, 0);
  const exposedHp = enemy.hp;
  enemy.receiveDamage(10);
  assert.ok(enemy.hp < exposedHp - 10, 'broken shield should expose a short vulnerability window');
  enemy.update(1, { positionAt: distance => ({ x: distance, y: 0 }), pathLength: 1000 });
  enemy.update(1, { positionAt: distance => ({ x: distance, y: 0 }), pathLength: 1000 });
  assert.ok(enemy.shield > 0, 'shield should recover after its recharge delay');
}

function testTacticalCounters() {
  const { factory } = fixture();
  const runner = factory.create({ archetype: 'runner', maxHp: 300, baseSpeed: 40 });
  assert.equal(runner.receiveDamage(100, 'fire', 'splash'), 50, 'uncontrolled runners should evade raw damage');
  runner.applyStatus('slow', 2);
  assert.equal(runner.receiveDamage(100, 'water', 'chain'), 100, 'control should remove evasion');

  const boss = factory.create({ archetype: 'tyrant', maxHp: 500, baseSpeed: 20 });
  assert.equal(boss.receiveDamage(100, 'metal', 'single'), 190, 'single-target towers should specialize in bosses');
  assert.equal(boss.receiveDamage(100, 'fire', 'splash'), 100);

  const fortified = factory.create({ archetype: 'scout', maxHp: 300, baseSpeed: 30, traits: ['fortified'] });
  assert.equal(fortified.receiveDamage(100, 'fire', 'splash'), 60, 'fortified enemies should resist broad attacks');

  const shielded = factory.create({ archetype: 'guardian', maxHp: 100, baseSpeed: 30 });
  shielded.receiveDamage(10, 'thunder', 'chain');
  assert.equal(shielded.shield, 5, 'chain attacks should disrupt shields');

  const armored = factory.create({ archetype: 'scout', maxHp: 300, baseSpeed: 30, traits: ['armored'] });
  assert.equal(armored.receiveDamage(100, 'fire', 'pierce'), 80);
  armored.applyStatus('weaken', 2);
  assert.equal(armored.receiveDamage(100, 'fire', 'pierce'), 100, 'weaken should fully answer ordinary armor');

  const healer = factory.create({ archetype: 'healer', maxHp: 100, baseSpeed: 10 });
  healer.hp = 50;
  healer.applyStatus('burn', 2);
  healer.update(1, { positionAt: distance => ({ x: distance, y: 0 }), pathLength: 1000 });
  assert.ok(Math.abs(healer.hp - 51.2) < .001, 'regeneration and fire resistance should counter burn damage');

  const poisonHealer = factory.create({ archetype: 'healer', maxHp: 100, baseSpeed: 10 });
  poisonHealer.hp = 50;
  poisonHealer.applyStatus('poison', 2);
  poisonHealer.update(1, { positionAt: distance => ({ x: distance, y: 0 }), pathLength: 1000 });
  assert.ok(Math.abs(poisonHealer.hp - 53.6) < .001, 'regeneration and poison resistance should counter poison damage');
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

function testIndependentMovementAndSpeedCap() {
  const { factory } = fixture();
  const front = factory.create({ archetype: 'scout', maxHp: 100, baseSpeed: 40 });
  const behind = factory.create({ archetype: 'scout', maxHp: 100, baseSpeed: 40 });
  front.dist = 30;
  behind.dist = 0;
  front.applyStatus('stun', 2);
  const context = { positionAt: distance => ({ x: distance, y: 0 }), pathLength: 1000 };
  front.update(1, context);
  behind.update(1, context);
  assert.equal(front.dist, 30);
  assert.equal(behind.dist, 40, 'a controlled enemy must not stop enemies behind it');

  const fast = factory.create({ archetype: 'runner', maxHp: 100, baseSpeed: 200 });
  assert.equal(fast.baseSpeed, SPEED_LIMITS.max, 'stacked speed bonuses must stay readable');
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
testTraitAndArchetypeResistances();
testShieldAbsorbsBeforeHealth();
testShieldRulesAndRecovery();
testTacticalCounters();
testUpdateAndEscapeEvents();
testIndependentMovementAndSpeedCap();
testSpawnDirector();
console.log('enemy-system: 9 tests passed');
