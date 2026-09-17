const test = require('node:test');
const assert = require('node:assert/strict');
const { CampaignCheckpointStore, VERSION, MAX_BYTES } = require('../checkpoint-system.js');
const { CampaignRun } = require('../campaign-system.js');
const { Tower } = require('../tower-system.js');
const GameContent = require('../game-content.js');
const { BattleTactics } = require('../tactics-system.js');

const registry = GameContent.createRegistry();
const evolutionKeys = ['base', 'water', 'fire', 'wood', 'earth', 'metal', 'wind', 'thunder', 'yin', 'yang', 'fiveSpirit'];
const copy = value => JSON.parse(JSON.stringify(value));

function preparation(levelKey = 'groveGate') {
  const level = registry.levels.get(levelKey), map = registry.maps.get(level.mapKey);
  const run = new CampaignRun(level);
  run.record('wave', { number: 1 });
  run.record('recall');
  run.observe({ lives: level.startingLives - 2, combo: 9, towers: [{ evo: 'water', level: 8 }] });
  return {
    levelKey, waveIndex: 1, completedWaves: 1, lives: level.startingLives - 2,
    score: 12500, coins: 83.5, kills: 12,
    towers: [new Tower({ col: map.initialSlot[0], row: map.initialSlot[1], level: 8, evo: 'water', evoTier: 1, evolutionPath: 'water', cool: -.75, growth: 7, targetPriority: 'strong' }).snapshot()],
    reserve: { 1: 3, 3: 1 },
    standby: [{ ...new Tower({ col: 0, row: 0, level: 5, evo: 'fire', evolutionPath: 'fire', evoTier: 1 }).snapshot(), campaignRecalled: true }, { level: 9, evo: 'wood', evolutionPath: 'wood', evoTier: 1 }],
    growthMode: 'refine', growthCycles: { sprout: 0, balanced: 1, refine: 2, total: 7 },
    germinationOffers: [{ kind: 'seed', level: 5 }, { kind: 'cultivate', level: 3, claimed: false }],
    surgeCharge: 67,
    mapObjects: (map.objectives || []).map((spec, index) => ({ id: `${map.key}-${index}`, hp: index === 0 ? -17.25 : spec.hp - 33.5, cleared: index === 0 })),
    mapUnlockedSlots: (map.objectives?.[0]?.unlocks || []).map(slot => slot.join(',')),
    discoveredEvolutions: ['water', 'fire', 'wood'],
    campaign: { stats: { ...run.stats }, lastObservedLives: run.lastObservedLives },
    modifiers: { damage: 1.08, hp: 1.3, difficulty: 'veteran', support: 'power' },
    missionDecisions: { 'reward:2': 'charge', 'groveGate:choice': 'protect' }
  };
}

function memory() {
  let raw = null;
  return { evolutionKeys, read: () => raw, write: value => { raw = value; }, remove: () => { raw = null; }, now: () => 123456, raw: () => raw };
}

test('tactical command energy and cooldown survive checkpoint reload without refilling', () => {
  const tactics = new BattleTactics();
  tactics.cast('bramble', { x: 100, y: 100 }, { running: true, lives: 20, paths: [[[0, 100], [960, 100]]] });
  tactics.tick(2, { running: true, lives: 20 });
  tactics.endWave();
  const state = preparation(); state.tactics = tactics.snapshot();
  const storage = memory(), store = new CampaignCheckpointStore(registry, storage);
  assert.equal(store.save(state), true);
  const reloaded = new CampaignCheckpointStore(registry, storage).load();
  assert.deepEqual(reloaded.tactics, state.tactics);
  assert.equal(reloaded.tactics.energy, 68.6);
  assert.equal(reloaded.tactics.cooldowns.bramble, 12);
  const corrupt = copy(state); corrupt.tactics.energy = 999;
  assert.equal(store.save(corrupt), false);
  assert.deepEqual(store.load(), state);
});

test('preparation checkpoint restores full tower, economy, objectives and story state across twenty missions', () => {
  const storage = memory();
  const store = new CampaignCheckpointStore(registry, storage);
  for (const levelKey of registry.levels.keys()) {
    const state = preparation(levelKey);
    assert.equal(store.save(state), true, levelKey);
    assert.equal(JSON.parse(storage.raw()).version, VERSION);
    const restored = new CampaignCheckpointStore(registry, storage);
    assert.deepEqual(restored.load(), state);
    assert.equal(restored.savedAt, 123456);
    const tower = new Tower(restored.load().towers[0]);
    assert.deepEqual(tower.snapshot(), state.towers[0]);
    const run = new CampaignRun(registry.levels.get(levelKey));
    Object.assign(run.stats, restored.load().campaign.stats);
    run.lastObservedLives = restored.load().campaign.lastObservedLives;
    run.observe({ lives: state.lives });
    assert.equal(run.stats.livesLost, 2);
    assert.equal(run.stats.recalls, 1);
  }
});

test('checkpoint is an immutable backup and one suspended run replaces its predecessor', () => {
  const storage = memory(), store = new CampaignCheckpointStore(registry, storage);
  const source = preparation(), original = copy(source);
  assert.equal(store.save(source), true);
  source.towers[0].level = 20;
  source.campaign.stats.livesLost = 200;
  source.mapUnlockedSlots.length = 0;
  assert.deepEqual(store.load(), original);
  const exposed = store.load();
  exposed.towers.length = 0;
  exposed.modifiers.damage = 9;
  assert.deepEqual(store.load(), original);
  assert.equal(store.save(preparation('whisperGrove')), true);
  assert.equal(store.load().levelKey, 'whisperGrove');
  assert.equal(store.clear(), true);
  assert.equal(store.load(), null);
  assert.equal(new CampaignCheckpointStore(registry, storage).load(), null);
});

test('corrupt, incompatible, oversized and combat snapshots cannot replace the last valid preparation', () => {
  const storage = memory(), store = new CampaignCheckpointStore(registry, storage);
  const valid = preparation();
  store.save(valid);
  const invalidStates = [
    state => { state.levelKey = 'missing'; },
    state => { state.waveIndex = 3; },
    state => { state.completedWaves = 0; },
    state => { state.lives = 0; },
    state => { state.coins = Infinity; },
    state => { state.score = NaN; },
    state => { state.kills = -1; },
    state => { state.towers[0].evo = 'unknown'; },
    state => { state.towers[0].evolutionPath = 'unknown'; },
    state => { state.towers[0].level = 21; },
    state => { state.towers[0].growth = Infinity; },
    state => { state.towers[0].col = 999; },
    state => { state.towers[0].targetPriority = 'random'; },
    state => { state.towers.push(copy(state.towers[0])); },
    state => { state.towers = Array(145).fill(state.towers[0]); },
    state => { state.towers = registry.maps.get('grove').buildSlots.slice(0,9).map(([col,row])=>({...state.towers[0],col,row})); },
    state => { state.standby = Array(129).fill(state.standby[0]); },
    state => { state.reserve[0] = 1; },
    state => { state.reserve[1] = 1e9; },
    state => { state.reserve[1] = 1.5; },
    state => { state.growthMode = 'unknown'; },
    state => { state.growthCycles.total = -1; },
    state => { state.germinationOffers = Array(4).fill(state.germinationOffers[0]); },
    state => { state.germinationOffers[0].kind = 'unlimited'; },
    state => { state.surgeCharge = 101; },
    state => { state.mapObjects[0].id = 'unknown'; },
    state => { state.mapObjects[0].cleared = false; },
    state => { state.mapObjects[1].hp = Infinity; },
    state => { state.mapUnlockedSlots.push('999,999'); },
    state => { state.mapUnlockedSlots.push(state.mapUnlockedSlots[0]); },
    state => { state.discoveredEvolutions.push('unknown'); },
    state => { state.campaign.stats.controls = Infinity; },
    state => { state.campaign.stats.wavesCleared = 0; },
    state => { state.campaign.lastObservedLives = 20; },
    state => { state.modifiers.damage = 100; },
    state => { state.modifiers.support = 'unlimited'; },
    state => { state.modifiers.difficulty = 'impossible'; },
    state => { state.missionDecisions.constructor = 'spoof'; },
    state => { state.missionDecisions.choice = { nested: true }; },
    state => { state.missionDecisions.choice = 'x'.repeat(MAX_BYTES); },
    state => { state.enemies = []; },
    state => { state.projectiles = []; }
  ];
  for (const mutate of invalidStates) {
    const state = copy(valid); mutate(state);
    assert.equal(store.save(state), false, mutate.toString());
    assert.equal(store.error, 'invalid-checkpoint');
    assert.deepEqual(store.load(), valid);
    const raw = JSON.stringify({ version: VERSION, savedAt: 123, state });
    assert.equal(new CampaignCheckpointStore(registry, { evolutionKeys, read: () => raw }).load(), null, mutate.toString());
  }
  for (const raw of ['null', '[]', 'false', '{bad', 'x'.repeat(MAX_BYTES + 1), JSON.stringify({ version: 99, savedAt: 123, state: valid }), JSON.stringify({ version: VERSION, savedAt: -1, state: valid })]) {
    const restored = new CampaignCheckpointStore(registry, { evolutionKeys, read: () => raw });
    assert.equal(restored.load(), null);
    assert.equal(restored.error, 'invalid-checkpoint');
    assert.equal(restored.storageAvailable, true);
  }
});

test('unavailable storage is nonfatal and retains an in-memory preparation for the current page', () => {
  const denied = () => { throw new Error('storage denied'); };
  const store = new CampaignCheckpointStore(registry, { evolutionKeys, read: denied, write: denied, remove: denied });
  assert.equal(store.load(), null);
  assert.equal(store.storageAvailable, false);
  assert.equal(store.save(preparation()), false);
  assert.deepEqual(store.load(), preparation());
  assert.equal(store.error, 'storage-unavailable');
  assert.equal(store.clear(), false);
  assert.equal(store.load(), null);
});
