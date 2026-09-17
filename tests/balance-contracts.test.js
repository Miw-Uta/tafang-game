const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const content = require('../game-content');
const { createSandbox } = require('../scripts/simulate-campaign');

test('all 85 campaign waves have fixed, advertised compositions and only scheduled bosses', () => {
  const registry = content.createRegistry();
  let waves = 0;
  for (const level of registry.levels.values()) for (const wave of level.waves) {
    waves++;
    assert.equal(wave.spawnPlan.length, wave.enemyCount);
    assert.equal(wave.spawnPlan.filter(spawn=>content.enemyArchetypes[spawn.archetype].role==='boss').length, wave.boss ? 1 : 0);
    if (wave.boss) assert.equal(wave.spawnPlan.at(-1).archetype, wave.boss);
    for (const spawn of wave.spawnPlan) {
      assert.ok(wave.roster.includes(spawn.archetype) || wave.boss===spawn.archetype);
      assert.deepEqual([...spawn.traits], wave.traitKey ? [wave.traitKey] : []);
      assert.ok(Object.isFrozen(spawn.traits));
    }
  }
  assert.equal(waves, 85);
});

test('campaign enemies and common evolution counters do not depend on cosmetic randomness', () => {
  const sandbox = createSandbox(42);
  const actual = vm.runInContext(`(() => {
    startMode('campaign','worldTree');
    const spawns=()=>{
      enemies=[];
      for(spawned=0;spawned<waveSize();spawned++) addEnemy();
      return enemies.map(e=>({archetype:e.archetype,hp:e.hp,speed:e.speed,traits:e.traits,route:e.routeIndex}));
    };
    const first=spawns();
    for(let i=0;i<1500;i++)Math.random();
    const second=spawns();
    pendingEvolution=towerFactory.create({col:1,row:1,level:5});
    pendingEvolutionStage='primary';openEvolution('primary');
    const choices=offeredEvolutions('primary');
    for(let i=0;i<1500;i++)Math.random();
    return JSON.stringify({first,second,choices,next:offeredEvolutions('primary')});
  })()`, sandbox);
  const { first, second, choices, next } = JSON.parse(actual);
  assert.deepEqual(first, second);
  for (const key of ['metal','wood','water','fire','earth']) assert.ok(choices.includes(key));
  assert.deepEqual(choices, next);
});

test('combat redeployment preserves cooldown and cancels unlaunched attacks', () => {
  const sandbox = createSandbox(42);
  const result = JSON.parse(vm.runInContext(`(() => {
    startMode('campaign','frostGate');
    const tower=towers[0],cell={col:tower.col,row:tower.row};
    tower.cool=3;tower.queuedAttack={};tower.attackAnimation={};
    attackEvents=[{tower,resolved:false}];
    running=true;selectedTower=tower;recallSelectedTower();
    beginDeployStandby(0);deployReserve(cell.col,cell.row);
    const recalled={cool:towers[0].cool,events:attackEvents.length,queued:tower.queuedAttack,animation:tower.attackAnimation};
    running=false;selectedTower=towers[0];recallSelectedTower();
    beginDeployStandby(0);deployReserve(cell.col,cell.row);
    return JSON.stringify({recalled,restored:towers[0].evo});
  })()`, sandbox));
  assert.equal(result.recalled.cool, 3);
  assert.equal(result.recalled.events, 0);
  assert.equal(result.recalled.queued, null);
  assert.equal(result.recalled.animation, null);
  assert.equal(result.restored, 'water');
});
