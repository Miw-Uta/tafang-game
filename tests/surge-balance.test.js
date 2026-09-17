const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const { createSandbox } = require('../scripts/simulate-campaign');
const evaluate = source => vm.runInContext(`(() => {
  startMode('campaign','groveGate'); navigatePage('battle');
  running=true;paused=false;$('storyModal').hidden=true;
  ${source}
})()`, createSandbox(42));

test('surge lethal rewards spirit, score and objective credit once but never recharges itself', () => {
  const result = evaluate(`
    const source=towers[0];enemies=[];kills=0;score=0;coins=0;surgeCharge=100;
    for(let i=0;i<15;i++){
      const enemy=enemyFactory.create({archetype:'mossling',maxHp:1000,baseSpeed:40});
      Object.assign(enemy,{hp:1,x:200+i,y:200,routeIndex:0});enemies.push(enemy);
    }
    const targets=[...enemies];unleashSurge();
    const first={charge:surgeCharge,kills,score,coins,surgeKills:campaignRun.stats.surgeKills};
    unleashSurge();
    targets.forEach(enemy=>damageTarget(source,enemy,{...evolution.base,damage:0,effect:null}));
    return {first,after:{charge:surgeCharge,kills,score,coins,surgeKills:campaignRun.stats.surgeKills},allDead:targets.every(enemy=>enemy.dead)};
  `);
  assert.equal(result.allDead, true);
  assert.equal(result.first.charge, 0, 'fifteen burst kills must not fund another burst');
  assert.equal(result.first.kills, 15);
  assert.equal(result.first.surgeKills, 15);
  assert.ok(result.first.coins > 0); assert.ok(result.first.score > 0);
  assert.deepEqual(result.after, result.first, 'already settled enemies cannot duplicate rewards');
});

test('surviving a surge does not suppress charge earned by a later genuine tower kill', () => {
  const result = evaluate(`
    const enemy=enemyFactory.create({archetype:'mossling',maxHp:1000,baseSpeed:40});
    Object.assign(enemy,{x:200,y:200,routeIndex:0});enemies=[enemy];surgeCharge=100;
    unleashSurge();const afterBurst={hp:enemy.hp,charge:surgeCharge,surgeKill:Boolean(enemy.campaignSurgeHit)};
    damageTarget(towers[0],enemy,{...evolution.base,damage:100000,effect:null});
    return {afterBurst,charge:surgeCharge,surgeKills:campaignRun.stats.surgeKills,kills};
  `);
  assert.ok(result.afterBurst.hp > 0); assert.equal(result.afterBurst.charge, 0);
  assert.equal(result.afterBurst.surgeKill, false);
  assert.equal(result.charge, 9); assert.equal(result.surgeKills, 0); assert.equal(result.kills, 1);
});

test('normal and story retain their burst percentage while veteran extra health does not amplify burst damage', () => {
  const result = evaluate(`
    const samples={};
    for(const [difficulty,max] of [['story',700],['normal',1000],['veteran',1450]]){
      window.campaignModifiers={damage:1,hp:max/1000,difficulty,support:'seeds'};
      const enemy=enemyFactory.create({archetype:'mossling',maxHp:max,baseSpeed:40});
      Object.assign(enemy,{x:200,y:200,routeIndex:0});enemies=[enemy];surgeCharge=100;
      unleashSurge();samples[difficulty]={damage:max-enemy.hp,max};
    }
    return samples;
  `);
  assert.ok(Math.abs(result.story.damage - 196) < 1e-8);
  assert.ok(Math.abs(result.normal.damage - 280) < 1e-8);
  assert.ok(result.veteran.damage <= result.normal.damage + 1e-8, 'harder difficulty must not buff percentage-based burst against identical enemies');
  assert.ok(result.veteran.damage > 150, 'veteran burst remains a substantial emergency resource');
});

test('surge lethals do not inherit the selected tower burn, freeze, knockback or damage payload', () => {
  const result = evaluate(`
    const tower=towerFactory.create({col:1,row:3,evo:'fire',level:20});towers=[tower];selectedTower=tower;
    const enemy=enemyFactory.create({archetype:'mossling',maxHp:1000,baseSpeed:40});
    Object.assign(enemy,{hp:1,x:200,y:200,routeIndex:0});enemies=[enemy];surgeCharge=100;
    unleashSurge();return {dead:enemy.dead,burn:enemy.burn,charge:surgeCharge};
  `);
  assert.equal(result.dead, true); assert.equal(result.burn, 0); assert.equal(result.charge, 0);
});
