const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const { createSandbox } = require('../scripts/simulate-campaign.js');

function evaluate(source) {
  return vm.runInContext(`(() => { ${source} })()`, createSandbox(20260907));
}

test('shadow weapons hit real road targets from legal cells on all maps with a bounded four-pulse budget', () => {
  const results = evaluate(`
    const results = [];
    for (const field of battlefields) {
      battlefieldIndex = battlefields.indexOf(field);
      mapObjects = createMapObjects(field); mapUnlockedSlots = new Set();
      for (const evo of ['yin','taiji','voidstar']) {
        const definition = { ...evolution[evo], effect: null };
        let placement;
        for (const [col,row] of field.buildSlots) {
          if (!isBuildSlot(col,row)) continue;
          const tower = towerFactory.create({col,row,evo,level:8});
          const origin = center(tower), radius = currentAttackRadius(definition,tower);
          const roadPoint = field.routes.flat().find(([x,y]) => {
            const distance = Math.hypot(x-origin.x,y-origin.y);
            return distance >= 60 && distance < radius;
          });
          if (roadPoint) { placement={tower,roadPoint}; break; }
        }
        if (!placement) throw new Error('No reachable legal placement: '+field.key+'/'+evo);
        const {tower,roadPoint:[x,y]} = placement;
        towers=[tower];attackEvents=[];projectiles=[];
        const target = enemyFactory.create({archetype:'mossling',maxHp:10000000,baseSpeed:40});
        const untouched = enemyFactory.create({archetype:'mossling',maxHp:10000000,baseSpeed:40});
        const comparison = enemyFactory.create({archetype:'mossling',maxHp:10000000,baseSpeed:40});
        Object.assign(target,{x,y});Object.assign(untouched,{x,y});
        enemies=[target,untouched];
        damageTarget(tower,comparison,definition);
        launchAttack(tower,[target],definition);
        const event = attackEvents[0];
        for(let i=0;i<12;i++)updateAttackEvents(.05);
        results.push({map:field.key,evo,damage:target.max-target.hp,expected:comparison.max-comparison.hp,pulses:event.pulseIndex,untouched:untouched.max-untouched.hp});
      }
    }
    return results;
  `);
  assert.equal(results.length, 12);
  for (const result of results) {
    assert.ok(result.damage > 0, `${result.map}/${result.evo} must hit a legal road target`);
    assert.ok(Math.abs(result.damage-result.expected)<1e-6, `${result.evo} pulses must sum to one attack`);
    assert.equal(result.pulses, 4);
    assert.equal(result.untouched, 0, 'orbit cannot bypass target limits by hitting unselected neighbors');
  }
});

test('shadow orbit stops damage and rendering when its selected target leaves actual range', () => {
  const result = evaluate(`
    const tower=towerFactory.create({col:1,row:4,evo:'yin',level:5});towers=[tower];
    const target=enemyFactory.create({archetype:'mossling',maxHp:1000000,baseSpeed:40});
    Object.assign(target,{x:150,y:270});enemies=[target];attackEvents=[];
    launchAttack(tower,[target],{...evolution.yin,effect:null});
    const event=attackEvents[0];updateAttackEvents(.1);
    const firstDamage=target.max-target.hp;
    target.x=2000;
    for(let i=0;i<12;i++)updateAttackEvents(.05);
    return {firstDamage,finalDamage:target.max-target.hp,visibleTargets:shadowOrbitTargets(event).length};
  `);
  assert.ok(result.firstDamage > 0);
  assert.equal(result.finalDamage, result.firstDamage);
  assert.equal(result.visibleTargets, 0);
});

test('freeze cannot smuggle stun through boss phase immunity', () => {
  const result = evaluate(`
    const tower=towerFactory.create({col:1,row:4,evo:'froststorm',level:5});towers=[tower];
    const target=enemyFactory.create({archetype:'frostOracle',maxHp:10000000,baseSpeed:40});
    target.hp=target.max*.4;
    const context={positionAt:d=>({x:d,y:0}),pathLength:100000};
    target.update(.01,context);
    const start=target.dist;
    for(let i=0;i<400;i++) {
      if(i%10===0)damageTarget(tower,target,{...evolution.froststorm,damage:0});
      target.update(.05,context);
    }
    return {travel:target.dist-start,freeze:target.freeze,stun:target.stun,phase:target.phase.active};
  `);
  assert.equal(result.phase, true);
  assert.equal(result.freeze, 0);
  assert.equal(result.stun, 0);
  assert.ok(result.travel > 300, 'phase immune boss must keep moving through repeated freeze hits');
});

test('earth knockback only changes distance after immunity accepts the status', () => {
  const result = evaluate(`
    Math.random=()=>0;
    const tower=towerFactory.create({col:1,row:4,evo:'earth',level:5});towers=[tower];
    const target=enemyFactory.create({archetype:'shellguard',maxHp:1000000,baseSpeed:40});
    target.dist=500;
    damageTarget(tower,target,{...evolution.earth,damage:0});
    const shielded={distance:target.dist,stun:target.stun,knockback:target.knockback};
    target.shield=0;
    damageTarget(tower,target,{...evolution.earth,damage:0});
    return {shielded,exposed:{distance:target.dist,stun:target.stun,knockback:target.knockback}};
  `);
  assert.equal(result.shielded.distance, 500);
  assert.equal(result.shielded.stun, 0);
  assert.equal(result.shielded.knockback, 0);
  assert.equal(result.exposed.distance, 422);
  assert.ok(result.exposed.stun > 0);
  assert.ok(result.exposed.knockback > 0);
});

test('every tower status receives its source and active formation duration multiplier', () => {
  const results = evaluate(`
    Math.random=()=>0;
    const source=towerFactory.create({col:1,row:4,evo:'wood',level:5});
    towers=[source,towerFactory.create({col:2,row:4,evo:'water',level:5})];
    const multiplier=formationCombatModifiers(source).statusDuration,results=[];
    const cases=[['slow','slow',3.2],['weaken','weaken',5],['stun','stun',1],['silence','silence',3],['freeze','freeze',3.8],['burn','burn',5],['poison','poison',6],['fiveElements','weaken',6],['taiji','taiji',6]];
    for(const [effect,status,duration] of cases) {
      const target=enemyFactory.create({archetype:'mossling',maxHp:1000000,baseSpeed:40});
      damageTarget(source,target,{...evolution.wood,damage:0,effect});
      results.push({effect,status,actual:target[status],expected:duration*multiplier,hasSource:target.statuses.sourceOf(status)===source});
    }
    return results;
  `);
  for (const result of results) {
    assert.ok(Math.abs(result.actual-result.expected)<1e-9, `${result.effect} must apply formation duration`);
    assert.equal(result.hasSource, true, `${result.effect} must retain tower ownership`);
  }
});
