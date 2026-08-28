const assert = require('node:assert/strict');
const { ContentRegistry, GameSession, WaveDefinition } = require('../content-system.js');
const GameContent = require('../game-content.js');

const registry = GameContent.createRegistry();
assert.equal(registry.maps.values().length, 4);
assert.equal(registry.levels.values().length, 3);
assert.notDeepEqual(registry.maps.get('grove').path, registry.maps.get('wetland').path);
assert.ok(registry.maps.get('frost').pathLength > 0);

const campaign = new GameSession(registry, { modeKey: 'campaign', levelKey: 'groveGate' });
assert.equal(campaign.map.key, 'grove');
assert.equal(campaign.currentWave.enemyCount, 8);
assert.equal(campaign.selectMap('frost'), false);
assert.equal(campaign.startWave(), true);
assert.equal(campaign.completeWave().won, false);
assert.equal(campaign.waveNumber, 2);
campaign.startWave(); campaign.completeWave(); campaign.startWave();
assert.equal(campaign.currentWave.boss, 'groveTyrant');
assert.equal(campaign.completeWave().won, true);
assert.equal(campaign.status, 'won');

const endless = new GameSession(registry, { modeKey: 'endless', mapKey: 'wetland' });
assert(endless.currentWave instanceof WaveDefinition);
assert.equal(endless.selectMap('ember'), true);
assert.equal(endless.map.key, 'ember');
endless.startWave(); endless.completeWave();
assert.equal(endless.waveNumber, 2);
assert.equal(endless.status, 'preparing');
assert.equal(endless.abandon().status, 'abandoned');

const broken = new ContentRegistry();
broken.maps.register('valid', { name: '地图', path: [[0, 0], [1, 1]] });
broken.levels.register('broken', { name: '坏关卡', mapKey: 'missing', waves: [{}] });
assert.throws(() => broken.validate(), /unknown map/);

console.log('content-system: registry, maps, endless and campaign sessions passed');
