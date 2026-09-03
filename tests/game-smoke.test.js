const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const indexMarkup = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const elements = new Map();
const classList = () => ({ add() {}, remove() {}, toggle() {}, contains() { return false; } });
function element(id) {
  if (!elements.has(id)) elements.set(id, {
    id, textContent: '', innerHTML: '', disabled: false, hidden: false,
    style: {}, dataset: {}, classList: classList(),
    addEventListener() {}, setAttribute() {}, setPointerCapture() {},
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 960, height: 540 }; }
  });
  return elements.get(id);
}

const canvas = element('game');
const drawingContext = new Proxy({}, {
  get(target, key) { if (!(key in target)) target[key] = () => {}; return target[key]; },
  set(target, key, value) { target[key] = value; return true; }
});
canvas.getContext = () => drawingContext;
const document = {
  body: { classList: classList() },
  getElementById: element,
  querySelector() { return element('query-result'); },
  querySelectorAll() { return []; }
};
const window = {
  matchMedia: () => ({ matches: false }),
  addEventListener() {}
};
const sandbox = {
  console, document, window,
  performance: { now: () => 0 },
  requestAnimationFrame() {},
  setTimeout, clearTimeout,
  Math, Map, Set, Object, Array
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'content-system.js'), 'utf8'), sandbox, { filename: 'content-system.js' });
vm.runInContext(fs.readFileSync(path.join(root, 'game-content.js'), 'utf8'), sandbox, { filename: 'game-content.js' });
vm.runInContext(fs.readFileSync(path.join(root, 'enemy-system.js'), 'utf8'), sandbox, { filename: 'enemy-system.js' });
vm.runInContext(fs.readFileSync(path.join(root, 'evolution-system.js'), 'utf8'), sandbox, { filename: 'evolution-system.js' });
vm.runInContext(fs.readFileSync(path.join(root, 'tower-system.js'), 'utf8'), sandbox, { filename: 'tower-system.js' });
vm.runInContext(fs.readFileSync(path.join(root, 'synergy-system.js'), 'utf8'), sandbox, { filename: 'synergy-system.js' });
vm.runInContext(`${fs.readFileSync(path.join(root, 'game.js'), 'utf8')}
  globalThis.__smoke = {
    towerClass: towers[0].constructor.name,
    towerCount: towers.length,
    catalogSize: towerCatalog.values().length,
    selectedName: document.getElementById('selectedInfo').innerHTML,
    waveBefore: wave
  };
  startWave(); update(1.1);
  globalThis.__smoke.spawned = spawned;
  globalThis.__smoke.enemyClass = enemies[0].constructor.name;
  globalThis.__smoke.enemyArchetype = enemies[0].archetype;
  globalThis.__smoke.waveRunning = running;
  addEnemy(); spawned++;
  globalThis.__smoke.routeSchedule = currentPaths().length === 2 && enemies[0].routeIndex === 0 && enemies[1].routeIndex === 0 && routeIndexForSpawn(2, 3) === 1;
  globalThis.__smoke.strategicInitialSlot = isBuildSlot(towers[0].col, towers[0].row) && cellRoadDistance(towers[0].col, towers[0].row) >= 55;
  globalThis.__smoke.initialTowerCoversBothRoutes = cellRouteDistances(towers[0].col,towers[0].row).every(distance=>distance<=currentAttackRadius(evolution.base,towers[0]));
  globalThis.__smoke.initialSlotIsLookout = towerSlotEffect(towers[0])?.name === '瞭望台' && currentAttackRadius(evolution.base,towers[0]) > attackRadius(evolution.base);
  globalThis.__smoke.balancedAttackRadii = [attackRadius(evolution.base),attackRadius(evolution.wood),currentAttackRadius(evolution.base,towers[0])].map(Math.round);
  globalThis.__smoke.buildSlotVisibility = [shouldDrawBuildSlot(1,0),shouldDrawBuildSlot(1,0,true),shouldDrawBuildSlot(towers[0].col,towers[0].row),shouldDrawBuildSlot(currentBattlefield().ritualSite[0],currentBattlefield().ritualSite[1])];
  const projectileEnemy = { x: 230, y: 390, dist: 100, hp: 10000, max: 10000, dead: false, armor: 0, resist: {}, radius: 14, type: 'normal' };
  projectiles = [];
  launchAttack(towers[0], [projectileEnemy], evolution.base);
  globalThis.__smoke.hpBeforeFlight = projectileEnemy.hp;
  globalThis.__smoke.towerActionStarted = towers[0].attackAnimation?.weapon === 'seedshot' && towers[0].attackAnimation?.target === projectileEnemy;
  updateProjectiles(.02);
  globalThis.__smoke.hpDuringFlight = projectileEnemy.hp;
  draw();
  globalThis.__smoke.canvasDrawPassed = true;
  towers[0].updateAttackAnimation(.2);
  updateProjectiles(2);
  globalThis.__smoke.hpAfterImpact = projectileEnemy.hp;
  globalThis.__smoke.weaponFxSpawned = fxParticles.length > 0;
  const modelTower = towerFactory.create({ col: 1, row: 6, level: 1, evo: 'fire', evoTier: 1, evolutionPath: 'fire' });
  const modelEnemy = { x: 230, y: 390, dist: 100, hp: 10000, max: 10000, dead: false, armor: 0, resist: {}, radius: 14, type: 'normal' };
  projectiles = [];
  launchAttack(modelTower, [modelEnemy], evolution.fire);
  globalThis.__smoke.modelActionStarted = modelTower.attackAnimation?.weapon === 'rocket' && modelTower.attackAnimation?.target === modelEnemy;
  modelTower.updateAttackAnimation(.6);
  globalThis.__smoke.modelMuzzleOffset = projectiles[0]?.x !== 90 || projectiles[0]?.y !== 390;

  globalThis.__smoke.weaponAssignments = [
    evolution.metal.combat.weapon,
    evolution.fire.combat.weapon,
    evolution.water.combat.weapon,
    evolution.windBranch1.combat.weapon,
    evolution.fireBranch7.combat.weapon,
    evolution.fiveSpirit.combat.weapon
  ].join(',');

  const fireTower = towerFactory.create({ col: 1, row: 6, level: 1, evo: 'fire', evoTier: 1, evolutionPath: 'fire' });
  const splashLead = { x: 230, y: 390, dist: 100, hp: 10000, max: 10000, dead: false, armor: 0, resist: {}, radius: 14, type: 'normal' };
  const splashNear = { x: 245, y: 390, dist: 90, hp: 10000, max: 10000, dead: false, armor: 0, resist: {}, radius: 14, type: 'normal' };
  projectiles = [];
  launchAttack(fireTower, [splashLead, splashNear], evolution.fire);
  fireTower.updateAttackAnimation(.6);
  updateProjectiles(2);
  globalThis.__smoke.splashDamagedBoth = splashLead.hp < 10000 && splashNear.hp < 10000;

  const meleeTower = towerFactory.create({ col: 1, row: 6, level: 1, evo: 'metal', evoTier: 1, evolutionPath: 'metal' });
  const meleeEnemy = { x: 120, y: 390, dist: 100, hp: 10000, max: 10000, dead: false, armor: 0, resist: {}, radius: 14, type: 'normal' };
  attackEvents = []; projectiles = [];
  launchAttack(meleeTower, [meleeEnemy], evolution.metal);
  globalThis.__smoke.meleeUsesEvent = attackEvents[0]?.type === 'melee' && projectiles.length === 0;
  updateAttackEvents(.1);
  globalThis.__smoke.meleeWaitsForImpact = meleeEnemy.hp === 10000;
  updateAttackEvents(.5);
  globalThis.__smoke.meleeLanded = meleeEnemy.hp < 10000;

  const chainTower = towerFactory.create({ col: 1, row: 6, level: 1, evo: 'water', evoTier: 1, evolutionPath: 'water' });
  const chainOne = { x: 160, y: 390, dist: 100, hp: 10000, max: 10000, dead: false, armor: 0, resist: {}, radius: 14, type: 'normal' };
  const chainTwo = { x: 210, y: 390, dist: 90, hp: 10000, max: 10000, dead: false, armor: 0, resist: {}, radius: 14, type: 'normal' };
  attackEvents = [];
  launchAttack(chainTower, [chainOne, chainTwo], evolution.water);
  updateAttackEvents(.31);
  globalThis.__smoke.chainFirstLink = chainOne.hp < 10000 && chainTwo.hp === 10000;
  updateAttackEvents(.1);
  globalThis.__smoke.chainSecondLink = chainTwo.hp < 10000;

  const mineTower = towerFactory.create({ col: 1, row: 6, level: 10, evo: 'fireBranch7', evoTier: 2, evolutionPath: 'fire' });
  const mineEnemy = { x: 230, y: 390, dist: 100, hp: 10000, max: 10000, dead: false, armor: 0, resist: {}, radius: 14, type: 'normal' };
  attackEvents = [];
  launchAttack(mineTower, [mineEnemy], evolution.fireBranch7);
  updateAttackEvents(.6);
  globalThis.__smoke.mineWaitsToArm = mineEnemy.hp === 10000;
  updateAttackEvents(.2);
  globalThis.__smoke.mineTriggersAfterArming = mineEnemy.hp < 10000;

  const meteorTower = towerFactory.create({ col: 1, row: 6, level: 10, evo: 'fiveSpirit', evoTier: 2, evolutionPath: 'fiveSpirit' });
  const meteorEnemy = { x: 230, y: 390, dist: 100, hp: 10000, max: 10000, dead: false, armor: 0, resist: {}, radius: 14, type: 'normal' };
  attackEvents = [];
  launchAttack(meteorTower, [meteorEnemy], evolution.fiveSpirit);
  updateAttackEvents(.4);
  globalThis.__smoke.meteorWarnsBeforeImpact = meteorEnemy.hp === 10000;
  updateAttackEvents(.3);
  globalThis.__smoke.meteorImpactsAfterWarning = meteorEnemy.hp < 10000;

  attackEvents = []; projectiles = [];
  for (const key of ['metal','wood','water','yang','fireBranch7','fiveSpirit']) {
    const tower = towerFactory.create({ col: 1, row: 6, level: 10, evo: key, evoTier: 1, evolutionPath: branchOf[key] || key });
    launchAttack(tower, [chainOne, chainTwo], evolution[key]);
  }
  draw();
  globalThis.__smoke.nonProjectileTypes = [...new Set(attackEvents.map(event => event.type))].sort();

  const storedTower = towerFactory.create({ col: 2, row: 6, level: 8, evo: 'fire', evoTier: 1, evolutionPath: 'fire' });
  towers.push(storedTower); selectedTower = storedTower; recallSelectedTower();
  globalThis.__smoke.evolvedTowerStored = standbyReserve.length === 1 && standbyReserve[0].evo === 'fire' && standbyReserve[0].level === 8;
  beginDeployStandby(0); deployReserve(1, 0);
  globalThis.__smoke.evolvedTowerRestored = towers.some(tower => tower.evo === 'fire' && tower.level === 8) && standbyReserve.length === 0;

  reserve = { 1: 2 }; coins = growthModes.balanced.threshold; growthCycles.balanced = 0;
  processGrowth();
  globalThis.__smoke.processGrowthLeavesPairs = reserve[1] >= 2 && reserveMergeCount() > 0;

  reserve = { 1: 32 };
  globalThis.__smoke.reserveCascadeCount = reserveMergeCount() === 30 && reserve[1] === 32;
  compactReserve();
  globalThis.__smoke.reserveStopsAtEvolution = reserve[5] === 2 && !reserve[6];

  towers = [towerFactory.create({ col: 0, row: 0, level: 2 })];
  reserve = { 2: 1 }; pendingDeployLevel = 2; pendingDeployTowerIndex = null;
  deployReserve(0, 0);
  globalThis.__smoke.reserveInjectMerge = towers.length === 1 && towers[0].level === 3 && !reserve[2];

  const waterBranchOne = towerFactory.create({ col: 0, row: 1, level: 10, evo: 'waterBranch1', evoTier: 2, evolutionPath: 'water' });
  const waterBranchTwo = towerFactory.create({ col: 1, row: 1, level: 10, evo: 'waterBranch2', evoTier: 2, evolutionPath: 'water' });
  globalThis.__smoke.differentBranchesDoNotMerge = !canMergeTowers(waterBranchOne, waterBranchTwo);

  towers = [towerFactory.create({ col: 0, row: 0, level: 2 }), towerFactory.create({ col: 1, row: 0, level: 2 })];
  reserve = { 1: 4 }; pendingEvolution = null; running = false;
  globalThis.__smoke.mergeOpportunityTotal = mergeOpportunityCount() === 4;
  autoMerge();
  const mergedOnce = towers.length === 1 && towers[0].level === 3 && reserve[3] === 1;
  globalThis.__smoke.mergeFeedback = hits.some(item => item.type === 'mergeText' && /合成成功/.test(item.label));
  globalThis.__smoke.mergeProgressMarkup = document.getElementById('selectedInfo').innerHTML.includes('merge-meter') && document.getElementById('selectedInfo').innerHTML.includes('合成进度');
  undoAutoMerge();
  globalThis.__smoke.autoMergeUndo = mergedOnce && towers.length === 2 && towers.every(tower => tower.level === 2) && reserve[1] === 4 && !reserve[2];

  towers = [towerFactory.create({ col: 0, row: 0, level: 6 }), towerFactory.create({ col: 1, row: 0, level: 2 })];
  reserve = {}; pendingEvolution = null; autoMerge();
  globalThis.__smoke.lowerTowerAddsMergeProgress = towers.length === 1 && towers[0].level === 6 && towers[0].growth === 5;

  const focusCore = towerFactory.create({ col: 0, row: 0, level: 1 });
  const focusSupport = towerFactory.create({ col: 1, row: 0, level: 1, evo: 'wood', evoTier: 1, evolutionPath: 'wood' });
  towers = [focusCore, focusSupport]; reserve = {};
  const damageWithoutReserve = formationDamageMultiplier(focusCore);
  reserve = { 5: 13 };
  globalThis.__smoke.reserveDoesNotBuffCombat = formationDamageMultiplier(focusCore) === damageWithoutReserve;
  growthMode = 'sprout';
  const sproutCombat = [formationDamageMultiplier(focusCore), growthCombatModifiers().cooldown];
  growthMode = 'refine';
  const refineCombat = [formationDamageMultiplier(focusCore), growthCombatModifiers().cooldown];
  globalThis.__smoke.rootsChangeCombat = sproutCombat[0] < damageWithoutReserve && sproutCombat[1] < 1 && refineCombat[0] > damageWithoutReserve && refineCombat[1] > 1;
  growthMode = 'balanced';

  pendingEvolution = null; reserve = { 1: 2 }; coins = 0;
  gameSession.reset({ modeKey: 'endless', mapKey: 'grove' }); wave = 1; gameSession.startWave(); running = true;
  completeWave();
  globalThis.__smoke.waveLeavesReserveUntouched = reserve[1] >= 2 && mergeOpportunityCount() > 0;
  globalThis.__smoke.automaticPreparation = !running && nextWaveTimer === 4 && gameSession.status === 'preparing' && document.getElementById('waveBtn').disabled === false;
  update(4.1);
  globalThis.__smoke.automaticNextWave = running && nextWaveTimer === 0 && gameSession.status === 'running' && wave === 2;
  globalThis.__smoke.balancedGrowthCurve = growthThreshold(10) === 28 && growthThreshold(19) === 46;
  const threatThree = endlessThreatProfile(3), threatTen = endlessThreatProfile(10);
  globalThis.__smoke.endlessThreatCycle = threatThree.traitKey === 'armored' && threatThree.roster.includes('shellguard') && threatTen.finale && threatTen.traitKey === 'fortified';
  globalThis.__smoke.fixedEnemyPace = enemyTravelSpeed({ speedScale: 1 }, endlessThreatProfile(1), 1) === enemyTravelSpeed({ speedScale: 1 }, endlessThreatProfile(49), 1);
  startMode('endless'); wave = 1; gameSession.startWave(); running = true; finalWave = true;
  towers = [towerFactory.create({ col: 1, row: 4, level: 20, evo: 'fiveSpirit', evoTier: 2, evolutionPath: 'fiveSpirit' })];
  completeWave();
  globalThis.__smoke.finalTrialNeedsFormation = gameSession.status === 'preparing' && !gameWon;
  towers.push(towerFactory.create({ col: 2, row: 4, level: 5, evo: 'metal', evoTier: 1, evolutionPath: 'metal' }));
  towers.push(towerFactory.create({ col: 3, row: 4, level: 5, evo: 'fire', evoTier: 1, evolutionPath: 'fire' }));
  globalThis.__smoke.finalTrialFormationReady = finaleRequirementsMet();
  const combatBudget = definition => definition.damage / definition.rate * attackModeBudget[definition.attackMode];
  const commonBudget = Math.max(...fiveKeys.map(key => combatBudget(evolution[key])));
  const rareBudget = Math.max(...['yin','yang','wind','thunder'].map(key => combatBudget(evolution[key])));
  const branchRatios = routes.flatMap(parent => branchKeys[parent].map(key => combatBudget(evolution[key]) / combatBudget(evolution[parent])));
  globalThis.__smoke.noUniversalRareStatWinner = rareBudget <= commonBudget * 1.2;
  globalThis.__smoke.branchesShareCombatBudget = Math.min(...branchRatios) >= 1.08 && Math.max(...branchRatios) <= 1.35;
  globalThis.__smoke.fusionsRespectIngredientBudget = combatBudget(evolution.fiveSpirit) <= fiveKeys.reduce((sum, key) => sum + combatBudget(evolution[key]), 0) * 1.6;
`, sandbox, { filename: 'game.js' });

assert.equal(sandbox.__smoke.towerClass, 'Tower');
assert.equal(sandbox.__smoke.towerCount, 1);
assert.equal(sandbox.__smoke.catalogSize, 79);
assert.match(sandbox.__smoke.selectedName, /橡果守卫/);
assert.equal(sandbox.__smoke.waveBefore, 1);
assert.equal(sandbox.__smoke.spawned, 1);
assert.equal(sandbox.__smoke.enemyClass, 'Enemy');
assert.equal(sandbox.__smoke.enemyArchetype, 'mossling');
assert.equal(sandbox.__smoke.waveRunning, true);
assert.equal(sandbox.__smoke.routeSchedule, true);
assert.equal(sandbox.__smoke.strategicInitialSlot, true);
assert.equal(sandbox.__smoke.initialTowerCoversBothRoutes, true);
assert.equal(sandbox.__smoke.initialSlotIsLookout, true);
assert.deepEqual(Array.from(sandbox.__smoke.balancedAttackRadii), [108,180,135]);
assert.deepEqual(Array.from(sandbox.__smoke.buildSlotVisibility), [false,true,true,true]);
assert.equal(sandbox.__smoke.hpDuringFlight, sandbox.__smoke.hpBeforeFlight);
assert.equal(sandbox.__smoke.towerActionStarted, true);
assert.equal(sandbox.__smoke.modelActionStarted, true);
assert.equal(sandbox.__smoke.modelMuzzleOffset, true);
assert.ok(sandbox.__smoke.hpAfterImpact < sandbox.__smoke.hpBeforeFlight);
assert.equal(sandbox.__smoke.weaponFxSpawned, true);
assert.equal(sandbox.__smoke.weaponAssignments, 'boomerang,rocket,waterjet,scatter,mine,meteor');
assert.equal(sandbox.__smoke.splashDamagedBoth, true);
assert.equal(sandbox.__smoke.canvasDrawPassed, true);
assert.equal(sandbox.__smoke.meleeUsesEvent, true);
assert.equal(sandbox.__smoke.meleeWaitsForImpact, true);
assert.equal(sandbox.__smoke.meleeLanded, true);
assert.equal(sandbox.__smoke.chainFirstLink, true);
assert.equal(sandbox.__smoke.chainSecondLink, true);
assert.equal(sandbox.__smoke.mineWaitsToArm, true);
assert.equal(sandbox.__smoke.mineTriggersAfterArming, true);
assert.equal(sandbox.__smoke.meteorWarnsBeforeImpact, true);
assert.equal(sandbox.__smoke.meteorImpactsAfterWarning, true);
assert.equal(sandbox.__smoke.nonProjectileTypes.join(','), 'area,beam,chain,melee,nova,rain');
assert.equal(sandbox.__smoke.evolvedTowerStored, true);
assert.equal(sandbox.__smoke.evolvedTowerRestored, true);
assert.equal(sandbox.__smoke.processGrowthLeavesPairs, true);
assert.equal(sandbox.__smoke.reserveCascadeCount, true);
assert.equal(sandbox.__smoke.reserveStopsAtEvolution, true);
assert.equal(sandbox.__smoke.reserveInjectMerge, true);
assert.equal(sandbox.__smoke.differentBranchesDoNotMerge, true);
assert.equal(sandbox.__smoke.mergeOpportunityTotal, true);
assert.equal(sandbox.__smoke.mergeFeedback, true);
assert.equal(sandbox.__smoke.mergeProgressMarkup, true);
assert.equal(sandbox.__smoke.autoMergeUndo, true);
assert.equal(sandbox.__smoke.lowerTowerAddsMergeProgress, true);
assert.equal(sandbox.__smoke.reserveDoesNotBuffCombat, true);
assert.equal(sandbox.__smoke.rootsChangeCombat, true);
assert.equal(sandbox.__smoke.waveLeavesReserveUntouched, true);
assert.equal(sandbox.__smoke.automaticPreparation, true);
assert.equal(sandbox.__smoke.automaticNextWave, true);
assert.equal(sandbox.__smoke.balancedGrowthCurve, true);
assert.equal(sandbox.__smoke.endlessThreatCycle, true);
assert.equal(sandbox.__smoke.fixedEnemyPace, true);
assert.equal(sandbox.__smoke.finalTrialNeedsFormation, true);
assert.equal(sandbox.__smoke.finalTrialFormationReady, true);
assert.equal(sandbox.__smoke.noUniversalRareStatWinner, true);
assert.equal(sandbox.__smoke.branchesShareCombatBudget, true);
assert.equal(sandbox.__smoke.fusionsRespectIngredientBudget, true);
assert.deepEqual(Array.from(sandbox.window.GameApp.levels(), level => level.key), ['groveGate', 'mirrorMarsh', 'emberPass']);
const campaignSession = sandbox.window.GameApp.startMode('campaign', 'groveGate');
assert.equal(campaignSession.modeKey, 'campaign');
assert.equal(campaignSession.levelKey, 'groveGate');
assert.equal(campaignSession.mapKey, 'grove');
assert.equal(elements.get('modeEntryText').textContent, '第一章 · 林地之门');
assert.equal(elements.get('waveTotal').textContent, '/ 3');
sandbox.window.GameApp.navigatePage('battle');
assert.equal(elements.get('hubPage').hidden, true);
assert.equal(elements.get('campaignPage').hidden, true);
assert.equal(elements.get('battlePage').hidden, false);
assert.ok(indexMarkup.indexOf('id="mapOperations"') < indexMarkup.indexOf('<canvas id="game"'));
assert.equal(indexMarkup.includes('id="summonWorkshop"'), false);
assert.equal(indexMarkup.includes('mapCultivateBtn'), false);
assert.equal(indexMarkup.includes('mapInfuseBtn'), false);
assert.equal(elements.get('mapSpirit').textContent, 0);
assert.match(elements.get('mapReserveList').innerHTML, /暂无灵种/);
const developerSession = sandbox.window.GameApp.startMode('developer');
assert.equal(developerSession.modeKey, 'developer');
assert.equal(elements.get('devTools').hidden, false);
sandbox.window.GameApp.developer.action('spirit');
assert.match(elements.get('mapReserveList').innerHTML, /data-map-seed/);
assert.equal(sandbox.window.GameApp.developer.spawnTower(20, 'fiveSpirit', 'fiveSpirit', 2), true);
console.log('game-smoke: attack variants and evolved-tower standby storage passed');
