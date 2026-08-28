const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);
const setText = (id, value) => { const node = $(id); if (node) node.textContent = value; };
const W = 960, H = 540, CELL = 60, COLS = 16, ROWS = 9, MAX_LEVEL = 20;
const DEPLOY_LIMIT = 8;
const growthModes = GameContent.growthModes;
const cultivationPolicies = {
  symbiosis: { name: '共生培育', icon: '◎', desc: '自动均养低级守卫；所有已激活羁绊效果提高 25%' },
  focus: { name: '主脉培育', icon: '◆', desc: '资源集中到核心塔；核心强化，其他守卫伤害降低' },
  reserve: { name: '封存共鸣', icon: '◇', desc: '停止自动培养；库存灵蕴转化为全队战力' }
};
const runtime = {
  maxHits: 420,
  reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false,
  soundEnabled: true
};
const primaryEvolutionArt = Object.freeze({
  metal: 'resources/images/0ae53cf4663b8107ae8a7c9b3e7cab3f_compress.jpg',
  fire: 'resources/images/8e22172144b15eb6a4c980c2cf259668_compress.jpg',
  earth: 'resources/images/c3ca7698a30472f1273ed06dba370d05_compress.jpg',
  water: 'resources/images/c4faebe510acff099972adee3129e744_compress.jpg',
  wood: 'resources/images/ece6ef6f59ccc5e989c3497755a6bef6_compress.jpg'
});
const primaryEvolutionImages = {};
function loadPrimaryEvolutionArt() {
  if (typeof Image === 'undefined') return;
  Object.entries(primaryEvolutionArt).forEach(([key, src]) => {
    const image = new Image();
    image.onload = () => {
      // Convert the generated JPG's near-white background to transparency once.
      const buffer = document.createElement?.('canvas');
      if (!buffer) { primaryEvolutionImages[key] = image; return; }
      buffer.width = image.naturalWidth || image.width; buffer.height = image.naturalHeight || image.height;
      const bufferContext = buffer.getContext('2d');
      if (!bufferContext) { primaryEvolutionImages[key] = image; return; }
      bufferContext.drawImage(image, 0, 0);
      const pixels = bufferContext.getImageData(0, 0, buffer.width, buffer.height);
      for (let i = 0; i < pixels.data.length; i += 4) {
        const whiteness = Math.min(pixels.data[i], pixels.data[i + 1], pixels.data[i + 2]);
        if (whiteness > 238) pixels.data[i + 3] = Math.max(0, 255 - (whiteness - 238) * 15);
      }
      bufferContext.putImageData(pixels, 0, 0);
      primaryEvolutionImages[key] = buffer;
    };
    image.src = src;
  });
}
function hasPrimaryEvolutionArt(tower) {
  return tower && tower.level < 10 && Object.prototype.hasOwnProperty.call(primaryEvolutionArt, tower.evo);
}
loadPrimaryEvolutionArt();
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
Object.entries(routeWeights).forEach(([key, weight]) => { evolution[key].weight = weight; });
const attackModeNames = { single: '单体重击', pierce: '直线穿透', chain: '连锁攻击', splash: '范围溅射', omni: '全域攻击' };
const effectNames = { stun: '概率眩晕', weaken: '削弱护甲', slow: '持续减速', burn: '持续灼烧', silence: '压制减速', freeze: '冻结控制', poison: '持续中毒', fiveElements: '五行复合效果', taiji: '易伤与减速' };
const projectileStyleNames = { seed:'橡果弹',blade:'旋刃',thorn:'针雨',bubble:'水珠',fireball:'抛射火球',boulder:'击退巨石',shadow:'曲线影弹',sun:'日轮弹幕',windblade:'疾风扇刃',lightning:'跃动雷弧',frost:'冰晶齐射',void:'虚空星弹',spirit:'五灵弹幕',taiji:'阴阳轮' };
const deliveryNames = { projectile:'远程弹幕',bombard:'抛物轰炸',melee:'近战攻击',beam:'直线贯穿',chain:'逐段连锁',area:'落点范围',rain:'持续弹雨',nova:'全域阵法' };
const projectileProfiles = {
  base: { projectileStyle: 'seed', projectileSpeed: 360, volley: 1 },
  metal: { projectileStyle: 'blade', projectileSpeed: 430, volley: 1 },
  wood: { projectileStyle: 'thorn', projectileSpeed: 560, volley: 2 },
  water: { projectileStyle: 'bubble', projectileSpeed: 320, volley: 1 },
  fire: { projectileStyle: 'fireball', projectileSpeed: 270, arc: 48, splashRadius: 82, volley: 1 },
  earth: { projectileStyle: 'boulder', projectileSpeed: 235, arc: 64, volley: 1 },
  yin: { projectileStyle: 'shadow', projectileSpeed: 350, curve: 34, volley: 1 },
  yang: { projectileStyle: 'sun', projectileSpeed: 390, arc: 24, splashRadius: 92, volley: 2 },
  wind: { projectileStyle: 'windblade', projectileSpeed: 650, volley: 3 },
  thunder: { projectileStyle: 'lightning', projectileSpeed: 720, volley: 1 },
  fiveSpirit: { projectileStyle: 'spirit', projectileSpeed: 460, maxTargets: 12, volley: 2 },
  taiji: { projectileStyle: 'taiji', projectileSpeed: 420, maxTargets: 16, volley: 2 },
  emberwood: { projectileStyle: 'fireball', projectileSpeed: 310, arc: 58, splashRadius: 110, volley: 2 },
  froststorm: { projectileStyle: 'frost', projectileSpeed: 520, volley: 2 },
  voidstar: { projectileStyle: 'void', projectileSpeed: 400, curve: 45, maxTargets: 12, volley: 2 },
  ironwood: { projectileStyle: 'thorn', projectileSpeed: 610, volley: 3 }
};
function attackDelivery(key, data, lineage) {
  const fusionDeliveries = { fiveSpirit:'nova', taiji:'nova', emberwood:'bombard', froststorm:'chain', voidstar:'nova', ironwood:'beam' };
  if (fusionDeliveries[key]) return fusionDeliveries[key];
  const branch = Number(key.match(/Branch(\d+)$/)?.[1] || 0);
  if (branch === 1) return ['metal','earth'].includes(lineage) ? 'melee' : 'projectile';
  if (branch === 2) return ['fire','earth'].includes(lineage) ? 'bombard' : 'area';
  if (branch === 3 || branch === 6) return 'chain';
  if (branch === 4) return 'beam';
  if (branch === 5) return data.effect === 'freeze' ? 'beam' : 'projectile';
  if (branch === 7) return 'rain';
  return { base:'projectile', metal:'melee', wood:'beam', water:'chain', fire:'bombard', earth:'melee', yin:'chain', yang:'area', wind:'beam', thunder:'chain' }[lineage] || 'projectile';
}
Object.entries(evolution).forEach(([key, data]) => {
  const lineage = data.parent || key;
  const profile = projectileProfiles[key] || projectileProfiles[lineage] || projectileProfiles.base;
  const branchVolley = /Branch(6|7)$/.test(key) ? 1 : 0;
  data.combat = { ...profile, delivery: attackDelivery(key, data, lineage), ...(data.combat || {}), volley: Math.min(3, profile.volley + branchVolley) };
});
const towerCatalog = TowerDomain.TowerCatalog.fromConfig(evolution, key => branchOf[key] || key);
const towerFactory = new TowerDomain.TowerFactory(towerCatalog);
const attackPatterns = TowerDomain.AttackPatternRegistry.createDefault();
const evolutionTree = new EvolutionDomain.EvolutionTree(evolution);
const lineageFactions = Object.freeze({
  metal: ['faction:forged'], fire: ['faction:forged'], earth: ['faction:forged'],
  wood: ['faction:verdant'], water: ['faction:verdant'], wind: ['faction:verdant'],
  yin: ['faction:celestial'], yang: ['faction:celestial'], thunder: ['faction:celestial']
});
const fusionFactions = Object.freeze({
  fiveSpirit: ['faction:forged','faction:verdant'], taiji: ['faction:celestial'],
  emberwood: ['faction:forged','faction:verdant'], froststorm: ['faction:verdant','faction:celestial'],
  voidstar: ['faction:celestial'], ironwood: ['faction:forged','faction:verdant']
});
function towerSynergyTags(tower) {
  const definition = evolution[tower.evo], lineage = towerBranch(tower);
  return [...(fusionFactions[tower.evo] || lineageFactions[lineage] || []), `role:${definition.attackMode}`];
}
const synergySystem = new SynergyDomain.SynergySystem(GameContent.synergies, { tagResolver: towerSynergyTags, identityResolver: tower => tower.evo });
const hiddenFusions = [
  { result: 'emberwood', minLevel: 5, clue: '两团烈焰夹护新木，三者构成尖顶。', pattern: [{ parent: 'fire', dx: -1, dy: 0 }, { parent: 'wood', dx: 1, dy: 0 }, { parent: 'fire', dx: 0, dy: -1 }] },
  { result: 'froststorm', minLevel: 5, clue: '流水、长风与惊雷在同一条线上相遇。', pattern: [{ parent: 'water', dx: -1, dy: 0 }, { parent: 'wind', dx: 0, dy: 0 }, { parent: 'thunder', dx: 1, dy: 0 }] },
  { result: 'voidstar', minLevel: 8, clue: '两阴两阳占据空心方阵的四角。', pattern: [{ parent: 'yin', dx: -1, dy: -1 }, { parent: 'yang', dx: 1, dy: -1 }, { parent: 'yang', dx: -1, dy: 1 }, { parent: 'yin', dx: 1, dy: 1 }] },
  { result: 'ironwood', minLevel: 5, clue: '金在上、木居中、土承下，三塔垂直相连。', pattern: [{ parent: 'metal', dx: 0, dy: -1 }, { parent: 'wood', dx: 0, dy: 0 }, { parent: 'earth', dx: 0, dy: 1 }] }
];
const contentRegistry = GameContent.createRegistry();
const gameSession = new ContentDomain.GameSession(contentRegistry, { modeKey: 'endless', mapKey: 'grove' });
const waveEvents = contentRegistry.events.values();
const battlefields = contentRegistry.maps.values();
const enemyTypes = {
  normal: { label: '普通', icon: '●' }, elite: { label: '精英', icon: '◆' }, boss: { label: 'Boss', icon: '👑' }
};
const enemyArchetypes = GameContent.enemyArchetypes;
const enemyTraits = GameContent.enemyTraits;
const enemyTraitKeys = Object.keys(enemyTraits);
const enemyCatalog = EnemyDomain.DefinitionCatalog.fromConfig(EnemyDomain.EnemyDefinition, enemyArchetypes);
const enemyTraitCatalog = EnemyDomain.DefinitionCatalog.fromConfig(EnemyDomain.TraitDefinition, enemyTraits);
const enemyFactory = new EnemyDomain.EnemyFactory(enemyCatalog, enemyTraitCatalog);
const spawnDirector = new EnemyDomain.SpawnDirector(enemyCatalog, enemyTraitCatalog, enemyFactory);

let towers, enemies, attackEvents, projectiles, hits, coins, lives, score, wave, kills, spawned;
let running, gameWon, finalWave, spawnTimer, drag, selectedTower, selectedEnemy, pendingEvolution, pendingEvolutionStage, evolutionDecision, evolutionWasPaused, nextWaveTimer, started, paused, speed, last, fiveAttemptSignature, discoveredEvolutions, currentWaveEvent, combo, comboTimer, summonsBought, surgeCharge, screenFlash, lastSummon, battlefieldIndex, reserve, standbyReserve, pendingDeployLevel, pendingDeployTowerIndex, deployHover, growthMode, growthCycles, lastMergeSnapshot, cultivationTarget, cultivationPolicy, cultivationCore, activeCultivationPolicy, activeCultivationCore, intermissionSummary;
let selectedModeKey = 'endless', selectedLevelKey = contentRegistry.levels.keys()[0], activeCommandTab = 'roots';

function resetGame() {
  gameSession.reset({ modeKey: gameSession.mode.key, levelKey: gameSession.level?.key || null, mapKey: gameSession.map.key });
  towers = [towerFactory.create({ col: 1, row: 6, level: 1 })];
  enemies = []; attackEvents = []; projectiles = []; hits = [];
  coins = 0; lives = gameSession.lives; score = 0; wave = gameSession.waveNumber; kills = 0; spawned = 0;
  running = false; gameWon = false; finalWave = false; spawnTimer = 0; drag = null; selectedTower = towers[0]; selectedEnemy = null; pendingEvolution = null; pendingEvolutionStage = null; evolutionDecision = null; evolutionWasPaused = false; nextWaveTimer = 0; started = false; paused = false; speed = 1; fiveAttemptSignature = null; discoveredEvolutions = new Set(); currentWaveEvent = contentRegistry.events.get(gameSession.currentWave.eventKey); combo = 0; comboTimer = 0; summonsBought = 0; surgeCharge = 0; screenFlash = 0; lastSummon = []; battlefieldIndex = battlefields.findIndex(field => field.key === gameSession.map.key); reserve = {}; standbyReserve = []; pendingDeployLevel = null; pendingDeployTowerIndex = null; deployHover = null; growthMode = 'balanced'; growthCycles = { sprout: 0, balanced: 0, refine: 0 }; lastMergeSnapshot = null; cultivationTarget = null; cultivationPolicy = 'symbiosis'; cultivationCore = towers[0]; activeCultivationPolicy = cultivationPolicy; activeCultivationCore = cultivationCore; intermissionSummary = ''; activeCommandTab = 'roots';
}

function center(item) { return { x: item.col * CELL + CELL / 2, y: item.row * CELL + CELL / 2 }; }
function attackRadius(towerData) { return towerData.rangeCells * CELL / 2; }
function currentBattlefield() { return battlefields[battlefieldIndex] || battlefields[0]; }
function currentPath() { return currentBattlefield().path; }
function currentPathLength() { return currentBattlefield().pathLength; }
function currentAttackRadius(towerData) { return attackRadius(towerData) * (currentWaveEvent?.range || 1) * currentBattlefield().range; }
function segmentDistance(x, y, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy));
}
function isRoad(col, row) {
  const x = col * CELL + CELL / 2, y = row * CELL + CELL / 2;
  const path = currentPath();
  return path.slice(1).some((p, i) => segmentDistance(x, y, path[i], p) < CELL * .56);
}
function occupied(col, row, except = null) { return towers.some(t => t !== except && t.col === col && t.row === row); }
function freeCellCount() {
  let count = 0;
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) if (!isRoad(col, row) && !occupied(col, row)) count++;
  return count;
}
function waveSize() { return gameSession.currentWave?.enemyCount || 0; }
function waveTrait() { return gameSession.currentWave?.traitKey || (wave <= 2 ? null : enemyTraitKeys[(wave - 3) % enemyTraitKeys.length]); }
function updateSelectionInfo() {
  if (selectedEnemy) {
    const type = selectedEnemy.definition || enemyTypes[selectedEnemy.type];
    const traits = selectedEnemy.traits.length ? selectedEnemy.traits.map(key => `<span style="color:${enemyTraits[key].color}">● ${enemyTraits[key].label}</span>`).join(' · ') : '<span style="color:#748079">无属性</span>';
    const status = selectedEnemy.dead || selectedEnemy.hp <= 0 ? ' · 已击败' : '';
    const activeStatuses = [[selectedEnemy.burn,'燃烧'],[selectedEnemy.poison,'中毒'],[selectedEnemy.freeze,'冻结'],[selectedEnemy.stun,'眩晕'],[selectedEnemy.slow,'减速'],[selectedEnemy.weaken,'破甲'],[selectedEnemy.taiji,'易伤']].filter(([time])=>time>0).map(([time,label])=>`${label} ${time.toFixed(1)}s`).join(' · ') || '无异常状态';
    const resistEntries = Object.entries(selectedEnemy.resist || {}), highResists = resistEntries.filter(([, value]) => value > .18);
    const resistText = resistEntries.every(([, value]) => value === 0) ? '属性抗性：无' : highResists.map(([key, value]) => `${evolution[key]?.name?.replace('守卫','') || key} ${Math.round(value * 100)}%`).join(' · ') || '属性抗性：低';
    const abilityText = type.abilities?.length ? ` · 能力 ${type.abilities.join('、')}` : '';
    const shieldText = selectedEnemy.maxShield > 0 ? ` · 护盾 ${Math.ceil(selectedEnemy.shield)}/${Math.ceil(selectedEnemy.maxShield)}` : '';
    $('selectedInfo').innerHTML = `<span class="info-icon">${type.icon}</span><div><b>${type.name || type.label}${status} · ${traits}</b><small>${type.desc ? `${type.desc}<br>` : ''}生命 ${Math.max(0,Math.ceil(selectedEnemy.hp))}/${Math.ceil(selectedEnemy.max)}${shieldText} · ${activeStatuses}<br>速度 ${selectedEnemy.speed.toFixed(0)} · 护甲 ${Math.round(selectedEnemy.armor*100)}% · 减速抗性 ${Math.round(selectedEnemy.slowResist*100)}% · 再生 ${selectedEnemy.regen.toFixed(1)}/秒${abilityText} · ${resistText}</small></div>`;
  } else if (selectedTower) {
    const z = evolution[selectedTower.evo];
    const usesProjectiles = ['projectile','bombard'].includes(z.combat?.delivery), volley = usesProjectiles ? Math.min(3, (z.combat?.volley || 1) + (selectedTower.level >= 10 ? 1 : 0)) : 1;
    const deliveryDetail = usesProjectiles ? `${projectileStyleNames[z.combat?.projectileStyle] || '能量弹'} · ${volley} 波齐射` : deliveryNames[z.combat?.delivery] || '特殊攻击';
    const cultivation = selectedTower.level < MAX_LEVEL ? `<br>灵蕴 ${selectedTower.growth || 0}/${growthThreshold(selectedTower.level)} · 同级共鸣额外 +${resonanceBonus(selectedTower.level)} · 可吞噬低级同形态塔` : '<br>已达 Lv.20 终点';
    const towerTags = new Set(towerSynergyTags(selectedTower));
    const bonds = formationSynergies().filter(result => towerTags.has(result.definition.tag)).map(result => result.definition.name).join(' · ');
    $('selectedInfo').innerHTML = `<span class="info-icon">${z.icon}</span><div><b>${z.name} · Lv.${selectedTower.level}</b><small>${z.desc || '基础单体攻击'}<br>伤害 ${z.damage * selectedTower.level} · 射程 ${z.rangeCells}×${z.rangeCells} 格 · ${attackModeNames[z.attackMode] || '特殊攻击'}<br>${deliveryDetail} · ${effectNames[z.effect] || '无附加效果'}${bonds ? `<br>阵容标签 ${bonds}` : ''}${cultivation}</small></div>`;
  } else {
    $('selectedInfo').innerHTML = '<span class="info-icon">🌰</span><div><b>拖动橡果塔改变位置</b><small>点击敌人可查看属性 · Lv.5 选择主路线，Lv.10 选择专属分支</small></div>';
  }
}
function ui() {
  $('coins').textContent = coins; $('lives').textContent = lives; $('score').textContent = score; $('wave').textContent = wave;
  setText('waveTotal', gameSession.isFinite ? `/ ${gameSession.level.waves.length}` : '/ ∞');
  $('progressText').textContent = `${kills} / ${waveSize()}`;
  $('progressBar').style.width = `${Math.min(100, kills / waveSize() * 100)}%`;
  $('surgeCharge').textContent = Math.floor(surgeCharge);
  $('surgeFill').style.width = `${surgeCharge}%`;
  $('surgeBtn').disabled = surgeCharge < 100 || !enemies.some(enemy => !enemy.dead) || paused;
  if ($('undoMergeBtn')) $('undoMergeBtn').disabled = !lastMergeSnapshot || Boolean(pendingEvolution);
  if ($('mergeBtn')) $('mergeBtn').disabled = running || Boolean(pendingEvolution);
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
    selectedEnemy = null; setCommandTab('tower'); ui();
  });
}
function updateWorkshop() {
  const workshop = $('summonWorkshop');
  if (!workshop) return;
  if (!$('cultivateBtn')) {
    const recall = $('recallBtn');
    if (recall?.parentNode) {
      const button = document.createElement('button');
      button.id = 'cultivateBtn'; button.className = 'cultivate-btn'; button.textContent = '✦ 灵蕴祭炼';
      button.onclick = beginCultivation;
      recall.parentNode.appendChild(button);
    }
  }
  if (!$('infuseBtn')) {
    const cultivate = $('cultivateBtn');
    if (cultivate?.parentNode) {
      const button = document.createElement('button');
      button.id = 'infuseBtn'; button.className = 'cultivate-btn infuse-btn'; button.textContent = '⇧ 灌注至节点';
      button.onclick = infuseReserveToMilestone;
      cultivate.parentNode.appendChild(button);
    }
  }
  if (!$('cultivationPolicy')) {
    const panel = document.createElement('div');
    panel.id = 'cultivationPolicy'; panel.className = 'cultivation-policy';
    panel.innerHTML = `<div><b>培育方针</b><small id="policyStatus"></small></div><div class="policy-options">${Object.entries(cultivationPolicies).map(([key, policy]) => `<button data-cultivation-policy="${key}" title="${policy.desc}"><span>${policy.icon}</span><b>${policy.name.replace('培育','')}</b></button>`).join('')}</div><button class="core-assign-btn" id="coreAssignBtn">设当前塔为主脉</button>`;
    workshop.insertBefore(panel, $('summonResult'));
    panel.querySelectorAll('[data-cultivation-policy]').forEach(button => button.onclick = () => setCultivationPolicy(button.dataset.cultivationPolicy));
    $('coreAssignBtn').onclick = assignCultivationCore;
  }
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
  const reserveEssence = reserveEntries.reduce((sum,[level,count]) => sum + seedGrowthValue(Number(level)) * count, 0);
  const standbyCount = standbyReserve.length;
  setText('reserveSummary', reserveCount || standbyCount ? `${reserveCount} 枚灵种 / ${reserveEssence} 灵蕴 · ${standbyCount} 座待命塔` : '灵种自动培育至 Lv.5 节点');
  if ($('reserveList')) {
    const seeds = reserveEntries.map(([level,count]) => `<button class="reserve-seed${pendingDeployLevel===Number(level)?' active':''}" data-deploy-level="${level}" title="每枚可灌注 ${seedGrowthValue(Number(level))} 点灵蕴"><span>🌰</span><b>Lv.${level}</b><small>×${count}</small></button>`).join('');
    const standby = standbyReserve.map((state,index) => { const data = evolution[state.evo]; return `<button class="reserve-seed standby-seed${pendingDeployTowerIndex===index?' active':''}" data-deploy-standby="${index}" title="${data.name} Lv.${state.level}"><span>${data.icon}</span><b>Lv.${state.level}</b><small>${data.name.replace('守卫','').replace('塔','')}</small></button>`; }).join('');
    $('reserveList').innerHTML = seeds + standby || '<span class="reserve-empty">暂无库存</span>';
    $('reserveList').querySelectorAll('[data-deploy-level]').forEach(button => button.onclick = () => beginDeploy(Number(button.dataset.deployLevel)));
    $('reserveList').querySelectorAll('[data-deploy-standby]').forEach(button => button.onclick = () => beginDeployStandby(Number(button.dataset.deployStandby)));
  }
  document.querySelectorAll('[data-growth-mode]').forEach(button => { button.classList.toggle('active', button.dataset.growthMode === growthMode); button.onclick = () => { growthMode = button.dataset.growthMode; processGrowth(); $('message').textContent = `世界树转为${growthModes[growthMode].name}根系：${growthModes[growthMode].desc}。`; ui(); }; });
  document.querySelectorAll('[data-cultivation-policy]').forEach(button => { button.classList.toggle('active', button.dataset.cultivationPolicy === cultivationPolicy); button.disabled = false; });
  if ($('coreAssignBtn')) { $('coreAssignBtn').hidden = cultivationPolicy !== 'focus'; $('coreAssignBtn').disabled = !selectedTower; }
  if ($('policyStatus')) {
    const core = cultivationPolicy === 'focus' && cultivationCore ? ` · 核心 ${evolution[cultivationCore.evo].name} Lv.${cultivationCore.level}` : '';
    const reserveBonus = cultivationPolicy === 'reserve' ? ` · 增伤 ${Math.round(Math.min(.2, Math.floor(reserveEssenceTotal() / 20) * .02) * 100)}%` : '';
    const timing = running && (cultivationPolicy !== activeCultivationPolicy || (cultivationPolicy === 'focus' && cultivationCore !== activeCultivationCore)) ? ' · 下波生效' : '';
    $('policyStatus').textContent = `${cultivationPolicies[cultivationPolicy].desc}${core}${reserveBonus}${timing}`;
  }
  $('recallBtn').disabled = !selectedTower || Boolean(pendingEvolution) || Boolean(cultivationTarget);
  $('recallBtn').textContent = '↙ 撤回选中的塔';
  if ($('cultivateBtn')) {
    $('cultivateBtn').disabled = cultivationTarget ? false : running || !selectedTower || Boolean(pendingEvolution);
    $('cultivateBtn').classList.toggle('active', Boolean(cultivationTarget));
    $('cultivateBtn').textContent = cultivationTarget ? '× 取消灵蕴祭炼' : '✦ 灵蕴祭炼';
  }
  if ($('infuseBtn')) $('infuseBtn').disabled = running || !selectedTower || selectedTower.level >= MAX_LEVEL || !reserveCount || Boolean(pendingEvolution);
  $('summonPriceHint').textContent = `${mode.name}根系：${mode.desc} · 可批量灌注至下个成长节点`;
  updateMapOperations(reserveEntries, reserveCount);
}
function setCommandTab(key) {
  const order = ['roots', 'reserve', 'tower'];
  if (!order.includes(key)) return;
  activeCommandTab = key;
  const activeIndex = order.indexOf(key);
  document.querySelectorAll('[data-command-tab]').forEach(button => {
    const active = button.dataset.commandTab === key;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('[data-command-panel]').forEach(panel => {
    const panelIndex = order.indexOf(panel.dataset.commandPanel);
    const active = panelIndex === activeIndex;
    panel.classList.toggle('active', active);
    panel.dataset.position = panelIndex < activeIndex ? 'before' : panelIndex > activeIndex ? 'after' : 'active';
    panel.setAttribute('aria-hidden', String(!active));
    panel.inert = !active;
  });
}
function showGrowthHelp(key = growthMode) {
  const mode = growthModes[key];
  const help = $('mapGrowthHelp');
  if (help && mode) help.innerHTML = `<b>${mode.name}根系</b><span>${mode.desc}</span>`;
}
function showPolicyHelp(key = cultivationPolicy) {
  const policy = cultivationPolicies[key];
  const help = $('mapPolicyHelp');
  if (!help || !policy) return;
  const timing = running && key === cultivationPolicy ? '<small>当前调整将在下一波生效</small>' : '';
  help.innerHTML = `<b>${policy.name}</b><span>${policy.desc}</span>${timing}`;
}
function bindCommandPreview(button, showPreview, restore) {
  button.onmouseenter = showPreview;
  button.onfocus = showPreview;
  button.onmouseleave = restore;
  button.onblur = restore;
}
function updateMapOperations(reserveEntries = Object.entries(reserve).filter(([, count]) => count > 0).sort((a,b) => Number(b[0]) - Number(a[0])), reserveCount = reserveEntries.reduce((sum,[,count]) => sum + count, 0)) {
  const mode = growthModes[growthMode];
  setText('mapSpirit', coins); setText('mapSpiritCost', mode.threshold);
  if ($('mapSpiritFill')) $('mapSpiritFill').style.width = `${Math.min(100, coins / mode.threshold * 100)}%`;
  document.querySelectorAll('[data-map-growth]').forEach(button => {
    button.classList.toggle('active', button.dataset.mapGrowth === growthMode);
    button.onclick = () => { growthMode = button.dataset.mapGrowth; processGrowth(); $('message').textContent = `世界树转为${growthModes[growthMode].name}根系：${growthModes[growthMode].desc}。`; ui(); };
    bindCommandPreview(button, () => showGrowthHelp(button.dataset.mapGrowth), () => showGrowthHelp());
  });
  showGrowthHelp();
  document.querySelectorAll('[data-map-policy]').forEach(button => {
    button.classList.toggle('active', button.dataset.mapPolicy === cultivationPolicy);
    button.onclick = () => setCultivationPolicy(button.dataset.mapPolicy);
    bindCommandPreview(button, () => showPolicyHelp(button.dataset.mapPolicy), () => showPolicyHelp());
  });
  showPolicyHelp();
  const list = $('mapReserveList');
  if (list) {
    const seeds = reserveEntries.map(([level,count]) => `<button class="hud-seed${pendingDeployLevel===Number(level)?' active':''}" data-map-seed="${level}" title="部署 Lv.${level} 灵种"><span>🌰</span><b>${level}</b><small>×${count}</small></button>`).join('');
    const standby = standbyReserve.map((state,index) => { const data=evolution[state.evo]; return `<button class="hud-seed standby${pendingDeployTowerIndex===index?' active':''}" data-map-standby="${index}" title="部署 ${data.name} Lv.${state.level}"><span>${data.icon}</span><b>${state.level}</b></button>`; }).join('');
    list.innerHTML = seeds + standby || '<span class="hud-empty">暂无灵种</span>';
    list.querySelectorAll('[data-map-seed]').forEach(button => button.onclick = () => beginDeploy(Number(button.dataset.mapSeed)));
    list.querySelectorAll('[data-map-standby]').forEach(button => button.onclick = () => beginDeployStandby(Number(button.dataset.mapStandby)));
  }
  const hasTower = Boolean(selectedTower && towers.includes(selectedTower) && !selectedEnemy);
  const selectedData = hasTower ? evolution[selectedTower.evo] : null;
  if ($('mapTowerSummary')) $('mapTowerSummary').innerHTML = hasTower
    ? `<span>${selectedData.icon} ${selectedData.name} <b>Lv.${selectedTower.level}</b></span><small>${selectedData.desc}</small>`
    : '<span>未选择守卫</span><small>点击地图上的塔查看可用操作</small>';
  if ($('mapRecallBtn')) $('mapRecallBtn').disabled = !hasTower || Boolean(pendingEvolution) || Boolean(cultivationTarget);
  if ($('mapCultivateBtn')) {
    $('mapCultivateBtn').disabled = cultivationTarget ? false : running || !hasTower || Boolean(pendingEvolution) || selectedTower.level >= MAX_LEVEL;
    $('mapCultivateBtn').classList.toggle('active', Boolean(cultivationTarget));
    $('mapCultivateBtn').innerHTML = cultivationTarget ? '×<span>取消祭炼</span>' : '✦<span>祭炼</span>';
    $('mapCultivateBtn').title = cultivationTarget ? '取消当前祭炼选择' : '将另一座塔转化为当前塔的成长灵蕴';
  }
  if ($('mapInfuseBtn')) $('mapInfuseBtn').disabled = running || !hasTower || selectedTower.level >= MAX_LEVEL || !reserveCount || Boolean(pendingEvolution) || Boolean(cultivationTarget);
  if ($('mapCoreBtn')) {
    $('mapCoreBtn').disabled = !hasTower || Boolean(cultivationTarget);
    $('mapCoreBtn').classList.toggle('active', hasTower && cultivationCore === selectedTower && cultivationPolicy === 'focus');
  }
  if ($('mapCancelCultivationBtn')) $('mapCancelCultivationBtn').hidden = !cultivationTarget;
  setCommandTab(activeCommandTab);
}
function updateEvolutionSummary() {
  const summary = $('evolutionSummary');
  if (!summary) return;
  const nodes = [...discoveredEvolutions].map(key => evolution[key]).filter(Boolean);
  const undiscovered = hiddenFusions.filter(recipe => !discoveredEvolutions.has(recipe.result));
  const clue = undiscovered.length ? undiscovered[wave % undiscovered.length].clue : '所有古老阵式均已被发现。';
  const formation = formationSynergies();
  const active = formation.filter(result => result.tier);
  const upcoming = formation.filter(result => !result.tier && result.count > 0).sort((left, right) => (left.nextTier.count - left.count) - (right.nextTier.count - right.count)).slice(0, 2);
  const amplification = formationAmplification();
  const activeMarkup = active.map(result => `<span class="bond active" title="${result.definition.desc}"><i>${result.definition.icon}</i><b>${result.definition.name}</b><small>${result.count} · ${synergyEffectText(result.tier, amplification)}</small></span>`).join('');
  const upcomingMarkup = upcoming.map(result => `<span class="bond" title="${result.definition.desc}"><i>${result.definition.icon}</i><b>${result.definition.name}</b><small>${result.count}/${result.nextTier.count}</small></span>`).join('');
  summary.innerHTML = `<div class="formation-bonds"><div><b>阵容羁绊</b><small>${active.length ? `${active.length} 项生效${amplification > 1 ? ' · 共生强化' : ''}` : '尚未成阵'}</small></div><div class="bond-list">${activeMarkup || upcomingMarkup || '<span class="bond-empty">进化不同形态以组成羁绊</span>'}</div>${active.length && upcomingMarkup ? `<div class="bond-preview">临近激活 ${upcomingMarkup}</div>` : ''}</div><div class="discovery-record"><b>进化发现 ${nodes.length} · 隐藏塔 ${hiddenFusions.length - undiscovered.length}/${hiddenFusions.length}</b><small>${nodes.length ? nodes.map(node => `${node.icon} ${node.name}`).join(' · ') : 'Lv.5 选择主路线，Lv.10 解锁分支'}</small><em>古碑残句：${clue}</em></div>`;
}
function pointAt(distance) {
  const path = currentPath();
  let left = distance;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (left <= length) return { x: a[0] + (b[0] - a[0]) * left / length, y: a[1] + (b[1] - a[1]) * left / length };
    left -= length;
  }
  return { x: path.at(-1)[0], y: path.at(-1)[1] };
}
function addEnemy() {
  const waveDefinition = gameSession.currentWave;
  const neutral = waveTrait() === null;
  const resist = Object.fromEntries(['metal','wood','water','fire','earth','yin','yang','wind','thunder'].map(key => [key, neutral ? 0 : .08 + Math.random() * .14]));
  const eventSpeed = (currentWaveEvent?.enemySpeed || 1) * currentBattlefield().enemySpeed;
  const forcedBoss = waveDefinition?.boss && spawned === waveSize() - 1 ? waveDefinition.boss : null;
  enemies.push(spawnDirector.create({
    wave, spawnIndex: spawned,
    hpScale: (38 + wave * 20 + spawned * 2.5) * (currentWaveEvent?.enemyHp || 1) * (waveDefinition?.hpScale || 1),
    speedScale: (35 + wave * 4.5) * eventSpeed * (waveDefinition?.speedScale || 1),
    resist, primaryTrait: waveTrait(), neutral, archetype: forcedBoss, roster: waveDefinition?.roster || []
  }));
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
  // Lv.5 is the first evolution decision. Never auto-combine beyond it.
  for (let level = 1; level < 5; level++) {
    while ((reserve[level] || 0) >= 2) { reserve[level] -= 2; reserve[level + 1] = (reserve[level + 1] || 0) + 1; merged++; }
    if (!reserve[level]) delete reserve[level];
  }
  return merged;
}
function seedGrowthValue(level) { return 2 ** Math.max(0, Math.min(4, level - 1)); }
function reserveEssenceTotal() {
  return Object.entries(reserve).reduce((sum, [level, count]) => sum + seedGrowthValue(Number(level)) * count, 0);
}
function takeReserveSeed() {
  const level = Object.keys(reserve).map(Number).filter(key => reserve[key] > 0).sort((a, b) => b - a)[0];
  if (!level) return null;
  reserve[level]--; if (!reserve[level]) delete reserve[level];
  return { level, value: seedGrowthValue(level) };
}
function triggerGrowthDecision(target) {
  const stage = evolutionTree.stageFor(target);
  if (!stage) return false;
  pendingEvolution = target; pendingEvolutionStage = stage; selectedTower = target; openEvolution(stage);
  return true;
}
function autoCultivateAfterWave() {
  const available = reserveEssenceTotal();
  if (!available) return `${cultivationPolicies[cultivationPolicy].name}：本波无可分配灵蕴`;
  if (cultivationPolicy === 'reserve') return `封存共鸣：保留 ${available} 点灵蕴，转化为全队增幅`;

  let targets;
  if (cultivationPolicy === 'focus') {
    if (!towers.includes(cultivationCore) || cultivationCore.level >= MAX_LEVEL) cultivationCore = towers.filter(tower => tower.level < MAX_LEVEL).sort((a, b) => b.level - a.level)[0] || null;
    targets = cultivationCore ? [cultivationCore] : [];
  } else targets = towers.filter(tower => tower.level < MAX_LEVEL);
  if (!targets.length) return `${cultivationPolicies[cultivationPolicy].name}：没有可培养的守卫`;

  const stops = new Map(targets.map(target => [target, nextGrowthMilestone(target.level)]));
  let infused = 0, consumed = 0, decision = false;
  while (reserveEssenceTotal() > 0) {
    const eligible = targets.filter(target => target.level < stops.get(target));
    if (!eligible.length) break;
    const target = cultivationPolicy === 'focus' ? eligible[0] : eligible.sort((a, b) => (a.level + a.growth / growthThreshold(a.level)) - (b.level + b.growth / growthThreshold(b.level)))[0];
    const seed = takeReserveSeed(); if (!seed) break;
    applyGrowth(target, seed.value, stops.get(target)); infused += seed.value; consumed++;
    if (triggerGrowthDecision(target)) { decision = true; break; }
  }
  const targetText = cultivationPolicy === 'focus' && cultivationCore ? ` → ${evolution[cultivationCore.evo].name}` : '';
  return `${cultivationPolicies[cultivationPolicy].name}${targetText}：自动分配 ${consumed} 枚灵种 / ${infused} 灵蕴${decision ? '，已抵达进化节点' : ''}`;
}
function setCultivationPolicy(policy) {
  if (!cultivationPolicies[policy]) return;
  cultivationPolicy = policy;
  if (policy === 'focus' && selectedTower) cultivationCore = selectedTower;
  $('message').textContent = `${cultivationPolicies[policy].name}：${cultivationPolicies[policy].desc}${running ? '，本波结算后生效。' : '。'}`;
  ui();
}
function assignCultivationCore() {
  if (!selectedTower) { $('message').textContent = '请先选择一座主脉核心塔。'; return; }
  cultivationCore = selectedTower; cultivationPolicy = 'focus';
  $('message').textContent = `${evolution[selectedTower.evo].name}已设为主脉核心，后续波次资源将自动集中灌注。`;
  ui();
}
function beginDeploy(level) {
  if (!(reserve[level] > 0)) return;
  pendingDeployTowerIndex = null;
  pendingDeployLevel = pendingDeployLevel === level ? null : level; deployHover = null; selectedTower = null; selectedEnemy = null;
  $('message').textContent = pendingDeployLevel ? `部署 Lv.${level} 灵种：点击地图上的绿色空格。` : '已取消灵种部署。'; ui();
}
function beginDeployStandby(index) {
  if (!standbyReserve[index]) return;
  pendingDeployLevel = null;
  pendingDeployTowerIndex = pendingDeployTowerIndex === index ? null : index;
  deployHover = null; selectedTower = null; selectedEnemy = null;
  const state = standbyReserve[index];
  $('message').textContent = pendingDeployTowerIndex !== null ? `部署 ${evolution[state.evo].name} Lv.${state.level}：点击地图上的绿色空格。` : '已取消塔位部署。';
  ui();
}
function deployReserve(col, row) {
  const deployingStandby = pendingDeployTowerIndex !== null;
  if ((!pendingDeployLevel || !(reserve[pendingDeployLevel] > 0)) && (!deployingStandby || !standbyReserve[pendingDeployTowerIndex])) return false;
  const occupant = towers.find(tower => tower.col === col && tower.row === row);
  if (!deployingStandby && occupant) {
    const seed = towerFactory.create({ col, row, level: pendingDeployLevel });
    if (!canMergeTowers(occupant, seed)) { $('message').textContent = '该塔与灵种等级或形态不同，不能直接合并。'; return true; }
    const level = pendingDeployLevel;
    reserve[level]--; if (!reserve[level]) delete reserve[level];
    lastMergeSnapshot = null;
    mergeTowers(occupant, seed);
    pendingDeployLevel = reserve[level] > 0 && !pendingEvolution ? level : null;
    deployHover = null;
    if (!pendingEvolution) $('message').textContent = pendingDeployLevel ? `注入合并成功！继续部署 Lv.${level} 灵种，按 Esc 结束。` : `注入合并成功！${evolution[occupant.evo].name} Lv.${occupant.level}`;
    ui();
    return true;
  }
  if (towers.length >= DEPLOY_LIMIT) { $('message').textContent = `编队已满。可将同级灵种直接点到场上普通塔完成合并，或先撤回一座塔。`; return true; }
  if (isRoad(col,row) || occupant) { $('message').textContent = '这里无法部署，请选择绿色空格。'; return true; }
  const placedLevel = pendingDeployLevel;
  const tower = deployingStandby
    ? towerFactory.create({ ...standbyReserve[pendingDeployTowerIndex], col, row, cool: 0 })
    : towerFactory.create({ col, row, level: pendingDeployLevel });
  towers.push(tower);
  if (deployingStandby) standbyReserve.splice(pendingDeployTowerIndex, 1);
  else { reserve[placedLevel]--; if (!reserve[placedLevel]) delete reserve[placedLevel]; }
  selectedTower = tower; selectedEnemy = null; audioBus.merge();
  pendingDeployLevel = !deployingStandby && reserve[placedLevel] > 0 ? placedLevel : null; pendingDeployTowerIndex = null; deployHover = null; lastMergeSnapshot = null;
  if (tower.evo === 'base' && tower.level >= 5 && !tower.evolutionPath) {
    pendingDeployLevel = null; pendingEvolution = tower; pendingEvolutionStage = 'primary';
    openEvolution('primary');
    $('message').textContent = `Lv.${tower.level} 灵种已部署，请选择主路线。`;
  } else if (tower.level >= 10 && tower.evoTier === 1 && !evolution[tower.evo]?.fusion) {
    pendingDeployLevel = null; pendingEvolution = tower; pendingEvolutionStage = 'branch';
    openEvolution('branch');
    $('message').textContent = `Lv.${tower.level} 守卫已部署，请选择专属分支。`;
  } else {
    $('message').textContent = deployingStandby ? `${evolution[tower.evo].name} Lv.${tower.level} 已重新编入战场。` : pendingDeployLevel ? `Lv.${placedLevel} 已部署，继续选择空格，按 Esc 结束。` : `Lv.${placedLevel} 橡果守卫已部署。`;
  }
  ui();
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
  if (!selectedTower || pendingEvolution) { $('message').textContent = '请先选择一座要撤回的塔，并完成当前进化选择。'; return; }
  const tower = selectedTower; towers = towers.filter(item => item !== tower); lastMergeSnapshot = null;
  if (tower.evo === 'base') {
    reserve[tower.level] = (reserve[tower.level] || 0) + 1;
    const merged = compactReserve(); selectedTower = null; pendingDeployLevel = null; pendingDeployTowerIndex = null;
    $('message').textContent = `Lv.${tower.level} 普通塔已收回${merged ? `，仓内自动整编 ${merged} 次` : ''}。`;
  } else {
    standbyReserve.push(tower.snapshot()); selectedTower = null; pendingDeployLevel = null; pendingDeployTowerIndex = null;
    $('message').textContent = `${evolution[tower.evo].name} Lv.${tower.level} 已进入待命塔仓，进化路线完整保留。`;
  }
  ui();
}
function beginCultivation() {
  if (cultivationTarget) { cancelCultivation(); return; }
  if (running) { $('message').textContent = '灵蕴祭炼仅在整备阶段开放。'; return; }
  if (!selectedTower || pendingEvolution) { $('message').textContent = '请先选择一座要培养的主塔。'; return; }
  cultivationTarget = selectedTower;
  selectedEnemy = null;
  setCommandTab('tower');
  $('message').textContent = `祭炼模式：点击另一座守卫完成献祭；点击主塔、地图空地或“取消祭炼”即可退出。`;
  ui();
}
function cancelCultivation() {
  if (!cultivationTarget) return;
  cultivationTarget = null;
  $('message').textContent = '已退出灵蕴祭炼。';
  ui();
}
function sacrificeTower(target, fodder) {
  if (!target || !fodder || target === fodder || !towers.includes(target) || !towers.includes(fodder) || target.level >= MAX_LEVEL) return false;
  const value = fodder.sacrificeValue({ efficiency: .6, tierBonus: .15, fusionBonus: .25, isFusion: tower => Boolean(evolution[tower.evo]?.fusion) });
  towers = towers.filter(tower => tower !== fodder);
  applyGrowth(target, value, nextGrowthMilestone(target.level));
  selectedTower = target;
  cultivationTarget = null;
  audioBus.evolve();
  if (target.level >= 5 && target.evo === 'base' && !target.evolutionPath) {
    cultivationTarget = null; pendingEvolution = target; pendingEvolutionStage = 'primary'; openEvolution('primary');
  } else if (target.level >= 10 && target.evoTier === 1 && !evolution[target.evo]?.fusion) {
    cultivationTarget = null; pendingEvolution = target; pendingEvolutionStage = 'branch'; openEvolution('branch');
  } else {
    $('message').textContent = `祭炼成功：${evolution[fodder.evo].name} 转化为 ${value} 点灵蕴。`;
  }
  return true;
}
function nextGrowthMilestone(level) { return level < 5 ? 5 : level < 10 ? 10 : level < 15 ? 15 : MAX_LEVEL; }
function applyGrowth(target, amount, stopLevel = MAX_LEVEL) {
  target.growth = (target.growth || 0) + Math.max(0, amount);
  while (target.level < Math.min(stopLevel, MAX_LEVEL) && target.growth >= growthThreshold(target.level)) {
    target.growth -= growthThreshold(target.level);
    target.level += 1;
  }
  return target.level;
}
function infuseReserveToMilestone() {
  if (running) { $('message').textContent = '批量灌注仅在整备阶段开放。'; return; }
  if (!selectedTower || selectedTower.level >= MAX_LEVEL || pendingEvolution) { $('message').textContent = '请选择一座未满级的主塔。'; return; }
  const levels = Object.keys(reserve).map(Number).filter(level => reserve[level] > 0).sort((a, b) => b - a);
  if (!levels.length) { $('message').textContent = '灵种仓中没有可灌注的灵种。'; return; }
  const target = selectedTower, milestone = nextGrowthMilestone(target.level);
  let required = -target.growth;
  for (let level = target.level; level < milestone; level++) required += growthThreshold(level);
  let infused = 0, consumed = 0;
  for (const level of levels) {
    while (reserve[level] > 0 && infused < required) {
      reserve[level]--; infused += seedGrowthValue(level); consumed++;
    }
    if (!reserve[level]) delete reserve[level];
    if (infused >= required) break;
  }
  applyGrowth(target, infused, milestone);
  selectedTower = target; lastMergeSnapshot = null; audioBus.evolve();
  if (target.level >= 5 && target.evo === 'base' && !target.evolutionPath) {
    pendingEvolution = target; pendingEvolutionStage = 'primary'; openEvolution('primary');
  } else if (target.level >= 10 && target.evoTier === 1 && !evolution[target.evo]?.fusion) {
    pendingEvolution = target; pendingEvolutionStage = 'branch'; openEvolution('branch');
  } else {
    $('message').textContent = `批量灌注完成：消耗 ${consumed} 枚灵种，注入 ${infused} 点灵蕴，抵达 Lv.${target.level}。`;
  }
  ui();
}
function pickRoutes(count = 3) {
  return evolutionTree.choices('primary', null, routes, count);
}
function towerBranch(tower) { return tower.branch(key => branchOf[key] || key); }
let formationCacheSignature = '', formationCache = [];
function formationSynergies() {
  const signature = towers.map(tower => tower.evo).sort().join('|');
  if (signature !== formationCacheSignature) {
    formationCacheSignature = signature;
    formationCache = synergySystem.evaluate(towers);
  }
  return formationCache;
}
function formationAmplification() {
  const policy = running ? activeCultivationPolicy : cultivationPolicy;
  return policy === 'symbiosis' ? 1.25 : 1;
}
function formationCombatModifiers(tower) {
  return synergySystem.modifiersFor(tower, formationSynergies(), formationAmplification());
}
function synergyEffectText(tier, amplification = 1) {
  const effects = [];
  if (tier.damage) effects.push(`伤害 +${Math.round(tier.damage * amplification * 100)}%`);
  if (tier.attackSpeed) effects.push(`攻速 +${Math.round(tier.attackSpeed * amplification * 100)}%`);
  return effects.join(' · ');
}
function cultivationDamageMultiplier(tower) {
  const policy = running ? activeCultivationPolicy : cultivationPolicy;
  const core = running ? activeCultivationCore : cultivationCore;
  let cultivation = 1;
  if (policy === 'focus') cultivation = tower === core ? 1.3 : .9;
  if (policy === 'reserve') cultivation = 1 + Math.min(.2, Math.floor(reserveEssenceTotal() / 20) * .02);
  return cultivation * formationCombatModifiers(tower).damage;
}
function towerMergeIdentity(tower) { return `${tower.evo}|${tower.evolutionPath || ''}|${tower.evoTier}`; }
function growthThreshold(level) { return 8 + level * 2; }
function cultivationValue(tower) { return Math.max(1, Math.ceil(tower.level * .75)); }
function resonanceBonus(level) { return Math.max(1, growthThreshold(level) - cultivationValue({ level })); }
function mergeRules() { return { identityResolver: towerMergeIdentity, maxLevel: MAX_LEVEL, cultivation: true, growthThreshold, cultivationValue, resonanceBonus }; }
function canMergeTowers(left, right) { return Boolean(left?.canMergeWith(right, mergeRules())); }
function mergeNeedsChoice(tower) {
  return (tower.level >= 4 && tower.level < 10 && tower.evo === 'base' && !tower.evolutionPath) ||
    (tower.level >= 9 && tower.level < 10 && tower.evoTier === 1 && !evolution[tower.evo]?.fusion);
}
function mergeTowers(keeper, consumed) {
  if (!keeper || !consumed) return false;
  if (consumed.level > keeper.level && canMergeTowers(consumed, keeper)) [keeper, consumed] = [consumed, keeper];
  if (!keeper.absorb(consumed, mergeRules())) return false;
  towers = towers.filter(tower => tower !== consumed);
  selectedTower = keeper; selectedEnemy = null; audioBus.merge();
  if (keeper.level === 5 && keeper.evo === 'base' && !keeper.evolutionPath) {
    pendingDeployLevel = null; pendingEvolution = keeper; pendingEvolutionStage = 'primary'; openEvolution('primary');
  } else if (keeper.level >= 10 && keeper.evoTier === 1 && !evolution[keeper.evo]?.fusion) {
    pendingDeployLevel = null; pendingEvolution = keeper; pendingEvolutionStage = 'branch'; openEvolution('branch');
  } else if (keeper.level === MAX_LEVEL) {
    finalWave = true;
    $('message').textContent = running ? `${evolution[keeper.evo].ultimate}诞生，当前波成为决胜波！` : `${evolution[keeper.evo].ultimate}诞生，下一波成为决胜波！`;
  } else {
    const kind = keeper.lastAbsorbKind === 'resonance' ? '共鸣合成' : '培养吞噬';
    $('message').textContent = `${kind}成功！${evolution[keeper.evo].name} Lv.${keeper.level} · ${keeper.growth}/${growthThreshold(keeper.level)} 灵蕴`;
  }
  return true;
}
function pickBranches(parent, count = 3) {
  return evolutionTree.choices('branch', parent, branchKeys[parent] || [], count);
}
function burst(x, y, color) {
  const count = runtime.reducedMotion ? 3 : 7;
  for (let i = 0; i < count && hits.length < runtime.maxHits; i++) hits.push({ x, y, life: 1, color, vx: (Math.random() - .5) * 55, vy: (Math.random() - .5) * 55 });
}
function statusText(target, label, color) {
  if (hits.length >= runtime.maxHits) return;
  hits.push({ type: 'statusText', x: target.x, y: target.y - target.radius - 10, life: 1, color, label });
}
function applyEnemyStatus(target, key, duration, source = null) {
  if (typeof target.applyStatus === 'function') return target.applyStatus(key, duration, source);
  const adjusted = duration * (['slow','silence','freeze'].includes(key) ? 1 - (target.slowResist || 0) : 1);
  target[key] = Math.max(target[key] || 0, adjusted);
  if (source) target[`${key}Source`] = source;
  return adjusted;
}
function damageTarget(t, target, z) {
  const field = currentBattlefield(), branch = towerBranch(t);
  const fieldDamage = field.bonus.includes(branch) ? field.damage : 1;
  const rawDamage = z.damage * t.level * fieldDamage * cultivationDamageMultiplier(t);
  if (typeof target.receiveDamage === 'function') target.receiveDamage(rawDamage, branch);
  else {
    const resistance = target.resist?.[branch] || 0;
    target.hp -= rawDamage * (target.taiji > 0 ? 1.3 : 1) * (1 - Math.max(0, (target.armor || 0) - (target.weaken > 0 ? .15 : 0))) * (1 - resistance);
  }
  if ('dist' in target) {
    if (z.effect === 'slow') { if (!(target.slow > .3)) statusText(target, '减速', '#8cecff'); applyEnemyStatus(target, 'slow', 3.2); }
    if (z.effect === 'burn') { if (!(target.burn > .3)) statusText(target, '燃烧', '#ff9b45'); applyEnemyStatus(target, 'burn', 5, t); }
    if (z.effect === 'weaken') { if (!(target.weaken > .3)) statusText(target, '破甲', '#d9c36f'); applyEnemyStatus(target, 'weaken', 5); }
    if (z.effect === 'stun' && Math.random() < (t.evo === 'earth' ? .55 : .34)) {
      if (!(target.stun > .2)) statusText(target, '眩晕!', '#ffe467');
      applyEnemyStatus(target, 'stun', t.evo === 'earth' ? 1.4 : 1);
      if (t.evo === 'earth') { target.dist = Math.max(0, target.dist - 78); applyEnemyStatus(target, 'knockback', 1); statusText(target, '击退', '#ffd08a'); }
    }
    if (z.effect === 'silence') { if (!(target.silence > .3)) statusText(target, '压制', '#c3a8ff'); applyEnemyStatus(target, 'silence', 3); applyEnemyStatus(target, 'slow', 3); }
    if (z.effect === 'freeze') { if (!(target.freeze > .3)) statusText(target, '冻结!', '#d8fbff'); applyEnemyStatus(target, 'freeze', 3.8); applyEnemyStatus(target, 'slow', 3.8); applyEnemyStatus(target, 'stun', 1.25); }
    if (z.effect === 'poison') { if (!(target.poison > .3)) statusText(target, '中毒', '#9bea62'); applyEnemyStatus(target, 'poison', 6, t); }
    if (z.effect === 'fiveElements') { applyEnemyStatus(target,'slow',3.5);applyEnemyStatus(target,'burn',5,t);applyEnemyStatus(target,'weaken',6);if(Math.random()<.45)applyEnemyStatus(target,'stun',1.1);statusText(target,'五行侵蚀','#fff0a0'); }
    if (z.effect === 'taiji') { applyEnemyStatus(target, 'taiji', 6); applyEnemyStatus(target, 'slow', 3); statusText(target, '易伤', '#f1e8ff'); }
  }
  if (branchOf[t.evo] === 'water' && 'dist' in target) applyEnemyStatus(target, 'slow', 3.2);
  if (target.hp > 0 || target.dead) return;
  target.dead = true;
  combo = comboTimer > 0 ? combo + 1 : 1; comboTimer = 2.2; const comboBonus = 1 + Math.min(.5, Math.floor(combo / 5) * .1); const rewardScale = (currentWaveEvent?.reward || 1) * currentBattlefield().reward; const enemyReward = target.rewardMultiplier || ({normal:1,elite:2,boss:8}[target.type] || 1); gainSpirit((10 + wave) * enemyReward * rewardScale); score += Math.round(100 * t.level * enemyReward * comboBonus); kills++; surgeCharge = Math.min(100, surgeCharge + (target.type === 'boss' ? 35 : target.type === 'elite' ? 18 : 9)); if(combo>1&&hits.length<runtime.maxHits)hits.push({type:'text',x:target.x,y:target.y-20,life:1,color:'#fff3a6',label:`${combo} 连击`});
}
function launchProjectiles(tower, targets, definition) {
  const combat = definition.combat || {};
  const baseVolley = combat.volley || 1;
  const volley = runtime.reducedMotion ? 1 : Math.min(3, baseVolley + (tower.level >= 10 ? 1 : 0));
  const focusTargets = definition.attackMode === 'splash' ? [targets[0]] : targets;
  const origin = center(tower);
  focusTargets.forEach((target, targetIndex) => {
    for (let shot = 0; shot < volley; shot++) {
      if (projectiles.length >= 320) return;
      const spread = (shot - (volley - 1) / 2) * 7;
      const payloadTargets = definition.attackMode === 'splash' ? targets : [target];
      const chainOrigin = definition.attackMode === 'chain' && targetIndex > 0 ? targets[targetIndex - 1] : origin;
      projectiles.push({
        tower, target, payloadTargets, definition,
        x: chainOrigin.x, y: chainOrigin.y, originX: chainOrigin.x + spread, originY: chainOrigin.y,
        targetX: target.x, targetY: target.y,
        age: 0, delay: shot * .095 + targetIndex * .025,
        duration: Math.max(.14, Math.hypot(target.x - chainOrigin.x, target.y - chainOrigin.y) / (combat.projectileSpeed || 400)),
        style: combat.projectileStyle || 'seed', arc: combat.arc || 0, curve: combat.curve || 0,
        damageScale: 1 / volley, appliesEffect: shot === 0, rotation: Math.random() * Math.PI * 2, dead: false
      });
    }
  });
}
function launchAttack(tower, targets, definition) {
  const delivery = definition.combat?.delivery || 'projectile';
  if (delivery === 'projectile' || delivery === 'bombard') { launchProjectiles(tower, targets, definition); return; }
  if (attackEvents.length >= 160) return;
  const timings = {
    melee: { impactAt: .14, duration: .34 }, beam: { impactAt: .12, duration: .38 },
    chain: { impactAt: .08, duration: .28 + targets.length * .1 }, area: { impactAt: .38, duration: .68 },
    rain: { impactAt: .48, duration: .82 }, nova: { impactAt: .24, duration: .65 }
  };
  const timing = timings[delivery] || timings.beam;
  attackEvents.push({
    type: delivery, tower, targets: [...targets], definition, age: 0,
    impactAt: timing.impactAt, duration: timing.duration, resolved: false,
    resolvedTargets: new Set(), focusX: targets[0].x, focusY: targets[0].y,
    seed: Math.random() * 1000
  });
}
function resolveAttackTarget(event, target) {
  if (!target || target.dead || target.hp <= 0 || event.resolvedTargets.has(target)) return;
  event.resolvedTargets.add(target);
  damageTarget(event.tower, target, event.definition);
  burst(target.x, target.y, event.definition.color);
}
function updateAttackEvents(dt) {
  attackEvents.forEach(event => {
    event.age += dt;
    if (event.type === 'chain') {
      event.targets.forEach((target, index) => { if (event.age >= event.impactAt + index * .09) resolveAttackTarget(event, target); });
    } else if (!event.resolved && event.age >= event.impactAt) {
      event.resolved = true;
      event.targets.forEach(target => resolveAttackTarget(event, target));
    }
  });
  attackEvents = attackEvents.filter(event => event.age < event.duration);
}
function resolveProjectile(projectile) {
  if (projectile.dead) return;
  projectile.dead = true;
  const validTargets = projectile.payloadTargets.filter(target => !target.dead && target.hp > 0);
  if (!validTargets.length) return;
  const scaledDefinition = { ...projectile.definition, damage: projectile.definition.damage * projectile.damageScale, effect: projectile.appliesEffect ? projectile.definition.effect : null };
  validTargets.forEach(target => damageTarget(projectile.tower, target, scaledDefinition));
  burst(projectile.targetX, projectile.targetY, projectile.definition.color);
  if (projectile.tower.evo === 'base') audioBus.hit();
}
function updateProjectiles(dt) {
  projectiles.forEach(projectile => {
    if (projectile.delay > 0) { projectile.delay -= dt; return; }
    projectile.age += dt;
    if (!projectile.target.dead) { projectile.targetX = projectile.target.x; projectile.targetY = projectile.target.y; }
    const progress = Math.min(1, projectile.age / projectile.duration);
    const eased = 1 - (1 - progress) * (1 - progress);
    const dx = projectile.targetX - projectile.originX, dy = projectile.targetY - projectile.originY;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const curve = Math.sin(progress * Math.PI) * projectile.curve;
    projectile.x = projectile.originX + dx * eased - dy / distance * curve;
    projectile.y = projectile.originY + dy * eased + dx / distance * curve - Math.sin(progress * Math.PI) * projectile.arc;
    projectile.rotation += dt * 12;
    if (progress >= 1) resolveProjectile(projectile);
  });
  projectiles = projectiles.filter(projectile => !projectile.dead);
}
function towerCombatContext() {
  return {
    catalog: towerCatalog,
    patterns: attackPatterns,
    enemies,
    positionOf: center,
    rangeOf: tower => currentAttackRadius(towerCatalog.get(tower.evo)),
    cooldownMultiplier: tower => formationCombatModifiers(tower).cooldown,
    damage: damageTarget,
    visualize: () => {},
    launch: launchAttack
  };
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
  const path = currentPath(), pathLength = currentPathLength();
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
function drawJaggedLink(from, to, color, width, seed) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(from.x, from.y);
  for (let step = 1; step < 6; step++) {
    const t = step / 6, wobble = Math.sin(seed + step * 8.7) * 8;
    const dx = to.x - from.x, dy = to.y - from.y, length = Math.max(1, Math.hypot(dx, dy));
    ctx.lineTo(from.x + dx * t - dy / length * wobble, from.y + dy * t + dx / length * wobble);
  }
  ctx.lineTo(to.x, to.y); ctx.stroke();
}
function drawMeleeAttack(event) {
  const origin = center(event.tower), target = event.targets[0];
  if (!target) return;
  const angle = Math.atan2(target.y - origin.y, target.x - origin.x);
  const windup = Math.min(1, event.age / event.impactAt), recovery = Math.max(0, 1 - (event.age - event.impactAt) / (event.duration - event.impactAt));
  const swing = event.age < event.impactAt ? -.85 + windup * .35 : -.5 + (1 - recovery) * 1.45;
  ctx.save(); ctx.translate(origin.x, origin.y); ctx.rotate(angle + swing); ctx.lineCap='round';
  if (towerBranch(event.tower) === 'earth') {
    ctx.strokeStyle='#4e3d2d';ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(2,0);ctx.lineTo(43,0);ctx.stroke();ctx.fillStyle='#a27b50';roundedRect(35,-15,26,30,5);ctx.fill();
  } else {
    ctx.strokeStyle='#fff2b1';ctx.lineWidth=8;ctx.beginPath();ctx.arc(0,0,50,-.35,.35);ctx.stroke();ctx.strokeStyle=event.definition.color;ctx.lineWidth=3;ctx.stroke();
  }
  ctx.restore();
  if (event.age >= event.impactAt) { const pulse=Math.max(0,1-(event.age-event.impactAt)*5);ctx.strokeStyle=event.definition.color;ctx.globalAlpha=pulse;ctx.lineWidth=6;ctx.beginPath();ctx.arc(target.x,target.y,18+(1-pulse)*28,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1; }
}
function drawBeamAttack(event) {
  const origin = center(event.tower), focus = event.targets[0];
  if (!focus) return;
  const dx=focus.x-origin.x,dy=focus.y-origin.y,length=Math.max(1,Math.hypot(dx,dy));
  const reach=Math.max(...event.targets.map(target=>Math.hypot(target.x-origin.x,target.y-origin.y)),length)+35;
  const end={x:origin.x+dx/length*reach,y:origin.y+dy/length*reach};
  const alpha=Math.min(1,event.age/.08)*Math.max(0,1-event.age/event.duration);
  ctx.save();ctx.globalAlpha=alpha;ctx.lineCap='round';
  const lineage=towerBranch(event.tower);
  if(lineage==='wood'||event.tower.evo==='ironwood'){
    ctx.strokeStyle='#245d35';ctx.lineWidth=13;ctx.beginPath();ctx.moveTo(origin.x,origin.y);ctx.quadraticCurveTo((origin.x+end.x)/2-12,(origin.y+end.y)/2+12,end.x,end.y);ctx.stroke();ctx.strokeStyle='#a8e36f';ctx.lineWidth=5;ctx.stroke();
    for(let i=1;i<6;i++){const t=i/6,x=origin.x+(end.x-origin.x)*t,y=origin.y+(end.y-origin.y)*t;ctx.fillStyle='#d9ff9b';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-dy/length*10-dx/length*5,y+dx/length*10-dy/length*5);ctx.lineTo(x+dx/length*5,y+dy/length*5);ctx.fill()}
  }else if(lineage==='wind'){
    [-10,0,10].forEach(offset=>{ctx.strokeStyle=offset?'#d9ffff':event.definition.color;ctx.lineWidth=offset?3:7;ctx.beginPath();ctx.moveTo(origin.x-dy/length*offset,origin.y+dx/length*offset);ctx.quadraticCurveTo((origin.x+end.x)/2+dy/length*(offset+12),(origin.y+end.y)/2-dx/length*(offset+12),end.x-dy/length*offset,end.y+dx/length*offset);ctx.stroke()});
  }else{
    ctx.strokeStyle='#efffff';ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(origin.x,origin.y);ctx.lineTo(end.x,end.y);ctx.stroke();ctx.strokeStyle=event.definition.color;ctx.lineWidth=6;ctx.stroke();
  }
  ctx.restore();
}
function drawChainAttack(event) {
  const points=[center(event.tower),...event.targets.map(target=>({x:target.x,y:target.y}))];
  const visible=Math.min(event.targets.length,Math.max(0,Math.floor((event.age-event.impactAt)/.09)+1));
  const lineage=towerBranch(event.tower);
  ctx.save();ctx.lineCap='round';
  for(let index=0;index<visible;index++){
    const from=points[index],to=points[index+1],fade=Math.max(.2,1-(event.age-event.impactAt-index*.09)/event.duration);ctx.globalAlpha=fade;
    if(lineage==='thunder'||event.tower.evo==='froststorm'){drawJaggedLink(from,to,'#f7f0ff',9,event.seed+index);drawJaggedLink(from,to,event.definition.color,4,event.seed+index)}
    else{ctx.strokeStyle=lineage==='water'?'#c9f8ff':'#bba1e8';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.quadraticCurveTo((from.x+to.x)/2+12,(from.y+to.y)/2-12,to.x,to.y);ctx.stroke();ctx.strokeStyle=event.definition.color;ctx.lineWidth=3;ctx.stroke()}
  }
  ctx.restore();
}
function drawAreaAttack(event) {
  const radius=event.definition.combat?.splashRadius||86,pre=event.age<event.impactAt;
  ctx.save();ctx.translate(event.focusX,event.focusY);
  if(pre){const pulse=.65+.25*Math.sin(event.age*28);ctx.globalAlpha=pulse;ctx.setLineDash([7,5]);ctx.strokeStyle=event.definition.color;ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=event.definition.color+'22';ctx.fill()}
  else{const progress=Math.min(1,(event.age-event.impactAt)/(event.duration-event.impactAt));ctx.globalAlpha=1-progress;ctx.fillStyle=event.definition.color+'55';ctx.beginPath();ctx.arc(0,0,radius*(.35+progress*.65),0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff2a0';ctx.lineWidth=7;ctx.stroke();for(let i=0;i<10;i++){ctx.rotate(Math.PI/5);ctx.beginPath();ctx.moveTo(radius*.35,0);ctx.lineTo(radius*.8,0);ctx.stroke()}}
  if(towerBranch(event.tower)==='yang'){ctx.globalAlpha=pre ? .35 : Math.max(0,1-(event.age-event.impactAt)*3);ctx.fillStyle='#fff2a0';ctx.fillRect(-18,-event.focusY,36,event.focusY)}
  ctx.restore();
}
function drawRainAttack(event) {
  const radius=event.definition.combat?.splashRadius||90,pre=event.age<event.impactAt;
  ctx.save();ctx.translate(event.focusX,event.focusY);ctx.setLineDash(pre?[5,5]:[]);ctx.strokeStyle=event.definition.color;ctx.lineWidth=3;ctx.globalAlpha=pre?.8:Math.max(.15,1-event.age/event.duration);ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.stroke();ctx.fillStyle=event.definition.color+'25';ctx.fill();ctx.setLineDash([]);
  if(!pre){for(let i=0;i<9;i++){const x=Math.sin(event.seed+i*7.3)*radius*.75,y=((event.age-event.impactAt)*240+i*31)%(radius*2)-radius;ctx.strokeStyle=i%2?'#b9ef71':'#c4a4f2';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x,y-22);ctx.lineTo(x,y);ctx.stroke();ctx.fillStyle=ctx.strokeStyle;ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill()}}
  ctx.restore();
}
function drawNovaAttack(event) {
  const origin=center(event.tower),progress=Math.min(1,event.age/event.duration),radius=currentAttackRadius(event.definition)*Math.min(1,progress*1.35),alpha=1-progress;
  ctx.save();ctx.globalAlpha=alpha;ctx.lineWidth=event.tower.evo==='taiji'?12:7;
  if(event.tower.evo==='fiveSpirit'){['#c99b36','#4f9d50','#399dc4','#d95832','#9c754d'].forEach((color,index)=>{ctx.strokeStyle=color;ctx.beginPath();ctx.arc(origin.x,origin.y,Math.max(6,radius-index*9),0,Math.PI*2);ctx.stroke()})}
  else{ctx.strokeStyle=event.definition.color;ctx.beginPath();ctx.arc(origin.x,origin.y,radius,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#f4efff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(origin.x,origin.y,radius*.72,0,Math.PI*2);ctx.stroke()}
  ctx.restore();
}
function drawAttackEvents(){attackEvents.forEach(event=>{if(event.type==='melee')drawMeleeAttack(event);else if(event.type==='beam')drawBeamAttack(event);else if(event.type==='chain')drawChainAttack(event);else if(event.type==='area')drawAreaAttack(event);else if(event.type==='rain')drawRainAttack(event);else if(event.type==='nova')drawNovaAttack(event)})}
function drawProjectile(projectile) {
  if (projectile.delay > 0) return;
  const definition = projectile.definition;
  const angle = Math.atan2(projectile.targetY - projectile.y, projectile.targetX - projectile.x);
  ctx.save(); ctx.translate(projectile.x, projectile.y); ctx.rotate(angle);
  ctx.shadowColor = definition.color; ctx.shadowBlur = 10;
  if (projectile.style === 'blade') {
    ctx.rotate(projectile.rotation); ctx.fillStyle = '#fff4b0'; ctx.strokeStyle = definition.color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(15,0); ctx.lineTo(0,6); ctx.lineTo(-15,0); ctx.lineTo(0,-6); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (projectile.style === 'thorn') {
    ctx.fillStyle = '#d9ff9b'; ctx.strokeStyle = '#28753d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(18,0); ctx.lineTo(-10,5); ctx.lineTo(-5,0); ctx.lineTo(-10,-5); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (projectile.style === 'bubble') {
    ctx.globalAlpha = .85; ctx.fillStyle = '#7ee9ff'; ctx.strokeStyle = '#e8fdff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0,0,9,0,Math.PI*2); ctx.fill(); ctx.stroke(); ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(-3,-3,2.5,0,Math.PI*2);ctx.fill();
  } else if (projectile.style === 'fireball') {
    ctx.fillStyle = '#ffcf4a'; ctx.beginPath(); ctx.arc(4,0,9,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#f24b26';ctx.beginPath();ctx.moveTo(-2,-8);ctx.lineTo(-18,0);ctx.lineTo(-2,8);ctx.closePath();ctx.fill();
  } else if (projectile.style === 'boulder') {
    ctx.fillStyle = '#806447'; ctx.strokeStyle = '#e6c488'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0,0,13,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.strokeStyle='#4e3d2d';ctx.beginPath();ctx.moveTo(-6,-5);ctx.lineTo(2,1);ctx.lineTo(8,-3);ctx.stroke();
  } else if (projectile.style === 'sun') {
    ctx.rotate(projectile.rotation); ctx.strokeStyle='#fff0a1';ctx.lineWidth=3;for(let i=0;i<8;i++){ctx.rotate(Math.PI/4);ctx.beginPath();ctx.moveTo(10,0);ctx.lineTo(16,0);ctx.stroke()}ctx.fillStyle='#ffd13f';ctx.beginPath();ctx.arc(0,0,10,0,Math.PI*2);ctx.fill();
  } else if (projectile.style === 'windblade') {
    ctx.strokeStyle='#d9ffff';ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,15,-.8,.8);ctx.stroke();ctx.strokeStyle=definition.color;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-18,-7);ctx.lineTo(8,0);ctx.lineTo(-18,7);ctx.stroke();
  } else if (projectile.style === 'lightning') {
    ctx.strokeStyle='#f6e8ff';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-18,0);ctx.lineTo(-8,-6);ctx.lineTo(0,5);ctx.lineTo(8,-5);ctx.lineTo(17,0);ctx.stroke();ctx.strokeStyle=definition.color;ctx.lineWidth=2;ctx.stroke();
  } else if (projectile.style === 'frost') {
    ctx.strokeStyle='#e9ffff';ctx.lineWidth=3;for(let i=0;i<3;i++){ctx.rotate(Math.PI/3);ctx.beginPath();ctx.moveTo(-11,0);ctx.lineTo(11,0);ctx.stroke()}ctx.fillStyle='#79d9ee';ctx.beginPath();ctx.arc(0,0,4,0,Math.PI*2);ctx.fill();
  } else if (projectile.style === 'shadow' || projectile.style === 'void') {
    ctx.fillStyle=projectile.style==='void'?'#a971e8':'#625b9d';ctx.beginPath();ctx.arc(0,0,11,0,Math.PI*2);ctx.fill();ctx.fillStyle='#261f38';ctx.beginPath();ctx.arc(5,-3,9,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#d5b8ff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,14,0,Math.PI*2);ctx.stroke();
  } else if (projectile.style === 'taiji') {
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(0,0,13,0,Math.PI*2);ctx.fill();ctx.fillStyle='#222';ctx.font='bold 21px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('☯',0,1);
  } else if (projectile.style === 'spirit') {
    ['#c99b36','#4f9d50','#399dc4','#d95832','#9c754d'].forEach((color,index)=>{const a=projectile.rotation+index*Math.PI*2/5;ctx.fillStyle=color;ctx.beginPath();ctx.arc(Math.cos(a)*10,Math.sin(a)*10,4,0,Math.PI*2);ctx.fill()});
  } else {
    ctx.fillStyle='#9b693d';ctx.strokeStyle='#f2d49b';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,8,0,Math.PI*2);ctx.fill();ctx.stroke();
  }
  ctx.restore();
}
function drawProjectiles() { projectiles.forEach(drawProjectile); }
function drawEnemyStatuses(enemy, radius) {
  const statuses = [
    [enemy.burn, '火', '#ff7b31'], [enemy.poison, '毒', '#79c94d'], [enemy.freeze, '冰', '#7ee9ff'],
    [enemy.stun, '晕', '#ffe15b'], [enemy.slow, '缓', '#55cce8'], [enemy.weaken, '破', '#e1bd5e'], [enemy.taiji, '易', '#d9c4ff']
  ].filter(([time]) => time > 0);
  if (enemy.freeze > 0) { ctx.fillStyle='rgba(164,244,255,.28)';ctx.strokeStyle='#dffcff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(enemy.x,enemy.y,radius+5,0,Math.PI*2);ctx.fill();ctx.stroke(); }
  if (enemy.burn > 0) { ctx.fillStyle='#ff8a32';for(let i=0;i<3;i++){const a=performance.now()/180+i*2.1;ctx.beginPath();ctx.arc(enemy.x+Math.cos(a)*radius*.7,enemy.y-radius+Math.sin(a)*4,3.5,0,Math.PI*2);ctx.fill()} }
  if (enemy.poison > 0) { ctx.fillStyle='#a8ed65';for(let i=0;i<2;i++){const a=performance.now()/260+i*3;ctx.beginPath();ctx.arc(enemy.x+Math.cos(a)*radius,enemy.y+Math.sin(a)*radius,3,0,Math.PI*2);ctx.fill()} }
  const width = statuses.length * 18;
  statuses.forEach(([,label,color],index) => { const x=enemy.x-width/2+index*18+9,y=enemy.y-radius-23;ctx.fillStyle='rgba(28,39,34,.86)';ctx.beginPath();ctx.arc(x,y,8,0,Math.PI*2);ctx.fill();ctx.fillStyle=color;ctx.font='900 9px Noto Sans SC';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,x,y); });
}
function draw() {
  const field = currentBattlefield(), path = currentPath();
  ctx.clearRect(0, 0, W, H); ctx.fillStyle = field.palette.grass; ctx.fillRect(0, 0, W, H); drawGrid(); drawScenery();
  ctx.lineCap = 'round'; ctx.lineWidth = 58; ctx.strokeStyle = field.palette.roadEdge; ctx.beginPath(); path.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.stroke();
  ctx.lineWidth = 48; ctx.strokeStyle = field.palette.road; ctx.beginPath(); path.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.stroke(); drawPathDetails();
  if (pendingDeployLevel || pendingDeployTowerIndex !== null) {
    ctx.save();
    for (let row=0;row<ROWS;row++) for(let col=0;col<COLS;col++) if(!isRoad(col,row)&&!occupied(col,row)){ctx.fillStyle='rgba(223,255,174,.2)';ctx.fillRect(col*CELL+4,row*CELL+4,CELL-8,CELL-8)}
    if(deployHover){const standby=pendingDeployTowerIndex!==null?standbyReserve[pendingDeployTowerIndex]:null,occupant=towers.find(t=>t.col===deployHover.col&&t.row===deployHover.row),seed=!standby&&pendingDeployLevel?towerFactory.create({col:deployHover.col,row:deployHover.row,level:pendingDeployLevel}):null,valid=!isRoad(deployHover.col,deployHover.row)&&(!occupant||canMergeTowers(occupant,seed)),p=center(deployHover);ctx.fillStyle=valid?'rgba(226,255,145,.72)':'rgba(211,65,53,.5)';ctx.fillRect(deployHover.col*CELL+4,deployHover.row*CELL+4,CELL-8,CELL-8);ctx.font='26px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(standby?evolution[standby.evo].icon:'🌰',p.x,p.y);ctx.fillStyle='#26382d';ctx.font='bold 10px Nunito';ctx.fillText(occupant&&valid?'合并':`Lv ${standby?standby.level:pendingDeployLevel}`,p.x,p.y+22)}
    ctx.restore();
  }
  drawFusionHint();
  if(selectedTower&&towers.includes(selectedTower)){const p=drag&&drag.tower===selectedTower?{x:drag.x,y:drag.y}:center(selectedTower),z=evolution[selectedTower.evo],r=currentAttackRadius(z);ctx.save();ctx.fillStyle=z.color+'22';ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();ctx.strokeStyle=z.color;ctx.lineWidth=3;ctx.stroke();ctx.restore()}
  if(cultivationTarget&&towers.includes(cultivationTarget)){const p=center(cultivationTarget);ctx.save();ctx.strokeStyle='#f0b83f';ctx.lineWidth=4;ctx.setLineDash([7,5]);ctx.beginPath();ctx.arc(p.x,p.y,30,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#8b631d';ctx.font='900 10px Nunito';ctx.textAlign='center';ctx.fillText('祭炼目标',p.x,p.y-34);ctx.restore()}
  if(drag){const col=Math.max(0,Math.min(COLS-1,Math.floor(drag.x/CELL))),row=Math.max(0,Math.min(ROWS-1,Math.floor(drag.y/CELL))),other=towers.find(t=>t!==drag.tower&&t.col===col&&t.row===row),valid=!isRoad(col,row)&&(!other||canMergeTowers(other,drag.tower)||canMergeTowers(drag.tower,other));ctx.save();ctx.fillStyle=valid?'rgba(229,255,178,.55)':'rgba(205,66,52,.38)';ctx.strokeStyle=valid?'#f5ffb2':'#ff8a78';ctx.lineWidth=3;ctx.fillRect(col*CELL+4,row*CELL+4,CELL-8,CELL-8);ctx.strokeRect(col*CELL+5.5,row*CELL+5.5,CELL-11,CELL-11);ctx.restore()}
  towers.forEach(t => { const p=drag&&drag.tower===t?{x:drag.x,y:drag.y}:center(t), z=evolution[t.evo];ctx.save();if(drag&&drag.tower===t){ctx.shadowColor='rgba(35,60,40,.35)';ctx.shadowBlur=16;ctx.shadowOffsetY=8}ctx.fillStyle='rgba(49,89,44,.22)';ctx.beginPath();ctx.ellipse(p.x,p.y+13,27,12,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=z.color;ctx.beginPath();ctx.arc(p.x,p.y,t.evo==='base'?20:23,0,7);ctx.fill();if(t.evo!=='base'){ctx.strokeStyle='#fff9';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,18,0,7);ctx.stroke()}const art=hasPrimaryEvolutionArt(t)&&primaryEvolutionImages[t.evo];if(art){ctx.save();ctx.beginPath();ctx.arc(p.x,p.y,22,0,Math.PI*2);ctx.clip();ctx.drawImage(art,p.x-25,p.y-25,50,50);ctx.restore()}else{ctx.font=t.evo==='base'?'24px serif':'27px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(z.icon,p.x,p.y)}ctx.fillStyle='#26382d';roundedRect(p.x-20,p.y+24,40,16,8);ctx.fill();ctx.fillStyle='#fff';ctx.font='bold 10px Nunito';ctx.fillText(`Lv ${t.level}`,p.x,p.y+32);ctx.restore(); });
  enemies.forEach(e=>{const type=e.definition||enemyTypes[e.type],r=e.radius||15,primary=enemyTraits[e.traits[0]]||{color:'#748079'};ctx.save();ctx.fillStyle=primary.color;ctx.beginPath();ctx.arc(e.x,e.y,r,0,7);ctx.fill();if(e.type!=='normal'){ctx.strokeStyle=e.type==='boss'?'#ffd05a':'#eadfff';ctx.lineWidth=3;ctx.stroke()}if(e.shield>0){ctx.strokeStyle='rgba(126,222,255,.9)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(e.x,e.y,r+5,0,Math.PI*2*(e.shield/e.maxShield));ctx.stroke()}if(e.knockback>0){ctx.strokeStyle='#f1bf62';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(e.x+r+6,e.y-8);ctx.lineTo(e.x+r+22,e.y-8);ctx.moveTo(e.x+r+8,e.y);ctx.lineTo(e.x+r+28,e.y);ctx.moveTo(e.x+r+6,e.y+8);ctx.lineTo(e.x+r+22,e.y+8);ctx.stroke()}if(e.stun>0){ctx.strokeStyle='#ffe76b';ctx.lineWidth=3;ctx.beginPath();ctx.arc(e.x,e.y-r-10,9,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#ffe76b';for(let i=0;i<4;i++){const a=performance.now()/220+i*Math.PI/2;ctx.fillRect(e.x+Math.cos(a)*14-2,e.y-r-10+Math.sin(a)*14-2,4,4)}}if(e===selectedEnemy){ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(e.x,e.y,r+8,0,7);ctx.stroke()}ctx.fillStyle='#fff';ctx.font=`bold ${e.type==='boss'?20:14}px Nunito`;ctx.textAlign='center';ctx.fillText(e.kind,e.x,e.y+1);ctx.fillRect(e.x-r,e.y-r-9,r*2,5);ctx.fillStyle=e.type==='boss'?'#e5a52b':e.type==='elite'?'#9a72db':primary.color;ctx.fillRect(e.x-r,e.y-r-9,r*2*Math.max(0,e.hp/e.max),5);ctx.fillStyle='#3b2d2a';ctx.font='bold 10px Nunito';const traitText=e.traits.length?e.traits.map(key=>enemyTraits[key].icon).join('·'):'无';ctx.fillText(`${type.name||type.label} ${traitText}`,e.x,e.y+r+13);const markerX=e.x-(e.traits.length*7-2)/2;e.traits.forEach((key,i)=>{ctx.fillStyle=enemyTraits[key].color;ctx.fillRect(markerX+i*7,e.y+r+17,5,5)});drawEnemyStatuses(e,r);ctx.restore()});
  drawAttackEvents();
  drawProjectiles();
  hits.forEach(p=>{ctx.save();ctx.globalAlpha=p.life;if(p.type==='text'||p.type==='statusText'){ctx.fillStyle=p.color;ctx.strokeStyle='rgba(25,35,30,.8)';ctx.lineWidth=3;ctx.font=p.type==='statusText'?'900 13px Noto Sans SC':'900 17px Nunito';ctx.textAlign='center';ctx.strokeText(p.label,p.x,p.y-p.life*18);ctx.fillText(p.label,p.x,p.y-p.life*18)}else if(p.type==='surge'){ctx.strokeStyle='#ffbd45';ctx.lineWidth=18*p.life;ctx.beginPath();ctx.arc(W/2,H/2,(1-p.life)*650,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#fff4a8';ctx.lineWidth=5;ctx.stroke()}else{ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,4,4)}ctx.restore()});
  if(screenFlash>0){ctx.fillStyle=`rgba(255,226,116,${screenFlash*.38})`;ctx.fillRect(0,0,W,H)}
}
function unleashSurge() {
  if (surgeCharge < 100 || paused) return;
  const targets = enemies.filter(enemy => !enemy.dead);
  if (!targets.length) { $('message').textContent = '当前没有可打击的目标。'; return; }
  surgeCharge = 0; screenFlash = 1; hits.push({type:'surge',life:1}); audioBus.play(110,.5,'sawtooth',.05); audioBus.play(440,.7,'sine',.035);
  const source = selectedTower || towers[0];
  targets.forEach(enemy => { enemy.hp -= enemy.max * .28; applyEnemyStatus(enemy, 'stun', 1.2); burst(enemy.x,enemy.y,'#ffbd45'); if(enemy.hp<=0) damageTarget(source,enemy,{...evolution[source.evo],damage:0}); });
  score += targets.length * 60; $('message').textContent = `橙光席卷战场，命中 ${targets.length} 个目标！`; ui();
}
function drawFallback() {
  const field = currentBattlefield(), path = currentPath();
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = field.palette.grass; ctx.fillRect(0, 0, W, H);
  ctx.lineCap = 'round'; ctx.lineWidth = 58; ctx.strokeStyle = field.palette.roadEdge; ctx.beginPath(); path.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.stroke();
  ctx.lineWidth = 46; ctx.strokeStyle = field.palette.road; ctx.beginPath(); path.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.stroke();
  towers.forEach(tower => { const p = center(tower), data = evolution[tower.evo]; ctx.fillStyle = data.color; ctx.beginPath(); ctx.arc(p.x,p.y,22,0,Math.PI*2); ctx.fill(); const art=hasPrimaryEvolutionArt(tower)&&primaryEvolutionImages[tower.evo]; if(art){ctx.save();ctx.beginPath();ctx.arc(p.x,p.y,22,0,Math.PI*2);ctx.clip();ctx.drawImage(art,p.x-25,p.y-25,50,50);ctx.restore();}else{ctx.fillStyle='#fff';ctx.font='22px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(data.icon,p.x,p.y);} });
  enemies.forEach(enemy => { ctx.fillStyle='#5e6f66';ctx.beginPath();ctx.arc(enemy.x,enemy.y,enemy.radius||14,0,Math.PI*2);ctx.fill(); });
}
function completeWave() {
  running = false;
  const completedWave = wave;
  const reward = Math.round((gameSession.currentWave?.reward || 20 + wave * 4) * currentBattlefield().reward);
  gainSpirit(reward);
  const result = gameSession.completeWave({ finalEvolution: finalWave });
  if (result.won) { gameWon = true; $('message').textContent = gameSession.isFinite ? `${gameSession.level.name}完成，甜橙谷的道路继续向前！` : '最终进化守住了甜橙谷，你胜利了！'; $('waveBtn').textContent = '重新开始'; score += 5000; ui(); return; }
  wave = gameSession.waveNumber;
  intermissionSummary = autoCultivateAfterWave();
  nextWaveTimer = 4;
  $('waveBtn').disabled = false; $('waveBtn').innerHTML = `提前开第 ${wave} 波 <span>▶</span>`;
  $('message').textContent = `第 ${completedWave} 波结算：${intermissionSummary}。${nextWaveTimer.toFixed(1)} 秒后自动开波。`; ui();
}
function update(dt) {
  screenFlash = Math.max(0, screenFlash - dt * 2.8);
  comboTimer = Math.max(0, comboTimer - dt); if (!comboTimer) combo = 0;
  if (started && !running && !gameWon && lives > 0 && nextWaveTimer > 0) {
    nextWaveTimer -= dt;
    $('message').textContent = `${intermissionSummary} · ${Math.max(0, nextWaveTimer).toFixed(1)} 秒后自动进入第 ${wave} 波。`;
    if (nextWaveTimer <= 0) startWave();
  }
  if (running) {
    spawnTimer -= dt;
    if (spawned < waveSize() && spawnTimer <= 0) {
      addEnemy();
      spawned++;
      // Keep each unit at least one body length behind the unit ahead.
      spawnTimer = gameSession.currentWave.spawnInterval;
    }
    if (spawned >= waveSize() && enemies.length === 0) completeWave();
  }
  enemies.forEach(enemy => enemy.update(dt, {
    positionAt: pointAt, pathLength: currentPathLength(),
    onDotLethal: (source, target) => damageTarget(source, target, { ...evolution[source.evo], damage: 0 }),
    onEscape: target => { lives = gameSession.loseLife(target.lifeCost); ui(); }
  }));
  maintainEnemySpacing();
  updateAttackEvents(dt);
  updateProjectiles(dt);
  const combatContext = towerCombatContext();
  towers.forEach(tower => { if (tower.updateCombat(dt, combatContext).length) ui(); });
  enemies=enemies.filter(e=>!e.dead&&e.hp>0);hits.forEach(p=>{p.life-=dt;if(!p.type){p.x+=p.vx*dt;p.y+=p.vy*dt}});hits=hits.filter(p=>p.life>0);
  if(lives<=0&&running){running=false;started=false;$('message').textContent='森林失守了，再试一次吧！';$('waveBtn').disabled=false;$('waveBtn').textContent='重新开始'}
}
function loop(ts){const dt=Math.min(.05,(ts-last)/1000||0);last=ts;if(!paused)update(dt*speed);try{draw()}catch(error){console.error('地图绘制已切换至兼容模式',error);drawFallback()}requestAnimationFrame(loop)}
function pointerCell(e){const r=canvas.getBoundingClientRect();return{col:Math.max(0,Math.min(COLS-1,Math.floor((e.clientX-r.left)*W/r.width/CELL))),row:Math.max(0,Math.min(ROWS-1,Math.floor((e.clientY-r.top)*H/r.height/CELL)))}}
function pointerPosition(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height}}
canvas.addEventListener('pointerdown',e=>{const c=pointerCell(e),p=pointerPosition(e);if(pendingDeployLevel||pendingDeployTowerIndex!==null){deployReserve(c.col,c.row);return}const tower=towers.find(t=>t.col===c.col&&t.row===c.row);if(tower){
  if(cultivationTarget){ if(tower === cultivationTarget) cancelCultivation(); else { sacrificeTower(cultivationTarget, tower); ui(); } return; }
  selectedEnemy=null;selectedTower=tower;setCommandTab('tower');drag={tower,x:p.x,y:p.y,origin:{col:tower.col,row:tower.row}};canvas.setPointerCapture(e.pointerId);ui();return
}if(cultivationTarget){cancelCultivation();return}const enemy=[...enemies].reverse().find(item=>Math.hypot(item.x-p.x,item.y-p.y)<=item.radius+7);if(enemy){selectedEnemy=enemy;selectedTower=null;ui()}});
canvas.addEventListener('pointermove',e=>{if(pendingDeployLevel||pendingDeployTowerIndex!==null){deployHover=pointerCell(e);return}if(!drag)return;const r=canvas.getBoundingClientRect();drag.x=(e.clientX-r.left)*W/r.width;drag.y=(e.clientY-r.top)*H/r.height});
canvas.addEventListener('pointerleave',()=>{deployHover=null});
canvas.addEventListener('contextmenu',event=>{if(!pendingDeployLevel&&pendingDeployTowerIndex===null)return;event.preventDefault();pendingDeployLevel=null;pendingDeployTowerIndex=null;deployHover=null;$('message').textContent='已取消部署。';ui()});
canvas.addEventListener('pointerup', () => {
  if (!drag) return;
  const tower = drag.tower;
  const col = Math.max(0, Math.min(COLS - 1, Math.floor(drag.x / CELL)));
  const row = Math.max(0, Math.min(ROWS - 1, Math.floor(drag.y / CELL)));
  tower.relocate(col, row);
  const other = towers.find(item => item !== tower && item.col === col && item.row === row);
  if (isRoad(col, row)) {
    tower.relocate(drag.origin.col, drag.origin.row);
    $('message').textContent = '道路无法部署守卫。';
  } else if (other && mergeTowers(other, tower)) {
    lastMergeSnapshot = null;
  } else if (other) {
    tower.relocate(drag.origin.col, drag.origin.row);
    $('message').textContent = other.level !== tower.level ? '只有同等级守卫才能合成。' : '必须是完全相同的守卫形态和进化分支。';
  }
  if (tower.col !== drag.origin.col || tower.row !== drag.origin.row) lastMergeSnapshot = null;
  delete drag.origin; drag = null; tryFiveFusion(); tryTaijiFusion(); tryHiddenFusions(); ui();
});
canvas.addEventListener('pointercancel',()=>{if(!drag)return;drag.tower.col=drag.origin.col;drag.tower.row=drag.origin.row;drag=null;ui()});
function openEvolution(stage = 'branch') { const primary = stage === 'primary'; evolutionDecision = evolutionTree.begin(pendingEvolution, stage); const choices = evolutionDecision ? evolutionDecision.choices(primary ? routes : (branchKeys[pendingEvolution?.evolutionPath] || [])) : []; const dialog = document.querySelector('.evo-dialog'); const modal = $('evoModal'); const hasRare = choices.some(key => evolution[key].rare); if (!choices.length) { $('message').textContent = '当前进化树没有可用分支。'; return; } if (!modal.classList.contains('show')) evolutionWasPaused = paused; paused = true; $('pauseBtn').textContent = '▶'; $('evoTitle').textContent = primary ? 'Lv.5 · 选择进化主路线' : `Lv.10 · 选择${evolution[pendingEvolution?.evolutionPath]?.name || ''}分支`; $('rareBanner').hidden = !hasRare; dialog.classList.toggle('has-rare', hasRare); $('evoChoices').innerHTML = choices.map(key => { const route = evolution[key]; const rarity = primary ? (route.rare ? '稀有主路线' : '五行主路线') : '专属分支'; const stats = `伤害 ${route.damage} / 等级 · 射程 ${route.rangeCells} 格 · 攻速 ${(1 / route.rate).toFixed(1)}/秒`; return `<button class="${route.rare ? 'rare-route' : ''}" data-route="${key}" data-route-key="${key}">${route.rare ? '<span class="rare-badge">稀有</span>' : ''}<strong>${route.icon} ${route.name}</strong><small><b>${rarity}</b><br>${route.desc}</small><span class="evo-stats">${stats}</span><span class="evo-effect">${attackModeNames[route.attackMode]} · ${effectNames[route.effect] || '无附加效果'}</span><small>${primary ? 'Lv.10 解锁专属分支' : `终点：${route.ultimate}`}</small></button>`; }).join(''); document.querySelectorAll('[data-route]').forEach(button => button.onclick = () => chooseEvolution(button.dataset.route)); modal.classList.add('show'); modal.setAttribute('aria-hidden','false'); document.body.classList.add('modal-open'); }
function closeEvolution(){ $('evoModal').classList.remove('show');$('evoModal').setAttribute('aria-hidden','true');document.body.classList.remove('modal-open');paused=evolutionWasPaused;$('pauseBtn').textContent=paused?'▶':'Ⅱ'; }
function chooseEvolution(route){ const t = pendingEvolution; if (!t || !evolutionDecision) return; const stage = pendingEvolutionStage; const result = evolutionDecision.commit(route); if (!result.ok) { $('message').textContent = '这条进化分支当前不可用，请重新选择。'; return; } audioBus.evolve(); discoveredEvolutions.add(route); if (stage === 'primary' && t.level >= 10) { pendingEvolutionStage = 'branch'; openEvolution('branch'); return; } pendingEvolution = null; pendingEvolutionStage = null; evolutionDecision = null; closeEvolution(); $('message').textContent = stage === 'primary' ? `已进化为${evolution[route].name}，Lv.10 时解锁该路线的专属分支。` : `分支已确定：${evolution[t.evo].name}`; tryFiveFusion(); tryTaijiFusion(); tryHiddenFusions(); ui(); }
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
  if (running) { $('message').textContent = '自动整编仅在整备阶段开放。'; return; }
  if (pendingEvolution) { $('message').textContent = '请先完成当前守卫的进化选择。'; return; }
  let merged = 0;
  const before = towers.map(tower => tower.snapshot());
  while (true) {
    let pair = null;
    const candidates = [];
    for (let i = 0; i < towers.length; i++) for (let j = i + 1; j < towers.length; j++) {
      const left = towers[i], right = towers[j], keeper = left.level >= right.level ? left : right;
      if (mergeNeedsChoice(keeper)) continue;
      if (canMergeTowers(left, right) || canMergeTowers(right, left)) candidates.push({ left, right, resonance: left.level === right.level });
    }
    candidates.sort((a, b) => Number(b.resonance) - Number(a.resonance) || b.left.level + b.right.level - (a.left.level + a.right.level));
    if (candidates.length) pair = [candidates[0].left, candidates[0].right];
    if (!pair) break;
    const [keeper, consumed] = pair;
    if (!mergeTowers(keeper, consumed)) break;
    merged++;
  }
  lastMergeSnapshot = merged ? before : null;
  const decisions = towers.filter(tower => mergeNeedsChoice(tower) && towers.some(other => other !== tower && canMergeTowers(tower, other))).length / 2;
  $('message').textContent = merged ? `自动整编完成，共处理 ${merged} 组${decisions ? `；另有 ${Math.ceil(decisions)} 组需手动确认进化` : ''}。` : decisions ? `有 ${Math.ceil(decisions)} 组即将进化，请拖拽重叠或从灵种仓注入确认。` : '当前没有可自动整编的同形态守卫。';
  ui();
}
function undoAutoMerge() {
  if (!lastMergeSnapshot || pendingEvolution) return;
  towers = lastMergeSnapshot.map(state => towerFactory.create(state));
  lastMergeSnapshot = null; selectedTower = null; selectedEnemy = null;
  $('message').textContent = '已撤销上一次一键合成。';
  ui();
}
function startWave(){if(!gameSession.startWave())return;started=true;nextWaveTimer=0;cultivationTarget=null;intermissionSummary='';activeCultivationPolicy=cultivationPolicy;activeCultivationCore=cultivationCore;wave=gameSession.waveNumber;spawned=0;kills=0;combo=0;comboTimer=0;currentWaveEvent=contentRegistry.events.get(gameSession.currentWave.eventKey);running=true;spawnTimer=0;$('waveBtn').disabled=true;$('waveBtn').textContent='自动波次中';$('waveEvent').innerHTML=`<b>${currentWaveEvent.icon} ${currentWaveEvent.name}</b><small>${currentWaveEvent.desc}</small>`;const traitKey=waveTrait(),trait=traitKey?enemyTraits[traitKey]:null;$('message').textContent=trait?(finalWave?`最终决战开始！本波主属性：${trait.label}`:`第 ${wave} 波主属性：${trait.label} · ${currentWaveEvent.name}`):`第 ${wave} 波：${currentWaveEvent.name}。`;ui()}
function startMode(modeKey, levelKey = null){gameSession.reset({modeKey,levelKey,mapKey:gameSession.map.key});resetGame();selectedModeKey=modeKey;if(levelKey)selectedLevelKey=levelKey;setText('modeEntryText',gameSession.level?gameSession.level.name:gameSession.mode.name);setText('modeSubtitle',`森林守卫 · ${gameSession.level?.name || gameSession.mode.name}`);$('message').textContent=gameSession.level?`已进入${gameSession.level.name}，共 ${gameSession.level.waves.length} 波。`:`已进入${gameSession.mode.name}`;ui();return gameSession.snapshot()}
function navigatePage(pageKey) {
  const pages = { hub: $('hubPage'), campaign: $('campaignPage'), battle: $('battlePage') };
  Object.entries(pages).forEach(([key, page]) => { if (page) page.hidden = key !== pageKey; });
  if (document.body.dataset) document.body.dataset.page = pageKey;
  if (pageKey !== 'battle') paused = true;
}
function renderChapterGrid() {
  const grid = $('chapterGrid');
  if (!grid) return;
  grid.innerHTML = contentRegistry.levels.values().map((level, index) => {
    const map = contentRegistry.maps.get(level.mapKey), boss = level.waves.at(-1)?.boss;
    const bossName = boss ? enemyArchetypes[boss]?.name || boss : '无';
    return `<button class="chapter-card" data-chapter="${level.key}" style="--map-grass:${map.palette.grass};--map-road:${map.palette.road};--map-road-edge:${map.palette.roadEdge}"><span class="chapter-map-preview"><span>${map.icon}</span></span><span class="chapter-card-copy"><span class="chapter-index">CHAPTER ${String(index + 1).padStart(2, '0')}</span><h3>${level.name}</h3><p>${map.name} · ${map.desc}</p><span class="chapter-meta"><span>${level.waves.length} 波</span><span>${level.startingLives} 生命</span><span>${bossName}</span></span><em>进入战场 →</em></span></button>`;
  }).join('');
  grid.querySelectorAll('[data-chapter]').forEach(button => button.onclick = () => {
    startMode('campaign', button.dataset.chapter); paused = false; navigatePage('battle');
  });
}
function leaveBattle() { paused = true; running = false; gameSession.abandon(); navigatePage('hub'); }
if ($('fieldBtn')) $('fieldBtn').onclick=()=>{if(running||gameSession.mode.levelRequired)return;const unlocked=battlefields.filter(item=>item.unlock<=wave);if(unlocked.length<2)return;const current=unlocked.indexOf(currentBattlefield());battlefieldIndex=(current+1)%unlocked.length;gameSession.selectMap(currentBattlefield().key);$('message').textContent=`已切换至${currentBattlefield().name}：${currentBattlefield().desc}`;screenFlash=.25;ui()};
$('waveBtn').onclick=()=>{if(lives<=0||gameWon){resetGame();started=true;startWave();return}if(!running){started=true;cultivationTarget=null;startWave()}};
$('pauseBtn').onclick=()=>{if(!started||gameWon)return;paused=!paused;$('pauseBtn').textContent=paused?'▶':'Ⅱ';$('message').textContent=paused?'游戏已暂停':'游戏继续';ui()};
$('speedBtn').onclick=()=>{speed=speed===1?2:speed===2?3:1;$('speedBtn').textContent=`${speed}×`};
$('recallBtn').onclick=recallSelectedTower;
if ($('cultivateBtn')) $('cultivateBtn').onclick=beginCultivation;
$('mergeBtn').onclick=autoMerge;
$('undoMergeBtn').onclick=undoAutoMerge;
$('surgeBtn').onclick=unleashSurge;
$('soundBtn').onclick=()=>{runtime.soundEnabled=!runtime.soundEnabled;$('soundBtn').textContent=runtime.soundEnabled?'🔊':'🔇';if(runtime.soundEnabled)audioBus.play(520,.08,'sine',.03)};
$('modeEntryBtn').onclick=leaveBattle;
$('hubEndlessBtn').onclick=()=>{startMode('endless');paused=false;navigatePage('battle')};
$('hubCampaignBtn').onclick=()=>navigatePage('campaign');
$('campaignBackBtn').onclick=()=>navigatePage('hub');
$('battleBackBtn').onclick=leaveBattle;
$('mapRecallBtn').onclick=recallSelectedTower;
$('mapCultivateBtn').onclick=beginCultivation;
$('mapCancelCultivationBtn').onclick=cancelCultivation;
$('mapInfuseBtn').onclick=infuseReserveToMilestone;
$('mapCoreBtn').onclick=assignCultivationCore;
document.querySelectorAll('[data-command-tab]').forEach(button => button.onclick = () => setCommandTab(button.dataset.commandTab));
const hubSoundButton=document.querySelector('.hub-sound-btn');if(hubSoundButton)hubSoundButton.onclick=()=>$('soundBtn').click();
window.addEventListener('keydown',event=>{if(event.key==='Escape'&&cultivationTarget){cancelCultivation();return}if(event.key==='Escape'&&(pendingDeployLevel||pendingDeployTowerIndex!==null)){pendingDeployLevel=null;pendingDeployTowerIndex=null;deployHover=null;$('message').textContent='已取消部署。';ui();return}if(event.code==='Space'&&!event.repeat&&!pendingEvolution){event.preventDefault();unleashSurge()}if(event.key.toLowerCase()==='p'&&!event.repeat)$('pauseBtn').click()});
window.GameApp = Object.freeze({
  startMode,
  navigatePage,
  modes: () => contentRegistry.modes.values(),
  levels: () => contentRegistry.levels.values(),
  maps: () => contentRegistry.maps.values(),
  session: () => gameSession.snapshot()
});
renderChapterGrid();resetGame();ui();navigatePage('hub');requestAnimationFrame(loop);
