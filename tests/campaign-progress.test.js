const test = require('node:test');
const assert = require('node:assert/strict');
const { CampaignProgress } = require('../content-system.js');
const GameContent = require('../game-content.js');

const levels = GameContent.createRegistry().levels;

test('the story unlocks in order and supports a continuous twenty-mission campaign', () => {
  const progress = new CampaignProgress(levels);
  assert.equal(progress.isUnlocked('groveGate'), true);
  assert.equal(progress.isUnlocked('whisperGrove'), false);
  assert.equal(progress.isUnlocked('missing'), false);
  assert.equal(progress.next('missing'), null);
  assert.equal(progress.markComplete('worldTree'), null);
  for (const [index, key] of levels.keys().entries()) {
    assert.equal(progress.nextUncompleted(), key);
    assert.equal(progress.isUnlocked(key), true);
    const completion = progress.markComplete(key, { lives: levels.get(key).startingLives, waves: levels.get(key).waves.length, score: 1000 + index });
    assert.equal(completion.firstClear, true);
    assert.equal(completion.stars, 3);
    assert.equal(completion.nextLevelKey, levels.keys()[index + 1] || null);
    assert.equal(progress.completedCount(), index + 1);
  }
  assert.equal(progress.next('worldTree'), null);
  assert.equal(progress.completedCount(), 20);
});

test('records keep the best medal, lives and score while replays remain available', () => {
  let saved = null, timestamp = 100;
  const progress = new CampaignProgress(levels, { write: value => { saved = value; }, now: () => timestamp++ });
  const first = progress.markComplete('groveGate', { score: 3000, lives: 12, waves: 3 });
  const replay = progress.markComplete('groveGate', { score: 100, lives: 1, waves: 3 });
  assert.equal(replay.firstClear, false);
  assert.equal(replay.score, 3000);
  assert.equal(replay.lives, 12);
  assert.equal(replay.stars, 3);
  assert.equal(replay.completedAt, first.completedAt);
  assert.ok(replay.updatedAt > first.updatedAt);
  const restored = new CampaignProgress(levels, { read: () => saved });
  assert.equal(restored.isUnlocked('groveGate'), true);
  assert.equal(restored.isUnlocked('whisperGrove'), true);
  assert.equal(restored.isUnlocked('rootCrossing'), false);
  assert.equal(restored.load().groveGate.score, 3000);
});

test('old records migrate and unavailable or malformed storage never blocks play', () => {
  const migrated = new CampaignProgress(levels, { read: () => JSON.stringify({ groveGate: { completedAt: 10 }, worldTree: { completedAt: 20 }, unknown: { completedAt: 5 } }) });
  assert.equal(migrated.completedCount(), 2);
  assert.equal(migrated.isUnlocked('worldTree'), true);
  assert.equal(migrated.isUnlocked('whisperGrove'), true);
  assert.equal(migrated.markComplete('groveGate', { lives: 6 }).stars, 2);
  const privateProgress = new CampaignProgress(levels, { read: () => { throw new Error('denied'); }, write: () => { throw new Error('quota'); } });
  privateProgress.markComplete('groveGate');
  assert.equal(privateProgress.isUnlocked('whisperGrove'), true);
  assert.equal(privateProgress.storageAvailable, false);
  for (const raw of ['null', '[]', 'false', '{bad', '{"groveGate":false}', '{"groveGate":{"completedAt":"wrong"}}']) {
    const progress = new CampaignProgress(levels, { read: () => raw });
    assert.equal(progress.completedCount(), 0);
    assert.equal(progress.isUnlocked('groveGate'), true);
  }
});
