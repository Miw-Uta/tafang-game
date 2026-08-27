const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);
const setText = (id, value) => { const node = $(id); if (node) node.textContent = value; };
const W = 960, H = 540, CELL = 60, COLS = 16, ROWS = 9, MAX_LEVEL = 20;
const DEPLOY_LIMIT = 8;
const growthModes = {
  sprout: { name: '繁育', threshold: 100, absorb: 1.35, desc: '灵力吸收 +35%，固定产出 Lv.1', sequence: [1] },
  balanced: { name: '均衡', threshold: 100, absorb: 1, desc: '标准吸收，依次产出 Lv.1、Lv.2、Lv.1、Lv.3', sequence: [1,2,1,3] },
  refine: { name: '精炼', threshold: 100, absorb: .72, desc: '吸收较慢，依次产出 Lv.2、Lv.2、Lv.3', sequence: [2,2,3] }
};
const runtime = {
  maxHits: 420,
  reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false,
  soundEnabled: true
};
const audioBus = {
  context: null,
  ensure() {
    if (!runtime.soundEnabled) return null;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!this.context) this.context = new AudioContextClass();
    if (this.context.state === 'suspended') this.context.resume();
    return this.context;
  },
  play(frequency, duration = .06, type = 'sine', gain = .025) {
    const audioContext = this.ensure();
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const volume = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    volume.gain.setValueAtTime(gain, audioContext.currentTime);
    volume.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
    oscillator.connect(volume).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  },
  merge() { this.play(420, .09, 'triangle', .035); },
  evolve() { this.play(680, .18, 'sine', .045); },
  hit() { this.play(180, .035, 'square', .012); }
};
const path = [[-30, 90], [150, 90], [150, 270], [390, 270], [390, 150], [690, 150], [690, 390], [990, 390]];
const pathLength = path.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - path[i][0], p[1] - path[i][1]), 0);
const evolution = {
  base: { name: '橡果守卫', icon: '🌰', color: '#8a633c', damage: 16, rangeCells: 3, rate: .72, attackMode: 'single', desc: '基础单体攻击，稳定可靠' },
  metal: { name: '金锋守卫', icon: '⚔️', color: '#c99b36', damage: 48, rangeCells: 3, rate: .78, attackMode: 'single', effect: 'stun', desc: '近距离单体重击，概率眩晕', ultimate: '天罡金刃' },
  wood: { name: '青木守卫', icon: '🌿', color: '#4f9d50', damage: 22, rangeCells: 5, rate: .55, attackMode: 'pierce', effect: 'weaken', desc: '藤蔓穿刺，贯穿并削弱护甲', ultimate: '万象神木' },
  water: { name: '玄水守卫', icon: '💧', color: '#399dc4', damage: 16, rangeCells: 5, rate: .38, attackMode: 'chain', effect: 'slow', desc: '链式水弹，连续减速多个敌人', ultimate: '沧澜水灵' },
  fire: { name: '赤焰守卫', icon: '🔥', color: '#d95832', damage: 28, rangeCells: 3, rate: .62, attackMode: 'splash', effect: 'burn', desc: '范围爆炸，附加持续灼烧', ultimate: '焚天炎皇' },
  earth: { name: '厚土守卫', icon: '🪨', color: '#9c754d', damage: 58, rangeCells: 3, rate: 1.05, attackMode: 'single', effect: 'stun', desc: '极慢重击，伤害最高并短暂击退', ultimate: '镇岳地灵' },
  yin: { name: '幽阴守卫', icon: '🌑', color: '#625b9d', damage: 42, rangeCells: 5, rate: .58, attackMode: 'chain', effect: 'silence', desc: '稀有：暗影弹射，降低敌人速度', ultimate: '太阴冥主', rare: true },
  yang: { name: '耀阳守卫', icon: '☀️', color: '#edaf31', damage: 54, rangeCells: 5, rate: .68, attackMode: 'splash', effect: 'burn', desc: '稀有：炽阳爆发，灼烧范围敌人', ultimate: '大日神辉', rare: true },
  wind: { name: '御风守卫', icon: '🌪️', color: '#62aeb0', damage: 25, rangeCells: 5, rate: .3, attackMode: 'pierce', effect: 'slow', desc: '稀有：疾风穿透，极快并减速', ultimate: '九霄风君', rare: true },
  thunder: { name: '惊雷守卫', icon: '⚡', color: '#8466cf', damage: 48, rangeCells: 5, rate: .5, attackMode: 'chain', effect: 'stun', desc: '稀有：雷霆连锁，概率麻痹', ultimate: '紫霄雷帝', rare: true },
  fiveSpirit: { name: '五灵塔', icon: '🌀', color: '#f2a83b', damage: 165, rangeCells: 7, rate: .4, attackMode: 'omni', effect: 'fiveElements', desc: '五行共鸣，全域多目标并施加灼烧、减速、破甲与眩晕', ultimate: '五灵归一', fusion: true },
  taiji: { name: '太极塔', icon: '☯️', color: '#252832', damage: 230, rangeCells: 7, rate: .34, attackMode: 'omni', effect: 'taiji', desc: '阴阳归一，全域打击并使敌人受到的后续伤害提高', ultimate: '太极无极', fusion: true },
  emberwood: { name: '焚木共鸣塔', icon: '🌋', color: '#c85d32', damage: 128, rangeCells: 5, rate: .46, attackMode: 'splash', effect: 'burn', desc: '火木共鸣，范围灼烧并削弱敌人', ultimate: '焚木天灾', fusion: true, hidden: true },
  froststorm: { name: '霜雷塔', icon: '🌩️', color: '#5f9dd0', damage: 142, rangeCells: 6, rate: .34, attackMode: 'chain', effect: 'freeze', desc: '水风雷共振，链式冻结敌人', ultimate: '霜雷寂灭', fusion: true, hidden: true },
  voidstar: { name: '虚空星塔', icon: '✦', color: '#7352a8', damage: 205, rangeCells: 7, rate: .48, attackMode: 'omni', effect: 'poison', desc: '阴阳交错，全域施加虚空毒蚀', ultimate: '星陨虚界', fusion: true, hidden: true },
  ironwood: { name: '玄铁神木塔', icon: '🪵', color: '#607d45', damage: 176, rangeCells: 5, rate: .62, attackMode: 'pierce', effect: 'weaken', desc: '金土木三相叠合，穿透并破甲', ultimate: '万古森罗', fusion: true, hidden: true }
};
const routes = ['metal','wood','water','fire','earth','yin','yang','wind','thunder'];
const fiveKeys = ['metal','wood','water','fire','earth'];
const branchNames = {
  metal: ['庚金剑魄','白虎裂空','天罡战甲','玄铁镇杀号','万刃归宗','鎏金雷铳','兵主杀阵'],
  wood: ['青帝长生','建木通天','荆棘王庭','万藤缚界','森罗灵鹿','碧海神木','苍穹古树'],
  water: ['沧海龙吟','玄冥寒潮','弱水三千','镜花水月','鲛人泪痕','深渊潮汐','冰魄灵泉'],
  fire: ['虚无吞炎','太阳真火','幽冥鬼火','生灵之炎','古灵冷火','九龙雷罡火','幽冥毒火'],
  earth: ['山河社稷','不周神岳','黄泉厚土','玄武镇界','大地脉冲','陨星坠落','息壤神壤'],
  yin: ['太阴蚀月','幽都冥火','黄泉渡魂','夜幕咒印','影界潜行','玄阴魔瞳','寂灭轮回'],
  yang: ['大日金乌','圣阳裁决','天光普照','赤曜神轮','煌炎圣剑','焚界天辉','九阳神体'],
  wind: ['鲲鹏扶摇','裂空风刃','青岚结界','飓风之眼','流云逐月','天翔羽衣','风暴主宰'],
  thunder: ['紫霄神雷','九天应元','雷罚天狱','惊蛰龙吟','雷光遁影','万钧霹雳','天劫审判']
};
const branchIcons = {
  metal: ['🗡️','🐯','🛡️','⛓️','🔪','🔫','⚔️'], wood: ['🍃','🌳','🌵','🪴','🦌','🎋','🌲'],
  water: ['🐉','❄️','🌊','🪞','🫧','🌀','🧊'], fire: ['🕳️','🌞','👻','🌱','❄️','🐲','☠️'],
  earth: ['🏞️','⛰️','🟤','🐢','💥','☄️','🏔️'], yin: ['🌘','🏮','👁️','🌌','🥷','🔮','♾️'],
  yang: ['🐦','✨','🔆','🟠','🗡️','🌅','💫'], wind: ['🦅','🗡️','🍃','🌪️','☁️','🪽','🌀'],
  thunder: ['💜','🔱','⚡','🐲','✨','🌩️','⚖️']
};
const branchProfiles = [
  { attackMode: 'single', effect: 'weaken', damage: 1.75, range: 0, rate: 1.05 },
  { attackMode: 'splash', effect: 'burn', damage: 1.4, range: 0, rate: 1.12 },
  { attackMode: 'chain', effect: 'silence', damage: 1.2, range: 2, rate: .9 },
  { attackMode: 'pierce', effect: 'slow', damage: 1.3, range: 2, rate: .78 },
  { attackMode: 'single', effect: 'freeze', damage: 1.55, range: 2, rate: 1.2 },
  { attackMode: 'chain', effect: 'stun', damage: 1.35, range: 0, rate: .84 },
  { attackMode: 'splash', effect: 'poison', damage: 1.25, range: 2, rate: .72 }
];
const branchKeys = Object.fromEntries(routes.map(parent => [parent, branchNames[parent].map((name, index) => {
  const key = `${parent}Branch${index + 1}`;
  const profile = branchProfiles[index];
  evolution[key] = {
    ...evolution[parent], ...profile, name, icon: branchIcons[parent][index],
    damage: Math.round(evolution[parent].damage * profile.damage),
    rangeCells: Math.max(3, evolution[parent].rangeCells + profile.range),
    rate: Math.max(.22, Number((evolution[parent].rate * profile.rate).toFixed(2))),
    desc: `${evolution[parent].name}的${name}分支`, ultimate: name, parent
  };
  return key;
})]));
const branchOf = Object.fromEntries(Object.keys(evolution).map(key => [key, evolution[key].parent || key]));
const routeWeights = Object.fromEntries(routes.map(key => [key, evolution[key].rare ? 1 : 7]));
const attackModeNames = { single: '单体重击', pierce: '直线穿透', chain: '连锁攻击', splash: '范围溅射', omni: '全域攻击' };
const effectNames = { stun: '概率眩晕', weaken: '削弱护甲', slow: '持续减速', burn: '持续灼烧', silence: '压制减速', freeze: '冻结控制', poison: '持续中毒', fiveElements: '五行复合效果', taiji: '易伤与减速' };
const hiddenFusions = [
  { result: 'emberwood', minLevel: 5, clue: '两团烈焰夹护新木，三者构成尖顶。', pattern: [{ parent: 'fire', dx: -1, dy: 0 }, { parent: 'wood', dx: 1, dy: 0 }, { parent: 'fire', dx: 0, dy: -1 }] },
  { result: 'froststorm', minLevel: 5, clue: '流水、长风与惊雷在同一条线上相遇。', pattern: [{ parent: 'water', dx: -1, dy: 0 }, { parent: 'wind', dx: 0, dy: 0 }, { parent: 'thunder', dx: 1, dy: 0 }] },
  { result: 'voidstar', minLevel: 8, clue: '两阴两阳占据空心方阵的四角。', pattern: [{ parent: 'yin', dx: -1, dy: -1 }, { parent: 'yang', dx: 1, dy: -1 }, { parent: 'yang', dx: -1, dy: 1 }, { parent: 'yin', dx: 1, dy: 1 }] },
  { result: 'ironwood', minLevel: 5, clue: '金在上、木居中、土承下，三塔垂直相连。', pattern: [{ parent: 'metal', dx: 0, dy: -1 }, { parent: 'wood', dx: 0, dy: 0 }, { parent: 'earth', dx: 0, dy: 1 }] }
];
const waveEvents = [
  { key: 'calm', name: '林地微风', icon: '🍃', desc: '平稳波次', enemySpeed: 1, enemyHp: 1, reward: 1, range: 1, spirit: 1 },
  { key: 'bounty', name: '丰饶时刻', icon: '✨', desc: '灵力收益提高 50%', enemySpeed: 1.05, enemyHp: 1.08, reward: 1.5, range: 1, spirit: 1 },
  { key: 'mist', name: '迷雾侵袭', icon: '🌫️', desc: '塔射程降低 15%', enemySpeed: .94, enemyHp: 1.12, reward: 1.2, range: .85, spirit: 1 },
  { key: 'rush', name: '兽潮奔袭', icon: '💨', desc: '敌人更快但更脆弱', enemySpeed: 1.18, enemyHp: .88, reward: 1.25, range: 1, spirit: 1 },
  { key: 'resonance', name: '根系共鸣', icon: '🌳', desc: '世界树吸收效率提高 60%', enemySpeed: 1, enemyHp: 1.16, reward: 1.1, range: 1, spirit: 1.6 }
];
const battlefields = [
  { key: 'grove', name: '翠影林地', icon: '🌲', unlock: 1, desc: '普通守卫伤害 +12%', bonus: ['base'], damage: 1.12, range: 1, enemySpeed: 1, reward: 1, palette: { grass: '#add69c', roadEdge: '#c3ad75', road: '#efdda9', accent: '#4f8b4e', shrub: '#76b66b', mote: '#e9f5b5' } },
  { key: 'wetland', name: '镜水湿地', icon: '💧', unlock: 2, desc: '水、风路线伤害 +20%', bonus: ['water','wind'], damage: 1.2, range: 1.05, enemySpeed: .96, reward: 1, palette: { grass: '#8fc9b5', roadEdge: '#8fae9b', road: '#cce1c8', accent: '#318aa0', shrub: '#58a58d', mote: '#bdeff1' } },
  { key: 'ember', name: '赤霞山径', icon: '🔥', unlock: 4, desc: '火、金路线伤害 +18% · 奖励 +10%', bonus: ['fire','metal'], damage: 1.18, range: .96, enemySpeed: 1.04, reward: 1.1, palette: { grass: '#c9aa78', roadEdge: '#9b704c', road: '#dfbd83', accent: '#ce5831', shrub: '#8e8852', mote: '#ffbf62' } },
  { key: 'frost', name: '霜月高地', icon: '❄️', unlock: 6, desc: '木、土路线射程 +15% · 奖励 +15%', bonus: ['wood','earth'], damage: 1.08, range: 1.15, enemySpeed: 1.08, reward: 1.15, palette: { grass: '#aebfc0', roadEdge: '#90a3a2', road: '#d9dddd', accent: '#5c8fa5', shrub: '#789a8f', mote: '#f1ffff' } }
];
const enemyTypes = {
  normal: { label: '普通', icon: '●', hp: 1, speed: 1, reward: 1, radius: 14, traitCount: 1, lifeCost: 1 },
  elite: { label: '精英', icon: '◆', hp: 2.4, speed: .85, reward: 2, radius: 21, traitCount: 2, lifeCost: 1 },
  boss: { label: 'Boss', icon: '👑', hp: 7, speed: .62, reward: 8, radius: 29, traitCount: 3, lifeCost: 3 }
};
const enemyTraits = {
  armored: { label: '重甲', icon: '盾', color: '#697784', apply: e => { e.armor += .22; } },
  swift: { label: '迅捷', icon: '速', color: '#e98a32', apply: e => { e.speed *= 1.28; } },
  resistant: { label: '抗性', icon: '抗', color: '#398fc1', apply: e => { e.slowResist += .45; } },
  regenerating: { label: '再生', icon: '愈', color: '#4c9b64', apply: e => { e.regen += e.max * .012; } },
  fortified: { label: '强韧', icon: '韧', color: '#956d48', apply: e => { e.max *= 1.5; e.hp = e.max; } },
  enraged: { label: '狂暴', icon: '怒', color: '#d34a43', apply: e => { e.enraged = true; } }
};
const enemyTraitKeys = Object.keys(enemyTraits);

let towers, enemies, hits, coins, lives, score, wave, kills, spawned;
let running, gameWon, finalWave, spawnTimer, drag, selectedTower, selectedEnemy, pendingEvolution, pendingEvolutionStage, evolutionWasPaused, nextWaveTimer, started, paused, speed, last, fiveAttemptSignature, discoveredEvolutions, currentWaveEvent, combo, comboTimer, summonsBought, surgeCharge, screenFlash, lastSummon, battlefieldIndex, reserve, pendingDeployLevel, deployHover, growthMode, growthCycles;

function resetGame() {
  towers = [{ col: 1, row: 6, level: 1, evo: 'base', evoTier: 0, cool: 0 }];
  enemies = []; hits = [];
  coins = 0; lives = 12; score = 0; wave = 1; kills = 0; spawned = 0;
  running = false; gameWon = false; finalWave = false; spawnTimer = 0; drag = null; selectedTower = towers[0]; selectedEnemy = null; pendingEvolution = null; pendingEvolutionStage = null; evolutionWasPaused = false; nextWaveTimer = 0; started = false; paused = false; speed = 1; fiveAttemptSignature = null; discoveredEvolutions = new Set(); currentWaveEvent = waveEvents[0]; combo = 0; comboTimer = 0; summonsBought = 0; surgeCharge = 0; screenFlash = 0; lastSummon = []; battlefieldIndex = 0; reserve = {}; pendingDeployLevel = null; deployHover = null; growthMode = 'balanced'; growthCycles = { sprout: 0, balanced: 0, refine: 0 };
}

function center(item) { return { x: item.col * CELL + CELL / 2, y: item.row * CELL + CELL / 2 }; }
function attackRadius(towerData) { return towerData.rangeCells * CELL / 2; }
function currentBattlefield() { return battlefields[battlefieldIndex] || battlefields[0]; }
function currentAttackRadius(towerData) { return attackRadius(towerData) * (currentWaveEvent?.range || 1) * currentBattlefield().range; }
function segmentDistance(x, y, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy));
}
function isRoad(col, row) {
  const x = col * CELL + CELL / 2, y = row * CELL + CELL / 2;
  return path.slice(1).some((p, i) => segmentDistance(x, y, path[i], p) < CELL * .56);
}
function occupied(col, row, except = null) { return towers.some(t => t !== except && t.col === col && t.row === row); }
function freeCellCount() {
  let count = 0;
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) if (!isRoad(col, row) && !occupied(col, row)) count++;
  return count;
}
function waveSize() { return 8 + wave * 3; }
function waveTrait() { return wave <= 2 ? null : enemyTraitKeys[(wave - 3) % enemyTraitKeys.length]; }
function updateSelectionInfo() {
  if (selectedEnemy) {
    const type = enemyTypes[selectedEnemy.type];
    const traits = selectedEnemy.traits.length ? selectedEnemy.traits.map(key => `<span style="color:${enemyTraits[key].color}">● ${enemyTraits[key].label}</span>`).join(' · ') : '<span style="color:#748079">无属性</span>';
    const status = selectedEnemy.dead || selectedEnemy.hp <= 0 ? ' · 已击败' : '';
    const resistEntries = Object.entries(selectedEnemy.resist || {}), highResists = resistEntries.filter(([, value]) => value > .18);
    const resistText = resistEntries.every(([, value]) => value === 0) ? '属性抗性：无' : highResists.map(([key, value]) => `${evolution[key]?.name?.replace('守卫','') || key} ${Math.round(value * 100)}%`).join(' · ') || '属性抗性：低';
    $('selectedInfo').innerHTML = `<span class="info-icon">${type.icon}</span><div><b>${type.label}${status} · ${traits}</b><small>生命 ${Math.max(0,Math.ceil(selectedEnemy.hp))}/${Math.ceil(selectedEnemy.max)} · 速度 ${selectedEnemy.speed.toFixed(0)} · 护甲 ${Math.round(selectedEnemy.armor*100)}% · 减速抗性 ${Math.round(selectedEnemy.slowResist*100)}% · 再生 ${selectedEnemy.regen.toFixed(1)}/秒 · ${resistText}</small></div>`;
  } else if (selectedTower) {
    const z = evolution[selectedTower.evo];
    $('selectedInfo').innerHTML = `<span class="info-icon">${z.icon}</span><div><b>${z.name} · Lv.${selectedTower.level}</b><small>${z.desc || '基础单体攻击'} · 伤害 ${z.damage * selectedTower.level} · 射程 ${z.rangeCells}×${z.rangeCells} 格 · ${attackModeNames[z.attackMode] || '特殊攻击'} · ${effectNames[z.effect] || '无附加效果'}</small></div>`;
  } else {
    $('selectedInfo').innerHTML = '<span class="info-icon">🌰</span><div><b>拖动橡果塔改变位置</b><small>点击敌人可查看属性 · Lv.5 选择主路线，Lv.10 选择专属分支</small></div>';
  }
}
function ui() {
  $('coins').textContent = coins; $('lives').textContent = lives; $('score').textContent = score; $('wave').textContent = wave;
  $('progressText').textContent = `${kills} / ${waveSize()}`;
  $('progressBar').style.width = `${Math.min(100, kills / waveSize() * 100)}%`;
  $('surgeCharge').textContent = Math.floor(surgeCharge);
  $('surgeFill').style.width = `${surgeCharge}%`;
  $('surgeBtn').disabled = surgeCharge < 100 || !enemies.some(enemy => !enemy.dead) || paused;
  $('surgeBtn').classList.toggle('ready', surgeCharge >= 100);
  $('comboBadge').textContent = combo > 1 ? `连击 ×${combo}` : '连击 ×0';
  $('comboBadge').classList.toggle('active', combo > 1);
  const remaining = Math.max(0, waveSize() - kills);
  $('threatBadge').textContent = running ? `${remaining} 个目标` : (started ? '整备阶段' : '林地安宁');
  const field = currentBattlefield();
  setText('fieldName', field.name);
  setText('fieldIcon', field.icon);
  setText('fieldEffect', field.desc);
  if ($('fieldBtn')) $('fieldBtn').disabled = running || battlefields.filter(item => item.unlock <= wave).length < 2;
  updateRoster();
  updateSelectionInfo();
  updateWorkshop();
  updateEvolutionSummary();
}
function updateRoster() {
  const groups = new Map();
  towers.forEach(tower => {
    const group = groups.get(tower.evo) || { evo: tower.evo, count: 0, min: tower.level, max: tower.level };
    group.count++; group.min = Math.min(group.min, tower.level); group.max = Math.max(group.max, tower.level); groups.set(tower.evo, group);
  });
  const list = $('towerList');
  list.innerHTML = [...groups.values()].sort((a,b) => b.max - a.max).map(group => {
    const data = evolution[group.evo], active = selectedTower?.evo === group.evo ? ' active' : '';
    const levels = group.min === group.max ? `Lv.${group.max}` : `Lv.${group.min}-${group.max}`;
    return `<button class="tower-card${active}" data-roster-evo="${group.evo}"><div class="tower-art" style="background:${data.color}33">${data.icon}</div><div><b>${data.name}</b><small>${attackModeNames[data.attackMode] || '特殊攻击'} · ${group.count} 座</small></div><span class="price">${levels}</span></button>`;
  }).join('');
  list.querySelectorAll('[data-roster-evo]').forEach(button => button.onclick = () => {
    selectedTower = towers.filter(tower => tower.evo === button.dataset.rosterEvo).sort((a,b) => b.level - a.level)[0];
    selectedEnemy = null; ui();
  });
}
function updateWorkshop() {
  const workshop = $('summonWorkshop');
  if (!workshop) return;
  const physicalFree = freeCellCount(), capacity = Math.max(0, DEPLOY_LIMIT - towers.length), mode = growthModes[growthMode];
  const baseTowers = towers.filter(tower => tower.evo === 'base').length;
  const evolvedTowers = towers.length - baseTowers;
  $('workshopCoins').textContent = coins;
  $('workshopCost').textContent = mode.threshold;
  $('workshopSlots').textContent = Math.min(physicalFree, capacity);
  $('baseTowerCount').textContent = baseTowers;
  $('evolvedTowerCount').textContent = evolvedTowers;
  setText('luckText', `${coins} / ${mode.threshold}`);
  if ($('luckFill')) $('luckFill').style.width = `${Math.min(100, coins / mode.threshold * 100)}%`;
  if ($('summonResult')) $('summonResult').innerHTML = lastSummon.length
    ? `<span>${lastSummon.map(level => `<b class="summon-level level-${level}">Lv.${level}</b>`).join('')}</span><small>最近凝结 · ${growthModes[growthMode].name}根系 · 固定产出序列</small>`
    : '<span>根系正在吸收灵力</span><small>无需购买，进度满后自动凝结并整编</small>';
  const reserveEntries = Object.entries(reserve).filter(([, count]) => count > 0).sort((a,b) => Number(b[0]) - Number(a[0]));
  const reserveCount = reserveEntries.reduce((sum,[,count]) => sum + count, 0);
  setText('reserveSummary', reserveCount ? `${reserveCount} 枚灵种 · 点击等级后在地图部署` : '召唤结果会在此自动合成');
  if ($('reserveList')) {
    $('reserveList').innerHTML = reserveEntries.length ? reserveEntries.map(([level,count]) => `<button class="reserve-seed${pendingDeployLevel===Number(level)?' active':''}" data-deploy-level="${level}"><span>🌰</span><b>Lv.${level}</b><small>×${count}</small></button>`).join('') : '<span class="reserve-empty">暂无库存</span>';
    $('reserveList').querySelectorAll('[data-deploy-level]').forEach(button => button.onclick = () => beginDeploy(Number(button.dataset.deployLevel)));
  }
  document.querySelectorAll('[data-growth-mode]').forEach(button => { button.classList.toggle('active', button.dataset.growthMode === growthMode); button.onclick = () => { growthMode = button.dataset.growthMode; processGrowth(); $('message').textContent = `世界树转为${growthModes[growthMode].name}根系：${growthModes[growthMode].desc}。`; ui(); }; });
  $('recallBtn').disabled = !selectedTower || selectedTower.evo !== 'base' || Boolean(pendingEvolution);
  $('summonPriceHint').textContent = `${mode.name}根系：${mode.desc}`;
}
function updateEvolutionSummary() {
  const summary = $('evolutionSummary');
  if (!summary) return;
  const nodes = [...discoveredEvolutions].map(key => evolution[key]).filter(Boolean);
  const undiscovered = hiddenFusions.filter(recipe => !discoveredEvolutions.has(recipe.result));
  const clue = undiscovered.length ? undiscovered[wave % undiscovered.length].clue : '所有古老阵式均已被发现。';
  summary.innerHTML = `<b>进化发现 ${nodes.length} · 隐藏塔 ${hiddenFusions.length - undiscovered.length}/${hiddenFusions.length}</b><small>${nodes.length ? nodes.map(node => `${node.icon} ${node.name}`).join(' · ') : 'Lv.5 选择主路线，Lv.10 解锁分支'}</small><em>古碑残句：${clue}</em>`;
}
function pointAt(distance) {
  let left = distance;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (left <= length) return { x: a[0] + (b[0] - a[0]) * left / length, y: a[1] + (b[1] - a[1]) * left / length };
    left -= length;
  }
  return { x: path.at(-1)[0], y: path.at(-1)[1] };
}
function addEnemy() {
  const isBoss = wave >= 5 && wave % 5 === 0 && spawned === 0;
  const isElite = !isBoss && wave >= 2 && (spawned % 5 === 4 || Math.random() < Math.min(.28, wave * .018));
  const typeKey = isBoss ? 'boss' : isElite ? 'elite' : 'normal';
  const type = enemyTypes[typeKey];
  const hp = (38 + wave * 20 + spawned * 2.5) * type.hp * (currentWaveEvent?.enemyHp || 1);
  const neutral = waveTrait() === null;
  const resist = Object.fromEntries(['metal','wood','water','fire','earth','yin','yang','wind','thunder'].map(key => [key, neutral ? 0 : .08 + Math.random() * .14]));
  const eventSpeed = (currentWaveEvent?.enemySpeed || 1) * currentBattlefield().enemySpeed;
  const enemy = { dist: 0, x: -30, y: 90, hp, max: hp, baseSpeed: (35 + wave * 4.5) * type.speed * eventSpeed, speed: (35 + wave * 4.5) * type.speed * eventSpeed, type: typeKey, kind: type.icon, slow: 0, armor: 0, slowResist: 0, regen: 0, radius: type.radius, traits: [], resist };
  const primaryTrait = waveTrait();
  const traitPool = enemyTraitKeys.filter(key => key !== primaryTrait);
  if (primaryTrait) { enemy.traits.push(primaryTrait); enemyTraits[primaryTrait].apply(enemy); }
  const traitCount = neutral ? 0 : type.traitCount;
  while (enemy.traits.length < traitCount) {
    const trait = traitPool.splice(Math.floor(Math.random() * traitPool.length), 1)[0];
    enemy.traits.push(trait); enemyTraits[trait].apply(enemy);
  }
  enemies.push(enemy);
}
function maintainEnemySpacing() {
  const ordered = enemies.filter(enemy => !enemy.dead).sort((a, b) => b.dist - a.dist);
  for (let i = 0; i < ordered.length - 1; i++) {
    const front = ordered[i], behind = ordered[i + 1];
    const minimumGap = front.radius + behind.radius + 12;
    if (front.dist - behind.dist < minimumGap) {
      behind.dist = Math.max(0, front.dist - minimumGap);
      Object.assign(behind, pointAt(behind.dist));
    }
  }
}
function rollSummonLevel() {
  const sequence = growthModes[growthMode].sequence, index = growthCycles[growthMode] % sequence.length;
  growthCycles[growthMode]++; return sequence[index];
}
function compactReserve() {
  let merged = 0;
  for (let level = 1; level < 4; level++) {
    while ((reserve[level] || 0) >= 2) { reserve[level] -= 2; reserve[level + 1] = (reserve[level + 1] || 0) + 1; merged++; }
    if (!reserve[level]) delete reserve[level];
  }
  return merged;
}
function beginDeploy(level) {
  if (!(reserve[level] > 0)) return;
  pendingDeployLevel = pendingDeployLevel === level ? null : level; deployHover = null; selectedTower = null; selectedEnemy = null;
  $('message').textContent = pendingDeployLevel ? `部署 Lv.${level} 灵种：点击地图上的绿色空格。` : '已取消灵种部署。'; ui();
}
function deployReserve(col, row) {
  if (!pendingDeployLevel || !(reserve[pendingDeployLevel] > 0)) return false;
  if (towers.length >= DEPLOY_LIMIT) { $('message').textContent = `指挥容量已满（${DEPLOY_LIMIT}/${DEPLOY_LIMIT}），请先收回一座普通塔。`; return true; }
  if (isRoad(col,row) || occupied(col,row)) { $('message').textContent = '这里无法部署，请选择绿色空格。'; return true; }
  const tower = { col, row, level: pendingDeployLevel, evo: 'base', evoTier: 0, cool: 0 };
  towers.push(tower); reserve[pendingDeployLevel]--; if (!reserve[pendingDeployLevel]) delete reserve[pendingDeployLevel];
  selectedTower = tower; selectedEnemy = null; audioBus.merge();
  const placedLevel = pendingDeployLevel; pendingDeployLevel = null; deployHover = null;
  $('message').textContent = `Lv.${placedLevel} 橡果守卫已部署。`; ui();
  return true;
}
function processGrowth() {
  const produced = [];
  while (coins >= growthModes[growthMode].threshold) {
    coins -= growthModes[growthMode].threshold;
    const level = rollSummonLevel(); reserve[level] = (reserve[level] || 0) + 1; produced.push(level); summonsBought++;
  }
  if (!produced.length) return false;
  const merged = compactReserve(); lastSummon = produced; audioBus.merge();
  if (produced.includes(3)) { audioBus.evolve(); screenFlash = .45; }
  if (hits.length < runtime.maxHits) hits.push({type:'text',x:W-95,y:65,life:1,color:'#fff3a6',label:`灵种 +${produced.length}${merged ? ` · 整编 ${merged}` : ''}`});
  return true;
}
function gainSpirit(amount) {
  const eventBoost = currentWaveEvent?.spirit || 1, modeBoost = growthModes[growthMode].absorb;
  coins += Math.max(0, Math.round(amount * eventBoost * modeBoost));
  processGrowth();
}
function recallSelectedTower() {
  if (!selectedTower || selectedTower.evo !== 'base' || pendingEvolution) { $('message').textContent = '只有未进化的普通塔可以收回灵种仓。'; return; }
  const tower = selectedTower; towers = towers.filter(item => item !== tower); reserve[tower.level] = (reserve[tower.level] || 0) + 1;
  const merged = compactReserve(); selectedTower = null; pendingDeployLevel = null;
  $('message').textContent = `Lv.${tower.level} 普通塔已收回${merged ? `，仓内自动整编 ${merged} 次` : ''}。`; ui();
}
function pickRoutes(count = 3) {
  const pool = [...routes], picks = [];
  while (picks.length < count && pool.length) {
    const total = pool.reduce((sum, key) => sum + routeWeights[key], 0);
    let roll = Math.random() * total;
    const index = pool.findIndex(key => (roll -= routeWeights[key]) <= 0);
    picks.push(pool.splice(index < 0 ? 0 : index, 1)[0]);
  }
  return picks;
}
function towerBranch(tower) { return tower.evo === 'base' ? (tower.evolutionPath || 'base') : branchOf[tower.evo]; }
function pickBranches(parent, count = 3) {
  const pool = [...(branchKeys[parent] || [])];
  const picks = [];
  while (picks.length < count && pool.length) picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return picks;
}
function burst(x, y, color) {
  const count = runtime.reducedMotion ? 3 : 7;
  for (let i = 0; i < count && hits.length < runtime.maxHits; i++) hits.push({ x, y, life: 1, color, vx: (Math.random() - .5) * 55, vy: (Math.random() - .5) * 55 });
}
function attackEffect(t, target, z) {
  const p = center(t), q = 'dist' in target ? target : center(target), angle = Math.atan2(q.y - p.y, q.x - p.x);
  const effectType = t.evo === 'fiveSpirit' ? 'five' : t.evo === 'taiji' ? 'taiji' : t.evo === 'earth' || z.attackMode === 'splash' ? 'impact' : z.attackMode === 'chain' ? 'chain' : z.attackMode === 'pierce' ? 'pierce' : 'slash';
  if (hits.length < runtime.maxHits) hits.push({ type: effectType, x: q.x, y: q.y, originX: p.x, originY: p.y, angle, radius: attackRadius(z) * .72, life: 1, color: z.color, evo: t.evo, glyph: z.icon });
  burst(q.x, q.y, z.color);
  if (t.evo === 'base') audioBus.hit();
}
function damageTarget(t, target, z) {
  const field = currentBattlefield(), branch = towerBranch(t);
  const fieldDamage = field.bonus.includes(branch) ? field.damage : 1;
  const rawDamage = z.damage * t.level * fieldDamage * (target.taiji > 0 ? 1.3 : 1);
  const resistance = target.resist?.[towerBranch(t)] || 0;
  target.hp -= rawDamage * (1 - Math.max(0, (target.armor || 0) - (target.weaken > 0 ? .15 : 0))) * (1 - resistance);
  if ('dist' in target) {
    if (z.effect === 'slow') target.slow = Math.max(target.slow || 0, 1.6 * (1 - (target.slowResist || 0)));
    if (z.effect === 'burn') { target.burn = Math.max(target.burn || 0, 3); target.burnSource = t; }
    if (z.effect === 'weaken') target.weaken = Math.max(target.weaken || 0, 3);
    if (z.effect === 'stun' && Math.random() < (t.evo==='earth'?.38:.22)) { target.stun = Math.max(target.stun || 0, t.evo==='earth'?.85:.6); if(t.evo==='earth'){target.dist=Math.max(0,target.dist-42);target.knockback=1;} }
    if (z.effect === 'silence') target.slow = Math.max(target.slow || 0, 1.1);
    if (z.effect === 'freeze') { target.slow = Math.max(target.slow || 0, 2.4); target.stun = Math.max(target.stun || 0, .35); }
    if (z.effect === 'poison') { target.poison = Math.max(target.poison || 0, 4); target.poisonSource = t; }
    if (z.effect === 'fiveElements') { target.slow=Math.max(target.slow||0,2);target.burn=Math.max(target.burn||0,4);target.burnSource=t;target.weaken=Math.max(target.weaken||0,5);if(Math.random()<.35)target.stun=Math.max(target.stun||0,.8); }
    if (z.effect === 'taiji') { target.taiji = Math.max(target.taiji || 0, 5); target.slow = Math.max(target.slow || 0, 1.8); }
  }
  if (branchOf[t.evo] === 'water' && 'dist' in target) target.slow = Math.max(target.slow || 0, 1.6 * (1 - (target.slowResist || 0)));
  if (target.hp > 0 || target.dead) return;
  target.dead = true;
  combo = comboTimer > 0 ? combo + 1 : 1; comboTimer = 2.2; const comboBonus = 1 + Math.min(.5, Math.floor(combo / 5) * .1); const rewardScale = (currentWaveEvent?.reward || 1) * currentBattlefield().reward; gainSpirit((10 + wave) * enemyTypes[target.type].reward * rewardScale); score += Math.round(100 * t.level * enemyTypes[target.type].reward * comboBonus); kills++; surgeCharge = Math.min(100, surgeCharge + (target.type === 'boss' ? 35 : target.type === 'elite' ? 18 : 9)); if(combo>1&&hits.length<runtime.maxHits)hits.push({type:'text',x:target.x,y:target.y-20,life:1,color:'#fff3a6',label:`${combo} 连击`});
}
function drawGrid() {
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
    if (isRoad(col, row)) continue;
    ctx.fillStyle = (col + row) % 2 ? 'rgba(238,255,225,.14)' : 'rgba(73,122,65,.08)';
    ctx.fillRect(col * CELL + 2, row * CELL + 2, CELL - 4, CELL - 4);
    ctx.strokeStyle = 'rgba(71,111,64,.18)'; ctx.lineWidth = 1;
    ctx.strokeRect(col * CELL + 2.5, row * CELL + 2.5, CELL - 5, CELL - 5);
  }
}
function roundedRect(x, y, width, height, radius) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') { ctx.roundRect(x, y, width, height, radius); return; }
  const r = Math.min(radius, width / 2, height / 2);
  ctx.moveTo(x + r, y); ctx.lineTo(x + width - r, y); ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r); ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height); ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
function drawScenery() {
  const field = currentBattlefield();
  const shrubs = [[28,28,12],[94,26,9],[225,36,11],[318,96,8],[506,38,13],[605,92,9],[782,44,12],[902,86,10],[38,476,13],[124,510,9],[272,468,12],[488,500,9],[602,458,13],[824,495,11],[925,468,9]];
  shrubs.forEach(([x,y,r], index) => {
    ctx.fillStyle = index % 3 === 0 ? field.palette.shrub : `${field.palette.shrub}cc`;
    ctx.beginPath(); ctx.arc(x-r*.6,y,r,0,Math.PI*2); ctx.arc(x+r*.45,y+2,r*.82,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = index % 4 === 0 ? '#ffd269' : field.palette.mote; ctx.beginPath(); ctx.arc(x+r*.2,y-r*.35,2.2,0,Math.PI*2); ctx.fill();
  });
  ctx.save(); ctx.fillStyle = '#355d3b'; ctx.beginPath(); ctx.arc(18,90,22,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#f4a13b'; ctx.font='25px serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('🍂',20,90); ctx.restore();
  ctx.save(); ctx.translate(930,390); ctx.fillStyle='#31533a'; roundedRect(-28,-34,56,68,12); ctx.fill(); ctx.strokeStyle='#f1b84b';ctx.lineWidth=4;ctx.stroke();ctx.fillStyle='#fff2bd';ctx.font='25px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('🍊',0,0);ctx.restore();
}
function drawPathDetails() {
  ctx.save(); ctx.strokeStyle='rgba(139,103,54,.18)';ctx.lineWidth=2;ctx.setLineDash([3,12]);ctx.beginPath();path.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.stroke();ctx.setLineDash([]);
  for (let distance=110; distance<pathLength-60; distance+=170) { const p=pointAt(distance),q=pointAt(distance+10),a=Math.atan2(q.y-p.y,q.x-p.x);ctx.translate(p.x,p.y);ctx.rotate(a);ctx.fillStyle='rgba(116,83,45,.25)';ctx.beginPath();ctx.moveTo(8,0);ctx.lineTo(-5,-5);ctx.lineTo(-5,5);ctx.closePath();ctx.fill();ctx.rotate(-a);ctx.translate(-p.x,-p.y); }
  ctx.restore();
}
function drawFusionHint() {
  if (!selectedTower || selectedTower.evo === 'base' || evolution[selectedTower.evo]?.fusion) return;
  const parent = towerBranch(selectedTower);
  const recipe = hiddenFusions.find(item => !discoveredEvolutions.has(item.result) && item.pattern.some(slot => slot.parent === parent));
  if (!recipe) return;
  const selectedSlot = recipe.pattern.find(slot => slot.parent === parent);
  const centerCol = selectedTower.col - selectedSlot.dx, centerRow = selectedTower.row - selectedSlot.dy;
  recipe.pattern.forEach(slot => {
    const col = centerCol + slot.dx, row = centerRow + slot.dy;
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS || isRoad(col,row)) return;
    const occupant = towers.find(t => t.col === col && t.row === row), p = center({col,row});
    const matched = occupant && towerBranch(occupant) === slot.parent && occupant.level >= recipe.minLevel;
    ctx.save(); ctx.setLineDash([5,4]); ctx.strokeStyle = matched ? '#d9f37a' : '#fff8b8'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.x,p.y,25,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(29,57,35,.72)'; ctx.beginPath(); ctx.arc(p.x,p.y,14,0,Math.PI*2); ctx.fill();
    ctx.font = '17px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(evolution[slot.parent].icon,p.x,p.y);
    ctx.restore();
  });
}
function draw() {
  const field = currentBattlefield();
  ctx.clearRect(0, 0, W, H); ctx.fillStyle = field.palette.grass; ctx.fillRect(0, 0, W, H); drawGrid(); drawScenery();
  ctx.lineCap = 'round'; ctx.lineWidth = 58; ctx.strokeStyle = field.palette.roadEdge; ctx.beginPath(); path.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.stroke();
  ctx.lineWidth = 48; ctx.strokeStyle = field.palette.road; ctx.beginPath(); path.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.stroke(); drawPathDetails();
  if (pendingDeployLevel) {
    ctx.save();
    for (let row=0;row<ROWS;row++) for(let col=0;col<COLS;col++) if(!isRoad(col,row)&&!occupied(col,row)){ctx.fillStyle='rgba(223,255,174,.2)';ctx.fillRect(col*CELL+4,row*CELL+4,CELL-8,CELL-8)}
    if(deployHover){const valid=!isRoad(deployHover.col,deployHover.row)&&!occupied(deployHover.col,deployHover.row),p=center(deployHover);ctx.fillStyle=valid?'rgba(226,255,145,.72)':'rgba(211,65,53,.5)';ctx.fillRect(deployHover.col*CELL+4,deployHover.row*CELL+4,CELL-8,CELL-8);ctx.font='26px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('🌰',p.x,p.y);ctx.fillStyle='#26382d';ctx.font='bold 10px Nunito';ctx.fillText(`Lv ${pendingDeployLevel}`,p.x,p.y+22)}
    ctx.restore();
  }
  drawFusionHint();
  if(selectedTower&&towers.includes(selectedTower)){const p=drag&&drag.tower===selectedTower?{x:drag.x,y:drag.y}:center(selectedTower),z=evolution[selectedTower.evo],r=currentAttackRadius(z);ctx.save();ctx.fillStyle=z.color+'22';ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();ctx.strokeStyle=z.color;ctx.lineWidth=3;ctx.stroke();ctx.restore()}
  if(drag){const col=Math.max(0,Math.min(COLS-1,Math.floor(drag.x/CELL))),row=Math.max(0,Math.min(ROWS-1,Math.floor(drag.y/CELL))),other=towers.find(t=>t!==drag.tower&&t.col===col&&t.row===row),valid=!isRoad(col,row)&&(!other||(other.level===drag.tower.level&&towerBranch(other)===towerBranch(drag.tower)));ctx.save();ctx.fillStyle=valid?'rgba(229,255,178,.55)':'rgba(205,66,52,.38)';ctx.strokeStyle=valid?'#f5ffb2':'#ff8a78';ctx.lineWidth=3;ctx.fillRect(col*CELL+4,row*CELL+4,CELL-8,CELL-8);ctx.strokeRect(col*CELL+5.5,row*CELL+5.5,CELL-11,CELL-11);ctx.restore()}
  towers.forEach(t => { const p=drag&&drag.tower===t?{x:drag.x,y:drag.y}:center(t), z=evolution[t.evo];ctx.save();if(drag&&drag.tower===t){ctx.shadowColor='rgba(35,60,40,.35)';ctx.shadowBlur=16;ctx.shadowOffsetY=8}ctx.fillStyle='rgba(49,89,44,.22)';ctx.beginPath();ctx.ellipse(p.x,p.y+13,27,12,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=z.color;ctx.beginPath();ctx.arc(p.x,p.y,t.evo==='base'?20:23,0,7);ctx.fill();if(t.evo!=='base'){ctx.strokeStyle='#fff9';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,18,0,7);ctx.stroke()}ctx.font=t.evo==='base'?'24px serif':'27px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(z.icon,p.x,p.y);ctx.fillStyle='#26382d';roundedRect(p.x-20,p.y+24,40,16,8);ctx.fill();ctx.fillStyle='#fff';ctx.font='bold 10px Nunito';ctx.fillText(`Lv ${t.level}`,p.x,p.y+32);ctx.restore(); });
  enemies.forEach(e=>{const type=enemyTypes[e.type],r=e.radius||15,primary=enemyTraits[e.traits[0]]||{color:'#748079'};ctx.save();ctx.fillStyle=primary.color;ctx.beginPath();ctx.arc(e.x,e.y,r,0,7);ctx.fill();if(e.burn>0){ctx.fillStyle=`rgba(255,92,28,${.25+.18*Math.sin(performance.now()/80)})`;ctx.beginPath();ctx.arc(e.x,e.y,r+2,0,7);ctx.fill()}if(e.poison>0){ctx.strokeStyle='#75b84a';ctx.lineWidth=4;ctx.beginPath();ctx.arc(e.x,e.y,r+6,0,Math.PI*2);ctx.stroke()}if(e.type!=='normal'){ctx.strokeStyle=e.type==='boss'?'#ffd05a':'#eadfff';ctx.lineWidth=3;ctx.stroke()}if(e.slow>0){ctx.strokeStyle='#77d5eb';ctx.lineWidth=3;ctx.beginPath();ctx.arc(e.x,e.y,r+4,0,7);ctx.stroke()}if(e.knockback>0){e.knockback-=.03;ctx.strokeStyle='#f1bf62';ctx.lineWidth=3;ctx.beginPath();ctx.arc(e.x,e.y,r+10,0,7);ctx.stroke()}if(e.stun>0){ctx.strokeStyle='#ffe76b';ctx.lineWidth=3;ctx.beginPath();ctx.arc(e.x,e.y-22,9,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#ffe76b';for(let i=0;i<4;i++){const a=performance.now()/220+i*Math.PI/2;ctx.fillRect(e.x+Math.cos(a)*14-2,e.y-22+Math.sin(a)*14-2,4,4)}}if(e===selectedEnemy){ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(e.x,e.y,r+8,0,7);ctx.stroke()}ctx.fillStyle='#fff';ctx.font=`bold ${e.type==='boss'?20:14}px Nunito`;ctx.textAlign='center';ctx.fillText(e.kind,e.x,e.y+1);ctx.fillRect(e.x-r,e.y-r-9,r*2,5);ctx.fillStyle=e.type==='boss'?'#e5a52b':e.type==='elite'?'#9a72db':primary.color;ctx.fillRect(e.x-r,e.y-r-9,r*2*Math.max(0,e.hp/e.max),5);ctx.fillStyle='#3b2d2a';ctx.font='bold 10px Nunito';const traitText=e.traits.length?e.traits.map(key=>enemyTraits[key].icon).join('·'):'无';ctx.fillText(`${type.label} ${traitText}`,e.x,e.y+r+13);const markerX=e.x-(e.traits.length*7-2)/2;e.traits.forEach((key,i)=>{ctx.fillStyle=enemyTraits[key].color;ctx.fillRect(markerX+i*7,e.y+r+17,5,5)});ctx.restore()});
  hits.forEach(p=>{ctx.save();ctx.globalAlpha=p.life;if(p.type==='text'){ctx.fillStyle=p.color;ctx.font='900 17px Nunito';ctx.textAlign='center';ctx.fillText(p.label,p.x,p.y-p.life*18)}else if(p.type==='surge'){ctx.strokeStyle='#ffbd45';ctx.lineWidth=18*p.life;ctx.beginPath();ctx.arc(W/2,H/2,(1-p.life)*650,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#fff4a8';ctx.lineWidth=5;ctx.stroke()}else if(p.type==='slash'){ctx.translate(p.originX,p.originY);ctx.rotate(p.angle);ctx.strokeStyle=p.color;ctx.lineWidth=10;ctx.lineCap='round';ctx.beginPath();ctx.arc(0,0,p.radius,-.7,.7);ctx.stroke()}else if(p.type==='impact'){ctx.strokeStyle=p.color;ctx.lineWidth=p.evo==='earth'?10:6;ctx.beginPath();ctx.arc(p.x,p.y,Math.max(8,p.radius*(1-p.life*.35)),0,Math.PI*2);ctx.stroke()}else if(p.type==='pierce'){ctx.strokeStyle=p.color;ctx.lineWidth=p.evo==='wind'?7:5;ctx.beginPath();ctx.moveTo(p.originX,p.originY);ctx.lineTo(p.x,p.y);ctx.stroke();ctx.lineWidth=2;ctx.strokeStyle='#fff';ctx.stroke()}else if(p.type==='chain'){ctx.strokeStyle=p.color;ctx.lineWidth=p.evo==='thunder'?6:4;ctx.beginPath();ctx.moveTo(p.originX,p.originY);ctx.lineTo((p.originX+p.x)/2+10,p.y-10);ctx.lineTo(p.x,p.y);ctx.stroke()}else if(p.type==='five'){['#c99b36','#4f9d50','#399dc4','#d95832','#9c754d'].forEach((color,i)=>{ctx.strokeStyle=color;ctx.lineWidth=4;ctx.beginPath();ctx.arc(p.x,p.y,22+i*10,0,Math.PI*2);ctx.stroke()})}else if(p.type==='taiji'){ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(p.x,p.y,55,0,Math.PI*2);ctx.fill();ctx.fillStyle='#222';ctx.beginPath();ctx.arc(p.x,p.y,55,Math.PI/2,Math.PI*1.5);ctx.fill();ctx.font='bold 40px serif';ctx.textAlign='center';ctx.fillText('☯',p.x,p.y+3)}else{ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,4,4)}if(p.glyph&&p.type!=='taiji'){const gx=p.type==='slash'||p.evo==='base'?p.originX:p.x, gy=p.type==='slash'||p.evo==='base'?p.originY-28:p.y-25;ctx.fillStyle=p.color;ctx.font='bold 25px serif';ctx.textAlign='center';ctx.fillText(p.glyph,gx,gy)}ctx.restore()});
  if(screenFlash>0){ctx.fillStyle=`rgba(255,226,116,${screenFlash*.38})`;ctx.fillRect(0,0,W,H)}
}
function unleashSurge() {
  if (surgeCharge < 100 || paused) return;
  const targets = enemies.filter(enemy => !enemy.dead);
  if (!targets.length) { $('message').textContent = '当前没有可打击的目标。'; return; }
  surgeCharge = 0; screenFlash = 1; hits.push({type:'surge',life:1}); audioBus.play(110,.5,'sawtooth',.05); audioBus.play(440,.7,'sine',.035);
  const source = selectedTower || towers[0];
  targets.forEach(enemy => { enemy.hp -= enemy.max * .28; enemy.stun = Math.max(enemy.stun || 0, 1.2); burst(enemy.x,enemy.y,'#ffbd45'); if(enemy.hp<=0) damageTarget(source,enemy,{...evolution[source.evo],damage:0}); });
  score += targets.length * 60; $('message').textContent = `橙光席卷战场，命中 ${targets.length} 个目标！`; ui();
}
function drawFallback() {
  const field = currentBattlefield();
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = field.palette.grass; ctx.fillRect(0, 0, W, H);
  ctx.lineCap = 'round'; ctx.lineWidth = 58; ctx.strokeStyle = field.palette.roadEdge; ctx.beginPath(); path.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.stroke();
  ctx.lineWidth = 46; ctx.strokeStyle = field.palette.road; ctx.beginPath(); path.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.stroke();
  towers.forEach(tower => { const p = center(tower), data = evolution[tower.evo]; ctx.fillStyle = data.color; ctx.beginPath(); ctx.arc(p.x,p.y,22,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#fff';ctx.font='22px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(data.icon,p.x,p.y); });
  enemies.forEach(enemy => { ctx.fillStyle='#5e6f66';ctx.beginPath();ctx.arc(enemy.x,enemy.y,enemy.radius||14,0,Math.PI*2);ctx.fill(); });
}
function completeWave() {
  running = false;
  if (finalWave) { gameWon = true; $('message').textContent = '最终进化守住了甜橙谷，你胜利了！'; $('waveBtn').textContent = '重新开始'; score += 5000; ui(); return; }
  const reward = Math.round((20 + wave * 4) * currentBattlefield().reward);
  gainSpirit(reward);
  wave++; nextWaveTimer = 2.5; $('message').textContent = `第 ${wave - 1} 波完成，世界树吸收 ${reward} 点基础灵力；${nextWaveTimer.toFixed(1)} 秒后进入第 ${wave} 波。`; ui();
}
function update(dt) {
  screenFlash = Math.max(0, screenFlash - dt * 2.8);
  comboTimer = Math.max(0, comboTimer - dt); if (!comboTimer) combo = 0;
  if (started && !running && !gameWon && lives > 0 && nextWaveTimer > 0) { nextWaveTimer -= dt; $('message').textContent = `第 ${wave} 波将在 ${Math.max(0, nextWaveTimer).toFixed(1)} 秒后开始。`; if (nextWaveTimer <= 0) startWave(); }
  if (running) {
    spawnTimer -= dt;
    if (spawned < waveSize() && spawnTimer <= 0) {
      addEnemy();
      spawned++;
      // Keep each unit at least one body length behind the unit ahead.
      spawnTimer = Math.max(.7, 1.05 - wave * .01);
    }
    if (spawned >= waveSize() && enemies.length === 0) completeWave();
  }
  enemies.forEach(e=>{if(e.slow>0)e.slow-=dt;if(e.stun>0)e.stun-=dt;if(e.taiji>0)e.taiji-=dt;if(e.burn>0){e.burn-=dt;e.hp-=8*dt;if(e.hp<=0&&!e.dead&&e.burnSource){damageTarget(e.burnSource,e,{...evolution[e.burnSource.evo],damage:0})}}if(e.poison>0){e.poison-=dt;e.hp-=5*dt;if(e.hp<=0&&!e.dead&&e.poisonSource){damageTarget(e.poisonSource,e,{...evolution[e.poisonSource.evo],damage:0})}}if(e.weaken>0)e.weaken-=dt;if(e.regen>0)e.hp=Math.min(e.max,e.hp+e.regen*dt);const rage=e.enraged&&e.hp/e.max<.5?1.45:1;e.dist+=e.stun>0?0:e.speed*rage*(e.slow>0?.4:1)*dt;Object.assign(e,pointAt(e.dist));if(e.dist>=pathLength){e.dead=true;lives-=enemyTypes[e.type].lifeCost;ui()}});
  maintainEnemySpacing();
  towers.forEach(t=>{const p=center(t),z=evolution[t.evo],range=currentAttackRadius(z);t.cool-=dt;if(t.cool<=0){let targets=enemies.filter(e=>!e.dead&&Math.hypot(e.x-p.x,e.y-p.y)<range).sort((a,b)=>b.dist-a.dist);if(targets.length){if(z.attackMode==='single')targets=[targets[0]];else if(z.attackMode==='chain')targets=targets.slice(0,3);else if(z.attackMode==='pierce')targets=targets.slice(0,5);else if(z.attackMode==='splash'){const hit=targets[0];targets=targets.filter(e=>Math.hypot(e.x-hit.x,e.y-hit.y)<72).slice(0,6)}else if(z.attackMode==='omni')targets=targets.slice(0,t.evo==='taiji'?16:12);t.cool=z.rate;targets.forEach(target=>damageTarget(t,target,z));if(z.attackMode==='chain'||z.attackMode==='pierce')targets.forEach(target=>attackEffect(t,target,z));else attackEffect(t,targets[0],z);ui()}}});
  enemies=enemies.filter(e=>!e.dead&&e.hp>0);hits.forEach(p=>{p.life-=dt*(p.type==='slash'?3.4:1);if(!p.type){p.x+=p.vx*dt;p.y+=p.vy*dt}});hits=hits.filter(p=>p.life>0);
  if(lives<=0&&running){running=false;started=false;$('message').textContent='森林失守了，再试一次吧！';$('waveBtn').disabled=false;$('waveBtn').textContent='重新开始'}
}
function loop(ts){const dt=Math.min(.05,(ts-last)/1000||0);last=ts;if(!paused)update(dt*speed);try{draw()}catch(error){console.error('地图绘制已切换至兼容模式',error);drawFallback()}requestAnimationFrame(loop)}
function pointerCell(e){const r=canvas.getBoundingClientRect();return{col:Math.max(0,Math.min(COLS-1,Math.floor((e.clientX-r.left)*W/r.width/CELL))),row:Math.max(0,Math.min(ROWS-1,Math.floor((e.clientY-r.top)*H/r.height/CELL)))}}
function pointerPosition(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height}}
canvas.addEventListener('pointerdown',e=>{const c=pointerCell(e),p=pointerPosition(e);if(pendingDeployLevel){deployReserve(c.col,c.row);return}const tower=towers.find(t=>t.col===c.col&&t.row===c.row);if(tower){selectedEnemy=null;selectedTower=tower;drag={tower,x:p.x,y:p.y,origin:{col:tower.col,row:tower.row}};canvas.setPointerCapture(e.pointerId);ui();return}const enemy=[...enemies].reverse().find(item=>Math.hypot(item.x-p.x,item.y-p.y)<=item.radius+7);if(enemy){selectedEnemy=enemy;selectedTower=null;ui()}});
canvas.addEventListener('pointermove',e=>{if(pendingDeployLevel){deployHover=pointerCell(e);return}if(!drag)return;const r=canvas.getBoundingClientRect();drag.x=(e.clientX-r.left)*W/r.width;drag.y=(e.clientY-r.top)*H/r.height});
canvas.addEventListener('pointerleave',()=>{deployHover=null});
canvas.addEventListener('contextmenu',event=>{if(!pendingDeployLevel)return;event.preventDefault();pendingDeployLevel=null;deployHover=null;$('message').textContent='已取消灵种部署。';ui()});
canvas.addEventListener('pointerup',()=>{if(!drag)return;const tower=drag.tower,c=Math.max(0,Math.min(COLS-1,Math.floor(drag.x/CELL))),r=Math.max(0,Math.min(ROWS-1,Math.floor(drag.y/CELL)));tower.col=c;tower.row=r;const other=towers.find(t=>t!==tower&&t.col===c&&t.row===r);const sameBranch=other&&towerBranch(other)===towerBranch(tower);if(isRoad(c,r)){tower.col=drag.origin.col;tower.row=drag.origin.row;$('message').textContent='道路无法部署守卫。'}else if(other&&other.level===tower.level&&sameBranch&&tower.level<MAX_LEVEL){other.level++;towers=towers.filter(t=>t!==tower);selectedTower=other;if(other.level===5&&other.evo==='base'&&!other.evolutionPath){pendingEvolution=other;pendingEvolutionStage='primary';openEvolution('primary')}else if(other.level===10&&other.evoTier===1){pendingEvolution=other;pendingEvolutionStage='branch';openEvolution('branch')}else if(other.level===MAX_LEVEL){finalWave=true;$('message').textContent=running?`${evolution[other.evo].ultimate}诞生，当前波成为决胜波！`:`${evolution[other.evo].ultimate}诞生，下一波成为决胜波！`}else $('message').textContent=`合成成功！${evolution[other.evo].name} Lv.${other.level}`;}else if(other){tower.col=drag.origin.col;tower.row=drag.origin.row;$('message').textContent=other.level!==tower.level?'只有同等级炮塔才能合成。':'只有相同进化路线的炮塔才能合并。'}delete drag.origin;drag=null;tryFiveFusion();tryTaijiFusion();tryHiddenFusions();ui()});
canvas.addEventListener('pointercancel',()=>{if(!drag)return;drag.tower.col=drag.origin.col;drag.tower.row=drag.origin.row;drag=null;ui()});
function openEvolution(stage = 'branch') { const primary = stage === 'primary'; const choices = primary ? pickRoutes() : pickBranches(pendingEvolution?.evolutionPath); const dialog = document.querySelector('.evo-dialog'); const modal = $('evoModal'); const hasRare = choices.some(key => evolution[key].rare); if (!modal.classList.contains('show')) evolutionWasPaused = paused; paused = true; $('pauseBtn').textContent = '▶'; $('evoTitle').textContent = primary ? '选择进化主路线' : `选择${evolution[pendingEvolution?.evolutionPath]?.name || ''}分支`; $('rareBanner').hidden = !hasRare; dialog.classList.toggle('has-rare', hasRare); $('evoChoices').innerHTML = choices.map(key => { const route = evolution[key]; const rarity = primary ? (route.rare ? '稀有主路线' : '五行主路线') : 'Lv.10 专属分支'; const stats = `伤害 ${route.damage} / 等级 · 射程 ${route.rangeCells} 格 · 攻速 ${(1 / route.rate).toFixed(1)}/秒`; return `<button class="${route.rare ? 'rare-route' : ''}" data-route="${key}" data-route-key="${key}">${route.rare ? '<span class="rare-badge">稀有</span>' : ''}<strong>${route.icon} ${route.name}</strong><small><b>${rarity}</b><br>${route.desc}</small><span class="evo-stats">${stats}</span><span class="evo-effect">${attackModeNames[route.attackMode]} · ${effectNames[route.effect] || '无附加效果'}</span><small>${primary ? 'Lv.10 解锁专属分支' : `Lv.20：${route.ultimate}`}</small></button>`; }).join(''); document.querySelectorAll('[data-route]').forEach(button => button.onclick = () => chooseEvolution(button.dataset.route)); modal.classList.add('show'); modal.setAttribute('aria-hidden','false'); document.body.classList.add('modal-open'); }
function closeEvolution(){ $('evoModal').classList.remove('show');$('evoModal').setAttribute('aria-hidden','true');document.body.classList.remove('modal-open');paused=evolutionWasPaused;$('pauseBtn').textContent=paused?'▶':'Ⅱ'; }
function chooseEvolution(route){ const t = pendingEvolution; if (!t) return; audioBus.evolve(); discoveredEvolutions.add(route); if (pendingEvolutionStage === 'primary') { t.evolutionPath = route; t.evo = route; t.evoTier = 1; if (t.level >= 10) { pendingEvolutionStage = 'branch'; openEvolution('branch'); return; } pendingEvolution = null; pendingEvolutionStage = null; closeEvolution(); $('message').textContent = `已进化为${evolution[route].name}，Lv.10 时解锁该路线的专属分支。`; tryFiveFusion(); tryTaijiFusion(); tryHiddenFusions(); ui(); return; } t.evo = route; t.evoTier = 2; pendingEvolution = null; pendingEvolutionStage = null; closeEvolution(); $('message').textContent = `分支已确定：${evolution[t.evo].name}`; tryFiveFusion(); tryTaijiFusion(); tryHiddenFusions(); ui(); }
function tryHiddenFusions() {
  for (const recipe of hiddenFusions) {
    for (let row = 1; row < ROWS - 1; row++) for (let col = 1; col < COLS - 1; col++) {
      const parts = recipe.pattern.map(item => towers.find(t => towerBranch(t) === item.parent && t.col === col + item.dx && t.row === row + item.dy));
      if (parts.some(part => !part) || Math.min(...parts.map(part => part.level)) < recipe.minLevel) continue;
      const unique = new Set(parts); if (unique.size !== parts.length) continue;
      const anchor = parts[0], level = Math.min(...parts.map(part => part.level));
      towers = towers.filter(tower => !parts.includes(tower));
      Object.assign(anchor, { col, row, evo: recipe.result, evolutionPath: null, evoTier: 1, level, cool: 0 });
      towers.push(anchor); selectedTower = anchor; discoveredEvolutions.add(recipe.result); audioBus.evolve();
      $('message').textContent = `发现隐藏塔：${evolution[recipe.result].name} Lv.${level}！`;
      return true;
    }
  }
  return false;
}
function tryFiveFusion() {
  let parts = null;
  for (const metal of towers.filter(t => towerBranch(t) === 'metal')) {
    const at = (evo, col, row) => towers.find(t => towerBranch(t) === evo && t.col === col && t.row === row);
    const formation = [metal, at('wood',metal.col-1,metal.row-1), at('water',metal.col+1,metal.row-1), at('earth',metal.col+1,metal.row+1), at('fire',metal.col-1,metal.row+1)];
    if (formation.every(Boolean)) { parts = formation; break; }
  }
  if (!parts) { fiveAttemptSignature = null; return false; }
  const signature = parts.map(t => `${t.evo}:${t.col}:${t.row}`).join('|');
  if (signature === fiveAttemptSignature) return false;
  fiveAttemptSignature = signature;
  if (Math.random() > .65) {
    parts.forEach(t => { t.level = Math.max(1, t.level - 1); });
    $('message').textContent = '五行合体失败，阵中五塔各降 1 级。';
    return true;
  }
  const level = Math.min(...parts.map(t => t.level));
  const anchor = parts[0];
  towers = towers.filter(t => !parts.includes(t));
  anchor.evo = 'fiveSpirit'; anchor.evolutionPath = null; anchor.evoTier = 1; anchor.level = level; anchor.cool = 0;
  towers.push(anchor); selectedTower = anchor; discoveredEvolutions.add('fiveSpirit'); finalWave = finalWave || level === MAX_LEVEL;
  $('message').textContent = `五行合体成功！五灵塔 Lv.${level} 诞生。`;
  return true;
}
function tryTaijiFusion() {
  const pattern = [['yang',-1,-1],['yang',0,-1],['yin',1,-1],['yin',-1,0],['yang',1,0],['yang',-1,1],['yin',0,1],['yin',1,1]];
  for (let row=1;row<ROWS-1;row++) for(let col=1;col<COLS-1;col++) {
    if (isRoad(col,row)||occupied(col,row)) continue;
    const match = inverted => pattern.map(([evo,dx,dy]) => towers.find(t => towerBranch(t) === (inverted?(evo==='yin'?'yang':'yin'):evo) && t.col===col+dx && t.row===row+dy));
    let parts=match(false);if(parts.some(t=>!t))parts=match(true);if(parts.some(t=>!t))continue;
    const level=Math.min(...parts.map(t=>t.level)),anchor=parts[0];
    towers=towers.filter(t=>!parts.includes(t));Object.assign(anchor,{col,row,evo:'taiji',evolutionPath:null,evoTier:1,level,cool:0});towers.push(anchor);selectedTower=anchor;discoveredEvolutions.add('taiji');finalWave=finalWave||level===MAX_LEVEL;
    $('message').textContent=`阴阳归一！太极塔 Lv.${level} 诞生。`;return true;
  }
  return false;
}
function autoMerge() {
  if (pendingEvolution) { $('message').textContent = '请先完成当前守卫的进化选择。'; return; }
  let merged = 0;
  while (true) {
    let pair = null;
    for (let i = 0; i < towers.length && !pair; i++) {
      if (towers[i].evo !== 'base') continue;
      const mate = towers.find((tower, j) => j > i && tower.evo === 'base' && tower.level === towers[i].level && tower.level < MAX_LEVEL);
      if (mate) pair = [towers[i], mate];
    }
    if (!pair) break;
    const [keeper, consumed] = pair;
    keeper.level++; towers = towers.filter(tower => tower !== consumed); selectedTower = keeper; merged++; audioBus.merge();
    if (keeper.level === 5 && keeper.evo === 'base' && !keeper.evolutionPath) {
      pendingEvolution = keeper; pendingEvolutionStage = 'primary'; ui(); openEvolution('primary');
      $('message').textContent = `已完成 ${merged} 次合成，请从三张主路线卡牌中选择。`;
      return;
    }
    if (keeper.level === 10 && keeper.evoTier === 1) {
      pendingEvolution = keeper; pendingEvolutionStage = 'branch'; ui(); openEvolution('branch');
      $('message').textContent = `已完成 ${merged} 次合成，请选择具体进化分支。`;
      return;
    }
    if (keeper.level === MAX_LEVEL) finalWave = true;
  }
  $('message').textContent = merged ? `一键合成完成，共合成 ${merged} 次普通橡果塔。` : '当前没有可自动合成的同等级橡果守卫。';
  ui();
}
function startWave(){spawned=0;kills=0;combo=0;comboTimer=0;currentWaveEvent=waveEvents[(wave-1)%waveEvents.length];running=true;spawnTimer=0;$('waveBtn').disabled=true;$('waveBtn').textContent='自动波次中';$('waveEvent').innerHTML=`<b>${currentWaveEvent.icon} ${currentWaveEvent.name}</b><small>${currentWaveEvent.desc}</small>`;const traitKey=waveTrait(),trait=traitKey?enemyTraits[traitKey]:null;$('message').textContent=trait?(finalWave?`最终决战开始！本波主属性：${trait.label}`:`第 ${wave} 波主属性：${trait.label} · ${currentWaveEvent.name}`):`第 ${wave} 波：${currentWaveEvent.name}。`;ui()}
if ($('fieldBtn')) $('fieldBtn').onclick=()=>{if(running)return;const unlocked=battlefields.filter(item=>item.unlock<=wave);if(unlocked.length<2)return;const current=unlocked.indexOf(currentBattlefield());battlefieldIndex=(current+1)%unlocked.length;$('message').textContent=`已切换至${currentBattlefield().name}：${currentBattlefield().desc}`;screenFlash=.25;ui()};
$('waveBtn').onclick=()=>{if(lives<=0||gameWon)resetGame();if(!started){started=true;startWave()}else if(gameWon){resetGame();started=true;startWave()}};
$('pauseBtn').onclick=()=>{if(!started||gameWon)return;paused=!paused;$('pauseBtn').textContent=paused?'▶':'Ⅱ';$('message').textContent=paused?'游戏已暂停':'游戏继续';ui()};
$('speedBtn').onclick=()=>{speed=speed===1?2:speed===2?3:1;$('speedBtn').textContent=`${speed}×`};
$('recallBtn').onclick=recallSelectedTower;
$('mergeBtn').onclick=autoMerge;
$('surgeBtn').onclick=unleashSurge;
$('soundBtn').onclick=()=>{runtime.soundEnabled=!runtime.soundEnabled;$('soundBtn').textContent=runtime.soundEnabled?'🔊':'🔇';if(runtime.soundEnabled)audioBus.play(520,.08,'sine',.03)};
window.addEventListener('keydown',event=>{if(event.key==='Escape'&&pendingDeployLevel){pendingDeployLevel=null;deployHover=null;$('message').textContent='已取消灵种部署。';ui();return}if(event.code==='Space'&&!event.repeat&&!pendingEvolution){event.preventDefault();unleashSurge()}if(event.key.toLowerCase()==='p'&&!event.repeat)$('pauseBtn').click()});
resetGame();ui();requestAnimationFrame(loop);
