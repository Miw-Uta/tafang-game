const assert = require('node:assert/strict');
const { ContentRegistry, GameSession, WaveDefinition } = require('../content-system.js');
const GameContent = require('../game-content.js');

const registry = GameContent.createRegistry();
function segmentDistance(x, y, start, end) {
  const dx = end[0] - start[0], dy = end[1] - start[1];
  const progress = Math.max(0, Math.min(1, ((x - start[0]) * dx + (y - start[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (start[0] + dx * progress), y - (start[1] + dy * progress));
}
assert.equal(registry.maps.values().length, 4);
assert.equal(registry.levels.values().length, 3);
assert.equal(registry.modes.get('developer').kind, 'developer');
assert.equal(registry.modes.get('developer').levelRequired, false);
assert.notDeepEqual(registry.maps.get('grove').path, registry.maps.get('wetland').path);
assert.ok(registry.maps.get('frost').pathLength > 0);
registry.maps.values().forEach(map => {
  assert.equal(map.routes.length, 2);
  assert.ok(map.routeControls.every(route => route.length >= 6));
  assert.ok(map.routeControls.every(route => route.slice(1).every((point,index) => point[0] === route[index][0] || point[1] === route[index][1])), `${map.key} contains a diagonal route segment`);
  assert.ok(map.routeLengths.every(length => length >= 1800), `${map.key} route is too short`);
  assert.deepEqual(map.routePlan.map(plan => plan.from), [1, 3, 5]);
  assert.deepEqual(Array.from(map.routePlan[0].weights), [1, 0]);
  assert.deepEqual(Array.from(map.routePlan[1].weights), [2, 1]);
  assert.deepEqual(Array.from(map.routePlan[2].weights), [1, 1]);
  assert.ok(map.buildSlots.length >= 60);
  assert.ok(map.buildSlots.some(slot => slot[0] === map.initialSlot[0] && slot[1] === map.initialSlot[1]));
  assert.ok(map.specialSlots.some(slot => slot.col === map.initialSlot[0] && slot.row === map.initialSlot[1] && slot.type === 'lookout'));
  map.buildSlots.forEach(([col, row]) => {
    const x = col * map.cellSize + map.cellSize / 2, y = row * map.cellSize + map.cellSize / 2;
    const clearance = Math.min(...map.routes.flatMap(route => route.slice(1).map((point, index) => segmentDistance(x, y, route[index], point))));
    assert.ok(clearance >= 55, `${map.key} slot ${col},${row} overlaps a road`);
  });
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    assert.ok(map.buildSlots.some(slot => slot[0] === map.ritualSite[0] + dx && slot[1] === map.ritualSite[1] + dy));
  }
  const initialX = map.initialSlot[0] * map.cellSize + map.cellSize / 2;
  const initialY = map.initialSlot[1] * map.cellSize + map.cellSize / 2;
  const initialClearances = map.routes.map(route => Math.min(...route.slice(1).map((point,index) => segmentDistance(initialX,initialY,route[index],point))));
  assert.ok(initialClearances.every(clearance => clearance <= map.cellSize * 2.1), `${map.key} initial lookout cannot cover both routes`);
});

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
assert.throws(() => new ContentRegistry().maps.register('badRoutes', { name: '坏路线', routes: [[[0,0],[1,1]],[[0,1],[1,0]]], routePlan: [{ from: 1, weights: [1] }] }), /Invalid route plan/);
assert.throws(() => new ContentRegistry().maps.register('badSlot', { name: '坏塔位', path: [[0,0],[1,1]], buildSlots: [[1,1]], initialSlot: [2,2] }), /Initial slot is not buildable/);
assert.throws(() => new ContentRegistry().maps.register('diagonal', { name: '斜线路线', routeStyle:'orthogonal', path: [[0,0],[1,1]] }), /diagonal segment/);

console.log('content-system: registry, maps, endless and campaign sessions passed');
