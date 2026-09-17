const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { BossEncounters, SKILLS, CAST_TIME, ATTACK_DELAY, enabled } = require('../boss-system.js');
const { createSandbox } = require('../scripts/simulate-campaign.js');

function fixture(archetype = 'groveTyrant') {
  const boss = { archetype, type: 'boss', hp: 1000, x: 150, y: 150 };
  const weak = { col: 1, row: 2, level: 5 }, strong = { col: 2, row: 2, level: 10 };
  const context = { running: true, paused: false, lives: 12, finite: true, missionNumber: 4, difficulty: 'normal', enemies: [boss], towers: [weak, strong], positionOf: tower => ({ x: tower.col * 60 + 30, y: tower.row * 60 + 30 }), inRange: () => true };
  return { system: new BossEncounters(), boss, weak, strong, context };
}
const evaluate = source => vm.runInContext(`(() => {
  startMode('campaign','mirrorMarsh');navigatePage('battle');
  $('storyModal').hidden=true;running=true;paused=false;spawnTimer=999;spawned=0;started=true;
  window.campaignModifiers.difficulty='normal';
  ${source}
})()`, createSandbox(42));

test('all five bosses have an identifiable attack and the same readable warning contract', () => {
  assert.equal(Object.keys(SKILLS).length, 5);
  assert.equal(new Set(Object.values(SKILLS).map(skill => skill.name)).size, 5);
  assert.equal(new Set(Object.values(SKILLS).map(skill => skill.shape)).size, 5);
  for (const archetype of Object.keys(SKILLS)) {
    const { system, boss, weak, strong, context } = fixture(archetype);
    assert.equal(system.tick(5.9, context).length, 0);
    const [event] = system.tick(.1, context);
    assert.equal(event.type, 'warning'); assert.equal(event.target, strong);
    assert.equal(system.stateOf(boss).warning.remaining, CAST_TIME);
    assert.ok(system.stateOf(boss).warning.radius < 60, 'one grid move must escape the danger zone');
    assert.equal(system.attackDelay(weak), 0);
  }
});

test('introductory missions and story difficulty are safe; endless mechanics begin at wave ten', () => {
  for (const difficulty of ['normal', 'veteran']) {
    assert.equal(enabled({ finite: true, difficulty, missionNumber: 3 }), false);
    assert.equal(enabled({ finite: true, difficulty, missionNumber: 4 }), true);
  }
  assert.equal(enabled({ finite: true, difficulty: 'story', missionNumber: 20 }), false);
  assert.equal(enabled({ finite: false, wave: 9 }), false);
  assert.equal(enabled({ finite: false, wave: 10 }), true);
  const { system, boss, context } = fixture();
  system.tick(99, { ...context, missionNumber: 1 });
  assert.equal(system.stateOf(boss), null);
});

test('boss must enter effective tower range and never targets the highest level tower across the map', () => {
  const { system, boss, weak, strong, context } = fixture();
  system.tick(99, { ...context, inRange: () => false });
  assert.equal(system.stateOf(boss).cooldown, 6);
  const [warning] = system.tick(6, { ...context, inRange: (_, tower) => tower === weak });
  assert.equal(warning.target, weak);
  assert.notEqual(warning.target, strong);
});

test('a warning locks a location and a legal one-cell relocation evades its impact', () => {
  const { system, boss, strong, context } = fixture();
  system.tick(6, context);
  const locked = system.stateOf(boss).warning;
  strong.col++;
  system.tick(2.9, context);
  assert.equal(system.attackDelay(strong), 0);
  const [impact] = system.tick(.1, context);
  assert.equal(impact.type, 'impact'); assert.equal(impact.towers.length, 0);
  assert.equal(impact.warning.x, locked.x);
  assert.equal(system.events.dodges, 1);
  assert.equal(system.stateOf(boss).warning, null);
});

test('remaining in the circle delays only the struck tower for exactly two combat seconds', () => {
  const { system, strong, weak, context } = fixture();
  system.tick(6, context); const [impact] = system.tick(3, context);
  assert.deepEqual(impact.towers, [strong]);
  assert.equal(system.attackDelay(strong), ATTACK_DELAY);
  assert.equal(system.attackDelay(weak), 0);
  assert.equal(system.combatDelta(strong, 1.5), 0);
  assert.equal(system.combatDelta(strong, 1), .5);
  assert.equal(system.attackDelay(strong), 0);
  assert.equal(system.combatDelta(weak, .05), .05);
  assert.equal(system.events.hits, 1);
});

test('pause, modal, prep, victory and defeat freeze warning and exposure clocks', () => {
  const { system, boss, context } = fixture(); system.tick(6, context);
  const before = system.stateOf(boss);
  for (const stop of [{ paused: true }, { blocked: true }, { running: false }, { won: true }, { lives: 0 }]) {
    system.tick(100, { ...context, ...stop });
    assert.deepEqual(system.stateOf(boss), before);
    assert.equal(system.interrupt(boss, { ...context, ...stop }), null);
  }
  system.interrupt(boss, context);
  system.tick(100, { ...context, paused: true });
  assert.equal(system.stateOf(boss).exposed, 3);
});

test('interrupt cancels the pending hit, grants a bounded output window, and cannot be farmed without another cast', () => {
  const { system, boss, strong, context } = fixture(); system.tick(6, context);
  assert.equal(system.interrupt(boss, context).multiplier, 1.15);
  assert.equal(system.stateOf(boss).warning, null);
  assert.equal(system.damageMultiplier(boss), 1.15);
  assert.equal(system.interrupt(boss, context), null);
  system.tick(2.95, context); assert.equal(system.damageMultiplier(boss), 1.15);
  system.tick(.05, context); assert.equal(system.damageMultiplier(boss), 1);
  assert.equal(system.attackDelay(strong), 0);
  assert.equal(system.events.interrupts, 1);
  assert.equal(system.events.impacts, 0);
});

test('boss death cancels its cast and ordinary enemies cannot invoke a boss attack', () => {
  const { system, boss, context } = fixture(); system.tick(6, context);
  boss.dead = true;
  assert.equal(system.stateOf(boss), null);
  system.tick(5, context);
  assert.equal(system.events.impacts, 0);
  const ordinary = { ...boss, dead: false, type: 'normal' };
  system.tick(50, { ...context, enemies: [ordinary] });
  assert.equal(system.stateOf(ordinary), null);
  assert.equal(system.damageMultiplier(ordinary), 1);
});

test('attack interval cannot chain-lock towers and reset removes ephemeral state without changing snapshots', () => {
  const { system, boss, strong, context } = fixture();
  const before = JSON.stringify([boss, strong]);
  system.tick(6, context); system.tick(3, context);
  system.tick(12.9, context); assert.equal(system.stateOf(boss).warning, null);
  system.tick(.1, context); assert.equal(system.stateOf(boss).warning.remaining, 3);
  assert.equal(JSON.stringify([boss, strong]), before, 'encounter fields stay out of enemy and tower saves');
  system.clearWave();
  assert.equal(system.stateOf(boss), null); assert.equal(system.attackDelay(strong), 0);
  assert.equal(system.impacts.length, 0);
  system.reset(); assert.equal(system.events.warnings, 0);
});

test('real engine impact postpones tower windup and cooldown without taking life or spirit', () => {
  const result = evaluate(`
    const tower=towers[0],origin=center(tower),boss=enemyFactory.create({archetype:'groveTyrant',maxHp:1e9,baseSpeed:1});
    Object.assign(boss,{x:origin.x+50,y:origin.y,routeIndex:0});enemies=[boss];
    advanceBossEncounters(6);
    const warning=bossEncounters.stateOf(boss).warning;
    const before={lives,coins};tower.cool=1.4;
    advanceBossEncounters(3);
    const context=towerCombatContext(),initial=tower.cool;
    for(let i=0;i<20;i++){const elapsed=bossEncounters.combatDelta(tower,.05);if(elapsed>0)tower.updateCombat(elapsed,context);}
    const held=tower.cool;
    for(let i=0;i<21;i++){const elapsed=bossEncounters.combatDelta(tower,.05);if(elapsed>0)tower.updateCombat(elapsed,context);}
    return {warning:Boolean(warning),before,after:{lives,coins},initial,held,afterDelay:tower.cool,delay:bossEncounters.attackDelay(tower)};
  `);
  assert.equal(result.warning, true);
  assert.deepEqual(result.after, result.before);
  assert.equal(result.held, result.initial);
  assert.ok(Math.abs(result.afterDelay - 1.35) < 1e-8);
  assert.equal(result.delay, 0);
});

test('real E ability must cover the reading boss, consumes its usual budget and increases real tower damage by 15 percent', () => {
  const result = evaluate(`
    const tower=towers[0],point=pointAt(220),boss=enemyFactory.create({archetype:'groveTyrant',maxHp:1e9,baseSpeed:1});
    Object.assign(boss,{...point,routeIndex:0,shield:0});enemies=[boss];
    const context={...bossEncounterContext(),inRange:()=>true};bossEncounters.tick(6,context);
    const cast=castTactic('flare',point),afterCast=bossEncounters.stateOf(boss);
    const definition={...evolution.base,effect:null,damage:100};
    const before=boss.hp;damageTarget(tower,boss,definition);const exposed=before-boss.hp;
    bossEncounters.tick(3,context);
    // Keep the same flare statuses for this direct comparison; isolate the
    // interrupt modifier from its pre-existing weaken/taiji amplification.
    const after=boss.hp;damageTarget(tower,boss,definition);const normal=after-boss.hp;
    return {cast:cast.ok,warning:afterCast.warning,exposedTime:afterCast.exposed,energy:battleTactics.energy,exposed,normal,interrupts:bossEncounters.events.interrupts};
  `);
  assert.equal(result.cast, true); assert.equal(result.warning, null); assert.equal(result.exposedTime, 3);
  assert.equal(result.energy, 45); assert.equal(result.interrupts, 1);
  assert.ok(Math.abs(result.exposed / result.normal - 1.15) < 1e-6, JSON.stringify(result));
});

test('real engine ignores first three mission bosses and clears all encounter state on a new run', () => {
  const result = evaluate(`
    startMode('campaign','groveGate');running=true;paused=false;$('storyModal').hidden=true;
    const origin=center(towers[0]),boss=enemyFactory.create({archetype:'groveTyrant',maxHp:1e9,baseSpeed:1});
    Object.assign(boss,{x:origin.x+40,y:origin.y});enemies=[boss];advanceBossEncounters(100);
    const first=bossEncounters.stateOf(boss);
    startMode('campaign','mirrorMarsh');running=true;paused=false;$('storyModal').hidden=true;
    enemies=[boss];bossEncounters.tick(6,{...bossEncounterContext(),inRange:()=>true});
    const active=Boolean(bossEncounters.stateOf(boss)?.warning);
    resetGame();return {first,active,after:bossEncounters.stateOf(boss),warnings:bossEncounters.events.warnings};
  `);
  assert.equal(result.first, null); assert.equal(result.active, true); assert.equal(result.after, null); assert.equal(result.warnings, 0);
});

test('an E field that misses the reading boss cannot cancel its warning or award vulnerability', () => {
  const result = evaluate(`
    const point=pointAt(120),boss=enemyFactory.create({archetype:'tideArchivist',maxHp:1e9,baseSpeed:1});
    Object.assign(boss,{...point,routeIndex:0});enemies=[boss];
    bossEncounters.tick(6,{...bossEncounterContext(),inRange:()=>true});
    const cast=castTactic('flare',pointAt(currentPathLength()*.7));
    return {cast:cast.ok,warning:Boolean(bossEncounters.stateOf(boss)?.warning),multiplier:bossEncounters.damageMultiplier(boss),energy:battleTactics.energy};
  `);
  assert.equal(result.cast, true); assert.equal(result.warning, true);
  assert.equal(result.multiplier, 1); assert.equal(result.energy, 45);
});
