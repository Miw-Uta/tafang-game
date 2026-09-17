// Reproducible normal/veteran difficulty controls. Losses are evidence about
// these legal policies, not proof that a mission is mathematically unwinnable.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { runMission } = require('./simulate-campaign');
const root = path.resolve(__dirname, '..');
const sourceFiles = ['content-system.js', 'game-content.js', 'campaign-system.js', 'story-content.js', 'story-system.js', 'tactics-system.js', 'boss-system.js', 'enemy-system.js', 'evolution-system.js', 'tower-system.js', 'synergy-system.js', 'game.js', 'campaign-ui.js', 'scripts/simulate-campaign.js'];
function sourceHash() {
  const hash = createHash('sha256');
  sourceFiles.forEach(file => hash.update(file).update(fs.readFileSync(path.join(root, file))));
  return hash.digest('hex');
}
const report = {
  sourceHash: sourceHash(), sourceFiles,
  methodology: 'Real game engine at 50ms ticks, legal growth/evolutions/rewards/relocation. Baseline mixed/balanced/seeds/first-choice, surge enabled. No active boss dodges. Adaptive commands target live clusters and firing towers but do not reserve E for boss interrupts. Base policy skips automatic merging while retaining authored evolved starting units and forced evolutions. Deterministic policy results are not human win rates; a loss does not prove an impossible mission.',
  results: []
};
const cases = [];
for (const level of ['groveGate', 'frostGate', 'blackTide', 'worldTree']) {
  for (const difficulty of ['normal', 'veteran']) {
    for (const tactics of ['none', 'adaptive']) cases.push({ level, seed: 42, difficulty, tactics });
  }
}
for (const level of ['frostGate', 'blackTide', 'worldTree']) {
  for (const strategy of ['fire', 'water', 'base']) cases.push({ level, strategy, seed: 42, difficulty: 'veteran', tactics: 'adaptive' });
}
for (const seed of [1234, 20260907]) {
  for (const difficulty of ['normal', 'veteran']) cases.push({ level: 'worldTree', seed, difficulty, tactics: 'adaptive' });
}
cases.push({ level: 'worldTree', seed: 42, difficulty: 'veteran', tactics: 'adaptive', noSurge: true });
for (const { level, ...options } of cases) {
  const result = runMission(level, options);
  report.results.push(result);
  console.log(`${level.padEnd(12)} ${result.difficulty.padEnd(7)} ${result.strategy.padEnd(5)} ${result.tactics.padEnd(8)} seed=${result.seed} surge=${!result.noSurge} ${result.result.padEnd(4)} loss=${result.lossTaken} time=${result.elapsed}s waves=${result.completedWaves}/${result.waves}`);
}
report.sourceHashAfter = sourceHash();
report.sourceChangedDuringAudit = report.sourceHash !== report.sourceHashAfter;
const output = path.join(root, 'artifacts/difficulty-audit.json');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(`Report: ${output}`);
