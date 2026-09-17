(function exposeStoryDomain(root, factory) {
  const domain = factory();
  if (typeof module === 'object' && module.exports) module.exports = domain;
  root.StoryDomain = domain;
})(typeof globalThis !== 'undefined' ? globalThis : window, function createStoryDomain() {
  const multiplierKeys = ['damage', 'hp', 'range', 'spirit', 'controlDuration', 'surgePower'];
  const identifier = value => typeof value === 'string' && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(value);
  const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

  function copyEffects(effects = {}) {
    const copy = {};
    if (!isRecord(effects)) throw new TypeError('Story effects must be an object');
    for (const [key, value] of Object.entries(effects)) {
      if (key === 'routeWeights') {
        if (!Array.isArray(value) || value.length !== 2 || !value.every(weight => Number.isFinite(weight) && weight >= 0) || !value.some(weight => weight > 0)) {
          throw new TypeError('Story route weights must contain two nonnegative finite weights');
        }
        copy.routeWeights = [...value];
      } else if (multiplierKeys.includes(key) && Number.isFinite(value) && value > 0) {
        copy[key] = value;
      } else {
        throw new TypeError('Unknown or invalid story effect: ' + key);
      }
    }
    return copy;
  }

  function prepareDecision(decision) {
    if (decision == null) return null;
    if (!isRecord(decision) || !identifier(decision.id) || !Number.isInteger(decision.atWave) || decision.atWave < 1 || !Array.isArray(decision.choices) || decision.choices.length !== 2) {
      throw new TypeError('A story decision requires an id, a wave number, and two choices');
    }
    const keys = new Set();
    const choices = decision.choices.map(choice => {
      if (!isRecord(choice) || !identifier(choice.key) || keys.has(choice.key)) throw new TypeError('Story choice keys must be unique identifiers');
      keys.add(choice.key);
      const effects = copyEffects(choice.effects);
      if (effects.routeWeights) Object.freeze(effects.routeWeights);
      return Object.freeze({ ...choice, effects: Object.freeze(effects) });
    });
    return Object.freeze({ ...decision, choices: Object.freeze(choices) });
  }

  class MissionStory {
    constructor(decision) {
      this.decision = prepareDecision(decision);
      this.choiceKey = null;
    }
    pending(waveNumber) {
      return Boolean(this.decision && !this.choiceKey && Number.isInteger(waveNumber) && waveNumber >= this.decision.atWave);
    }
    choose(choiceKey, waveNumber) {
      if (!this.pending(waveNumber)) return null;
      const choice = this.decision.choices.find(candidate => candidate.key === choiceKey);
      if (!choice) return null;
      this.choiceKey = choice.key;
      return choice;
    }
    effects() {
      const choice = this.selected();
      return choice ? copyEffects(choice.effects) : {};
    }
    snapshot() {
      return this.choiceKey ? { [this.decision.id]: this.choiceKey } : {};
    }
    restore(snapshot) {
      if (!this.decision || !isRecord(snapshot) || !Object.hasOwn(snapshot, this.decision.id)) return false;
      const choice = this.decision.choices.find(candidate => candidate.key === snapshot[this.decision.id]);
      if (!choice) return false;
      this.choiceKey = choice.key;
      return true;
    }
    selected() {
      return this.decision ? this.decision.choices.find(choice => choice.key === this.choiceKey) || null : null;
    }
  }

  return { MissionStory };
});
