(function exposeCampaignDomain(root, factory) {
  const domain = factory();
  if (typeof module === 'object' && module.exports) module.exports = domain;
  root.CampaignDomain = domain;
})(typeof globalThis !== 'undefined' ? globalThis : window, function createCampaignDomain() {
  const number = value => Number.isFinite(value) ? Math.max(0, value) : 0;

  class CampaignRun {
    constructor(level) {
      this.level = level;
      this.lastObservedLives = number(level.startingLives);
      this.stats = {
        livesLost: 0, maxCombo: 0, maxLineages: 0, maxSynergies: 0,
        maxEvolvedLevel: 0, mapCleared: 0, controls: 0, recalls: 0,
        redeployments: 0, focusedBossKills: 0, forgedBossKills: 0,
        bossKills: 0, fusions: 0, surgeKills: 0, merges: 0, wavesCleared: 0
      };
      this.focusedEnemies = new WeakSet();
      this.killedEnemies = new WeakSet();
      this.controlledEnemies = new WeakSet();
      this.finished = false;
    }
    observe({ lives, combo, towers = [], synergyCount = 0, mapCleared = 0 } = {}) {
      if (this.finished) return;
      const stats = this.stats;
      if (Number.isFinite(lives)) {
        const currentLives = number(lives);
        stats.livesLost += Math.max(0, this.lastObservedLives - currentLives);
        this.lastObservedLives = currentLives;
      }
      stats.maxCombo = Math.max(stats.maxCombo, number(combo));
      stats.maxSynergies = Math.max(stats.maxSynergies, number(synergyCount));
      stats.mapCleared = Math.max(stats.mapCleared, number(mapCleared));
      const lineages = new Set();
      towers.forEach(tower => {
        const lineage = tower.lineage || tower.evolutionPath || tower.evo;
        if (lineage && lineage !== 'base') lineages.add(lineage);
        if (tower.evo && tower.evo !== 'base') stats.maxEvolvedLevel = Math.max(stats.maxEvolvedLevel, number(tower.level));
        if (tower.fusion) stats.fusions = Math.max(stats.fusions, 1);
      });
      stats.maxLineages = Math.max(stats.maxLineages, lineages.size);
    }
    record(type, payload = {}) {
      if (this.finished) return;
      const stats = this.stats, enemy = payload.enemy;
      if (type === 'focus' && enemy && typeof enemy === 'object') this.focusedEnemies.add(enemy);
      if (type === 'control' && payload.applied !== false && enemy && typeof enemy === 'object' && !this.controlledEnemies.has(enemy)) {
        this.controlledEnemies.add(enemy);
        stats.controls++;
      }
      if (type === 'kill' && enemy && typeof enemy === 'object' && !this.killedEnemies.has(enemy)) {
        this.killedEnemies.add(enemy);
        if (enemy.type === 'boss') {
          stats.bossKills++;
          if (this.focusedEnemies.has(enemy)) stats.focusedBossKills++;
          if (['metal', 'fire', 'earth'].includes(payload.lineage)) stats.forgedBossKills++;
        }
        if (payload.surge) stats.surgeKills++;
      }
      if (type === 'recall') stats.recalls++;
      if (type === 'deploy' && payload.recalled && stats.redeployments < stats.recalls) stats.redeployments++;
      if (type === 'merge') stats.merges++;
      if (type === 'fusion') stats.fusions++;
      if (type === 'wave') stats.wavesCleared = Math.max(stats.wavesCleared, number(payload.number));
    }
    objectives() {
      return (this.level.objectives || []).filter(objective => objective && typeof objective === 'object').map(objective => {
        const value = number(this.stats[objective.metric]);
        const complete = objective.operator === 'max' ? value <= objective.target : value >= objective.target;
        return { ...objective, value, complete };
      });
    }
    finish({ won = false, score = 0 } = {}) {
      if (this.result) return this.result;
      const objectives = this.objectives();
      const stars = won ? 1 + Math.min(2, objectives.filter(objective => objective.complete).length) : 0;
      this.finished = true;
      this.result = {
        won, stars, score: number(score), objectives,
        stats: { ...this.stats },
        title: won ? (stars === 3 ? '完美守护' : stars === 2 ? '坚守成功' : '险境突围') : '防线失守',
        story: won ? this.level.epilogue || '' : this.level.retryStory || '防线还在等待你的归来。'
      };
      return this.result;
    }
  }

  function mergeRecord(previous = {}, result = {}, now = Date.now()) {
    if (!result.won) return { ...previous };
    return {
      ...previous,
      completedAt: previous.completedAt || now,
      lastPlayedAt: now,
      stars: Math.max(number(previous.stars), number(result.stars)),
      score: Math.max(number(previous.score), number(result.score)),
      attemptsWon: number(previous.attemptsWon) + 1
    };
  }

  return { CampaignRun, mergeRecord };
});
