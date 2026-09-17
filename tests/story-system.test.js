const assert = require('node:assert/strict');
const { test } = require('node:test');
const { MissionStory } = require('../story-system.js');
const { decisions } = require('../story-content.js');
const { levels } = require('../game-content.js');

test('every mission has an independently authored, two-sided tactical dilemma', () => {
  assert.deepEqual(Object.keys(decisions), Object.keys(levels));
  const ids = new Set(), outcomes = new Set();
  for (const [index, [levelKey, decision]] of Object.entries(decisions).entries()) {
    assert.equal(decision.atWave, index < 6 ? 2 : 3);
    assert.ok(decision.atWave < levels[levelKey].waves.length || decision.atWave === 2);
    assert.equal(decision.choices.length, 2);
    assert.ok(decision.body.length > 35);
    assert.ok(decision.title && decision.speaker);
    assert.ok(!ids.has(decision.id), 'decision ids must survive checkpoint serialization without collisions');
    ids.add(decision.id);
    const run = new MissionStory(decision);
    assert.ok(run.pending(decision.atWave));
    assert.notDeepEqual(decision.choices[0].effects, decision.choices[1].effects);
    for (const choice of decision.choices) {
      assert.ok(choice.label && choice.description && choice.outcome.length > 35);
      assert.ok(!outcomes.has(choice.outcome));
      outcomes.add(choice.outcome);
      const multipliers = Object.entries(choice.effects).filter(([key]) => key !== 'routeWeights');
      assert.ok(multipliers.every(([, value]) => value >= .8 && value <= 1.2), 'story choices keep combat modifiers bounded');
      assert.ok(multipliers.some(([key, value]) => key === 'hp' ? value < 1 : value > 1), 'every option needs a tactical benefit');
      assert.ok(multipliers.some(([key, value]) => key === 'hp' ? value > 1 : value < 1), 'every option needs a tactical cost');
    }
  }
  assert.equal(outcomes.size, 40);
  assert.ok(Object.values(decisions).filter(decision => decision.choices.some(choice => choice.effects.routeWeights)).length >= 7);
});

test('a decision cannot apply before its wave, twice, or through an unknown key', () => {
  const run = new MissionStory(decisions.groveGate);
  assert.equal(run.pending(1), false);
  assert.equal(run.choose('north', 1), null);
  assert.equal(run.choose('missing', 2), null);
  assert.equal(run.choose('north', Infinity), null);
  assert.equal(run.choose('north', '2'), null);
  assert.equal(run.choose('north', 2.5), null);
  assert.deepEqual(run.effects(), {});
  assert.deepEqual(run.snapshot(), {});
  assert.equal(run.selected(), null);
  const chosen = run.choose('north', 2);
  assert.equal(chosen.key, 'north');
  assert.equal(run.selected(), chosen);
  assert.equal(run.pending(3), false);
  assert.equal(run.choose('both', 3), null);
  assert.deepEqual(run.effects(), decisions.groveGate.choices[0].effects);
  assert.deepEqual(run.snapshot(), { gate_signal: 'north' });
});

test('an unchosen decision remains pending after its trigger instead of disappearing', () => {
  const run = new MissionStory(decisions.frostGate);
  assert.equal(run.pending(2), false);
  assert.equal(run.pending(3), true);
  assert.equal(run.pending(4), true);
  assert.equal(run.choose('release', 4).key, 'release');
});

test('checkpoint restore validates the mission, key and own property', () => {
  const original = new MissionStory(decisions.rootCrossing);
  original.choose('south', 2);
  const restored = new MissionStory(decisions.rootCrossing);
  assert.equal(restored.restore(JSON.parse(JSON.stringify(original.snapshot()))), true);
  assert.deepEqual(restored.effects(), original.effects());
  assert.equal(restored.pending(2), false);
  assert.equal(restored.choose('north', 2), null);
  for (const malformed of [null, undefined, 'south', [], { ferry_roots: 'missing' }, { gate_signal: 'south' }, Object.create({ ferry_roots: 'north' })]) {
    assert.equal(restored.restore(malformed), false);
    assert.equal(restored.selected().key, 'south', 'invalid data must not silently erase a valid decision');
  }
});

test('effect and snapshot copies cannot mutate the selected outcome', () => {
  const input = JSON.parse(JSON.stringify(decisions.groveGate));
  const run = new MissionStory(input);
  input.choices[0].effects.damage = 10;
  input.choices[0].effects.routeWeights[0] = 0;
  run.choose('north', 2);
  const effects = run.effects();
  effects.damage = 100;
  effects.routeWeights[0] = 100;
  const snapshot = run.snapshot();
  snapshot.gate_signal = 'both';
  assert.deepEqual(run.effects(), { routeWeights: [3, 1], range: 1.08, damage: .92 });
  assert.equal(run.selected().key, 'north');
});

test('missing content is inert and invalid effects are rejected before play', () => {
  const run = new MissionStory();
  assert.equal(run.pending(99), false);
  assert.equal(run.choose('anything', 99), null);
  assert.equal(run.restore({ unknown: 'choice' }), false);
  assert.equal(run.selected(), null);
  assert.deepEqual(run.snapshot(), {});
  assert.deepEqual(run.effects(), {});
  for (const effects of [{ gift: 30 }, { hp: NaN }, { damage: 0 }, { spirit: -20 }, { routeWeights: [0, 0] }, { routeWeights: [1] }, { routeWeights: [1, Infinity] }]) {
    const decision = JSON.parse(JSON.stringify(decisions.groveGate));
    decision.choices[0].effects = effects;
    assert.throws(() => new MissionStory(decision), TypeError);
  }
});
