const assert = require('node:assert/strict');
const { CampaignRun, mergeRecord } = require('../campaign-system.js');
const GameContent = require('../game-content.js');

const registry = GameContent.createRegistry();
const levels = registry.levels.values();
assert.equal(levels.length, 20);
assert.equal(levels[0].waves.length, 3);
assert.equal(levels.at(-1).waves.length, 7);
assert.ok(new Set(levels.map(level => level.objectives[1].metric)).size >= 10);
for (const level of levels) {
  assert.equal(level.objectives.length, 2, `${level.key} needs two bonus objectives`);
  assert.ok(level.epilogue.length > 35, `${level.key} needs a story conclusion`);
  assert.ok(level.retryStory.length > 15);
  assert.equal(level.dispatches.length, 3);
  assert.ok(level.startingLoadout.tower.level >= 1);
  assert.ok(Object.values(level.startingLoadout.seeds).every(count => Number.isInteger(count) && count > 0));
  assert.ok(level.startingLoadout.spirit >= 0);
  assert.ok(level.routePlan.every(plan => plan.weights.length === 2 && plan.weights.some(weight => weight > 0)));
  assert.ok(level.waves.at(-1).boss);
  const run = new CampaignRun(level);
  for (const objective of level.objectives) {
    assert.ok(Object.hasOwn(run.stats, objective.metric), `${level.key} uses an unknown metric`);
  }
}

const first = new CampaignRun(registry.levels.get('groveGate'));
first.record('merge'); first.record('merge');
first.observe({ lives: 11 });
const perfect = first.finish({ won: true, score: 400 });
assert.equal(perfect.stars, 3);
assert.equal(perfect.title, '完美守护');
assert.ok(perfect.story.includes('低语古树'));
first.record('merge'); first.observe({ lives: 0 });
assert.equal(first.stats.merges, 2, 'finished runs cannot continue accumulating statistics');
assert.equal(first.finish({ won: false }), perfect, 'final result is stable');

const wounded = new CampaignRun(registry.levels.get('groveGate'));
wounded.observe({ lives: 9 }); wounded.observe({ lives: 12 });
assert.equal(wounded.stats.livesLost, 3, 'healing cannot erase prior losses');
wounded.observe({ lives: 10 }); wounded.observe({ lives: 10 });
assert.equal(wounded.stats.livesLost, 5, 'new damage after healing counts once toward total losses');
assert.equal(wounded.finish({ won: true }).stars, 1);
assert.equal(new CampaignRun(levels[0]).finish({ won: false }).stars, 0, 'failure never awards preservation stars');

const focused = new CampaignRun(registry.levels.get('thornCathedral'));
const boss = { type: 'boss' }, otherBoss = { type: 'boss' }, normal = { type: 'normal' };
focused.record('focus', { enemy: boss });
focused.record('focus', { enemy: boss });
assert.equal(focused.stats.focusedBossKills, 0, 'repeated orders do not complete a kill objective');
focused.record('kill', { enemy: boss, lineage: 'metal' });
focused.record('kill', { enemy: boss, lineage: 'metal' });
focused.record('kill', { enemy: otherBoss });
focused.record('focus', { enemy: normal });
focused.record('kill', { enemy: normal });
assert.equal(focused.stats.focusedBossKills, 1);
assert.equal(focused.stats.bossKills, 2);
assert.equal(focused.stats.forgedBossKills, 1);

focused.record('control', { enemy: boss, applied: false });
focused.record('control', { enemy: otherBoss, applied: true });
focused.record('control', { enemy: otherBoss, applied: true });
assert.equal(focused.stats.controls, 1, 'resisted and repeated control effects do not inflate unique-target objectives');

const formation = new CampaignRun(registry.levels.get('rootMemory'));
formation.observe({ towers:[{evo:'base',level:10},{evo:'water',level:5},{evo:'waterBranch2',evolutionPath:'water',level:10}], synergyCount:1 });
assert.equal(formation.stats.maxLineages, 1, 'branches of the same element count as one lineage');
assert.equal(formation.stats.maxEvolvedLevel, 10);
formation.observe({ towers:[{evo:'metal',level:5},{evo:'wood',level:5}], synergyCount:2 });
assert.equal(formation.stats.maxLineages, 2, 'sequential single-lineage formations cannot satisfy simultaneous diversity');
assert.equal(formation.stats.maxSynergies, 2);

const redeploy = new CampaignRun(registry.levels.get('ashClimb'));
redeploy.record('deploy', { recalled: true });
assert.equal(redeploy.stats.redeployments, 0);
redeploy.record('recall');
redeploy.record('deploy', { recalled: false });
assert.equal(redeploy.stats.redeployments, 0, 'a fresh seed is not a redeployed guardian');
redeploy.record('deploy', { recalled: true });
assert.equal(redeploy.stats.redeployments, 1);

const previous = { stars:3, score:900, completedAt:100, attemptsWon:1 };
const lower = mergeRecord(previous, { won:true, stars:1, score:200 }, 200);
assert.equal(lower.stars, 3); assert.equal(lower.score, 900);
assert.equal(lower.completedAt, 100); assert.equal(lower.lastPlayedAt, 200); assert.equal(lower.attemptsWon, 2);
assert.deepEqual(mergeRecord(previous, { won:false, stars:0 }, 300), previous);
assert.deepEqual(previous, { stars:3, score:900, completedAt:100, attemptsWon:1 }, 'record merging does not mutate its input');

console.log('campaign-system: 20 mission contracts, meaningful objectives, three-star results and best records passed');
