#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseArgs } = require('node:util');

const root = path.resolve(__dirname, '..');
const allLevels = Object.entries(require('../game-content.js').levels);

function createSandbox(seed) {
  let randomState = seed >>> 0;
  const seededMath = Object.create(Math);
  seededMath.random = () => {
    randomState = (randomState + 0x6d2b79f5) >>> 0;
    let value = randomState;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
  const elements = new Map(), documentEvents = new Map();
  const classList = () => {
    const classes = new Set();
    return { add: key => classes.add(key), remove: key => classes.delete(key), contains: key => classes.has(key),
      toggle(key, force) { if (force ?? !classes.has(key)) classes.add(key); else classes.delete(key); } };
  };
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      id, textContent: '', innerHTML: '', disabled: false, hidden: id === 'storyModal',
      style: {}, dataset: {}, classList: classList(), listeners: {},
      addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); },
      setAttribute() {}, setPointerCapture() {}, releasePointerCapture() {},
      querySelectorAll() { return []; }, querySelector() { return null; },
      append() {}, before() {}, after() {}, focus() {}, insertAdjacentHTML() {},
      getBoundingClientRect() { return { left: 0, top: 0, width: 960, height: 540 }; }
    });
    return elements.get(id);
  }
  const canvas = element('game');
  canvas.getContext = () => new Proxy({}, { get: () => () => {}, set: () => true });
  const growthButtons = ['balanced','sprout','refine'].map(key => {
    const button = element(`growth-${key}`);
    button.dataset.mapGrowth = key;
    button.querySelector = selector => selector === 'small' ? { outerHTML:`<small>${key}</small>` } : null;
    return button;
  });
  const document = {
    body: { dataset: {}, classList: classList() }, activeElement: null,
    getElementById: element, querySelector: selector => element(selector),
    querySelectorAll: selector => selector === '[data-map-growth]' ? growthButtons : [],
    createElement: tag => element(`created-${tag}-${elements.size}`),
    addEventListener(type, listener) { if (!documentEvents.has(type)) documentEvents.set(type, []); documentEvents.get(type).push(listener); }
  };
  // A pre-existing completed save unlocks each mission for isolated balance checks.
  // Combat resources and all wave transitions still come exclusively from game code.
  const storage = new Map([
    ['tafang.campaignProgress', JSON.stringify(Object.fromEntries(allLevels.map(([key]) => [key, { stars: 1, completedAt: 1, score: 0 }])) )],
    ['tafang.settings', JSON.stringify({ sound: false, reducedMotion: false })]
  ]);
  const sandbox = {
    console, document, window: { matchMedia: () => ({ matches: false }), addEventListener() {} },
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    performance: { now: () => 0 }, requestAnimationFrame() {}, setTimeout() {}, clearTimeout() {},
    Math: seededMath, Map, Set, WeakSet, Object, Array, URLSearchParams, location: { search: '' },
    clickData(data) {
      const node = { dataset: data, closest() { return this; } };
      for (const listener of documentEvents.get('click') || []) listener({ target: node });
    },
    pointer(type, col, row) {
      for (const listener of canvas.listeners[type] || []) listener({ clientX: col * 60 + 30, clientY: row * 60 + 30, pointerId: 1, preventDefault() {} });
    }
  };
  vm.createContext(sandbox);
  const files = ['content-system.js','game-content.js','campaign-system.js','story-content.js','story-system.js','tactics-system.js','boss-system.js','enemy-system.js','evolution-system.js',
    'node_modules/@tweenjs/tween.js/dist/tween.umd.js','tower-system.js','synergy-system.js','game.js','campaign-ui.js'];
  for (const file of files) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file });
  return sandbox;
}

function playMission(levelKey, maxSeconds, rerollsPerWave, support, choiceSide, options = {}) {
  const strategy = options.strategy || 'mixed', growth = options.growth || 'balanced';
  const difficulty = options.difficulty || 'normal', noSurge = options.noSurge || false, tactics = options.tactics || 'none', priority = options.priority || 'front';
  const decisions = { deploy: 0, evolves: 0, merge: 0, reroll: 0, surge: 0, moves: 0, tactics: { bramble:0, rally:0, flare:0 } };
  const checkpoints = [], evolutionChoices = [];
  const coverage = new Map();
  let preparationWave = 0;
  window.CampaignUI.openMission(levelKey);
  clickData({ support });
  clickData({ difficulty });
  clickData({ action: 'deploy' });
  document.querySelectorAll('[data-map-growth]').find(button => button.dataset.mapGrowth === growth).onclick();

  function resolveEvolution() {
    if (!pendingEvolution) return false;
    const available = [...$('evoChoices').innerHTML.matchAll(/data-route="([^"]+)"/g)].map(match => match[1]);
    const existing = new Set(towers.filter(t => t !== pendingEvolution).map(t => towerBranch(t)));
    const preference = ['water','fire','wood','metal','earth','thunder','wind','yin','yang'];
    const ranked = available.sort((a, b) => {
      const value = key => {
        const data = evolution[key], lineage = branchOf[key] || key;
        const variety = existing.has(lineage) ? 0 : 50;
        const preferred = strategy !== 'mixed' && lineage === strategy ? 1000 : 0;
        return preferred + variety + (9 - preference.indexOf(lineage)) * 3 + data.damage / data.rate * .08;
      };
      return value(b) - value(a);
    });
    if (!ranked.length) throw new Error(`No offered evolution in ${levelKey}`);
    evolutionChoices.push({ wave, offered:[...available], chosen:ranked[0], lineage:branchOf[ranked[0]] || ranked[0] });
    chooseEvolution(ranked[0]); decisions.evolves++;
    return true;
  }
  function bestCell(tower, moving = false) {
    const definition = evolution[tower.evo || 'base'];
    const candidates = currentBattlefield().buildSlots.filter(([col,row]) => isBuildSlot(col,row) && !occupied(col,row,moving ? tower : null));
    const weights = routeWeightsForWave();
    return candidates.map(([col,row]) => {
      const key = `${wave}:${definition.key || tower.evo}:${col}:${row}`;
      let value = coverage.get(key);
      if (value === undefined) {
        const proposed = towerFactory.create({ col, row, evo:tower.evo || 'base', level:tower.level });
        const radius = currentAttackRadius(definition, proposed), p = center(proposed);
        value = currentPaths().reduce((sum,route,index) => {
          if (!weights[index]) return sum;
          let length = 0;
          for (let distance=0; distance<currentPathLength(index); distance+=24) {
            const sample = pointAt(distance,route);
            if (Math.hypot(sample.x-p.x,sample.y-p.y) < radius) length += 24 * (1 + distance/currentPathLength(index)*.15);
          }
          return sum + length * weights[index];
        }, 0);
        value *= slotEffectAt(col,row)?.damage || 1;
        value *= slotEffectAt(col,row)?.cooldown ? 1/slotEffectAt(col,row).cooldown : 1;
        coverage.set(key,value);
      }
      // A modest distribution bias spreads damage across the overlapping bends.
      const crowding = towers.filter(t => t !== tower && Math.hypot(t.col-col,t.row-row) < 1.5).length;
      return { col,row,value:value/(1+crowding*.08) };
    }).sort((a,b) => b.value-a.value)[0];
  }
  function deployAvailable() {
    if (pendingEvolution || towers.length >= DEPLOY_LIMIT) return false;
    if (standbyReserve.length) {
      const next = standbyReserve[0], cell = bestCell(next);
      if (!cell) return false;
      beginDeployStandby(0); deployReserve(cell.col,cell.row); decisions.deploy++;
      return true;
    }
    const level = Object.keys(reserve).map(Number).filter(level => reserve[level]>0).sort((a,b)=>b-a)[0];
    if (!level) return false;
    const cell = bestCell({ evo:'base',level });
    if (!cell) return false;
    beginDeploy(level); deployReserve(cell.col,cell.row); decisions.deploy++;
    return true;
  }
  function prepare() {
    if (preparationWave !== wave) {
      preparationWave = wave;
      if (wave > 1) {
        clickData({ reward: lives <= gameSession.level.startingLives-2 ? 'repair' : 'reinforce' });
        if(missionStory?.pending(wave))clickData({decision:missionStory.decision.choices[choiceSide==='second'?1:0].key});
      }
    }
    let rerolls = 0;
    for (let safety=0;safety<100;safety++) {
      if (resolveEvolution()) continue;
      const cultivatable = (strategy === 'base' ? towers.filter(t=>t.level<4) : towers).filter(t=>t.level<MAX_LEVEL && !hasUnresolvedEvolution(t));
      const offerIndex = germinationOffers.findIndex(offer=>!offer.claimed && (offer.kind==='seed' || cultivatable.length));
      if (offerIndex>=0) {
        selectedTower = cultivatable.filter(t=>t.evo==='base').sort((a,b)=>b.level-a.level)[0] || cultivatable[0] || null;
        if (claimGermination(offerIndex)) continue;
      }
      // The base control keeps its ordinary guards instead of initiating
      // automatic merges that force evolution. Content-forced offers stay legal.
      if (strategy !== 'base' && mergeOpportunityCount()>0) { autoMerge(); decisions.merge++; continue; }
      if (deployAvailable()) continue;
      if (rerolls<rerollsPerWave && coins>=20 && germinationOffers.length) {
        refreshGermination(); rerolls++; decisions.reroll++; continue;
      }
      break;
    }
    for (const tower of [...towers].sort((a,b)=>b.level-a.level)) {
      const cell = bestCell(tower,true);
      if (cell && (cell.col!==tower.col || cell.row!==tower.row)) {
        pointer('pointerdown',tower.col,tower.row);
        pointer('pointermove',cell.col,cell.row);
        pointer('pointerup',cell.col,cell.row);
        if (tower.col===cell.col && tower.row===cell.row) decisions.moves++;
      }
    }
    checkpoints.push({ wave, lives, spirit:coins, reserve:{...reserve}, towers:towers.map(t=>`${t.evo}:${t.level}`) });
    if (pendingEvolution) resolveEvolution();
    if (priority !== 'front') {
      const previousSelection = selectedTower;
      towers.forEach(tower => { selectedTower = tower; clickData({ priority }); });
      selectedTower = previousSelection;
    }
    startWave();
  }
  function commandTactics() {
    if (tactics === 'none' || !battleTactics || !running || paused) return;
    const living=enemies.filter(enemy=>!enemy.dead&&enemy.hp>0);
    if(!living.length)return;
    const coverage=(point,radius)=>living.filter(enemy=>Math.hypot(enemy.x-point.x,enemy.y-point.y)<radius);
    // All strategies see the same live battlefield and spend the same budget.
    // "wasteful" deliberately casts off the current front to measure placement.
    const allowed=tactics==='adaptive'?['flare','rally','bramble']:tactics==='wasteful'?['bramble','flare','rally']:[tactics];
    for(const key of allowed){
      const definition=TacticsDomain.ABILITIES[key];
      if(!definition||battleTactics.energy<definition.cost||battleTactics.cooldowns[key]>0)continue;
      let point, value=0;
      if(key==='rally'){
        const candidates=towers.map(center).map(candidate=>({point:candidate,value:towers.filter(tower=>Math.hypot(center(tower).x-candidate.x,center(tower).y-candidate.y)<definition.radius).reduce((sum,tower)=>sum+(living.some(enemy=>Math.hypot(enemy.x-center(tower).x,enemy.y-center(tower).y)<currentAttackRadius(evolution[tower.evo],tower))?tower.level:0),0)})).sort((a,b)=>b.value-a.value);
        point=(tactics==='wasteful'?candidates.at(-1):candidates[0])?.point;value=candidates[0]?.value||0;
      }else{
        const candidates=living.map(enemy=>({point:{x:enemy.x,y:enemy.y},value:coverage(enemy,definition.radius).reduce((sum,target)=>sum+(key==='flare'?(target.shield>0?3:1):target.slow>0?.2:1)+(target.routeProgress||0),0)})).sort((a,b)=>b.value-a.value);
        point=tactics==='wasteful'?pointAt(100):candidates[0]?.point;value=candidates[0]?.value||0;
      }
      if(!point || (tactics==='adaptive'&&value<(key==='rally'?8:key==='flare'?5:3)))continue;
      if(tactics==='adaptive'&&key==='flare'&&!coverage(point,definition.radius).some(enemy=>enemy.shield>0))continue;
      if(castTactic(key,point).ok){decisions.tactics[key]++;return;}
    }
  }
  let elapsed = 0, ticks = 0;
  while (!gameWon && lives>0 && elapsed<maxSeconds) {
    if (pendingEvolution) { resolveEvolution(); continue; }
    if (!running) prepare();
    if (paused) throw new Error(`Unexpected modal pause: ${levelKey}, wave ${wave}`);
    if (!noSurge && ticks%10===0 && surgeCharge>=100 && (enemies.length>=5 || enemies.some(enemy=>enemy.type==='boss'))) {
      unleashSurge(); decisions.surge++;
    }
    if(ticks%10===0)commandTactics();
    update(.05);
    elapsed += .05; ticks++;
  }
  return {
    level:levelKey, result:gameWon?'WIN':lives<=0?'LOSS':'TIMEOUT', lives,
    completedWaves:gameSession.completedWaves, waves:gameSession.level.waves.length,
    elapsed:Number(elapsed.toFixed(1)), stars:campaignRun.result?.stars || 0,
    lossTaken:campaignRun.stats.livesLost,
    firstWaveArmy:checkpoints[0]?.towers.join(','),
    finalArmy:towers.map(t=>({ evo:t.evo, level:t.level, lineage:towerBranch(t), col:t.col, row:t.row })),
    selectedLineages:[...new Set(evolutionChoices.map(item=>item.lineage))], evolutionChoices,
    strategy, growth, difficulty, noSurge, tactics, priority, decisions, checkpoints,
    bossEncounters: bossEncounters ? { ...bossEncounters.events } : null
  };
}

function normalizeOptions(options = {}) {
  const normalized = { seed:20260907, seconds:1200, rerolls:0, support:'seeds', choice:'first', strategy:'mixed', growth:'balanced', difficulty:'normal', noSurge:false, tactics:'none', priority:'front', ...options };
  const allowed = {
    support:['seeds','power','charge'], choice:['first','second'],
    strategy:['mixed','fire','water','metal','wood','earth','base'],
    growth:['balanced','sprout','refine'], difficulty:['story','normal','veteran'], tactics:['none','adaptive','wasteful','bramble','rally','flare'], priority:['front','back','strong','weak','counter']
  };
  for (const [key, choices] of Object.entries(allowed)) {
    if (!choices.includes(normalized[key])) throw new Error(`${key} must be ${choices.join(', ')}`);
  }
  for (const key of ['seed','seconds','rerolls']) {
    normalized[key] = Number(normalized[key]);
    if (!Number.isFinite(normalized[key]) || normalized[key]<0 || (key!=='seconds' && !Number.isInteger(normalized[key]))) throw new Error(`${key} must be a nonnegative ${key==='seconds'?'number':'integer'}`);
  }
  return normalized;
}

function runMission(levelKey, options = {}) {
  if (!allLevels.some(([key])=>key===levelKey)) throw new Error(`Unknown campaign level: ${levelKey}`);
  const settings = normalizeOptions(options), seed = settings.seed;
  const sandbox = createSandbox(seed);
  sandbox.simulationArgs = [levelKey, settings.seconds, settings.rerolls, settings.support, settings.choice, settings];
  const result = vm.runInContext(`(${playMission.toString()})(...simulationArgs)`, sandbox, { timeout: 180000 });
  return { seed, support:settings.support, choice:settings.choice, ...result };
}

function main() {
  const { values } = parseArgs({ options: {
    level:{type:'string'}, seed:{type:'string',default:'20260907'}, seconds:{type:'string',default:'1200'},
    json:{type:'boolean',default:false}, rerolls:{type:'string',default:'0'}, support:{type:'string',default:'seeds'},
    choice:{type:'string',default:'first'}, strategy:{type:'string',default:'mixed'}, growth:{type:'string',default:'balanced'},
    difficulty:{type:'string',default:'normal'}, 'no-surge':{type:'boolean',default:false}, tactics:{type:'string',default:'none'}, priority:{type:'string',default:'front'}
  } });
  const settings = normalizeOptions({ ...values, noSurge:values['no-surge'] });
  const chosen = values.level ? allLevels.filter(([key])=>values.level.split(',').includes(key)) : allLevels;
  if (!chosen.length) throw new Error('No matching campaign levels');
  const results = chosen.map(([key]) => {
    const result = runMission(key, { ...settings, seed:settings.seed+allLevels.findIndex(([levelKey])=>levelKey===key) });
    if (!values.json) console.log(`${key.padEnd(18)} ${result.result.padEnd(7)} lives=${String(result.lives).padStart(2)} loss=${result.lossTaken} waves=${result.completedWaves}/${result.waves} time=${result.elapsed}s stars=${result.stars} final=${result.finalArmy.map(t=>`${t.evo}:${t.level}`).join(',')} chosen=${result.selectedLineages.join(',') || 'none'}`);
    return result;
  });
  if (values.json) console.log(JSON.stringify({ rules:'Real engine, legal UI rewards and growth selection, offered evolutions, 50ms ticks; unlocked-save fixture only. Base skips automatic merges and accepts forced evolution offers.', ...settings, results },null,2));
  else console.log(`Passed ${results.filter(result=>result.result==='WIN').length}/${results.length}; seed=${settings.seed}; strategy=${settings.strategy}; growth=${settings.growth}; difficulty=${settings.difficulty}; support=${settings.support}; choice=${settings.choice}; surge=${!settings.noSurge}; rerolls per wave<=${settings.rerolls}. This heuristic audit does not prove human difficulty or three-star attainability.`);
  process.exitCode = results.some(result=>result.result!=='WIN') ? 1 : 0;
}

module.exports = { createSandbox, playMission, runMission };
if (require.main === module) main();
