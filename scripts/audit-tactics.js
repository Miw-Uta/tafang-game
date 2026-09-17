const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { runMission } = require('./simulate-campaign');

const inputFiles = ['content-system.js', 'game-content.js', 'campaign-system.js', 'story-content.js', 'story-system.js', 'tactics-system.js', 'boss-system.js', 'enemy-system.js', 'evolution-system.js', 'tower-system.js', 'synergy-system.js', 'game.js', 'campaign-ui.js', 'scripts/simulate-campaign.js'];
function sourceHash() {
  const hash = createHash('sha256');
  inputFiles.forEach(file => hash.update(file).update(fs.readFileSync(path.join(__dirname, '..', file))));
  return hash.digest('hex');
}
const report = {
  sourceHash: sourceHash(), sourceFiles: inputFiles, seed: 42, difficulty: 'normal', support: 'seeds', noSurge: true,
  methodology: 'Real combat engine at 50ms ticks. Identical mixed army/growth/evolution heuristic and seed. Commands use finite shared energy and legal targeting. Adaptive chooses live enemy clusters and actively firing towers; wasteful chooses the entry road and least useful tower. No surge isolates command value. This compares deterministic policies, not human skill or win rates.',
  results: []
};
for (const level of ['frostGate', 'worldTree']) for (const tactics of ['none', 'adaptive', 'wasteful']) {
  const result = runMission(level, { seed: report.seed, difficulty: report.difficulty, support: report.support, noSurge: report.noSurge, tactics });
  report.results.push(result);
  console.log(`${level.padEnd(12)} ${tactics.padEnd(9)} ${result.result.padEnd(4)} loss=${result.lossTaken} time=${result.elapsed}s casts=${JSON.stringify(result.decisions.tactics)}`);
}
report.sourceHashAfter = sourceHash();
report.sourceChangedDuringAudit = report.sourceHash !== report.sourceHashAfter;
const output = path.join(__dirname, '..', 'artifacts', 'tactics-audit.json');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(`Report: ${output}`);
