const assert = require('node:assert/strict');
const {
  SPEED_LIMITS, EnemyDefinition, TraitDefinition, DefinitionCatalog, EnemyFactory, SpawnDirector
} = require('../enemy-system.js');
const GameContent = require('../game-content.js');

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

function testShieldDamageConversion() {
  const { factory } = fixture();
  const cases = [
    { mode: null, resistance: 0, synergy: 0 },
    { mode: 'chain', resistance: 0, synergy: 0 },
    { mode: null, resistance: .25, synergy: 0 },
    { mode: 'chain', resistance: .25, synergy: 0 },
    { mode: null, resistance: 0, synergy: .5 },
    { mode: 'chain', resistance: 0, synergy: .5 },
    { mode: 'chain', resistance: .25, synergy: .5 },
    { mode: 'chain', resistance: .8, synergy: .8 }
  ];
  for (const { mode, resistance, synergy } of cases) {
    const enemy = factory.create({ archetype: 'guardian', maxHp: 100, baseSpeed: 40 });
    enemy.hp = 73;
    enemy.shieldResist.fire = resistance;
    enemy._synergyShieldBreak = synergy;
    const multiplier = (mode === 'chain' ? 1.5 : 1) * (1 + synergy) * (1 - resistance);
    const firstDamage = 5;
    enemy.receiveDamage(firstDamage, 'fire', mode);
    assert.equal(enemy.hp, 73, `${mode}/${resistance}/${synergy}: an intact shield must neither heal nor damage health`);
    assert.ok(Math.abs(enemy.shield - (20 - firstDamage * multiplier)) < 1e-9);
    const shieldBeforeBreak = enemy.shield;
    const secondDamage = shieldBeforeBreak / multiplier + 7;
    enemy.receiveDamage(secondDamage, 'fire', mode);
    assert.equal(enemy.shield, 0);
    assert.ok(Math.abs(enemy.hp - 66) < 1e-9, `${mode}/${resistance}/${synergy}: exactly 7 base damage should overflow`);
    assert.equal(enemy.shieldBroken, 2.5);
    enemy.receiveDamage(10, 'fire', mode);
    assert.ok(Math.abs(enemy.hp - 54.5) < 1e-9, 'after break, shield modifiers must not change exposed health damage');
  }
  const exact = factory.create({ archetype: 'guardian', maxHp: 100, baseSpeed: 40 });
  exact.shield = 15;
  exact.receiveDamage(10, 'fire', 'chain');
  assert.equal(exact.shield, 0);
  assert.equal(exact.hp, 100, 'an exact shield break must cause zero overflow');
}

function testRealBossPhaseImmunity() {
  const enemyCatalog = DefinitionCatalog.fromConfig(EnemyDefinition, GameContent.enemyArchetypes);
  const traitCatalog = DefinitionCatalog.fromConfig(TraitDefinition, GameContent.enemyTraits);
  const factory = new EnemyFactory(enemyCatalog, traitCatalog);
  const context = { positionAt: distance => ({ x: distance, y: 0 }), pathLength: 10000 };
  const source = { id: 'control-source' };

  const frost = factory.create({ archetype: 'frostOracle', maxHp: 1000, baseSpeed: 40 });
  assert.ok(frost.applyStatus('freeze', 10, source) > 0);
  frost.hp = 400;
  frost.update(.5, context);
  assert.equal(frost.phase.active, true);
  assert.equal(frost.shield, 0, 'the actual oracle phase grants no shield');
  assert.equal(frost.freeze, 0, 'phase immunity clears an existing freeze immediately');
  assert.equal(frost.statuses.sourceOf('freeze'), null);
  assert.equal(frost.applyStatus('freeze', 10, source), 0, 'the oracle must remain immune without a shield');
  assert.equal(frost.dist, 26, 'phase activation removes freeze movement penalty in the same update');
  assert.ok(frost.applyStatus('slow', 10) > 0, 'unlisted controls remain usable');
  frost.update(.1, context);
  assert.equal(frost.applyStatus('freeze', 10), 0, 'phase immunity persists on later updates');

  const heart = factory.create({ archetype: 'hollowHeart', maxHp: 1000, baseSpeed: 40 });
  heart.hp = 700;
  heart._synergyShieldBreak = .5;
  heart.receiveDamage(50, 'thunder', 'chain');
  assert.equal(heart.hp, 700, 'real tree-heart chain and synergy bonuses must never heal');
  assert.ok(Math.abs(heart.shield - 92) < 1e-9);
  heart.receiveDamage(50, 'thunder', 'chain');
  assert.equal(heart.shield, 0);
  assert.ok(Math.abs(heart.hp - (700 - (45 - 92 / 2.4))) < 1e-9);
  assert.ok(heart.applyStatus('slow', 10, source) > 0);
  heart.hp = 450; heart.shieldBroken = 0;
  heart.update(0, context);
  assert.equal(heart.phase.active, true);
  assert.equal(heart.shield, 120);
  assert.equal(heart.slow, 0);
  assert.equal(heart.statuses.sourceOf('slow'), null);
  assert.equal(heart.applyStatus('slow', 10), 0);
  heart.receiveDamage(100, 'thunder', 'chain');
  assert.equal(heart.shield, 0);
  assert.equal(heart.applyStatus('slow', 10), 0, 'dark-tide slow immunity survives the second shield breaking');
  assert.ok(heart.applyStatus('freeze', 10) > 0, 'phase immunity must not absorb unrelated controls');

  const ordinary = factory.create({ archetype: 'shellguard', maxHp: 1000, baseSpeed: 40 });
  assert.equal(ordinary.applyStatus('stun', 4), 0);
  ordinary.receiveDamage(300, 'thunder', 'chain');
  assert.equal(ordinary.shield, 0);
  assert.ok(ordinary.applyStatus('stun', 4) > 0, 'ordinary shield immunity expires when its shield breaks');
  ordinary.shield = 1;
  assert.equal(ordinary.applyStatus('stun', 4), 0, 'restored ordinary shields regain their own immunity');
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

function testBossStunRecoveryWindow() {
  const { factory } = fixture();
  const boss = factory.create({ archetype: 'tyrant', maxHp: 10000, baseSpeed: 40 });
  const context = { positionAt: distance => ({ x: distance, y: 0 }), pathLength: 100000 };
  assert.equal(boss.applyStatus('stun', 1), 1);
  boss.update(.5, context);
  assert.equal(boss.applyStatus('stun', 3), 0, 'an active boss stun cannot be refreshed');
  assert.equal(boss.stun, .5);
  boss.update(.5, context);
  assert.equal(boss.stunRecovery, 1.5);
  assert.equal(boss.applyStatus('stun', 1), 0);
  assert.equal(boss.applyStatus('slow', 2), 2, 'recovery still permits soft control');
  boss.update(1, context);
  assert.ok(boss.dist > 0, 'a recovering boss must advance even with slow applied');
  assert.equal(boss.applyStatus('stun', 1), 0);
  boss.update(.5, context);
  assert.equal(boss.applyStatus('stun', 1), 1, 'boss becomes stunnable after recovery');

  const regular = factory.create({ archetype: 'scout', maxHp: 10000, baseSpeed: 40 });
  regular.applyStatus('stun', 1);
  regular.update(.5, context);
  assert.equal(regular.applyStatus('stun', 2), 2, 'ordinary enemies remain fully controllable');

  const largeStep = factory.create({ archetype: 'tyrant', maxHp: 10000, baseSpeed: 40 });
  largeStep.applyStatus('stun', 1);
  largeStep.update(2, context);
  assert.equal(largeStep.stunRecovery, .5, 'recovery accounts for time beyond stun expiration');
}

testDefinitionsAndTraits();
testDamageAndStatusOwnership();
testTraitAndArchetypeResistances();
testShieldAbsorbsBeforeHealth();
testShieldRulesAndRecovery();
testShieldDamageConversion();
testRealBossPhaseImmunity();
testTacticalCounters();
testUpdateAndEscapeEvents();
testIndependentMovementAndSpeedCap();
testSpawnDirector();
testBossStunRecoveryWindow();
console.log('enemy-system: 12 tests passed');
