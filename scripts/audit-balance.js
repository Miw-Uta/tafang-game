#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { parseArgs } = require('node:util');
const { runMission } = require('./simulate-campaign');

const { values } = parseArgs({ options: {
  levels:{type:'string',default:'groveGate,mirrorMarsh,frostGate,worldTree'},
  strategies:{type:'string',default:'mixed,fire,water,metal,wood,earth'},
  seed:{type:'string',default:'42'}, output:{type:'string',default:'artifacts/balance-audit.json'}
} });
const root=path.resolve(__dirname,'..');
const inputs=['game.js','game-content.js','enemy-system.js','tower-system.js','evolution-system.js','synergy-system.js','story-content.js','story-system.js','campaign-ui.js','content-system.js','campaign-system.js','scripts/simulate-campaign.js'];
const hash=crypto.createHash('sha256');
inputs.forEach(file=>hash.update(file).update(fs.readFileSync(path.join(root,file))));
const report={sourceHash:hash.digest('hex'), seed:Number(values.seed), difficulty:'normal', support:'seeds', choice:'first',
  methodology:'Real engine, legal rewards/evolutions/deployment, balanced growth, surge enabled, 50ms ticks. Single-lineage strategies retain authored starting guards. Fixed heuristic, not a human win-rate estimate.', results:[]};
for(const level of values.levels.split(',')) for(const strategy of values.strategies.split(',')) {
  const result=runMission(level,{strategy,seed:report.seed});
  report.results.push(result);
  console.log(`${level.padEnd(18)} ${strategy.padEnd(6)} ${result.result.padEnd(4)} lost=${String(result.lossTaken).padStart(2)} stars=${result.stars} time=${result.elapsed}s`);
}
const output=path.resolve(root,values.output);
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(`Report: ${output}`);
