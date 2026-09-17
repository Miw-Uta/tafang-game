const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { BattleTactics, ABILITIES, validSnapshot } = require('../tactics-system.js');
const { createSandbox } = require('../scripts/simulate-campaign.js');

const context = (overrides = {}) => ({ running: true, paused: false, lives: 20, width: 960, height: 540, paths: [[[0, 100], [960, 100]]], towers: [{ x: 200, y: 200 }], enemies: [], ...overrides });
const point = { x: 200, y: 100 };
const evaluate = source => vm.runInContext(`(() => {
  startMode('endless'); navigatePage('battle');
  running=true;paused=false;spawnTimer=999;spawned=0;started=true;
  $('storyModal').hidden=true;
  ${source}
})()`, createSandbox(12));

test('tactical decisions share finite energy and rejected casts are atomic', () => {
  const system = new BattleTactics();
  for (const [key, target, state] of [['bramble', point, context({ paused: true })], ['rally', { x: 900, y: 500 }, context()], ['bramble', { x: 600, y: 400 }, context()], ['constructor', point, context()], ['flare', { x: NaN, y: 100 }, context()]]) {
    const previous = system.snapshot();
    assert.equal(system.cast(key, target, state).ok, false);
    assert.deepEqual(system.snapshot(), previous);
  }
  assert.equal(system.cast('flare', point, context()).ok, true);
  assert.equal(system.cast('rally', point, context()).ok, true);
  assert.equal(system.energy, 0);
  assert.equal(system.cast('bramble', point, context()).ok, false);
  assert.equal(system.casts, 2);
});

test('simulation time governs energy and cooldown; prep, pause, dialogs and defeat grant nothing', () => {
  const system = new BattleTactics();
  system.cast('bramble', point, context());
  const saved = system.snapshot();
  for (const state of [context({ running: false }), context({ paused: true }), context({ blocked: true }), context({ won: true }), context({ lives: 0 })]) system.tick(3600, state);
  for (const dt of [NaN, Infinity, -1, 0]) system.tick(dt, context());
  assert.deepEqual(system.snapshot(), saved);
  system.tick(5, context());
  assert.equal(system.energy, 74);
  assert.equal(system.cooldowns.bramble, 9);
  assert.equal(system.zones[0].remaining, 1);
  system.tick(1, context());
  assert.equal(system.zones.length, 0);
  assert.equal(system.cast('bramble', point, context()).ok, false, 'field expiry does not reset cooldown');
  system.tick(1000, context());
  assert.equal(system.energy, 100);
  assert.equal(system.cooldowns.bramble, 0);
});

test('rally rewards spatial formation and following the field never stacks its multiplier', () => {
  const system = new BattleTactics();
  system.cast('rally', point, context());
  assert.equal(system.cooldownMultiplier({ x: 200, y: 200 }), .65);
  assert.equal(system.cooldownMultiplier({ x: 340, y: 100 }), 1);
  assert.equal(system.cast('rally', point, context()).ok, false);
  system.endWave();
  assert.equal(system.cooldownMultiplier({ x: 200, y: 200 }), 1);
  assert.equal(system.energy, 55);
  assert.equal(system.cooldowns.rally, 22);
});

test('root and flare fields affect only living enemies currently inside each field', () => {
  const system = new BattleTactics();
  system.cast('bramble', point, context()); system.cast('flare', point, context());
  assert.deepEqual(system.enemyEffects({ ...point, hp: 100 }), ['slow', 'weaken', 'taiji']);
  assert.deepEqual(system.enemyEffects({ x: 307, y: 100, hp: 100 }), []);
  assert.deepEqual(system.enemyEffects({ ...point, hp: 0 }), []);
  assert.deepEqual(system.enemyEffects({ ...point, hp: 100, dead: true }), []);
});

test('snapshot restoration preserves spent commands and cooldown without time-based refills', () => {
  const system = new BattleTactics(); system.cast('flare', point, context()); system.tick(2.5, context());
  const snapshot = system.snapshot(), restored = new BattleTactics();
  assert.equal(restored.restore(snapshot), true);
  assert.deepEqual(restored.snapshot(), snapshot);
  snapshot.energy = 0; snapshot.zones[0].remaining = 0;
  assert.equal(restored.energy, 49.5);
  assert.equal(restored.zones[0].remaining, 3.5);
  for (let i = 0; i < 10; i++) assert.equal(restored.restore(restored.snapshot()), true);
  assert.equal(restored.energy, 49.5);
  assert.equal(restored.cooldowns.flare, 23.5);
});

test('corrupt or forged tactical snapshots are rejected without changing live state', () => {
  const system = new BattleTactics(); system.cast('rally', point, context());
  const before = system.snapshot();
  for (const mutate of [state => { state.energy = 101; }, state => { state.energy = NaN; }, state => { state.cooldowns.rally = -1; }, state => { state.zones[0].remaining = 99; }, state => { state.zones[0].key = '__proto__'; }, state => { state.zones[0].x = -1; }, state => { state.zones.push({ ...state.zones[0] }); }, state => { state.casts = Infinity; }, state => { state.offlineAt = Date.now(); }]) {
    const invalid = system.snapshot(); mutate(invalid);
    assert.equal(validSnapshot(invalid), false);
    assert.equal(system.restore(invalid), false);
    assert.deepEqual(system.snapshot(), before);
  }
});

test('real engine root field slows movement while immunity and duration resistance remain meaningful', () => {
  const result = evaluate(`
    const origin=pointAt(100), enemy=enemyFactory.create({archetype:'mossling',maxHp:100000,baseSpeed:40});
    const resistant=enemyFactory.create({archetype:'mossling',maxHp:100000,baseSpeed:40});
    const immune=enemyFactory.create({archetype:'mossling',maxHp:100000,baseSpeed:40});
    resistant.slowResist=.85;immune.statusImmunity=['slow'];
    for(const item of [enemy,resistant,immune])Object.assign(item,{dist:100,...origin,routeIndex:0});
    towers=[];enemies=[enemy,resistant,immune];
    const cast=castTactic('bramble',origin);
    for(let i=0;i<40;i++)update(.05);
    return {cast:cast.ok,normal:enemy.dist-100,resistant:resistant.dist-100,immune:immune.dist-100};
  `);
  assert.equal(result.cast, true);
  assert.ok(result.normal < result.immune * .6, JSON.stringify(result));
  assert.ok(result.resistant > result.normal * 1.4, JSON.stringify(result));
  assert.ok(Math.abs(result.immune - 80) < 1e-5);
});

test('real tower attack cooldown changes inside rally and returns to normal after moving away', () => {
  const result = evaluate(`
    const tower=towers[0],origin=center(tower),original=towerCombatContext().cooldownMultiplier(tower);
    const cast=castTactic('rally',origin);
    const enhanced=towerCombatContext().cooldownMultiplier(tower);
    const enemy=enemyFactory.create({archetype:'mossling',maxHp:100000,baseSpeed:40});Object.assign(enemy,{x:origin.x+70,y:origin.y});enemies=[enemy];
    tower.cool=0;tower.updateCombat(.05,towerCombatContext());
    const actual=tower.cool;
    tower.relocate(15,8);
    const outside=battleTactics.cooldownMultiplier(center(tower));
    return {cast:cast.ok,original,enhanced,actual,expected:evolution.base.rate*enhanced,outside};
  `);
  assert.equal(result.cast, true);
  assert.ok(Math.abs(result.enhanced / result.original - .65) < 1e-10);
  assert.ok(Math.abs(result.actual - result.expected) < 1e-10);
  assert.equal(result.outside, 1);
});

test('real flare removes shields, respects boss budget and increases actual tower damage', () => {
  const result = evaluate(`
    const origin=pointAt(100),tower=towers[0];
    const enemy=enemyFactory.create({archetype:'mossling',maxHp:100000,baseSpeed:40});
    const normal=enemyFactory.create({archetype:'mossling',maxHp:100000,baseSpeed:40});
    const boss=enemyFactory.create({archetype:'mossling',maxHp:100000,baseSpeed:40});boss.type='boss';
    for(const item of [enemy,boss])Object.assign(item,{...origin,shield:100,maxShield:100});
    enemy.armor=normal.armor=.3;enemies=[enemy,boss];
    const cast=castTactic('flare',origin),shield=enemy.shield,bossShield=boss.shield;
    enemy.shield=0;
    const definition={...evolution.base,effect:null};
    damageTarget(tower,normal,definition);damageTarget(tower,enemy,definition);
    return {cast:cast.ok,shield,bossShield,amplified:enemy.max-enemy.hp,normal:normal.max-normal.hp,energy:battleTactics.energy};
  `);
  assert.equal(result.cast, true);
  assert.equal(result.shield, 40);
  assert.equal(result.bossShield, 70);
  assert.ok(result.amplified > result.normal * 1.4, JSON.stringify(result));
  assert.equal(result.energy, 45);
});

test('engine rejects commands through story overlays, evolution and pause without spending energy', () => {
  const result = evaluate(`
    const origin=pointAt(100),outcomes=[];
    paused=true;outcomes.push(castTactic('bramble',origin).ok);paused=false;
    $('storyModal').hidden=false;outcomes.push(castTactic('bramble',origin).ok);$('storyModal').hidden=true;
    pendingEvolution=towers[0];outcomes.push(castTactic('bramble',origin).ok);pendingEvolution=null;
    navigatePage('hub');outcomes.push(castTactic('bramble',origin).ok);
    return {outcomes,energy:battleTactics.energy,casts:battleTactics.casts};
  `);
  assert.deepEqual(Array.from(result.outcomes), [false, false, false, false]);
  assert.equal(result.energy, 100);
  assert.equal(result.casts, 0);
});

test('real campaign save adapter restores spent tactical resources and cooldown on repeated resume', () => {
  const sandbox = createSandbox(12);
  for (const file of ['checkpoint-system.js', 'campaign-save.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), sandbox, { filename: file });
  const result = vm.runInContext(`(() => {
    startMode('campaign','groveGate');navigatePage('battle');$('storyModal').hidden=true;
    const cast=battleTactics.cast('bramble',pointAt(100),{...tacticsContext(),running:true});
    battleTactics.tick(2,{running:true,lives});battleTactics.endWave();
    const saved=window.CampaignSave.save(),before=battleTactics.snapshot();
    const restored=window.CampaignSave.restore(),after=battleTactics.snapshot();
    window.CampaignSave.restore();
    return {cast:cast.ok,saved,restored,before,after,again:battleTactics.snapshot()};
  })()`, sandbox);
  assert.equal(result.cast, true);
  assert.equal(result.saved, true);
  assert.equal(result.restored, true);
  assert.equal(result.before.energy, 68.6);
  assert.deepEqual(result.after, result.before);
  assert.deepEqual(result.again, result.before);
});
