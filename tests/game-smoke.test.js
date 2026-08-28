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
  const projectileEnemy = { x: 230, y: 390, dist: 100, hp: 10000, max: 10000, dead: false, armor: 0, resist: {}, radius: 14, type: 'normal' };
  projectiles = [];
  launchAttack(towers[0], [projectileEnemy], evolution.base);
  globalThis.__smoke.hpBeforeFlight = projectileEnemy.hp;
  updateProjectiles(.02);
  globalThis.__smoke.hpDuringFlight = projectileEnemy.hp;
  draw();
  globalThis.__smoke.canvasDrawPassed = true;
  updateProjectiles(2);
  globalThis.__smoke.hpAfterImpact = projectileEnemy.hp;

  const fireTower = towerFactory.create({ col: 1, row: 6, level: 1, evo: 'fire', evoTier: 1, evolutionPath: 'fire' });
  const splashLead = { x: 230, y: 390, dist: 100, hp: 10000, max: 10000, dead: false, armor: 0, resist: {}, radius: 14, type: 'normal' };
  const splashNear = { x: 245, y: 390, dist: 90, hp: 10000, max: 10000, dead: false, armor: 0, resist: {}, radius: 14, type: 'normal' };
  projectiles = [];
  launchAttack(fireTower, [splashLead, splashNear], evolution.fire);
  updateProjectiles(2);
  globalThis.__smoke.splashDamagedBoth = splashLead.hp < 10000 && splashNear.hp < 10000;

  const meleeTower = towerFactory.create({ col: 1, row: 6, level: 1, evo: 'metal', evoTier: 1, evolutionPath: 'metal' });
  const meleeEnemy = { x: 120, y: 390, dist: 100, hp: 10000, max: 10000, dead: false, armor: 0, resist: {}, radius: 14, type: 'normal' };
  attackEvents = []; projectiles = [];
  launchAttack(meleeTower, [meleeEnemy], evolution.metal);
  globalThis.__smoke.meleeUsesEvent = attackEvents[0]?.type === 'melee' && projectiles.length === 0;
  updateAttackEvents(.1);
  globalThis.__smoke.meleeWaitsForImpact = meleeEnemy.hp === 10000;
  updateAttackEvents(.1);
  globalThis.__smoke.meleeLanded = meleeEnemy.hp < 10000;

  const chainTower = towerFactory.create({ col: 1, row: 6, level: 1, evo: 'water', evoTier: 1, evolutionPath: 'water' });
  const chainOne = { x: 160, y: 390, dist: 100, hp: 10000, max: 10000, dead: false, armor: 0, resist: {}, radius: 14, type: 'normal' };
  const chainTwo = { x: 210, y: 390, dist: 90, hp: 10000, max: 10000, dead: false, armor: 0, resist: {}, radius: 14, type: 'normal' };
  attackEvents = [];
  launchAttack(chainTower, [chainOne, chainTwo], evolution.water);
  updateAttackEvents(.09);
  globalThis.__smoke.chainFirstLink = chainOne.hp < 10000 && chainTwo.hp === 10000;
  updateAttackEvents(.1);
  globalThis.__smoke.chainSecondLink = chainTwo.hp < 10000;

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
  beginDeployStandby(0); deployReserve(3, 0);
  globalThis.__smoke.evolvedTowerRestored = towers.some(tower => tower.evo === 'fire' && tower.level === 8) && standbyReserve.length === 0;

  reserve = { 1: 32 };
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
  pendingEvolution = null; running = false; autoMerge();
  const mergedOnce = towers.length === 1 && towers[0].level === 3;
  undoAutoMerge();
  globalThis.__smoke.autoMergeUndo = mergedOnce && towers.length === 2 && towers.every(tower => tower.level === 2);

  towers = [towerFactory.create({ col: 0, row: 0, level: 6 }), towerFactory.create({ col: 1, row: 0, level: 3, evo: 'fire', evoTier: 1, evolutionPath: 'fire' })];
  selectedTower = towers[0]; cultivationTarget = selectedTower;
  sacrificeTower(selectedTower, towers[1]);
  globalThis.__smoke.anyTowerSacrifice = towers.length === 1 && selectedTower.growth === 2;

  towers = [towerFactory.create({ col: 0, row: 0, level: 4 })];
  selectedTower = towers[0]; reserve = { 5: 10 }; pendingEvolution = null; cultivationTarget = null; running = false;
  infuseReserveToMilestone();
  globalThis.__smoke.batchInfusionStopsAtNode = selectedTower.level === 5 && selectedTower.growth === 0 && reserve[5] === 9 && pendingEvolution === selectedTower && seedGrowthValue(5) === 16;

  pendingEvolution = null;
  const symbiosisLow = towerFactory.create({ col: 0, row: 0, level: 1, evo: 'metal', evoTier: 1, evolutionPath: 'metal' });
  const symbiosisHigh = towerFactory.create({ col: 1, row: 0, level: 3, evo: 'fire', evoTier: 1, evolutionPath: 'fire' });
  towers = [symbiosisLow, symbiosisHigh]; cultivationPolicy = 'symbiosis'; reserve = { 1: 2 };
  autoCultivateAfterWave();
  globalThis.__smoke.symbiosisAutoAllocation = reserveEssenceTotal() === 0 && symbiosisLow.growth === 2 && symbiosisHigh.growth === 0;
  globalThis.__smoke.symbiosisBondBonus = cultivationDamageMultiplier(symbiosisLow);

  const focusCore = towerFactory.create({ col: 0, row: 0, level: 1 });
  const focusSupport = towerFactory.create({ col: 1, row: 0, level: 1, evo: 'wood', evoTier: 1, evolutionPath: 'wood' });
  towers = [focusCore, focusSupport]; cultivationPolicy = 'focus'; cultivationCore = focusCore; reserve = { 1: 2 };
  autoCultivateAfterWave();
  globalThis.__smoke.focusFeedsCoreOnly = reserveEssenceTotal() === 0 && focusCore.growth === 2 && focusSupport.growth === 0;
  globalThis.__smoke.focusMultipliers = [cultivationDamageMultiplier(focusCore), cultivationDamageMultiplier(focusSupport)];

  towers = [focusCore, focusSupport]; cultivationPolicy = 'reserve'; reserve = { 5: 13 };
  const reserveBefore = reserveEssenceTotal();
  autoCultivateAfterWave();
  globalThis.__smoke.reserveHoldsResources = reserveEssenceTotal() === reserveBefore;
  globalThis.__smoke.reserveDamageBonus = cultivationDamageMultiplier(focusCore);
  activeCultivationPolicy = 'symbiosis'; activeCultivationCore = focusCore; running = true;
  globalThis.__smoke.policyLockedForWave = cultivationDamageMultiplier(focusCore) === 1;
  running = false;

  towers = [towerFactory.create({ col: 0, row: 0, level: 3 }), towerFactory.create({ col: 1, row: 0, level: 2 })];
  selectedTower = towers[0]; pendingEvolution = null; cultivationTarget = null;
  beginCultivation();
  globalThis.__smoke.mouseCultivationStarts = cultivationTarget === selectedTower && document.getElementById('mapCultivateBtn').innerHTML.includes('取消祭炼');
  beginCultivation();
  globalThis.__smoke.mouseCultivationCancels = cultivationTarget === null;

  pendingEvolution = null; cultivationTarget = null; reserve = {}; coins = 0;
  gameSession.reset({ modeKey: 'endless', mapKey: 'grove' }); wave = 1; gameSession.startWave(); running = true;
  completeWave();
  globalThis.__smoke.automaticPreparation = !running && nextWaveTimer === 4 && gameSession.status === 'preparing' && document.getElementById('waveBtn').disabled === false;
  update(4.1);
  globalThis.__smoke.automaticNextWave = running && nextWaveTimer === 0 && gameSession.status === 'running' && wave === 2;
  globalThis.__smoke.balancedGrowthCurve = growthThreshold(10) === 28 && growthThreshold(19) === 46;
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
assert.equal(sandbox.__smoke.hpDuringFlight, sandbox.__smoke.hpBeforeFlight);
assert.ok(sandbox.__smoke.hpAfterImpact < sandbox.__smoke.hpBeforeFlight);
assert.equal(sandbox.__smoke.splashDamagedBoth, true);
assert.equal(sandbox.__smoke.canvasDrawPassed, true);
assert.equal(sandbox.__smoke.meleeUsesEvent, true);
assert.equal(sandbox.__smoke.meleeWaitsForImpact, true);
assert.equal(sandbox.__smoke.meleeLanded, true);
assert.equal(sandbox.__smoke.chainFirstLink, true);
assert.equal(sandbox.__smoke.chainSecondLink, true);
assert.equal(sandbox.__smoke.nonProjectileTypes.join(','), 'area,beam,chain,melee,nova,rain');
assert.equal(sandbox.__smoke.evolvedTowerStored, true);
assert.equal(sandbox.__smoke.evolvedTowerRestored, true);
assert.equal(sandbox.__smoke.reserveStopsAtEvolution, true);
assert.equal(sandbox.__smoke.reserveInjectMerge, true);
assert.equal(sandbox.__smoke.differentBranchesDoNotMerge, true);
assert.equal(sandbox.__smoke.autoMergeUndo, true);
assert.equal(sandbox.__smoke.anyTowerSacrifice, true);
assert.equal(sandbox.__smoke.batchInfusionStopsAtNode, true);
assert.equal(sandbox.__smoke.symbiosisAutoAllocation, true);
assert.equal(sandbox.__smoke.symbiosisBondBonus, 1.1);
assert.equal(sandbox.__smoke.focusFeedsCoreOnly, true);
assert.deepEqual(Array.from(sandbox.__smoke.focusMultipliers), [1.3, .9]);
assert.equal(sandbox.__smoke.reserveHoldsResources, true);
assert.equal(sandbox.__smoke.reserveDamageBonus, 1.2);
assert.equal(sandbox.__smoke.policyLockedForWave, true);
assert.equal(sandbox.__smoke.mouseCultivationStarts, true);
assert.equal(sandbox.__smoke.mouseCultivationCancels, true);
assert.equal(sandbox.__smoke.automaticPreparation, true);
assert.equal(sandbox.__smoke.automaticNextWave, true);
assert.equal(sandbox.__smoke.balancedGrowthCurve, true);
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
assert.ok(indexMarkup.indexOf('id="towerContextActions"') < indexMarkup.indexOf('<canvas id="game"'));
assert.equal(elements.get('mapSpirit').textContent, 0);
assert.match(elements.get('mapReserveList').innerHTML, /暂无灵种/);
console.log('game-smoke: attack variants and evolved-tower standby storage passed');
