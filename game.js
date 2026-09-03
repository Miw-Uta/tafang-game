const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);
const setText = (id, value) => { const node = $(id); if (node) node.textContent = value; };
const W = 960, H = 540, CELL = 60, COLS = 16, ROWS = 9, MAX_LEVEL = 20;
const DEPLOY_LIMIT = 8;
const growthModes = GameContent.growthModes;
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
const primaryEvolutionLayers = {};
const primaryEvolutionLayerSpecs = Object.freeze({
  metal: [
    { name: 'head', pivot: [1024, 1220], points: [[300, 230], [1720, 230], [1800, 1220], [1600, 1370], [430, 1370], [250, 1160]] },
    { name: 'leftLeg', pivot: [760, 1650], points: [[570, 1570], [1010, 1570], [1010, 2048], [570, 2048]] },
    { name: 'rightLeg', pivot: [1280, 1650], points: [[1035, 1570], [1480, 1570], [1480, 2048], [1035, 2048]] },
    { name: 'leftArm', pivot: [620, 1320], points: [[430, 1200], [610, 1190], [785, 1435], [745, 1665], [535, 1690], [405, 1500]] },
    { name: 'rightArm', pivot: [1428, 1320], points: [[1420, 1190], [1600, 1200], [1640, 1500], [1510, 1690], [1300, 1665], [1263, 1435]] }
  ],
  fire: [],
  earth: [
    { name: 'leftLeg', pivot: [760, 1630], points: [[560, 1540], [1010, 1540], [1010, 2048], [560, 2048]] },
    { name: 'rightLeg', pivot: [1280, 1630], points: [[1035, 1540], [1490, 1540], [1490, 2048], [1035, 2048]] },
    { name: 'leftArm', pivot: [480, 1250], points: [[180, 1120], [485, 1100], [690, 1350], [570, 1650], [245, 1600]] },
    { name: 'rightArm', pivot: [1568, 1250], points: [[1563, 1100], [1868, 1120], [1803, 1600], [1478, 1650], [1358, 1350]] }
  ],
  water: [
    { name: 'leftFoot', pivot: [760, 1600], points: [[560, 1510], [1010, 1510], [1010, 2048], [560, 2048]] },
    { name: 'rightFoot', pivot: [1280, 1600], points: [[1035, 1510], [1490, 1510], [1490, 2048], [1035, 2048]] },
    { name: 'leftFin', pivot: [470, 1210], points: [[190, 1080], [475, 1060], [700, 1360], [565, 1615], [250, 1570]] },
    { name: 'rightFin', pivot: [1578, 1210], points: [[1573, 1060], [1858, 1080], [1798, 1570], [1483, 1615], [1348, 1360]] }
  ],
  wood: [
    { name: 'leftFoot', pivot: [760, 1660], points: [[560, 1570], [1010, 1570], [1010, 2048], [560, 2048]] },
    { name: 'rightFoot', pivot: [1280, 1660], points: [[1035, 1570], [1490, 1570], [1490, 2048], [1035, 2048]] },
    { name: 'leftBranch', pivot: [475, 1320], points: [[255, 1190], [505, 1170], [735, 1450], [625, 1690], [305, 1630]] },
    { name: 'rightBranch', pivot: [1573, 1320], points: [[1543, 1170], [1793, 1190], [1743, 1630], [1423, 1690], [1313, 1450]] },
    { name: 'topSprout', pivot: [1024, 420], points: [[500, 160], [1550, 160], [1540, 650], [500, 650]] }
  ]
});
function buildPrimaryEvolutionLayers(source, key) {
  const specs = primaryEvolutionLayerSpecs[key], width = source.width || source.naturalWidth, height = source.height || source.naturalHeight;
  if (!specs || !width || !height || !document.createElement) return null;
  const base = document.createElement('canvas'), baseContext = base.getContext?.('2d');
  if (!baseContext) return null;
  base.width = width; base.height = height; baseContext.drawImage(source, 0, 0);
  const layers = specs.map(spec => {
    const layer = document.createElement('canvas'), layerContext = layer.getContext?.('2d');
    if (!layerContext) return null;
    layer.width = width; layer.height = height;
    layerContext.save();
    layerContext.beginPath();
    spec.points.forEach(([x, y], index) => index ? layerContext.lineTo(x, y) : layerContext.moveTo(x, y));
    layerContext.closePath(); layerContext.clip(); layerContext.drawImage(source, 0, 0); layerContext.restore();
    baseContext.save();
    baseContext.globalCompositeOperation = 'destination-out';
    baseContext.beginPath();
    spec.points.forEach(([x, y], index) => index ? baseContext.lineTo(x, y) : baseContext.moveTo(x, y));
    baseContext.closePath(); baseContext.fill(); baseContext.restore();
    return { ...spec, canvas: layer };
  }).filter(Boolean);
  return { base, layers, width, height };
}
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
      primaryEvolutionLayers[key] = buildPrimaryEvolutionLayers(buffer, key);
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
  metal: { name: '金锋守卫', icon: '⚔️', color: '#c99b36', damage: 52, rangeCells: 3, rate: .78, attackMode: 'single', effect: 'stun', desc: '近距离单体重击，擅长击破精英与首领', ultimate: '天罡金刃' },
  wood: { name: '青木守卫', icon: '🌿', color: '#4f9d50', damage: 20, rangeCells: 5, rate: .55, attackMode: 'pierce', effect: 'weaken', desc: '藤蔓穿刺多名敌人，并瓦解重甲', ultimate: '万象神木' },
  water: { name: '玄水守卫', icon: '💧', color: '#399dc4', damage: 15, rangeCells: 5, rate: .42, attackMode: 'chain', effect: 'slow', desc: '链式水流压制高速敌群', ultimate: '沧澜水灵' },
  fire: { name: '赤焰守卫', icon: '🔥', color: '#d95832', damage: 24, rangeCells: 3, rate: .68, attackMode: 'splash', effect: 'burn', desc: '范围灼烧成群敌人，但持续伤害会被再生抵消', ultimate: '焚天炎皇' },
  earth: { name: '厚土守卫', icon: '🪨', color: '#9c754d', damage: 66, rangeCells: 3, rate: 1.05, attackMode: 'single', effect: 'stun', desc: '极慢重击，专门拦截精英并短暂击退', ultimate: '镇岳地灵' },
  yin: { name: '幽阴守卫', icon: '🌑', color: '#625b9d', damage: 18, rangeCells: 5, rate: .44, attackMode: 'chain', effect: 'silence', desc: '稀有：压制高速敌群，但不擅长重甲目标', ultimate: '太阴冥主', rare: true },
  yang: { name: '耀阳守卫', icon: '☀️', color: '#edaf31', damage: 25, rangeCells: 5, rate: .62, attackMode: 'splash', effect: 'burn', desc: '稀有：远程灼烧大范围敌群，但不擅长再生目标', ultimate: '大日神辉', rare: true },
  wind: { name: '御风守卫', icon: '🌪️', color: '#62aeb0', damage: 17, rangeCells: 5, rate: .4, attackMode: 'pierce', effect: 'slow', desc: '稀有：快速贯穿并控制狭长敌阵', ultimate: '九霄风君', rare: true },
  thunder: { name: '惊雷守卫', icon: '⚡', color: '#8466cf', damage: 20, rangeCells: 5, rate: .42, attackMode: 'chain', effect: 'stun', desc: '稀有：连锁破盾并短暂麻痹敌人', ultimate: '紫霄雷帝', rare: true },
  fiveSpirit: { name: '五灵塔', icon: '🌀', color: '#f2a83b', damage: 60, rangeCells: 7, rate: .46, attackMode: 'omni', effect: 'fiveElements', desc: '五行共鸣，以覆盖面和复合状态支援全场', ultimate: '五灵归一', fusion: true },
  taiji: { name: '太极塔', icon: '☯️', color: '#252832', damage: 92, rangeCells: 7, rate: .42, attackMode: 'omni', effect: 'taiji', desc: '阴阳归一，全域施加易伤并协助阵容集火', ultimate: '太极无极', fusion: true },
  emberwood: { name: '焚木共鸣塔', icon: '🌋', color: '#c85d32', damage: 70, rangeCells: 5, rate: .52, attackMode: 'splash', effect: 'burn', desc: '火木共鸣，大范围清理密集敌群', ultimate: '焚木天灾', fusion: true, hidden: true },
  froststorm: { name: '霜雷塔', icon: '🌩️', color: '#5f9dd0', damage: 70, rangeCells: 6, rate: .42, attackMode: 'chain', effect: 'freeze', desc: '水风雷共振，牺牲爆发换取链式冻结', ultimate: '霜雷寂灭', fusion: true, hidden: true },
  voidstar: { name: '虚空星塔', icon: '✦', color: '#7352a8', damage: 58, rangeCells: 7, rate: .5, attackMode: 'omni', effect: 'poison', desc: '阴阳交错，全域毒蚀普通敌群，但会被再生抵消', ultimate: '星陨虚界', fusion: true, hidden: true },
  ironwood: { name: '玄铁神木塔', icon: '🪵', color: '#607d45', damage: 55, rangeCells: 5, rate: .62, attackMode: 'pierce', effect: 'weaken', desc: '金土木叠合，贯穿重甲阵线并持续破甲', ultimate: '万古森罗', fusion: true, hidden: true }
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
const attackModeBudget = Object.freeze({ single: 1, chain: 2.2, pierce: 2.8, splash: 3, omni: 5 });
const branchProfiles = [
  { attackMode: 'single', effect: 'weaken', power: 1.32, range: 0, rate: 1.05 },
  { attackMode: 'splash', effect: 'burn', power: 1.18, range: 0, rate: 1.12 },
  { attackMode: 'chain', effect: 'silence', power: 1.12, range: 2, rate: .9 },
  { attackMode: 'pierce', effect: 'slow', power: 1.14, range: 2, rate: .78 },
  { attackMode: 'single', effect: 'freeze', power: 1.2, range: 2, rate: 1.2 },
  { attackMode: 'chain', effect: 'stun', power: 1.18, range: 0, rate: .84 },
  { attackMode: 'splash', effect: 'poison', power: 1.14, range: 2, rate: .72 }
];
const branchKeys = Object.fromEntries(routes.map(parent => [parent, branchNames[parent].map((name, index) => {
  const key = `${parent}Branch${index + 1}`;
  const profile = branchProfiles[index];
  const rate = Math.max(.22, Number((evolution[parent].rate * profile.rate).toFixed(2)));
  const parentBudget = evolution[parent].damage / evolution[parent].rate * attackModeBudget[evolution[parent].attackMode];
  evolution[key] = {
    ...evolution[parent], ...profile, name, icon: branchIcons[parent][index],
    damage: Math.max(1, Math.round(parentBudget * profile.power * rate / attackModeBudget[profile.attackMode])),
    rangeCells: Math.max(3, evolution[parent].rangeCells + profile.range),
    rate,
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
const weaponNames = { seedshot:'橡果射手',boomerang:'回旋镖',rocket:'追踪火箭',waterjet:'连续水枪',scatter:'扇形散射',drill:'贯星钻头',meteor:'陨石轰炸',lightning:'连锁落雷',mine:'地脉地雷',sunbeam:'聚光日冕',shadowOrbit:'影刃环',quake:'大地震波' };
const weaponDescriptions = { seedshot:'稳定单体种子弹',boomerang:'去程与回程各有一次命中机会',rocket:'追踪目标并在落点爆炸',waterjet:'连续喷射，持续削弱前排',scatter:'扇形覆盖，多方向同时压制',drill:'沿攻击轴高速贯穿',meteor:'先预警落点，再造成大范围重击',lightning:'沿目标队列逐段跳跃',mine:'埋下后等待敌人踏入触发',sunbeam:'从天空持续灼射目标',shadowOrbit:'影刃环绕塔身，周期性切割近敌',quake:'地面震波并击退范围内敌人' };
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
const weaponProfiles = {
  base: 'seedshot', metal: 'boomerang', wood: 'drill', water: 'waterjet', fire: 'rocket', earth: 'quake',
  yin: 'shadowOrbit', yang: 'sunbeam', wind: 'scatter', thunder: 'lightning', fiveSpirit: 'meteor',
  taiji: 'shadowOrbit', emberwood: 'meteor', froststorm: 'waterjet', voidstar: 'shadowOrbit', ironwood: 'drill'
};
function weaponFor(key, data, lineage) {
  const branch = Number(key.match(/Branch(\d+)$/)?.[1] || 0);
  if (branch === 1) return lineage === 'metal' ? 'boomerang' : lineage === 'fire' ? 'rocket' : 'scatter';
  if (branch === 2) return lineage === 'fire' ? 'meteor' : lineage === 'earth' ? 'mine' : 'sunbeam';
  if (branch === 3) return lineage === 'water' ? 'waterjet' : 'lightning';
  if (branch === 4) return lineage === 'wood' ? 'drill' : 'scatter';
  if (branch === 5) return data.effect === 'freeze' ? 'waterjet' : 'rocket';
  if (branch === 6) return lineage === 'earth' ? 'quake' : 'lightning';
  if (branch === 7) return 'mine';
  return weaponProfiles[key] || weaponProfiles[lineage] || 'seedshot';
}
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
  data.combat = { ...profile, weapon: weaponFor(key, data, lineage), delivery: attackDelivery(key, data, lineage), ...(data.combat || {}), volley: Math.min(3, profile.volley + branchVolley) };
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
const battlefields = contentRegistry.maps.values();
const slotEffectTypes = Object.freeze({
  lookout: { name:'瞭望台',icon:'⌃',desc:'射程 +25%，伤害 -8%',range:1.25,damage:.92,cooldown:1,fill:'rgba(91,170,195,.2)',stroke:'#a9e8f1',text:'#23758b' },
  conduit: { name:'灵脉台',icon:'◆',desc:'伤害 +25%，攻击间隔 +12%',range:1,damage:1.25,cooldown:1.12,fill:'rgba(230,112,63,.2)',stroke:'#ffc07c',text:'#a14d24' },
  rapid: { name:'汇流台',icon:'»',desc:'攻速 +30%，射程 -12%',range:.88,damage:1,cooldown:.7,fill:'rgba(244,190,68,.2)',stroke:'#ffe18a',text:'#8a6410' },
  spring: { name:'灵泉台',icon:'✦',desc:'击杀额外获得 3 灵力，伤害 -15%',range:1,damage:.85,cooldown:1,spiritBonus:3,fill:'rgba(92,190,140,.2)',stroke:'#a8f0c6',text:'#24724d' }
});
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
const ENEMY_TRAVEL_SPEED = 48;

let towers, enemies, attackEvents, projectiles, hits, fxParticles, coins, lives, score, wave, kills, spawned;
let running, gameWon, finalWave, spawnTimer, drag, selectedTower, selectedEnemy, pendingEvolution, pendingEvolutionStage, evolutionDecision, evolutionWasPaused, nextWaveTimer, started, paused, speed, last, fiveAttemptSignature, discoveredEvolutions, currentWaveEvent, combo, comboTimer, surgeCharge, screenFlash, cameraShake, visualClock, battlefieldIndex, reserve, standbyReserve, pendingDeployLevel, pendingDeployTowerIndex, deployHover, growthMode, growthCycles, germinationOffers, mapObjects, mapUnlockedSlots, lastMergeSnapshot, intermissionSummary;
let selectedModeKey = 'endless', selectedLevelKey = contentRegistry.levels.keys()[0];

function resetGame() {
  gameSession.reset({ modeKey: gameSession.mode.key, levelKey: gameSession.level?.key || null, mapKey: gameSession.map.key });
  battlefieldIndex = battlefields.findIndex(field => field.key === gameSession.map.key);
  const initialSlot=currentBattlefield().initialSlot||[1,6];
  towers = [towerFactory.create({ col: initialSlot[0], row: initialSlot[1], level: 1 })];
  enemies = []; attackEvents = []; projectiles = []; hits = []; fxParticles = [];
  coins = 0; lives = gameSession.lives; score = 0; wave = gameSession.waveNumber; kills = 0; spawned = 0;
  running = false; gameWon = false; finalWave = false; spawnTimer = 0; drag = null; selectedTower = towers[0]; selectedEnemy = null; pendingEvolution = null; pendingEvolutionStage = null; evolutionDecision = null; evolutionWasPaused = false; nextWaveTimer = 0; started = false; paused = false; speed = 1; fiveAttemptSignature = null; discoveredEvolutions = new Set(); currentWaveEvent = contentRegistry.events.get(gameSession.currentWave.eventKey); combo = 0; comboTimer = 0; surgeCharge = 0; screenFlash = 0; cameraShake = 0; visualClock = 0; reserve = {}; standbyReserve = []; pendingDeployLevel = null; pendingDeployTowerIndex = null; deployHover = null; growthMode = 'balanced'; growthCycles = { sprout: 0, balanced: 0, refine: 0, total: 0 }; germinationOffers = []; mapObjects = createMapObjects(currentBattlefield()); mapUnlockedSlots = new Set(); lastMergeSnapshot = null; intermissionSummary = '';
}

function center(item) { return { x: item.col * CELL + CELL / 2, y: item.row * CELL + CELL / 2 }; }
function attackRadius(towerData) { return towerData.rangeCells * CELL * .6; }
function currentBattlefield() { return battlefields[battlefieldIndex] || battlefields[0]; }
function createMapObjects(field) {
  const specs = field.objectives || [];
  return specs.map((spec, index) => ({
    id: `${field.key}-${index}`, ...spec, x: spec.col * CELL + CELL / 2, y: spec.row * CELL + CELL / 2,
    max: spec.hp || 180, hp: spec.hp || 180, cleared: false, dead: false
  }));
}
function activeMapObjects() { return mapObjects.filter(object => !object.cleared && !object.dead && object.hp > 0); }
function mapObjectAt(col, row) { return activeMapObjects().find(object => object.col === col && object.row === row); }
function currentPaths() { return currentBattlefield().routes || [currentBattlefield().path]; }
function currentPath(index = 0) { return currentPaths()[index] || currentPaths()[0]; }
function pathLength(path) { return path.slice(1).reduce((sum,point,index)=>sum+Math.hypot(point[0]-path[index][0],point[1]-path[index][1]),0); }
function currentPathLength(index = 0) { return currentBattlefield().routeLengths?.[index] || pathLength(currentPath(index)); }
function currentAttackRadius(towerData,tower=null) { return attackRadius(towerData) * (currentWaveEvent?.range || 1) * currentBattlefield().range * (towerSlotEffect(tower)?.range||1) * (tower ? formationCombatModifiers(tower).range : 1); }
function segmentDistance(x, y, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy));
}
function terrainDefinition() { const field=currentBattlefield();return {type:field.terrainType||'grove',blocked:field.blockedCells||[]}; }
function routeWeightsForWave(waveNumber=wave){const plans=currentBattlefield().routePlan||[{from:1,weights:currentPaths().map(()=>1)}];return (plans.filter(plan=>plan.from<=waveNumber).at(-1)||plans[0]).weights;}
function routeUnlockWave(routeIndex){return currentBattlefield().routePlan?.find(plan=>(plan.weights[routeIndex]||0)>0)?.from||1;}
function routeIndexForSpawn(spawnIndex,waveNumber=wave){const weights=routeWeightsForWave(waveNumber),sequence=[];weights.forEach((weight,index)=>{for(let count=0;count<weight;count++)sequence.push(index)});return sequence[spawnIndex%Math.max(1,sequence.length)]||0;}
function isRouteOpen(routeIndex,waveNumber=wave){return (routeWeightsForWave(waveNumber)[routeIndex]||0)>0;}
function isTerrainBlocked(col, row) { return terrainDefinition().blocked.some(cell => cell[0] === col && cell[1] === row); }
function slotEffectAt(col,row){const slot=currentBattlefield().specialSlots?.find(item=>item.col===col&&item.row===row);return slot?slotEffectTypes[slot.type]||null:null;}
function towerSlotEffect(tower){return tower?slotEffectAt(tower.col,tower.row):null;}
function isRitualCell(col,row){const site=currentBattlefield().ritualSite;return Boolean(site&&Math.abs(col-site[0])<=1&&Math.abs(row-site[1])<=1);}
function shouldDrawBuildSlot(col,row,planning=false){return planning||Boolean(slotEffectAt(col,row))||isRitualCell(col,row);}
function cellRouteDistances(col,row) {
  const x = col * CELL + CELL / 2, y = row * CELL + CELL / 2;
  return currentPaths().map(path=>Math.min(...path.slice(1).map((point,index)=>segmentDistance(x,y,path[index],point))));
}
function cellRoadDistance(col,row) { return Math.min(...cellRouteDistances(col,row)); }
function isBuildSlot(col,row){return (currentBattlefield().buildSlots?.some(slot=>slot[0]===col&&slot[1]===row)||mapUnlockedSlots?.has(`${col},${row}`))&&!isTerrainBlocked(col,row)&&!mapObjectAt(col,row)&&cellRoadDistance(col,row)>=55;}
function isRoad(col, row) { return !isBuildSlot(col,row); }
function occupied(col, row, except = null) { return towers.some(t => t !== except && t.col === col && t.row === row) || mapObjects.some(object => !object.cleared && object.col === col && object.row === row); }
function fitTowersToBattlefield() {
  let moved=0;
  towers.forEach(tower=>{
    if(!isRoad(tower.col,tower.row))return;
    const candidates=[];
    for(let row=0;row<ROWS;row++)for(let col=0;col<COLS;col++)if(!isRoad(col,row)&&!occupied(col,row,tower))candidates.push({col,row,distance:Math.abs(col-tower.col)+Math.abs(row-tower.row)});
    const destination=candidates.sort((left,right)=>left.distance-right.distance||left.row-right.row||left.col-right.col)[0];
    if(destination){tower.relocate(destination.col,destination.row);moved++}
  });
  return moved;
}
function freeCellCount() {
  let count = 0;
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) if (!isRoad(col, row) && !occupied(col, row)) count++;
  return count;
}
function waveSize() { return gameSession.currentWave?.enemyCount || 0; }
function endlessThreatProfile(waveNumber = wave) {
  const cycle = (waveNumber - 1) % 6;
  const profiles = [
    { roster: ['mossling'], traitKey: null, hpScale: 1, speedScale: 1 },
    { roster: ['glimmermoth', 'mossling'], traitKey: 'swift', hpScale: .92, speedScale: 1.08 },
    { roster: ['shellguard', 'bramblehog'], traitKey: 'armored', hpScale: 1.04, speedScale: .96 },
    { roster: ['mireseer', 'shellguard'], traitKey: 'regenerating', hpScale: 1.08, speedScale: .98 },
    { roster: ['glimmermoth', 'mireseer'], traitKey: 'resistant', hpScale: 1, speedScale: 1.04 },
    { roster: ['bramblehog', 'shellguard', 'mireseer'], traitKey: 'fortified', hpScale: 1.14, speedScale: 1.02 }
  ];
  const profile = profiles[cycle];
  const finale = Boolean(finalWave) || waveNumber % 10 === 0;
  return {
    ...profile,
    hpScale: profile.hpScale * (1 + Math.floor((waveNumber - 1) / 6) * .045) * (finale ? 1.16 : 1),
    speedScale: profile.speedScale * (finale ? 1.03 : 1),
    roster: finale ? ['shellguard', 'mireseer', 'glimmermoth', 'bramblehog'] : profile.roster,
    traitKey: finale ? 'fortified' : profile.traitKey,
    finale
  };
}
function waveTrait() {
  if (gameSession.currentWave?.traitKey) return gameSession.currentWave.traitKey;
  if (gameSession.isFinite) return wave <= 2 ? null : enemyTraitKeys[(wave - 3) % enemyTraitKeys.length];
  return endlessThreatProfile(wave).traitKey;
}
function waveThreatHint(definition = gameSession.currentWave) {
  if (!definition) return '';
  const profile = gameSession.isFinite ? null : endlessThreatProfile(definition.number || wave);
  const traitKey = definition.traitKey || profile?.traitKey;
  const rosterKeys = definition.roster?.length ? definition.roster : profile?.roster;
  const trait = traitKey ? enemyTraits[traitKey]?.label : null;
  const roster = rosterKeys?.length ? rosterKeys.map(key => enemyArchetypes[key]?.name || key).join('、') : '';
  return [trait && `主属性：${trait}`, roster && `敌群：${roster}`].filter(Boolean).join(' · ');
}
function updateSelectionInfo() {
  if (selectedEnemy) {
    const type = selectedEnemy.definition || enemyTypes[selectedEnemy.type];
    const traits = selectedEnemy.traits.length ? selectedEnemy.traits.map(key => `<span style="color:${enemyTraits[key].color}">● ${enemyTraits[key].label}</span>`).join(' · ') : '<span style="color:#748079">无属性</span>';
    const status = selectedEnemy.dead || selectedEnemy.hp <= 0 ? ' · 已击败' : '';
    const activeStatuses = [[selectedEnemy.burn,'燃烧'],[selectedEnemy.poison,'中毒'],[selectedEnemy.freeze,'冻结'],[selectedEnemy.stun,'眩晕'],[selectedEnemy.slow,'减速'],[selectedEnemy.weaken,'破甲'],[selectedEnemy.taiji,'易伤']].filter(([time])=>time>0).map(([time,label])=>`${label} ${time.toFixed(1)}s`).join(' · ') || '无异常状态';
    const resistEntries = Object.entries(selectedEnemy.resist || {}), highResists = resistEntries.filter(([, value]) => value > .18);
    const resistText = resistEntries.every(([, value]) => value === 0) ? '属性抗性：无' : highResists.map(([key, value]) => `${evolution[key]?.name?.replace('守卫','') || key} ${Math.round(value * 100)}%`).join(' · ') || '属性抗性：低';
    const abilityText = type.abilities?.length ? ` · 能力 ${type.abilities.join('、')}` : '';
    const phaseText = selectedEnemy.phase?.active ? ' · 第二阶段' : '';
    const auraText = selectedEnemy.aura ? ` · 光环 ${Math.round((selectedEnemy.aura.damageReduction || 0) * 100)}%减伤` : '';
    const shieldText = selectedEnemy.maxShield > 0 ? ` · 护盾 ${Math.ceil(selectedEnemy.shield)}/${Math.ceil(selectedEnemy.maxShield)}${selectedEnemy.shieldBroken > 0 ? '（破盾：易伤）' : ''}` : '';
    $('selectedInfo').innerHTML = `<span class="info-icon">${type.icon}</span><div><b>${type.name || type.label}${status}${phaseText} · ${traits}</b><small>${type.desc ? `${type.desc}<br>` : ''}生命 ${Math.max(0,Math.ceil(selectedEnemy.hp))}/${Math.ceil(selectedEnemy.max)}${shieldText} · ${activeStatuses}<br>速度 ${selectedEnemy.speed.toFixed(0)} · 护甲 ${Math.round(selectedEnemy.armor*100)}% · 减速抗性 ${Math.round(selectedEnemy.slowResist*100)}% · 再生 ${selectedEnemy.regen.toFixed(1)}/秒${auraText}${abilityText} · ${resistText}</small></div>`;
  } else if (selectedTower) {
    const z = evolution[selectedTower.evo];
    const slotEffect=towerSlotEffect(selectedTower);
    const usesProjectiles = ['projectile','bombard'].includes(z.combat?.delivery), volley = usesProjectiles ? Math.min(3, (z.combat?.volley || 1) + (selectedTower.level >= 10 ? 1 : 0)) : 1;
    const weaponDetail = weaponNames[z.combat?.weapon] || projectileStyleNames[z.combat?.projectileStyle] || '能量攻击';
    const deliveryDetail = `${weaponDetail} · ${deliveryNames[z.combat?.delivery] || '特殊攻击'}${usesProjectiles ? ` · ${volley} 波齐射` : ''}<br><span class="weapon-note">${weaponDescriptions[z.combat?.weapon] || '独特攻击机制'}</span>`;
    const mergeValue = selectedTower.level < MAX_LEVEL ? growthThreshold(selectedTower.level) : 1;
    const mergePercent = selectedTower.level < MAX_LEVEL ? Math.min(100, Math.round((selectedTower.growth || 0) / mergeValue * 100)) : 100;
    const mergeProgress = selectedTower.level < MAX_LEVEL
      ? `<br><span class="merge-progress-copy">合成进度 ${selectedTower.growth || 0}/${mergeValue}</span><span class="merge-meter"><i style="width:${mergePercent}%"></i></span><span class="merge-rule">同级共鸣直接升一级 · 低级同形态转为素材进度</span>`
      : '<br><span class="merge-progress-copy">已达 Lv.20 终点</span>';
    const towerTags = new Set(towerSynergyTags(selectedTower));
    const bonds = formationSynergies().filter(result => towerTags.has(result.definition.tag)).map(result => result.definition.name).join(' · ');
    const actualDamage=Math.round(z.damage*selectedTower.level*formationDamageMultiplier(selectedTower)*(slotEffect?.damage||1));
    const actualInterval=(z.rate*formationCombatModifiers(selectedTower).cooldown*growthCombatModifiers().cooldown*(slotEffect?.cooldown||1)).toFixed(2);
    const actualRange=(currentAttackRadius(z,selectedTower)/CELL).toFixed(1);
    const slotText=slotEffect?`<br><span style="color:${slotEffect.text};font-weight:900">${slotEffect.icon} ${slotEffect.name}：${slotEffect.desc}</span>`:isRitualCell(selectedTower.col,selectedTower.row)?'<br><span style="color:#956a22;font-weight:900">阵 九宫阵位：参与五灵、太极与隐藏阵式融合</span>':'<br>普通部署位：无额外修正';
    $('selectedInfo').innerHTML = `<span class="info-icon">${z.icon}</span><div><b>${z.name} · Lv.${selectedTower.level}</b><small>${z.desc || '基础单体攻击'}<br>实际伤害 ${actualDamage} · 攻击间隔 ${actualInterval}s · 半径 ${actualRange} 格<br>${deliveryDetail} · ${effectNames[z.effect] || '无附加效果'}${slotText}${bonds ? `<br>阵容标签 ${bonds}` : ''}${mergeProgress}<br><button class="target-mode-btn" id="targetModeBtn">目标：${selectedTower.targeting === 'demolish' ? '清理地图目标' : selectedTower.targeting === 'strong' ? '优先强敌' : selectedTower.targeting === 'weak' ? '优先残血' : '优先前排'}</button></small></div>`;
    const targetButton = $('targetModeBtn');
    if (targetButton) targetButton.onclick = () => { const modes = ['front','strong','weak','demolish']; selectedTower.targeting = modes[(modes.indexOf(selectedTower.targeting || 'front') + 1) % modes.length]; $('message').textContent = selectedTower.targeting === 'demolish' ? '该塔将主动清理地图目标，敌人会被放过。' : '该塔已切换敌人优先级。'; ui(); };
  } else {
    $('selectedInfo').innerHTML = '<span class="info-icon">🌰</span><div><b>拖动橡果塔改变位置</b><small>点击敌人可查看属性 · Lv.5 选择主路线，Lv.10 选择专属分支</small></div>';
  }
}
function ui() {
  if ($('devTools')) $('devTools').hidden = !isDeveloperMode();
  $('coins').textContent = coins; $('lives').textContent = lives; $('score').textContent = score; $('wave').textContent = wave;
  setText('waveTotal', gameSession.isFinite ? `/ ${gameSession.level.waves.length}` : '/ ∞');
  $('progressText').textContent = `${kills} / ${waveSize()}`;
  $('progressBar').style.width = `${Math.min(100, kills / waveSize() * 100)}%`;
  $('surgeCharge').textContent = Math.floor(surgeCharge);
  $('surgeFill').style.width = `${surgeCharge}%`;
  $('surgeBtn').disabled = surgeCharge < 100 || !enemies.some(enemy => !enemy.dead) || paused;
  if ($('undoMergeBtn')) $('undoMergeBtn').disabled = !lastMergeSnapshot || Boolean(pendingEvolution);
  const mergeCount = mergeOpportunityCount();
  if ($('mergeBtn')) { $('mergeBtn').disabled = running || Boolean(pendingEvolution) || !mergeCount; $('mergeBtn').textContent = mergeCount ? `合成 ×${mergeCount}` : '暂无可合成'; }
  $('surgeBtn').classList.toggle('ready', surgeCharge >= 100);
  $('comboBadge').textContent = combo > 1 ? `连击 ×${combo}` : '连击 ×0';
  $('comboBadge').classList.toggle('active', combo > 1);
  const remaining = Math.max(0, waveSize() - kills);
  const openRoutes=currentPaths().map((route,index)=>index).filter(index=>isRouteOpen(index));
  const laneThreat=openRoutes.map(index=>`${String.fromCharCode(65+index)}路 ${enemies.filter(enemy=>!enemy.dead&&enemy.routeIndex===index).length}`).join(' · ');
  const nextLocked=currentPaths().map((route,index)=>index).find(index=>!isRouteOpen(index));
  const preparation=nextLocked===undefined?`${openRoutes.length} 路整备`:`${openRoutes.length} 路开放 · ${String.fromCharCode(65+nextLocked)}路第 ${routeUnlockWave(nextLocked)} 波启用`;
  $('threatBadge').textContent = running ? `${laneThreat} · ${remaining} 未清剿` : preparation;
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
    const growth = group.max < MAX_LEVEL ? ` · 进度 ${towers.filter(tower => tower.evo === group.evo && tower.level === group.max).reduce((max, tower) => Math.max(max, tower.growth || 0), 0)}/${growthThreshold(group.max)}` : '';
    return `<button class="tower-card${active}" data-roster-evo="${group.evo}"><div class="tower-art" style="background:${data.color}33">${data.icon}</div><div><b>${data.name}</b><small>${attackModeNames[data.attackMode] || '特殊攻击'} · ${group.count} 座${growth}</small></div><span class="price">${levels}</span></button>`;
  }).join('');
  list.querySelectorAll('[data-roster-evo]').forEach(button => button.onclick = () => {
    selectedTower = towers.filter(tower => tower.evo === button.dataset.rosterEvo).sort((a,b) => b.level - a.level)[0];
    selectedEnemy = null; ui();
  });
}
function updateWorkshop() {
  const reserveEntries = Object.entries(reserve).filter(([, count]) => count > 0).sort((a,b) => Number(b[0]) - Number(a[0]));
  if ($('mapRecallBtn')) $('mapRecallBtn').disabled = !selectedTower || Boolean(pendingEvolution);
  updateMapOperations(reserveEntries);
}
function updateMapOperations(reserveEntries = Object.entries(reserve).filter(([, count]) => count > 0).sort((a,b) => Number(b[0]) - Number(a[0]))) {
  const mode = growthModes[growthMode];
  setText('mapSpirit', coins); setText('mapSpiritCost', mode.threshold);
  if ($('mapSpiritFill')) $('mapSpiritFill').style.width = `${Math.min(100, coins / mode.threshold * 100)}%`;
  document.querySelectorAll('[data-map-growth]').forEach(button => {
    button.classList.toggle('active', button.dataset.mapGrowth === growthMode);
    button.title = growthModes[button.dataset.mapGrowth].desc;
    button.disabled = running || Boolean(pendingEvolution);
    button.onclick = () => {
      if (running) { $('message').textContent = '战斗进行中，根系策略将在下一次整备时调整。'; return; }
      const nextMode = button.dataset.mapGrowth;
      if (nextMode === growthMode) return;
      growthMode = nextMode;
      $('message').textContent = `世界树转为${growthModes[growthMode].name}根系：${growthModes[growthMode].desc}。`;
      ui();
    };
  });
  const list = $('mapReserveList');
  if (list) {
    const reserveLabel = list.parentElement?.querySelector?.('small');
    if (reserveLabel) reserveLabel.textContent = '灵种仓';
    const seeds = reserveEntries.map(([level,count]) => `<button class="hud-seed${pendingDeployLevel===Number(level)?' active':''}" data-map-seed="${level}" title="部署 Lv.${level} 灵种"><span>🌰</span><b>${level}</b><small>×${count}</small></button>`).join('');
    const standby = standbyReserve.map((state,index) => { const data=evolution[state.evo]; return `<button class="hud-seed standby${pendingDeployTowerIndex===index?' active':''}" data-map-standby="${index}" title="部署 ${data.name} Lv.${state.level}"><span>${data.icon}</span><b>${state.level}</b></button>`; }).join('');
    list.innerHTML = seeds + standby || '<span class="hud-empty">暂无灵种</span>';
    list.querySelectorAll('[data-map-seed]').forEach(button => button.onclick = () => beginDeploy(Number(button.dataset.mapSeed)));
    list.querySelectorAll('[data-map-standby]').forEach(button => button.onclick = () => beginDeployStandby(Number(button.dataset.mapStandby)));
  }
  const offers = $('mapOffers');
  if (offers) {
    offers.innerHTML = germinationOffers.map((offer, index) => {
      const label = offer.kind === 'seed' ? `Lv.${offer.level} 灵种` : `培育 ${offer.level}级塔`;
      const detail = offer.kind === 'seed' ? '收入灵种仓' : '为选中塔增加成长进度';
      return `<button class="sprout-offer${offer.claimed ? ' claimed' : ''}" data-sprout="${index}" title="${detail}" ${offer.claimed ? 'disabled' : ''}><b>${offer.kind === 'seed' ? '🌰' : '✦'} ${label}</b><small>${detail}</small></button>`;
    }).join('') || '<span class="hud-empty">灵力达到阈值后抽芽</span>';
    offers.querySelectorAll('[data-sprout]').forEach(button => button.onclick = () => claimGermination(Number(button.dataset.sprout)));
  }
  const reroll = $('sproutRefresh');
  if (reroll) { reroll.disabled = running || coins < 20 || !germinationOffers.length; reroll.onclick = refreshGermination; }
  const objective = $('mapObjective');
  if (objective) { const remaining = activeMapObjects(); objective.textContent = remaining.length ? `地图目标：${remaining.map(item => `${item.icon}${item.name}`).join(' · ')}` : '地图目标：全部清理'; }
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
function pointAt(distance, path = currentPath()) {
  let left = distance;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (left <= length) return { x: a[0] + (b[0] - a[0]) * left / length, y: a[1] + (b[1] - a[1]) * left / length };
    left -= length;
  }
  return { x: path.at(-1)[0], y: path.at(-1)[1] };
}
function enemyTravelSpeed(waveDefinition, threat, eventSpeed) {
  return ENEMY_TRAVEL_SPEED * eventSpeed * (waveDefinition?.speedScale || 1) * (threat?.speedScale || 1);
}
function addEnemy() {
  const waveDefinition = gameSession.currentWave;
  const threat = gameSession.isFinite ? null : endlessThreatProfile(wave);
  const neutral = waveTrait() === null;
  // Resistances now come from the enemy's archetype and traits. A tiny baseline
  // keeps raw damage from being universally optimal without flattening counters.
  const resist = Object.fromEntries(['metal','wood','water','fire','earth','yin','yang','wind','thunder'].map(key => [key, neutral ? 0 : .03]));
  const eventSpeed = (currentWaveEvent?.enemySpeed || 1) * currentBattlefield().enemySpeed;
  const forcedBoss = waveDefinition?.boss && spawned === waveSize() - 1
    ? waveDefinition.boss
    : threat?.finale && spawned === 0
      ? (wave % 10 === 0 ? 'ashenStag' : 'groveTyrant')
      : null;
  const roster = waveDefinition?.roster?.length ? waveDefinition.roster : ((wave % 5 === 0 || threat?.finale) && spawned === 0 ? [] : (threat?.roster || []));
  const enemy=spawnDirector.create({
    wave, spawnIndex: spawned,
    hpScale: (38 + wave * 20 + spawned * 2.5) * (currentWaveEvent?.enemyHp || 1) * (waveDefinition?.hpScale || 1) * (threat?.hpScale || 1),
    speedScale: enemyTravelSpeed(waveDefinition, threat, eventSpeed),
    resist, primaryTrait: waveTrait(), neutral, archetype: forcedBoss,
    roster
  });
  enemy.routeIndex=routeIndexForSpawn(spawned,wave);
  enemy.routeLength=currentPathLength(enemy.routeIndex);
  enemy.routeProgress=0;
  Object.assign(enemy,pointAt(0,currentPath(enemy.routeIndex)));
  enemies.push(enemy);
}
function rollSummonLevel() {
  const sequence = growthModes[growthMode].sequence;
  const index = growthCycles.total % sequence.length;
  growthCycles.total++;
  return sequence[index];
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
function reserveMergeCount(source = reserve) {
  const simulation = { ...source };
  let merged = 0;
  for (let level = 1; level < 5; level++) {
    const pairs = Math.floor((simulation[level] || 0) / 2);
    if (!pairs) continue;
    simulation[level] -= pairs * 2;
    simulation[level + 1] = (simulation[level + 1] || 0) + pairs;
    merged += pairs;
  }
  return merged;
}
function hasUnresolvedEvolution(tower) {
  return (tower.level >= 5 && tower.evo === 'base' && !tower.evolutionPath) ||
    (tower.level >= 10 && tower.evoTier === 1 && !evolution[tower.evo]?.fusion);
}
function mergeCandidates(sourceTowers) {
  const candidates = [];
  for (let i = 0; i < sourceTowers.length; i++) for (let j = i + 1; j < sourceTowers.length; j++) {
    const left = sourceTowers[i], right = sourceTowers[j];
    let keeper = left.level >= right.level ? left : right;
    let consumed = keeper === left ? right : left;
    if (!canMergeTowers(keeper, consumed) && canMergeTowers(consumed, keeper)) [keeper, consumed] = [consumed, keeper];
    if (!canMergeTowers(keeper, consumed)) continue;
    const preview = towerFactory.create(keeper.snapshot());
    preview.absorb(towerFactory.create(consumed.snapshot()), mergeRules());
    candidates.push({
      keeper,
      consumed,
      resonance: keeper.level === consumed.level,
      createsChoice: hasUnresolvedEvolution(preview)
    });
  }
  return candidates.sort((left, right) => Number(left.createsChoice) - Number(right.createsChoice) ||
    Number(right.resonance) - Number(left.resonance) ||
    right.keeper.level + right.consumed.level - left.keeper.level - left.consumed.level);
}
function battlefieldMergeCount(sourceTowers = towers) {
  const simulation = sourceTowers.map(tower => towerFactory.create(tower.snapshot()));
  let merged = 0;
  while (true) {
    const candidate = mergeCandidates(simulation)[0];
    if (!candidate) break;
    candidate.keeper.absorb(candidate.consumed, mergeRules());
    simulation.splice(simulation.indexOf(candidate.consumed), 1);
    merged++;
    if (hasUnresolvedEvolution(candidate.keeper)) break;
  }
  return merged;
}
function mergeOpportunityCount() { return reserveMergeCount() + battlefieldMergeCount(); }
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
  if (isRoad(col,row) || occupant || mapObjectAt(col,row)) { $('message').textContent = mapObjectAt(col,row) ? '该位置仍有地图目标，请先清理它。' : '这里无法部署，请选择发光的安全地块。'; return true; }
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
  while (coins >= growthModes[growthMode].threshold && germinationOffers.filter(offer => !offer.claimed).length < 3) {
    coins -= growthModes[growthMode].threshold;
    germinationOffers.push(nextGerminationOffer());
    produced.push(germinationOffers.at(-1));
  }
  if (!produced.length) return false;
  audioBus.merge();
  if (produced.some(offer => offer.level >= 3)) { audioBus.evolve(); screenFlash = .45; }
  if (hits.length < runtime.maxHits) hits.push({type:'text',x:W-95,y:65,life:1,color:'#fff3a6',label:`灵种 +${produced.length}`});
  return true;
}
function gainSpirit(amount, sourceTower = null) {
  const eventBoost = currentWaveEvent?.spirit || 1, modeBoost = growthModes[growthMode].absorb;
  const bonus = sourceTower ? formationCombatModifiers(sourceTower).spiritBonus : 0;
  coins += Math.max(0, Math.round(amount * eventBoost * modeBoost + bonus));
  processGrowth();
}
function recallSelectedTower() {
  if (!selectedTower || pendingEvolution) { $('message').textContent = '请先选择一座要撤回的塔，并完成当前进化选择。'; return; }
  const tower = selectedTower; towers = towers.filter(item => item !== tower); lastMergeSnapshot = null;
  if (tower.evo === 'base') {
    reserve[tower.level] = (reserve[tower.level] || 0) + 1;
    selectedTower = null; pendingDeployLevel = null; pendingDeployTowerIndex = null;
    $('message').textContent = `Lv.${tower.level} 普通塔已收回灵种仓，是否合成由你决定。`;
  } else {
    standbyReserve.push(tower.snapshot()); selectedTower = null; pendingDeployLevel = null; pendingDeployTowerIndex = null;
    $('message').textContent = `${evolution[tower.evo].name} Lv.${tower.level} 已进入待命塔仓，进化路线完整保留。`;
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
function formationAmplification() { return 1; }
function formationCombatModifiers(tower) {
  return synergySystem.modifiersFor(tower, formationSynergies(), formationAmplification());
}
function finaleRequirementsMet() {
  const viableTowers = towers.filter(tower => tower.level >= 5);
  const lineages = new Set(viableTowers.map(tower => towerBranch(tower)));
  const activeBonds = formationSynergies().filter(result => result.tier).length;
  return viableTowers.length >= 2 && lineages.size >= 2 && activeBonds >= 1;
}
function growthCombatModifiers() {
  const mode = growthModes[growthMode] || growthModes.balanced;
  return { damage: mode.damage || 1, cooldown: mode.cooldown || 1 };
}
function synergyEffectText(tier, amplification = 1) {
  const effects = [];
  if (tier.damage) effects.push(`伤害 +${Math.round(tier.damage * amplification * 100)}%`);
  if (tier.attackSpeed) effects.push(`攻速 +${Math.round(tier.attackSpeed * amplification * 100)}%`);
  if (tier.armorBreak) effects.push(`破甲 +${Math.round(tier.armorBreak * amplification * 100)}%`);
  if (tier.shieldBreak) effects.push(`破盾 +${Math.round(tier.shieldBreak * amplification * 100)}%`);
  if (tier.statusDuration) effects.push(`状态时长 +${Math.round(tier.statusDuration * amplification * 100)}%`);
  if (tier.range) effects.push(`射程 +${Math.round(tier.range * amplification * 100)}%`);
  if (tier.bossDamage) effects.push(`首领伤害 +${Math.round(tier.bossDamage * amplification * 100)}%`);
  if (tier.spiritBonus) effects.push(`击杀灵力 +${Math.round(tier.spiritBonus * amplification)}`);
  return effects.join(' · ');
}
function formationDamageMultiplier(tower) { return formationCombatModifiers(tower).damage * growthCombatModifiers().damage; }
function towerMergeIdentity(tower) { return `${tower.evo}|${tower.evolutionPath || ''}|${tower.evoTier}`; }
function growthThreshold(level) { return 8 + level * 2; }
function mergeMaterialValue(tower) { return Math.max(1, Math.ceil(2 + tower.level * 1.25)); }
function resonanceBonus(level) { return Math.max(1, growthThreshold(level) - mergeMaterialValue({ level })); }
function mergeRules() { return { identityResolver: towerMergeIdentity, maxLevel: MAX_LEVEL, progressiveMerge: true, growthThreshold, mergeMaterialValue, resonanceBonus }; }
function canMergeTowers(left, right) { return Boolean(left?.canMergeWith(right, mergeRules())); }
function mergeFeedback(keeper, consumed, beforeLevel, beforeGrowth) {
  const rawGain = keeper.lastAbsorbKind === 'resonance'
    ? mergeMaterialValue(consumed) + resonanceBonus(beforeLevel)
    : mergeMaterialValue(consumed);
  const gained = Math.max(1, rawGain);
  const position = center(keeper);
  const leveled = keeper.level > beforeLevel;
  const label = leveled
    ? `合成成功  Lv.${beforeLevel} → Lv.${keeper.level}`
    : `素材转化  +${gained} 进度`;
  if (hits.length < runtime.maxHits) hits.push({ type: 'mergeText', x: position.x, y: position.y - 34, life: 1.45, color: leveled ? '#ffe07a' : '#bfe88e', label });
  burst(position.x, position.y, leveled ? '#ffd35e' : '#a9df7a');
  if (leveled) screenFlash = Math.max(screenFlash, .22);
  return { gained, leveled, beforeLevel, afterLevel: keeper.level, consumedLevel: consumed.level };
}
function nextGerminationOffer() {
  const sequence = growthModes[growthMode].sequence;
  const level = sequence[growthCycles.total % sequence.length];
  growthCycles.total++;
  return Math.random() < .72 ? { kind: 'seed', level } : { kind: 'cultivate', level: Math.max(1, Math.min(5, level)) };
}
function claimGermination(index) {
  if (running || pendingEvolution) return false;
  const offer = germinationOffers[index];
  if (!offer || offer.claimed) return false;
  offer.claimed = true;
  if (offer.kind === 'seed') reserve[offer.level] = (reserve[offer.level] || 0) + 1;
  else if (selectedTower && selectedTower.level < MAX_LEVEL) selectedTower.growth = Math.min(growthThreshold(selectedTower.level), (selectedTower.growth || 0) + offer.level);
  else { offer.kind = 'seed'; reserve[offer.level] = (reserve[offer.level] || 0) + 1; }
  $('message').textContent = offer.kind === 'seed' ? `抽芽获得 Lv.${offer.level} 灵种。` : `培育完成，${evolution[selectedTower.evo].name} 成长进度提升。`;
  ui(); return true;
}
function refreshGermination() {
  if (running || coins < 20 || !germinationOffers.length) return false;
  coins -= 20; germinationOffers = [nextGerminationOffer(), nextGerminationOffer(), nextGerminationOffer()];
  $('message').textContent = '消耗 20 灵力重抽抽芽选项。'; ui(); return true;
}
function mergeTowers(keeper, consumed) {
  if (!keeper || !consumed) return false;
  if (consumed.level > keeper.level && canMergeTowers(consumed, keeper)) [keeper, consumed] = [consumed, keeper];
  const beforeLevel = keeper.level, beforeGrowth = keeper.growth || 0;
  if (!keeper.absorb(consumed, mergeRules())) return false;
  towers = towers.filter(tower => tower !== consumed);
  selectedTower = keeper; selectedEnemy = null; audioBus.merge();
  const result = mergeFeedback(keeper, consumed, beforeLevel, beforeGrowth);
  if (keeper.level === 5 && keeper.evo === 'base' && !keeper.evolutionPath) {
    pendingDeployLevel = null; pendingEvolution = keeper; pendingEvolutionStage = 'primary'; openEvolution('primary');
  } else if (keeper.level >= 10 && keeper.evoTier === 1 && !evolution[keeper.evo]?.fusion) {
    pendingDeployLevel = null; pendingEvolution = keeper; pendingEvolutionStage = 'branch'; openEvolution('branch');
  } else if (keeper.level === MAX_LEVEL) {
    finalWave = true;
    $('message').textContent = running ? `${evolution[keeper.evo].ultimate}诞生，当前波结束后进入最终试炼！` : `${evolution[keeper.evo].ultimate}诞生，下一波进入最终试炼！`;
  } else {
    const kind = keeper.lastAbsorbKind === 'resonance' ? '同级共鸣' : '素材合成';
    $('message').textContent = keeper.lastAbsorbKind === 'resonance'
      ? `${kind}成功：消耗 Lv.${consumed.level}，${evolution[keeper.evo].name} Lv.${keeper.level}。`
      : `${kind}成功：Lv.${consumed.level} 素材转化为 +${result.gained} 合成进度，当前 ${keeper.growth}/${growthThreshold(keeper.level)}。`;
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
function spawnFx(x, y, color, options = {}) {
  if (runtime.reducedMotion || fxParticles.length >= 460) return;
  const count = options.count || 1;
  for (let i = 0; i < count && fxParticles.length < 460; i++) {
    const angle = options.angle ?? Math.random() * Math.PI * 2;
    const spread = options.spread ?? Math.PI * 2;
    const direction = angle + (Math.random() - .5) * spread;
    const speed = (options.speed || 80) * (.55 + Math.random() * .7);
    fxParticles.push({ x, y, color, shape: options.shape || 'dot', size: (options.size || 4) * (.7 + Math.random() * .6), life: options.life || .55, maxLife: options.life || .55, vx: Math.cos(direction) * speed, vy: Math.sin(direction) * speed, gravity: options.gravity || 0, drag: options.drag || .94, rotation: Math.random() * Math.PI * 2, spin: (Math.random() - .5) * 8 });
  }
}
function spawnWeaponFx(x, y, color, weapon) {
  if (runtime.reducedMotion) return;
  const specs = {
    rocket: { count: 18, speed: 150, size: 5, life: .65, shape: 'spark' },
    meteor: { count: 30, speed: 220, size: 6, life: .8, shape: 'spark', gravity: 85 },
    mine: { count: 22, speed: 125, size: 5, life: .7, shape: 'spark' },
    waterjet: { count: 12, speed: 110, size: 4, life: .5, shape: 'drop' },
    boomerang: { count: 10, speed: 95, size: 4, life: .45, shape: 'spark' },
    lightning: { count: 14, speed: 180, size: 3, life: .4, shape: 'spark' },
    drill: { count: 13, speed: 145, size: 3, life: .5, shape: 'spark' },
    quake: { count: 18, speed: 120, size: 4, life: .6, shape: 'shard' }
  };
  spawnFx(x, y, color, specs[weapon] || { count: 8, speed: 90, size: 3, life: .42, shape: 'dot' });
}
function impactFx(x, y, color, kind = 'hit', radius = 24) {
  if (hits.length >= runtime.maxHits) return;
  hits.push({ type: 'impact', x, y, life: 1, color, kind, radius });
  spawnWeaponFx(x, y, color, kind);
  if (['rocket', 'meteor', 'mine'].includes(kind)) screenFlash = Math.max(screenFlash, kind === 'meteor' ? .28 : .14);
}
function statusText(target, label, color) {
  if (hits.length >= runtime.maxHits) return;
  hits.push({ type: 'statusText', x: target.x, y: target.y - target.radius - 10, life: 1, color, label });
}
function applyEnemyStatus(target, key, duration, source = null) {
  const sourceModifiers = source ? formationCombatModifiers(source) : null;
  const adjustedDuration = duration * (sourceModifiers?.statusDuration || 1);
  if (typeof target.applyStatus === 'function') return target.applyStatus(key, adjustedDuration, source);
  const adjusted = adjustedDuration * (['slow','silence','freeze'].includes(key) ? 1 - (target.slowResist || 0) : 1);
  target[key] = Math.max(target[key] || 0, adjusted);
  if (source) target[`${key}Source`] = source;
  return adjusted;
}
function damageTarget(t, target, z) {
  if (target?.isStructure) {
    const rawDamage = z.damage * t.level * formationDamageMultiplier(t) * (towerSlotEffect(t)?.damage || 1);
    target.receiveDamage(rawDamage);
    if (target.hp <= 0 && !target.dead) {
      target.dead = true;
      target.cleared = true;
      gainSpirit(target.reward, t);
      target.unlocks?.forEach(([col, row]) => mapUnlockedSlots.add(`${col},${row}`));
      $('message').textContent = `${target.name}已清理，获得 ${target.reward} 灵力${target.unlocks?.length ? `，开放 ${target.unlocks.length} 个部署位` : ''}。`;
      burst(target.x, target.y, '#f5c85c');
    }
    return;
  }
  const field = currentBattlefield(), branch = towerBranch(t);
  const fieldDamage = field.bonus.includes(branch) ? field.damage : 1;
  const formation = formationCombatModifiers(t);
  const bossMultiplier = target.type === 'boss' ? 1 + formation.bossDamage : 1;
  const rawDamage = z.damage * t.level * fieldDamage * formationDamageMultiplier(t) * bossMultiplier * (towerSlotEffect(t)?.damage||1);
  if (target.shield > 0 && formation.shieldBreak) target._synergyShieldBreak = Math.max(target._synergyShieldBreak || 0, formation.shieldBreak);
  if (target.armor > 0 && formation.armorBreak) target._synergyArmorBreak = Math.max(target._synergyArmorBreak || 0, formation.armorBreak);
  if (typeof target.receiveDamage === 'function') target.receiveDamage(rawDamage, branch, z.attackMode);
  else {
    const resistance = target.resist?.[branch] || 0;
    target.hp -= rawDamage * (target.taiji > 0 ? 1.3 : 1) * (1 - Math.max(0, (target.armor || 0) - (target.weaken > 0 ? .15 : 0))) * (1 - resistance);
  }
  target.visualHit = .16;
  target.hitFromX = center(t).x;
  if (hits.length < runtime.maxHits) hits.push({ type: 'damageText', x: target.x + (Math.random() - .5) * 12, y: target.y - target.radius - 5, life: .78, color: z.effect === 'burn' ? '#ff9b45' : z.effect === 'freeze' ? '#bff6ff' : '#fff4bb', label: `-${Math.max(1, Math.round(rawDamage))}` });
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
  combo = comboTimer > 0 ? combo + 1 : 1; comboTimer = 2.2; const comboBonus = 1 + Math.min(.5, Math.floor(combo / 5) * .1); const rewardScale = (currentWaveEvent?.reward || 1) * currentBattlefield().reward; const enemyReward = target.rewardMultiplier || ({normal:1,elite:2,boss:8}[target.type] || 1); gainSpirit((10 + wave) * enemyReward * rewardScale + (towerSlotEffect(t)?.spiritBonus||0), t); score += Math.round(100 * t.level * enemyReward * comboBonus); kills++; surgeCharge = Math.min(100, surgeCharge + (target.type === 'boss' ? 35 : target.type === 'elite' ? 18 : 9)); if(combo>1&&hits.length<runtime.maxHits)hits.push({type:'text',x:target.x,y:target.y-20,life:1,color:'#fff3a6',label:`${combo} 连击`});
}
function launchProjectiles(tower, targets, definition) {
  const combat = definition.combat || {};
  const weapon = combat.weapon || 'seedshot';
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
      const launchAngle = Math.atan2(target.y - origin.y, target.x - origin.x);
      const muzzleDistance = { seedshot: 30, rocket: 38, scatter: 34, drill: 40, waterjet: 35 }[weapon] || 28;
      const launchOrigin = chainOrigin === origin ? (hasPrimaryEvolutionArt(tower) ? modelMuzzlePoint(tower, target, definition) : { x: origin.x + Math.cos(launchAngle) * muzzleDistance, y: origin.y + Math.sin(launchAngle) * muzzleDistance }) : chainOrigin;
      if (shot === 0 && targetIndex === 0 && !runtime.reducedMotion) {
        spawnFx(launchOrigin.x, launchOrigin.y, definition.color, { count: 8, speed: 85, size: 3, life: .24, shape: 'spark' });
      }
      projectiles.push({
        tower, target, payloadTargets, definition,
        x: launchOrigin.x, y: launchOrigin.y, originX: launchOrigin.x - Math.sin(launchAngle) * spread, originY: launchOrigin.y + Math.cos(launchAngle) * spread,
        targetX: target.x, targetY: target.y,
        age: 0, delay: shot * .095 + targetIndex * .025,
        duration: Math.max(.14, Math.hypot(target.x - chainOrigin.x, target.y - chainOrigin.y) / (combat.projectileSpeed || 400)),
        style: combat.projectileStyle || 'seed', arc: combat.arc || 0, curve: combat.curve || 0,
        weapon, damageScale: 1 / volley, appliesEffect: shot === 0, rotation: Math.random() * Math.PI * 2, dead: false
      });
    }
  });
}
function launchAttack(tower, targets, definition) {
  const delivery = definition.combat?.delivery || 'projectile';
  const modelAttack = hasPrimaryEvolutionArt(tower);
  const modelTiming = {
    boomerang: { animationDuration: .86, releaseAt: .34 },
    rocket: { animationDuration: .92, releaseAt: .4 },
    waterjet: { animationDuration: .84, releaseAt: .3 },
    drill: { animationDuration: .82, releaseAt: .28 },
    quake: { animationDuration: 1.05, releaseAt: .48 },
    seedshot: { animationDuration: .78, releaseAt: .3 }
  }[definition.combat?.weapon] || { animationDuration: .86, releaseAt: .34 };
  const attackDefinition = modelAttack
    ? { ...definition, combat: { ...definition.combat, ...modelTiming } }
    : definition;
  const timings = {
    melee: { impactAt: .14, duration: .34 }, beam: { impactAt: .12, duration: .38 },
    chain: { impactAt: .08, duration: .28 + targets.length * .1 }, area: { impactAt: .38, duration: .68 },
    rain: { impactAt: .48, duration: .82 }, nova: { impactAt: .24, duration: .65 }
  };
  const weapon = definition.combat?.weapon || 'seedshot';
  const weaponTimings = {
    boomerang: { impactAt: .14, duration: .52 }, waterjet: { impactAt: .08, duration: .62 },
    drill: { impactAt: .1, duration: .42 }, scatter: { impactAt: .1, duration: .4 },
    lightning: { impactAt: .06, duration: .42 + targets.length * .09 }, sunbeam: { impactAt: .12, duration: 1.02 },
    meteor: { impactAt: .62, duration: 1.2 }, mine: { impactAt: .7, duration: 7.2 },
    quake: { impactAt: .32, duration: .82 }, shadowOrbit: { impactAt: .08, duration: .62 }
  };
  const timing = weaponTimings[weapon] || timings[delivery] || timings.beam;
  const createAttackEvent = animation => {
    if (attackEvents.length >= 160) return;
    const releaseAt = animation?.releaseAt ?? timing.impactAt;
    const impactAt = modelAttack && ['meteor', 'mine'].includes(weapon)
      ? Math.max(releaseAt, animation.duration * (weapon === 'meteor' ? .62 : .58))
      : modelAttack ? releaseAt : timing.impactAt;
    attackEvents.push({
      type: delivery, tower, targets: [...targets], definition, weapon, age: 0,
      releaseAt, impactAt, duration: Math.max(timing.duration, animation?.duration || 0), resolved: false,
      resolvedTargets: new Set(), focusX: targets[0].x, focusY: targets[0].y,
      seed: Math.random() * 1000, pulseIndex: 0, nextPulseAt: impactAt,
      armed: false, triggered: false
    });
  };
  tower.beginAttack?.(attackDefinition, targets, {
    releaseAt: attackDefinition.combat?.releaseAt,
    onStart: animation => {
      if (delivery !== 'projectile' && delivery !== 'bombard') createAttackEvent(animation);
    },
    onRelease: () => {
      if (delivery === 'projectile' || delivery === 'bombard') launchProjectiles(tower, targets, definition);
    }
  });
}
function resolveAttackTarget(event, target) {
  if (!target || target.dead || target.hp <= 0 || event.resolvedTargets.has(target)) return;
  event.resolvedTargets.add(target);
  damageTarget(event.tower, target, event.definition);
  impactFx(target.x, target.y, event.definition.color, event.weapon, event.weapon === 'rocket' || event.weapon === 'meteor' ? 38 : 24);
  if (!runtime.reducedMotion && event.type === 'melee' && towerBranch(event.tower) === 'earth') cameraShake = Math.max(cameraShake, 4);
}
function resolveAttackPulse(event, target, damageScale = .34, appliesEffect = false) {
  if (!target || target.dead || target.hp <= 0) return;
  const definition = { ...event.definition, damage: event.definition.damage * damageScale, effect: appliesEffect ? event.definition.effect : null };
  damageTarget(event.tower, target, definition);
  impactFx(target.x, target.y, event.definition.color, event.weapon, 18);
}
function activeEnemiesNear(x, y, radius) {
  return enemies.filter(enemy => !enemy.dead && enemy.hp > 0 && Math.hypot(enemy.x - x, enemy.y - y) <= radius)
    .sort((left, right) => (right.routeProgress ?? right.dist) - (left.routeProgress ?? left.dist));
}
function updateAttackEvents(dt) {
  attackEvents.forEach(event => {
    event.age += dt;
    if (event.weapon === 'boomerang') {
      if (!event.resolved && event.age >= event.impactAt) {
        event.resolved = true;
        resolveAttackTarget(event, event.targets[0]);
      }
      if (!event.returned && event.age >= event.duration * .68) {
        event.returned = true;
        const origin = center(event.tower), returnVictim = activeEnemiesNear(origin.x, origin.y, 56).find(target => !event.resolvedTargets.has(target));
        if (returnVictim) resolveAttackPulse(event, returnVictim, .35, false);
      }
    } else if (event.weapon === 'mine') {
      if (!event.armed && event.age >= event.impactAt) event.armed = true;
      if (event.armed && !event.triggered) {
        const radius = event.definition.combat?.splashRadius || 82;
        const seededVictims = event.targets.filter(target => target && !target.dead && target.hp > 0 && Math.hypot(target.x - event.focusX, target.y - event.focusY) <= radius);
        const victims = [...new Set([...activeEnemiesNear(event.focusX, event.focusY, radius), ...seededVictims])];
        if (victims.length) {
          event.triggered = true;
          victims.slice(0, event.definition.combat?.maxTargets || 6).forEach(target => resolveAttackTarget(event, target));
          impactFx(event.focusX, event.focusY, event.definition.color, 'mine', event.definition.combat?.splashRadius || 82);
          if (!runtime.reducedMotion) cameraShake = Math.max(cameraShake, 3);
          event.duration = event.age + .3;
        }
      }
    } else if (event.weapon === 'waterjet') {
      while (event.nextPulseAt <= event.age && event.pulseIndex < 12) {
        const target = event.targets[event.pulseIndex % event.targets.length];
        if (event.pulseIndex < event.targets.length) resolveAttackTarget(event, target);
        else resolveAttackPulse(event, target, .12, false);
        event.pulseIndex++;
        event.nextPulseAt += event.pulseIndex < event.targets.length ? .09 : .12;
      }
    } else if (event.weapon === 'sunbeam') {
      if (event.age >= event.impactAt && event.age >= event.nextPulseAt && event.pulseIndex < 6) {
        event.targets.forEach((target, index) => resolveAttackPulse(event, target, index === 0 ? .35 : .12, event.pulseIndex === 0));
        event.pulseIndex++;
        event.nextPulseAt += .16;
      }
    } else if (event.weapon === 'shadowOrbit') {
      if (!event.hitCooldowns) event.hitCooldowns = new Map();
      if (event.age >= event.nextPulseAt && event.pulseIndex < 6) {
        const origin = center(event.tower), victims = activeEnemiesNear(origin.x, origin.y, event.definition.combat?.splashRadius || 58);
        victims.slice(0, event.definition.combat?.maxTargets || 3).forEach(target => {
          if ((event.hitCooldowns.get(target) || 0) <= event.age) {
            resolveAttackPulse(event, target, .18, event.pulseIndex === 0);
            event.hitCooldowns.set(target, event.age + .24);
          }
        });
        event.pulseIndex++;
        event.nextPulseAt += .13;
      }
    } else if (event.weapon === 'quake') {
      if (!event.resolved && event.age >= event.impactAt) {
        event.resolved = true;
        const victims = activeEnemiesNear(event.focusX, event.focusY, event.definition.combat?.splashRadius || 92);
        victims.slice(0, event.definition.combat?.maxTargets || 6).forEach((target, index) => {
          if (index === 0) resolveAttackTarget(event, target);
          else resolveAttackPulse(event, target, .22, false);
        });
        if (!runtime.reducedMotion) cameraShake = Math.max(cameraShake, 7);
      }
    } else if (event.weapon === 'meteor') {
      if (!event.resolved && event.age >= event.impactAt) {
        event.resolved = true;
        const radius = event.definition.combat?.splashRadius || 100;
        const victims = [...new Set([...activeEnemiesNear(event.focusX, event.focusY, radius), ...event.targets])]
          .filter(target => target && !target.dead && target.hp > 0 && Math.hypot(target.x - event.focusX, target.y - event.focusY) <= radius);
        victims.slice(0, event.definition.combat?.maxTargets || 12).forEach(target => resolveAttackTarget(event, target));
        impactFx(event.focusX, event.focusY, event.definition.color, 'meteor', radius);
        if (!runtime.reducedMotion) cameraShake = Math.max(cameraShake, 8);
      }
    } else if (event.type === 'chain') {
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
  let validTargets = projectile.payloadTargets.filter(target => !target.dead && target.hp > 0);
  if (projectile.weapon === 'rocket') {
    const splashRadius = projectile.definition.combat?.splashRadius || 88;
    const nearby = activeEnemiesNear(projectile.targetX, projectile.targetY, splashRadius);
    validTargets = [...new Set([projectile.target, ...nearby, ...validTargets])].filter(target => !target.dead && target.hp > 0)
      .slice(0, projectile.definition.combat?.maxTargets || 8);
  }
  if (!validTargets.length) return;
  validTargets.forEach((target, index) => {
    const splashScale = projectile.weapon === 'rocket' && index > 0 ? .45 : 1;
    const scaledDefinition = { ...projectile.definition, damage: projectile.definition.damage * projectile.damageScale * splashScale, effect: projectile.appliesEffect ? projectile.definition.effect : null };
    damageTarget(projectile.tower, target, scaledDefinition);
    impactFx(target.x, target.y, projectile.definition.color, projectile.weapon, projectile.weapon === 'rocket' ? 34 : 20);
  });
  if (projectile.weapon === 'rocket') impactFx(projectile.targetX, projectile.targetY, projectile.definition.color, projectile.weapon, 42);
  if (!runtime.reducedMotion && ['boulder', 'fireball', 'sun'].includes(projectile.style)) cameraShake = Math.max(cameraShake, projectile.weapon === 'rocket' ? 5 : projectile.style === 'boulder' ? 5 : 3);
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
    if (!runtime.reducedMotion) {
      projectile.trail ||= [];
      projectile.trail.unshift({ x: projectile.x, y: projectile.y });
      projectile.trail.length = Math.min(5, projectile.trail.length);
      if (projectile.weapon === 'rocket' && Math.random() < .8) spawnFx(projectile.x - Math.cos(Math.atan2(projectile.targetY - projectile.y, projectile.targetX - projectile.x)) * 9, projectile.y, '#ff8b3d', { count: 1, speed: 20, size: 4, life: .32, shape: 'smoke' });
    }
    projectile.rotation += dt * (projectile.weapon === 'boomerang' ? 18 : 12);
    if (progress >= 1) resolveProjectile(projectile);
  });
  projectiles = projectiles.filter(projectile => !projectile.dead);
}
function updateFxParticles(dt) {
  fxParticles.forEach(p => {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.pow(p.drag, dt * 60);
    p.vy = p.vy * Math.pow(p.drag, dt * 60) + p.gravity * dt;
    p.rotation += p.spin * dt;
  });
  fxParticles = fxParticles.filter(p => p.life > 0);
}
function towerCombatContext() {
  const targets = [
    ...enemies.filter(enemy => !enemy.dead && enemy.hp > 0),
    ...(started && !gameWon ? activeMapObjects().map(object => { object.isStructure = true; object.routeProgress = -1; object.dist = -1; object.receiveDamage = amount => { object.hp -= amount; }; return object; }) : [])
  ];
  return {
    catalog: towerCatalog,
    patterns: attackPatterns,
    enemies: targets,
    positionOf: center,
    rangeOf: tower => currentAttackRadius(towerCatalog.get(tower.evo),tower),
    cooldownMultiplier: tower => formationCombatModifiers(tower).cooldown * growthCombatModifiers().cooldown * (towerSlotEffect(tower)?.cooldown||1),
    damage: damageTarget,
    visualize: () => {},
    launch: launchAttack
  };
}
function drawTerrainFeatures() {
  const terrain=terrainDefinition(),field=currentBattlefield();
  ctx.save();
  for(let patch=0;patch<7;patch++){
    const x=75+((patch*173+field.key.length*29)%850),y=55+((patch*97+field.key.length*41)%430);
    ctx.fillStyle=patch%2?'rgba(255,255,255,.035)':'rgba(35,72,43,.055)';ctx.beginPath();ctx.ellipse(x,y,78+(patch%3)*18,38+(patch%2)*15,patch*.38,0,Math.PI*2);ctx.fill();
  }
  terrain.blocked.forEach(([col,row],index)=>{
    const x=col*CELL+CELL/2,y=row*CELL+CELL/2,wobble=Math.sin(index*4.7)*3;
    ctx.fillStyle='rgba(29,54,35,.2)';ctx.beginPath();ctx.ellipse(x,y+18,28,9,0,0,Math.PI*2);ctx.fill();
    if(terrain.type==='water'){
      ctx.fillStyle='#4d91a0';ctx.strokeStyle='#9ed1c6';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(x,y,29,23,wobble*.02,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.strokeStyle='rgba(221,255,241,.65)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x-4,y,11,.2,2.7);ctx.stroke();ctx.fillStyle='#8ab85c';ctx.beginPath();ctx.ellipse(x+7,y-2,10,5,-.3,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#52794f';ctx.lineWidth=2;for(let reed=0;reed<3;reed++){ctx.beginPath();ctx.moveTo(x-24+reed*5,y+13);ctx.lineTo(x-25+reed*5,y-3-reed*3);ctx.stroke()}
    }else if(terrain.type==='rock'){
      ctx.fillStyle=index%2?'#75523f':'#855d43';ctx.strokeStyle='#4f392f';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x-25,y+14);ctx.lineTo(x-18+wobble,y-11);ctx.lineTo(x-3,y-23);ctx.lineTo(x+19,y-13);ctx.lineTo(x+27,y+13);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.strokeStyle='#d09456';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-4,y-20);ctx.lineTo(x+2,y-6);ctx.lineTo(x-8,y+5);ctx.stroke();
    }else if(terrain.type==='ice'){
      ctx.fillStyle='#d9e7e4';ctx.strokeStyle='#77999b';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x-27,y+14);ctx.lineTo(x-17,y-10);ctx.lineTo(x-4,y-22);ctx.lineTo(x+8,y-9);ctx.lineTo(x+19,y-16);ctx.lineTo(x+28,y+15);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.fillStyle='rgba(255,255,255,.72)';ctx.beginPath();ctx.moveTo(x-17,y-10);ctx.lineTo(x-4,y-22);ctx.lineTo(x+1,y-8);ctx.closePath();ctx.fill();
    }else{
      ctx.fillStyle='#70513a';roundedRect(x-7,y-2,14,27,4);ctx.fill();
      ctx.fillStyle=index%2?'#3e7d42':'#4f9149';ctx.beginPath();ctx.arc(x-13+wobble,y-7,16,0,Math.PI*2);ctx.arc(x+11+wobble,y-9,18,0,Math.PI*2);ctx.arc(x+wobble,y-24,17,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#7fbd58';ctx.beginPath();ctx.arc(x-8+wobble,y-18,6,0,Math.PI*2);ctx.fill();
    }
  });
  ctx.restore();
}
function drawGroundTexture() {
  const field=currentBattlefield(),terrain=terrainDefinition();ctx.save();ctx.lineCap='round';
  for(let index=0;index<72;index++){
    const x=12+((index*137+field.key.length*43)%936),y=12+((index*83+field.key.length*31)%516),size=2+(index%4);
    ctx.globalAlpha=.11+(index%3)*.025;
    if(terrain.type==='water'){
      ctx.strokeStyle=index%2?'#d6f2e7':'#367f83';ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(x,y,size*2,.15,Math.PI-.15);ctx.stroke();
    }else if(terrain.type==='rock'){
      ctx.strokeStyle=index%2?'#6f4a38':'#e2a05c';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(x-size,y-size);ctx.lineTo(x,y);ctx.lineTo(x-size*.4,y+size);ctx.lineTo(x+size,y+size*1.5);ctx.stroke();
    }else if(terrain.type==='ice'){
      ctx.strokeStyle=index%2?'#efffff':'#668d91';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(x-size*2,y);ctx.lineTo(x+size*2,y);ctx.moveTo(x,y-size*2);ctx.lineTo(x,y+size*2);ctx.stroke();
    }else{
      ctx.strokeStyle=index%2?'#376d3b':'#d8ef9d';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x,y+size);ctx.quadraticCurveTo(x-size,y,x-size*.5,y-size);ctx.moveTo(x,y+size);ctx.quadraticCurveTo(x+size,y,x+size*.6,y-size*1.2);ctx.stroke();
    }
  }
  ctx.restore();
}
function drawBuildPad(col,row,fill,stroke='transparent') {
  const x=col*CELL+CELL/2,y=row*CELL+CELL/2;
  ctx.fillStyle=fill;ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y,25,22,0,0,Math.PI*2);ctx.fill();if(stroke!=='transparent')ctx.stroke();
}
function drawBackfieldRoots() {
  const field=currentBattlefield(),end=currentPath(0).at(-1),originX=Math.min(W-30,end[0]-38),originY=end[1];
  const anchors=[[.52,.12],[.61,.27],[.55,.48],[.64,.69],[.53,.88]];
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=field.palette.accent;ctx.fillStyle=field.palette.accent;
  anchors.forEach(([xRatio,yRatio],index)=>{
    const targetX=W*xRatio,targetY=H*yRatio,bend=(index-2)*24;
    ctx.globalAlpha=.11+(index%2)*.035;ctx.lineWidth=10-index*.9;ctx.beginPath();ctx.moveTo(originX,originY);ctx.bezierCurveTo(originX-80,originY+bend,targetX+120,targetY-bend*.5,targetX,targetY);ctx.stroke();
    ctx.globalAlpha=.18;ctx.lineWidth=2.2;ctx.beginPath();ctx.moveTo(originX,originY);ctx.bezierCurveTo(originX-80,originY+bend,targetX+120,targetY-bend*.5,targetX,targetY);ctx.stroke();
    const angle=index%2?.55:-.55;ctx.save();ctx.translate(targetX,targetY);ctx.rotate(angle);ctx.globalAlpha=.24;ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(-13,-8,-24,-2);ctx.quadraticCurveTo(-12,8,0,0);ctx.fill();ctx.restore();
  });
  for(let index=0;index<4;index++){
    const x=W*(.61+index*.085),y=originY+(index%2?-1:1)*(86+index*13),pulse=runtime.reducedMotion?0:Math.sin(visualClock*1.6+index)*2;
    ctx.globalAlpha=.2;ctx.strokeStyle=field.palette.mote;ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,7+pulse,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=.16;ctx.fillStyle=field.palette.mote;ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}
function drawRitualSite() {
  const site=currentBattlefield().ritualSite;if(!site)return;const x=site[0]*CELL+CELL/2,y=site[1]*CELL+CELL/2,pulse=runtime.reducedMotion?0:Math.sin(visualClock*1.8)*2;
  const nodeColors=['#d6b65d','#c99b36','#d6b65d','#4f9d50','#fff0a0','#d95832','#d6b65d','#399dc4','#d6b65d'];
  ctx.save();ctx.translate(x,y);
  ctx.fillStyle='rgba(29,55,39,.16)';ctx.beginPath();for(let side=0;side<8;side++){const angle=-Math.PI/8+side*Math.PI/4,px=Math.cos(angle)*88,py=Math.sin(angle)*88;side?ctx.lineTo(px,py):ctx.moveTo(px,py)}ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(255,224,139,.58)';ctx.lineWidth=2.5;ctx.beginPath();for(let side=0;side<8;side++){const angle=-Math.PI/8+side*Math.PI/4,px=Math.cos(angle)*(86+pulse),py=Math.sin(angle)*(86+pulse);side?ctx.lineTo(px,py):ctx.moveTo(px,py)}ctx.closePath();ctx.stroke();
  ctx.strokeStyle='rgba(246,202,95,.34)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,68,0,Math.PI*2);ctx.stroke();ctx.setLineDash([3,6]);ctx.beginPath();ctx.arc(0,0,80,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
  ctx.strokeStyle='rgba(255,231,164,.3)';ctx.lineWidth=2;
  for(let offset=-1;offset<=1;offset++){
    ctx.beginPath();ctx.moveTo(-60,offset*60);ctx.lineTo(60,offset*60);ctx.stroke();
    ctx.beginPath();ctx.moveTo(offset*60,-60);ctx.lineTo(offset*60,60);ctx.stroke();
  }
  ctx.beginPath();ctx.moveTo(-60,-60);ctx.lineTo(60,60);ctx.moveTo(60,-60);ctx.lineTo(-60,60);ctx.stroke();
  let nodeIndex=0;for(let row=-1;row<=1;row++)for(let col=-1;col<=1;col++){
    const center=col===0&&row===0,radius=center?20:8;
    ctx.fillStyle=center?'rgba(31,55,40,.86)':'rgba(35,59,43,.72)';ctx.strokeStyle=nodeColors[nodeIndex++];ctx.lineWidth=center?3:2;ctx.beginPath();ctx.arc(col*60,row*60,radius,0,Math.PI*2);ctx.fill();ctx.stroke();
  }
  ctx.strokeStyle='rgba(255,239,181,.62)';ctx.lineWidth=2;for(let ray=0;ray<8;ray++){const angle=ray*Math.PI/4;ctx.beginPath();ctx.moveTo(Math.cos(angle)*24,Math.sin(angle)*24);ctx.lineTo(Math.cos(angle)*45,Math.sin(angle)*45);ctx.stroke()}
  ctx.fillStyle='#ffe5a0';ctx.font='900 14px Noto Sans SC';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('阵',0,1);ctx.restore();
}
function drawGrid() {
  const planning=Boolean(pendingDeployLevel||pendingDeployTowerIndex!==null||drag);
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
    if (isRoad(col, row)) continue;
    const seed = (col * 37 + row * 71) % 19;
    const effect=slotEffectAt(col,row),ritual=isRitualCell(col,row);
    if(!shouldDrawBuildSlot(col,row,planning))continue;
    const fill=effect?effect.fill:ritual?'rgba(246,202,95,.11)':planning?'rgba(229,246,185,.18)':'rgba(239,248,207,.09)';
    const stroke=effect?effect.stroke:ritual?'rgba(255,222,137,.34)':'rgba(238,255,214,.24)';
    drawBuildPad(col,row,fill,stroke);
    if(effect){const x=col*CELL+CELL/2,y=row*CELL+CELL/2;ctx.fillStyle=effect.stroke;ctx.font='900 13px Noto Sans SC';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(effect.icon,x,y+1)}
    ctx.strokeStyle = seed % 2 ? 'rgba(242,255,222,.2)' : 'rgba(51,100,49,.14)';
    ctx.lineWidth = 1.5;
    for (let blade = 0; blade < 3; blade++) {
      const x = col * CELL + 10 + ((seed * 13 + blade * 17) % 40);
      const y = row * CELL + 12 + ((seed * 7 + blade * 23) % 36);
      ctx.beginPath(); ctx.moveTo(x, y + 4); ctx.quadraticCurveTo(x - 2, y, x - 1, y - 4); ctx.stroke();
    }
    if(seed===4||seed===11){ctx.fillStyle=seed===4?'#f5d66d':'#dbeef0';ctx.beginPath();ctx.arc(col*CELL+18,row*CELL+20,2.2,0,Math.PI*2);ctx.arc(col*CELL+22,row*CELL+22,2,0,Math.PI*2);ctx.fill()}
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
    const col=Math.floor(x/CELL),row=Math.floor(y/CELL);if(isTerrainBlocked(col,row)||cellRoadDistance(col,row)<34)return;
    const sway = runtime.reducedMotion ? 0 : Math.sin(visualClock * 1.4 + index) * 1.3;
    ctx.fillStyle = 'rgba(35,74,42,.18)'; ctx.beginPath(); ctx.ellipse(x,y+r*.7,r*1.35,r*.55,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = index % 3 === 0 ? field.palette.shrub : `${field.palette.shrub}dd`;
    ctx.beginPath(); ctx.arc(x-r*.6+sway,y,r,0,Math.PI*2); ctx.arc(x+r*.45+sway,y+2,r*.82,0,Math.PI*2); ctx.arc(x+sway,y-r*.45,r*.7,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = index % 4 === 0 ? '#ffd269' : field.palette.mote; ctx.beginPath(); ctx.arc(x+r*.2+sway,y-r*.55,2.4,0,Math.PI*2); ctx.fill();
  });
  const routes=currentPaths(),end=routes[0].at(-1);
  routes.forEach((route,index)=>{const start=route[0],open=isRouteOpen(index);ctx.save();ctx.globalAlpha=open?1:.46;ctx.translate(Math.max(18,start[0]+35),start[1]);ctx.fillStyle=index?'#356a62':'#456b3e';ctx.beginPath();ctx.arc(0,0,27,0,Math.PI*2);ctx.fill();ctx.fillStyle='#7e4f2d';roundedRect(-7,7,14,27,4);ctx.fill();ctx.fillStyle=index?'#67aaa0':'#9bd05d';ctx.beginPath();ctx.arc(-10,-8,15,0,Math.PI*2);ctx.arc(9,-11,17,0,Math.PI*2);ctx.arc(0,-23,14,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;ctx.fillStyle=open?'#fff4cf':'#f3d8a4';ctx.font='900 9px Noto Sans SC';ctx.textAlign='center';ctx.fillText(open?`入口 ${String.fromCharCode(65+index)}`:`第 ${routeUnlockWave(index)} 波开放`,0,47);ctx.restore()});
  drawWorldTree(end);
  activeMapObjects().forEach(drawMapObject);
}
function drawMapObject(structure) {
  const pulse = runtime.reducedMotion ? 0 : Math.sin(visualClock * 2 + structure.col) * 2;
  const ratio = Math.max(0, structure.hp / structure.max);
  ctx.save(); ctx.translate(structure.x, structure.y);
  ctx.fillStyle = 'rgba(26,45,31,.26)'; ctx.beginPath(); ctx.ellipse(0, 22, 25, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = structure.kind === 'cache' ? '#5c7183' : structure.kind === 'monolith' ? '#6470a0' : '#6a7652'; ctx.strokeStyle = '#e6c36a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, pulse, 19, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f7df91'; ctx.font = '900 11px Noto Sans SC'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(structure.icon || '◆', 0, pulse);
  ctx.fillStyle = 'rgba(35,45,32,.72)'; roundedRect(-22, -31, 44, 5, 3); ctx.fill(); ctx.fillStyle = '#f3b94d'; roundedRect(-21, -30, 42 * ratio, 3, 2); ctx.fill();
  ctx.fillStyle = '#fff0af'; ctx.font = '800 9px Nunito'; ctx.fillText(`${structure.name} · +${structure.reward} 灵力`, 0, 32); ctx.restore();
}
function drawWorldTree(end) {
  const field=currentBattlefield(),x=Math.min(W-48,end[0]-46),y=end[1],sway=runtime.reducedMotion?0:Math.sin(visualClock*.9)*1.5;
  ctx.save();ctx.translate(x,y);
  ctx.fillStyle='rgba(26,54,33,.28)';ctx.beginPath();ctx.ellipse(0,33,46,13,0,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha=.26;ctx.strokeStyle='#ffe49a';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,-22,48+Math.sin(visualClock*1.2)*2,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;
  ctx.strokeStyle='#695037';ctx.lineWidth=8;ctx.lineCap='round';for(let root=0;root<5;root++){const targetX=(root-2)*20;ctx.beginPath();ctx.moveTo(0,17);ctx.quadraticCurveTo(targetX*.45,27,targetX,35);ctx.stroke()}
  ctx.fillStyle='#765237';ctx.strokeStyle='#4e392d';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-12,22);ctx.quadraticCurveTo(-8,-17,-18,-38);ctx.quadraticCurveTo(0,-29,18,-38);ctx.quadraticCurveTo(8,-15,13,22);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.strokeStyle='#b78a52';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-2,17);ctx.quadraticCurveTo(-7,-5,2,-28);ctx.stroke();
  const canopy=[[0,-52,30],[sway-25,-42,24],[sway+26,-41,25],[sway-15,-68,22],[sway+18,-70,21]];
  canopy.forEach(([cx,cy,radius],index)=>{ctx.fillStyle=index%2?field.palette.accent:field.palette.shrub;ctx.strokeStyle='rgba(36,72,40,.48)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.fill();ctx.stroke()});
  [[-23,-47],[5,-69],[24,-39],[-5,-35],[17,-62]].forEach(([fx,fy],index)=>{ctx.fillStyle=index%2?'#f49a31':'#ffb23e';ctx.strokeStyle='#bd5f25';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(fx+sway*(index%2?.5:-.35),fy,5.5,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='rgba(255,243,180,.7)';ctx.beginPath();ctx.arc(fx-1+sway*(index%2?.5:-.35),fy-2,1.4,0,Math.PI*2);ctx.fill()});
  ctx.fillStyle='rgba(30,53,38,.88)';roundedRect(-25,41,50,17,4);ctx.fill();ctx.strokeStyle='#d6a950';ctx.lineWidth=1.5;ctx.stroke();ctx.fillStyle='#ffe7a2';ctx.font='900 9px Noto Sans SC';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('世界树',0,49.5);ctx.restore();
}
function drawPathDetails(path,routeIndex=0) {
  const routeLength = pathLength(path),field=currentBattlefield();
  ctx.save();ctx.globalAlpha=isRouteOpen(routeIndex)?1:.28; ctx.strokeStyle='rgba(255,250,214,.38)';ctx.lineWidth=2;ctx.setLineDash([2,13]);ctx.beginPath();path.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.stroke();ctx.setLineDash([]);
  for(let distance=42+routeIndex*17;distance<routeLength-30;distance+=58){const p=pointAt(distance,path),q=pointAt(distance+8,path),dx=q.x-p.x,dy=q.y-p.y,length=Math.max(1,Math.hypot(dx,dy)),side=Math.floor(distance/58)%2?1:-1,x=p.x-dy/length*27*side,y=p.y+dx/length*27*side;ctx.fillStyle=field.palette.roadEdge;ctx.strokeStyle='rgba(73,51,32,.28)';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(x,y,5+(distance%3),3.5,(distance%11)*.1,0,Math.PI*2);ctx.fill();ctx.stroke()}
  for (let distance=72+routeIndex*23; distance<routeLength-45; distance+=76) { const p=pointAt(distance,path),q=pointAt(distance+10,path),a=Math.atan2(q.y-p.y,q.x-p.x),side=((distance/76)%2>.5?1:-1);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(a);ctx.fillStyle='rgba(120,82,44,.18)';ctx.beginPath();ctx.ellipse(-5,side*8,5,2.5,-.2,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(5,-side*8,5,2.5,.2,0,Math.PI*2);ctx.fill();ctx.restore(); }
  for (let distance=120+routeIndex*35; distance<routeLength-60; distance+=210) { const p=pointAt(distance,path),q=pointAt(distance+10,path),a=Math.atan2(q.y-p.y,q.x-p.x);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(a);ctx.fillStyle='rgba(104,75,42,.32)';ctx.beginPath();ctx.moveTo(10,0);ctx.lineTo(-5,-6);ctx.lineTo(-1,0);ctx.lineTo(-5,6);ctx.closePath();ctx.fill();ctx.restore(); }
  ctx.restore();
}
function drawRouteJunction() {
  const routes=currentPaths();if(routes.length<2)return;
  const junction=routes[0].slice(1,-1).find(point=>routes.slice(1).every(route=>route.some(other=>other[0]===point[0]&&other[1]===point[1])));if(!junction)return;
  const [x,y]=junction;ctx.save();ctx.fillStyle='rgba(255,196,80,.18)';ctx.strokeStyle='#f5c264';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,16,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='rgba(35,48,34,.86)';roundedRect(x-19,y-38,38,17,4);ctx.fill();ctx.fillStyle='#ffe3a1';ctx.font='900 9px Noto Sans SC';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('汇流口',x,y-29.5);ctx.restore();
}
function drawFusionHint() {
  if (!selectedTower || selectedTower.evo === 'base' || evolution[selectedTower.evo]?.fusion) return;
  const parent = towerBranch(selectedTower);
  const recipe = hiddenFusions.find(item => !discoveredEvolutions.has(item.result) && item.pattern.some(slot => slot.parent === parent));
  if (!recipe) return;
  const selectedSlot = recipe.pattern.find(slot => slot.parent === parent);
  const centerCol = selectedTower.col - selectedSlot.dx, centerRow = selectedTower.row - selectedSlot.dy;
  if(isRoad(centerCol,centerRow))return;
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
function drawBoomerangAttack(event) {
  const origin = attackOrigin(event.tower), target = event.targets[0];
  if (!target) return;
  const progress = Math.min(1, event.age / event.duration), outbound = Math.min(1, progress * 2.15), returnProgress = Math.max(0, progress * 2.15 - 1);
  const x = outbound < 1 ? origin.x + (target.x - origin.x) * outbound : target.x + (origin.x - target.x) * returnProgress;
  const y = outbound < 1 ? origin.y + (target.y - origin.y) * outbound : target.y + (origin.y - target.y) * returnProgress;
  const angle = Math.atan2(target.y - origin.y, target.x - origin.x) + event.age * 16;
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.globalAlpha=Math.min(1, progress*5)*Math.max(0,1-(progress-.65)*3);ctx.shadowColor=event.definition.color;ctx.shadowBlur=12;
  ctx.strokeStyle='#fff5b1';ctx.lineWidth=7;ctx.beginPath();ctx.arc(0,0,18,-1.05,1.05);ctx.stroke();ctx.strokeStyle=event.definition.color;ctx.lineWidth=3;ctx.stroke();ctx.restore();
  if (event.age >= event.impactAt) { ctx.save();ctx.globalAlpha=Math.max(0,1-(event.age-event.impactAt)*3);ctx.strokeStyle=event.definition.color;ctx.lineWidth=4;ctx.beginPath();ctx.arc(target.x,target.y,20,0,Math.PI*2);ctx.stroke();ctx.restore(); }
}
function drawWaterjetAttack(event) {
  const origin=attackOrigin(event.tower), focus=event.targets[event.pulseIndex % Math.max(1,event.targets.length)] || event.targets[0];
  if (!focus) return;
  const dx=focus.x-origin.x,dy=focus.y-origin.y,length=Math.max(1,Math.hypot(dx,dy)),nx=-dy/length,ny=dx/length;
  ctx.save();ctx.globalAlpha=.78;ctx.lineCap='round';ctx.strokeStyle='#e5ffff';ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(origin.x,origin.y);ctx.lineTo(focus.x,focus.y);ctx.stroke();ctx.strokeStyle=event.definition.color;ctx.lineWidth=4;ctx.stroke();
  for(let i=0;i<8;i++){const t=(i*1.7+event.age*8)%8/8,x=origin.x+dx*t+nx*Math.sin(i*4+event.age*12)*5,y=origin.y+dy*t+ny*Math.sin(i*4+event.age*12)*5;ctx.fillStyle='#c8fbff';ctx.beginPath();ctx.arc(x,y,3+(i%2),0,Math.PI*2);ctx.fill()}
  ctx.restore();
}
function drawScatterAttack(event) {
  const origin=attackOrigin(event.tower), focus=event.targets[0];
  if (!focus) return;
  const base=Math.atan2(focus.y-origin.y,focus.x-origin.x),length=Math.hypot(focus.x-origin.x,focus.y-origin.y);
  ctx.save();ctx.lineCap='round';[-.22,-.1,.02,.14,.26].forEach((offset,index)=>{const angle=base+offset, reach=length*(.72+(index%3)*.08),end={x:origin.x+Math.cos(angle)*reach,y:origin.y+Math.sin(angle)*reach};ctx.globalAlpha=.85-index*.08;ctx.strokeStyle=index%2?'#e8ffff':event.definition.color;ctx.lineWidth=index===2?6:3;ctx.beginPath();ctx.moveTo(origin.x,origin.y);ctx.lineTo(end.x,end.y);ctx.stroke();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(end.x,end.y,4,0,Math.PI*2);ctx.fill()});ctx.restore();
}
function drawDrillAttack(event) {
  const origin=attackOrigin(event.tower),focus=event.targets[0];
  if (!focus) return;
  const dx=focus.x-origin.x,dy=focus.y-origin.y,length=Math.max(1,Math.hypot(dx,dy)),angle=Math.atan2(dy,dx),reach=length+30;
  ctx.save();ctx.globalAlpha=.9;ctx.lineCap='round';ctx.strokeStyle='#d9ff9b';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(origin.x,origin.y);ctx.lineTo(origin.x+dx/length*reach,origin.y+dy/length*reach);ctx.stroke();ctx.translate(origin.x+dx/length*reach,origin.y+dy/length*reach);ctx.rotate(angle+event.age*22);ctx.fillStyle='#efffc0';ctx.strokeStyle='#397546';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(20,0);ctx.lineTo(-12,10);ctx.lineTo(-4,0);ctx.lineTo(-12,-10);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
}
function drawShadowOrbitAttack(event) {
  const origin=attackOrigin(event.tower), progress=Math.min(1,event.age/event.duration), alpha=Math.max(.2,1-progress*.8);
  ctx.save();ctx.globalAlpha=alpha;
  for(let index=0;index<3;index++){const angle=event.age*5+index*Math.PI*2/3,radius=30+index*7,x=origin.x+Math.cos(angle)*radius,y=origin.y+Math.sin(angle)*radius;ctx.save();ctx.translate(x,y);ctx.rotate(angle+Math.PI/2);ctx.fillStyle='#d9c4ff';ctx.strokeStyle=event.definition.color;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(12,0);ctx.lineTo(-8,5);ctx.lineTo(-4,0);ctx.lineTo(-8,-5);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore()}
  ctx.strokeStyle=event.definition.color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(origin.x,origin.y,38+Math.sin(event.age*8)*4,0,Math.PI*2);ctx.stroke();ctx.restore();
}
function drawMeteorAttack(event) {
  const radius=event.definition.combat?.splashRadius||100,pre=event.age<event.impactAt,progress=Math.max(0,Math.min(1,(event.age-event.impactAt)/.3));
  ctx.save();ctx.translate(event.focusX,event.focusY);ctx.globalAlpha=pre?.85:Math.max(0,1-progress);ctx.setLineDash(pre?[8,5]:[]);ctx.strokeStyle=event.definition.color;ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=event.definition.color+'24';ctx.fill();
  if(!pre){ctx.translate(0,-220+progress*220);ctx.rotate(event.age*8);ctx.fillStyle='#ffb840';ctx.strokeStyle='#fff0a0';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(0,-22);ctx.lineTo(14,12);ctx.lineTo(0,24);ctx.lineTo(-14,12);ctx.closePath();ctx.fill();ctx.stroke()}
  ctx.restore();
}
function drawMineAttack(event) {
  const radius=event.definition.combat?.splashRadius||82,armed=event.armed,pulse=.75+.25*Math.sin(event.age*12);
  ctx.save();ctx.translate(event.focusX,event.focusY);ctx.globalAlpha=armed?.9:.45;ctx.strokeStyle=armed?event.definition.color:'#a5ad9b';ctx.lineWidth=armed?4:2;ctx.setLineDash(armed?[]:[5,5]);ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=armed?event.definition.color+'38':'#89908355';ctx.beginPath();ctx.arc(0,0,13+(armed?pulse*3:0),0,Math.PI*2);ctx.fill();ctx.strokeStyle='#f5f2bd';ctx.lineWidth=3;for(let i=0;i<6;i++){const a=i*Math.PI/3;ctx.beginPath();ctx.moveTo(Math.cos(a)*8,Math.sin(a)*8);ctx.lineTo(Math.cos(a)*16,Math.sin(a)*16);ctx.stroke()}ctx.restore();
}
function drawSunbeamAttack(event) {
  const focus=event.targets[0];
  if (!focus) return;
  const alpha=Math.min(1,event.age/.12)*Math.max(0,1-(event.age-event.impactAt)/event.duration),width=22+Math.sin(event.age*20)*5;
  ctx.save();ctx.globalAlpha=Math.max(.15,alpha);ctx.fillStyle='#fff3a2';ctx.shadowColor=event.definition.color;ctx.shadowBlur=18;ctx.fillRect(focus.x-width/2,0,width,focus.y);ctx.fillStyle=event.definition.color+'99';ctx.fillRect(focus.x-width*.22,0,width*.44,focus.y);ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(focus.x,focus.y,18+Math.sin(event.age*18)*5,0,Math.PI*2);ctx.stroke();ctx.restore();
}
function drawQuakeAttack(event) {
  const progress=Math.min(1,Math.max(0,(event.age-event.impactAt)/.45)),radius=progress*(event.definition.combat?.splashRadius||92);
  ctx.save();ctx.globalAlpha=1-progress;ctx.strokeStyle=event.definition.color;ctx.lineWidth=7;ctx.beginPath();ctx.arc(event.focusX,event.focusY,radius,0,Math.PI*2);ctx.stroke();ctx.lineWidth=3;ctx.beginPath();ctx.arc(event.focusX,event.focusY,radius*.62,0,Math.PI*2);ctx.stroke();ctx.restore();
}
function drawMeleeAttack(event) {
  if (event.weapon === 'boomerang') { drawBoomerangAttack(event); return; }
  if (event.weapon === 'quake') { drawQuakeAttack(event); return; }
  const origin = attackOrigin(event.tower), target = event.targets[0];
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
  if (event.weapon === 'scatter') { drawScatterAttack(event); return; }
  if (event.weapon === 'drill') { drawDrillAttack(event); return; }
  const origin = attackOrigin(event.tower), focus = event.targets[0];
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
function drawAttackCharge(event) {
  if (event.age >= event.impactAt || !event.targets[0]) return;
  const progress=Math.max(0,Math.min(1,event.age/Math.max(.01,event.impactAt))),radius=18+progress*18,focus={x:event.focusX,y:event.focusY};
  ctx.save();ctx.globalAlpha=.25+.5*progress;ctx.strokeStyle=event.definition.color;ctx.lineWidth=2+progress*2;ctx.setLineDash([5,4]);ctx.beginPath();ctx.arc(focus.x,focus.y,radius+Math.sin(event.age*24)*3,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
  if(['rocket','meteor','mine'].includes(event.weapon)){ctx.globalAlpha=.35+.35*progress;ctx.fillStyle=event.definition.color+'32';ctx.beginPath();ctx.arc(focus.x,focus.y,(event.definition.combat?.splashRadius||86)*(.15+progress*.12),0,Math.PI*2);ctx.fill()}
  if(event.weapon==='lightning'){ctx.strokeStyle='#fff3a2';ctx.lineWidth=3;for(let i=0;i<4;i++){const x=focus.x+(i-1.5)*8;ctx.beginPath();ctx.moveTo(x,focus.y-24-progress*16);ctx.lineTo(x+Math.sin(event.age*18+i)*5,focus.y-7);ctx.stroke()}}
  ctx.restore();
}
function drawChainAttack(event) {
  if (event.weapon === 'waterjet') { drawWaterjetAttack(event); return; }
  if (event.weapon === 'shadowOrbit') { drawShadowOrbitAttack(event); return; }
  const points=[attackOrigin(event.tower),...event.targets.map(target=>({x:target.x,y:target.y}))];
  const visible=Math.min(event.targets.length,Math.max(0,Math.floor((event.age-event.impactAt)/.09)+1));
  const lineage=towerBranch(event.tower);
  ctx.save();ctx.lineCap='round';
  for(let index=0;index<visible;index++){
    const from=points[index],to=points[index+1],fade=Math.max(.2,1-(event.age-event.impactAt-index*.09)/event.duration);ctx.globalAlpha=fade;
    if(event.weapon==='lightning'||lineage==='thunder'||event.tower.evo==='froststorm'){drawJaggedLink(from,to,'#f7f0ff',9,event.seed+index);drawJaggedLink(from,to,event.definition.color,4,event.seed+index)}
    else{ctx.strokeStyle=lineage==='water'?'#c9f8ff':'#bba1e8';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.quadraticCurveTo((from.x+to.x)/2+12,(from.y+to.y)/2-12,to.x,to.y);ctx.stroke();ctx.strokeStyle=event.definition.color;ctx.lineWidth=3;ctx.stroke()}
  }
  ctx.restore();
}
function drawAreaAttack(event) {
  if (event.weapon === 'sunbeam') { drawSunbeamAttack(event); return; }
  const radius=event.definition.combat?.splashRadius||86,pre=event.age<event.impactAt;
  ctx.save();ctx.translate(event.focusX,event.focusY);
  if(pre){const pulse=.65+.25*Math.sin(event.age*28);ctx.globalAlpha=pulse;ctx.setLineDash([7,5]);ctx.strokeStyle=event.definition.color;ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=event.definition.color+'22';ctx.fill()}
  else{const progress=Math.min(1,(event.age-event.impactAt)/(event.duration-event.impactAt));ctx.globalAlpha=1-progress;ctx.fillStyle=event.definition.color+'55';ctx.beginPath();ctx.arc(0,0,radius*(.35+progress*.65),0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff2a0';ctx.lineWidth=7;ctx.stroke();for(let i=0;i<10;i++){ctx.rotate(Math.PI/5);ctx.beginPath();ctx.moveTo(radius*.35,0);ctx.lineTo(radius*.8,0);ctx.stroke()}}
  if(towerBranch(event.tower)==='yang'){ctx.globalAlpha=pre ? .35 : Math.max(0,1-(event.age-event.impactAt)*3);ctx.fillStyle='#fff2a0';ctx.fillRect(-18,-event.focusY,36,event.focusY)}
  ctx.restore();
}
function drawRainAttack(event) {
  if (event.weapon === 'mine') { drawMineAttack(event); return; }
  const radius=event.definition.combat?.splashRadius||90,pre=event.age<event.impactAt;
  ctx.save();ctx.translate(event.focusX,event.focusY);ctx.setLineDash(pre?[5,5]:[]);ctx.strokeStyle=event.definition.color;ctx.lineWidth=3;ctx.globalAlpha=pre?.8:Math.max(.15,1-event.age/event.duration);ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.stroke();ctx.fillStyle=event.definition.color+'25';ctx.fill();ctx.setLineDash([]);
  if(!pre){for(let i=0;i<9;i++){const x=Math.sin(event.seed+i*7.3)*radius*.75,y=((event.age-event.impactAt)*240+i*31)%(radius*2)-radius;ctx.strokeStyle=i%2?'#b9ef71':'#c4a4f2';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x,y-22);ctx.lineTo(x,y);ctx.stroke();ctx.fillStyle=ctx.strokeStyle;ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill()}}
  ctx.restore();
}
function drawNovaAttack(event) {
  if (event.weapon === 'meteor') { drawMeteorAttack(event); return; }
  if (event.weapon === 'shadowOrbit') { drawShadowOrbitAttack(event); return; }
  const origin=attackOrigin(event.tower),progress=Math.min(1,event.age/event.duration),radius=currentAttackRadius(event.definition,event.tower)*Math.min(1,progress*1.35),alpha=1-progress;
  ctx.save();ctx.globalAlpha=alpha;ctx.lineWidth=event.tower.evo==='taiji'?12:7;
  if(event.tower.evo==='fiveSpirit'){['#c99b36','#4f9d50','#399dc4','#d95832','#9c754d'].forEach((color,index)=>{ctx.strokeStyle=color;ctx.beginPath();ctx.arc(origin.x,origin.y,Math.max(6,radius-index*9),0,Math.PI*2);ctx.stroke()})}
  else{ctx.strokeStyle=event.definition.color;ctx.beginPath();ctx.arc(origin.x,origin.y,radius,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#f4efff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(origin.x,origin.y,radius*.72,0,Math.PI*2);ctx.stroke()}
  ctx.restore();
}
function drawAttackEvents(){attackEvents.forEach(event=>{drawAttackCharge(event);if(event.age<=(event.releaseAt||0))return;const age=event.age;event.age-=event.releaseAt||0;if(event.type==='melee')drawMeleeAttack(event);else if(event.type==='beam')drawBeamAttack(event);else if(event.type==='chain')drawChainAttack(event);else if(event.type==='area')drawAreaAttack(event);else if(event.type==='rain')drawRainAttack(event);else if(event.type==='nova')drawNovaAttack(event);event.age=age})}
function drawProjectile(projectile) {
  if (projectile.delay > 0) return;
  const definition = projectile.definition;
  const angle = Math.atan2(projectile.targetY - projectile.y, projectile.targetX - projectile.x);
  if (projectile.trail?.length > 1) {
    ctx.save();ctx.lineCap='round';
    for (let index=1;index<projectile.trail.length;index++) {
      const from=projectile.trail[index-1],to=projectile.trail[index];
      ctx.globalAlpha=(projectile.trail.length-index)/projectile.trail.length*.42;
      ctx.strokeStyle=definition.color;ctx.lineWidth=Math.max(1,7-index);
      ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke();
    }
    ctx.restore();
  }
  ctx.save(); ctx.translate(projectile.x, projectile.y); ctx.rotate(angle);
  ctx.shadowColor = definition.color; ctx.shadowBlur = 10;
  if (projectile.style === 'blade') {
    ctx.rotate(projectile.rotation); ctx.fillStyle = '#fff4b0'; ctx.strokeStyle = definition.color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(15,0); ctx.lineTo(0,6); ctx.lineTo(-15,0); ctx.lineTo(0,-6); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (projectile.style === 'thorn') {
    ctx.fillStyle = '#d9ff9b'; ctx.strokeStyle = '#28753d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(18,0); ctx.lineTo(-10,5); ctx.lineTo(-5,0); ctx.lineTo(-10,-5); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (projectile.style === 'bubble') {
    ctx.globalAlpha = .85; ctx.fillStyle = '#7ee9ff'; ctx.strokeStyle = '#e8fdff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0,0,9,0,Math.PI*2); ctx.fill(); ctx.stroke(); ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(-3,-3,2.5,0,Math.PI*2);ctx.fill();
  } else if (projectile.weapon === 'rocket') {
    ctx.fillStyle='#fff4b0';ctx.strokeStyle='#e64b2f';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(17,0);ctx.lineTo(2,8);ctx.lineTo(-12,6);ctx.lineTo(-15,0);ctx.lineTo(-12,-6);ctx.lineTo(2,-8);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle='#ff7b32';ctx.beginPath();ctx.moveTo(-12,-4);ctx.lineTo(-29,0);ctx.lineTo(-12,4);ctx.closePath();ctx.fill();
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
function drawFxParticles() {
  if (!fxParticles.length) return;
  ctx.save();ctx.globalCompositeOperation='lighter';
  fxParticles.forEach(p=>{const alpha=Math.max(0,p.life/p.maxLife),scale=.45+.55*alpha;ctx.save();ctx.globalAlpha=alpha;ctx.translate(p.x,p.y);ctx.rotate(p.rotation);ctx.fillStyle=p.color;ctx.strokeStyle=p.color;
    if(p.shape==='spark'){ctx.lineWidth=Math.max(1,p.size*.55);ctx.beginPath();ctx.moveTo(-p.size*1.8,0);ctx.lineTo(p.size*1.8,0);ctx.stroke();ctx.beginPath();ctx.moveTo(0,-p.size*1.8);ctx.lineTo(0,p.size*1.8);ctx.stroke()}
    else if(p.shape==='drop'){ctx.beginPath();ctx.moveTo(0,-p.size*1.8);ctx.quadraticCurveTo(p.size*1.4,0,0,p.size*1.4);ctx.quadraticCurveTo(-p.size*1.4,0,0,-p.size*1.8);ctx.fill()}
    else if(p.shape==='shard'){ctx.beginPath();ctx.moveTo(p.size*1.7,0);ctx.lineTo(-p.size,p.size*.7);ctx.lineTo(-p.size*.35,-p.size*.8);ctx.closePath();ctx.fill()}
    else if(p.shape==='smoke'){ctx.globalAlpha*=.45;ctx.beginPath();ctx.arc(0,0,p.size*scale,0,Math.PI*2);ctx.fill()}
    else{ctx.beginPath();ctx.arc(0,0,p.size*scale,0,Math.PI*2);ctx.fill()}
    ctx.restore();});ctx.restore();
}
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
function drawFace(size, mood = 'brave') {
  ctx.fillStyle='#26372d';
  const eyeY=-size*.12, eyeGap=size*.25;
  ctx.beginPath();ctx.arc(-eyeGap,eyeY,mood==='boss'?2.8:2.2,0,Math.PI*2);ctx.arc(eyeGap,eyeY,mood==='boss'?2.8:2.2,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#26372d';ctx.lineWidth=2;ctx.lineCap='round';ctx.beginPath();
  if(mood==='boss'){ctx.moveTo(-eyeGap-4,eyeY-5);ctx.lineTo(-eyeGap+3,eyeY-2);ctx.moveTo(eyeGap-3,eyeY-2);ctx.lineTo(eyeGap+4,eyeY-5)}
  else{ctx.arc(0,size*.1,size*.16,.18,Math.PI-.18)}
  ctx.stroke();
}
function towerAimAngle(tower) {
  const origin=center(tower), target=enemies.filter(enemy=>!enemy.dead&&enemy.hp>0)
    .map(enemy=>({enemy,distance:Math.hypot(enemy.x-origin.x,enemy.y-origin.y)}))
    .sort((left,right)=>left.distance-right.distance)[0]?.enemy;
  return target ? Math.atan2(target.y-origin.y,target.x-origin.x) : -Math.PI/2;
}
function drawTowerWeapon(tower, data) {
  const weapon=data.combat?.weapon||'seedshot', angle=towerAimAngle(tower), pulse=.75+.25*Math.sin(visualClock*5+tower.col);
  ctx.save();ctx.translate(0,-7);ctx.rotate(angle);ctx.lineCap='round';ctx.lineJoin='round';ctx.shadowColor=data.color;ctx.shadowBlur=weapon==='meteor'||weapon==='sunbeam'?12:7;
  if(weapon==='boomerang'){
    ctx.fillStyle='#5c4732';ctx.strokeStyle='#e9c45e';ctx.lineWidth=3;roundedRect(5,-5,27,10,4);ctx.fill();ctx.stroke();ctx.translate(31,0);ctx.rotate(-.35);ctx.beginPath();ctx.arc(0,0,16,-1.1,1.1);ctx.strokeStyle='#fff4ac';ctx.lineWidth=7;ctx.stroke();ctx.strokeStyle=data.color;ctx.lineWidth=3;ctx.stroke();
  }else if(weapon==='rocket'){
    ctx.fillStyle='#7b4938';ctx.strokeStyle='#ffcc83';ctx.lineWidth=2;roundedRect(2,-8,25,16,4);ctx.fill();ctx.stroke();ctx.fillStyle='#f7f1cf';ctx.strokeStyle='#db4f32';ctx.beginPath();ctx.moveTo(38,0);ctx.lineTo(24,8);ctx.lineTo(24,-8);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#ff762f';ctx.beginPath();ctx.moveTo(3,-4);ctx.lineTo(-13,0);ctx.lineTo(3,4);ctx.closePath();ctx.fill();
  }else if(weapon==='waterjet'){
    ctx.fillStyle='#496d75';ctx.strokeStyle='#c8fbff';ctx.lineWidth=3;roundedRect(5,-8,27,16,5);ctx.fill();ctx.stroke();ctx.fillStyle='#e8ffff';ctx.beginPath();ctx.arc(35,0,6,0,Math.PI*2);ctx.fill();ctx.fillStyle='#7ee9ff';[-6,0,6].forEach(y=>{ctx.beginPath();ctx.arc(41,y,2.5,0,Math.PI*2);ctx.fill()});
  }else if(weapon==='scatter'){
    ctx.fillStyle='#4c7370';ctx.strokeStyle='#dcffff';ctx.lineWidth=3;[-9,0,9].forEach(y=>{roundedRect(2,y-3,28,6,3);ctx.fill();ctx.stroke()});ctx.fillStyle=data.color;ctx.beginPath();ctx.arc(32,0,5,0,Math.PI*2);ctx.fill();
  }else if(weapon==='drill'){
    ctx.fillStyle='#3e6f45';ctx.strokeStyle='#d9ff9b';ctx.lineWidth=3;roundedRect(0,-9,22,18,4);ctx.fill();ctx.stroke();ctx.fillStyle='#efffc0';ctx.beginPath();ctx.moveTo(42,0);ctx.lineTo(18,12);ctx.lineTo(24,0);ctx.lineTo(18,-12);ctx.closePath();ctx.fill();ctx.stroke();
  }else if(weapon==='meteor'){
    ctx.rotate(-angle);ctx.translate(-10,-27);ctx.globalAlpha=.45+.3*pulse;ctx.strokeStyle='#ffcf60';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,18,0,Math.PI*2);ctx.stroke();ctx.rotate(visualClock*2);ctx.strokeStyle='#fff2ad';ctx.beginPath();ctx.moveTo(-13,0);ctx.lineTo(13,0);ctx.moveTo(0,-13);ctx.lineTo(0,13);ctx.stroke();ctx.fillStyle='#ff7b32';ctx.beginPath();ctx.arc(0,0,6,0,Math.PI*2);ctx.fill();
  }else if(weapon==='lightning'){
    ctx.fillStyle='#524a78';ctx.strokeStyle='#f4eaff';ctx.lineWidth=3;roundedRect(2,-6,24,12,3);ctx.fill();ctx.stroke();ctx.strokeStyle='#fff0a4';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(31,-14);ctx.lineTo(23,-2);ctx.lineTo(31,-3);ctx.lineTo(24,12);ctx.stroke();
  }else if(weapon==='mine'){
    ctx.rotate(-angle);ctx.translate(0,19);ctx.fillStyle='#273b35';ctx.strokeStyle='#e5c86b';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,12,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.strokeStyle='#ffed9a';for(let i=0;i<4;i++){const a=i*Math.PI/2;ctx.beginPath();ctx.moveTo(Math.cos(a)*7,Math.sin(a)*7);ctx.lineTo(Math.cos(a)*14,Math.sin(a)*14);ctx.stroke()}
  }else if(weapon==='sunbeam'){
    ctx.rotate(-angle);ctx.strokeStyle='#fff2a0';ctx.lineWidth=3;ctx.globalAlpha=.72+.2*pulse;ctx.beginPath();ctx.arc(0,0,24,0,Math.PI*2);ctx.stroke();ctx.lineWidth=2;for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.beginPath();ctx.moveTo(Math.cos(a)*28,Math.sin(a)*28);ctx.lineTo(Math.cos(a)*35,Math.sin(a)*35);ctx.stroke()}
  }else if(weapon==='shadowOrbit'){
    ctx.rotate(-angle);ctx.globalAlpha=.8;ctx.strokeStyle='#cdb7ff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,31,0,Math.PI*2);ctx.stroke();for(let i=0;i<3;i++){const a=visualClock*2.4+i*Math.PI*2/3;ctx.save();ctx.translate(Math.cos(a)*31,Math.sin(a)*31);ctx.rotate(a+Math.PI/2);ctx.fillStyle='#e3d4ff';ctx.beginPath();ctx.moveTo(9,0);ctx.lineTo(-6,5);ctx.lineTo(-3,0);ctx.lineTo(-6,-5);ctx.closePath();ctx.fill();ctx.restore()}
  }else if(weapon==='quake'){
    ctx.rotate(-angle);ctx.strokeStyle='#e6c488';ctx.lineWidth=3;ctx.globalAlpha=.6+.3*pulse;ctx.beginPath();ctx.moveTo(-25,20);ctx.lineTo(-10,8);ctx.lineTo(-2,18);ctx.lineTo(10,4);ctx.lineTo(25,14);ctx.stroke();ctx.strokeStyle=data.color;ctx.beginPath();ctx.arc(0,18,8,0,Math.PI*2);ctx.stroke();
  }else{
    ctx.fillStyle='#9b693d';ctx.strokeStyle='#f2d49b';ctx.lineWidth=2;roundedRect(5,-5,25,10,4);ctx.fill();ctx.stroke();
  }
  ctx.restore();
}
function towerAttackPose(tower) {
  const animation=tower.attackAnimation;
  if(!animation) return {x:0,y:0,rotation:0,scale:1};
  const progress=Math.min(1,animation.age/Math.max(.01,animation.duration)),target=animation.target;
  const origin=center(tower),dx=target?target.x-origin.x:0,dy=target?target.y-origin.y:0,length=Math.max(1,Math.hypot(dx,dy)),nx=dx/length,ny=dy/length;
  const action=progress<.35?progress/.35:progress<.55?1-(progress-.35)/.2:Math.max(0,1-(progress-.55)/.45),recovery=Math.max(0,(progress-.62)/.38);
  const pose={x:0,y:0,rotation:0,scale:1};
  if(['seedshot','rocket','waterjet','scatter'].includes(animation.weapon)){pose.x=-nx*action*7;pose.y=-ny*action*7;pose.rotation=ny*action*.08;}
  if(animation.weapon==='boomerang'){pose.x=nx*action*10;pose.y=ny*action*10;pose.rotation=ny*action*.18;}
  if(animation.weapon==='drill'){pose.x=nx*action*6;pose.y=ny*action*6;pose.rotation=ny*action*.14;}
  if(animation.weapon==='quake'){pose.x=nx*action*13;pose.y=ny*action*13;pose.rotation=ny*action*.22;pose.scale=1+action*.06;}
  if(animation.weapon==='lightning'){pose.x=-nx*action*5;pose.y=-ny*action*5;pose.rotation=ny*action*.12;}
  if(['meteor','sunbeam','shadowOrbit'].includes(animation.weapon)){pose.y=-action*5;pose.scale=1+action*.05;}
  if(animation.weapon==='mine'){pose.y=action*4;pose.rotation=ny*action*.08;}
  if(recovery>0){pose.x*=1-recovery*.35;pose.y*=1-recovery*.35;}
  return pose;
}
function modelActionProgress(tower) {
  const animation=tower.attackAnimation;
  if(!animation) return { progress: 0, strike: 0, recover: 0 };
  const progress=Math.min(1,animation.age/Math.max(.01,animation.duration));
  const smooth = value => value * value * (3 - 2 * value);
  const release = Math.max(.2, Math.min(.7, (animation.releaseAt || animation.duration * .4) / animation.duration));
  const windupEnd = release * .7;
  const contactEnd = Math.min(.86, release + .2);
  const anticipation = progress < windupEnd ? smooth(progress / windupEnd) : 0;
  const strike = progress < windupEnd ? 0 : progress < release ? smooth((progress - windupEnd) / Math.max(.01, release - windupEnd)) : 1;
  const recoil = progress < contactEnd ? 1 : Math.max(0, 1 - (progress - contactEnd) / Math.max(.01, 1 - contactEnd));
  const recover = progress < contactEnd ? 0 : smooth(Math.min(1, (progress - contactEnd) / Math.max(.01, 1 - contactEnd)));
  return { progress, anticipation, strike, recoil, recover };
}
function modelBodyPose(tower) {
  const animation=tower.attackAnimation, action=modelActionProgress(tower), branch=towerBranch(tower);
  const origin=center(tower), target=animation?.target;
  const dx=(target?.x ?? origin.x)-origin.x, dy=(target?.y ?? origin.y)-origin.y;
  const distance=Math.max(1,Math.hypot(dx,dy)), nx=dx/distance, ny=dy/distance;
  const a=action.anticipation, t=action.strike*action.recoil;
  const pose={x:0,y:0,rotation:0,scaleX:1,scaleY:1};
  if(!animation) return pose;
  if(branch==='metal') {
    pose.x=nx*(t*18-a*12); pose.y=ny*(t*8-a*4)+a*5-t*7; pose.rotation=ny*(t*.26-a*.18);
    pose.scaleX=1-a*.16+t*.12; pose.scaleY=1+a*.16-t*.12;
  } else if(branch==='fire') {
    pose.x=nx*(t*15-a*10); pose.y=a*6-t*15; pose.rotation=ny*(t*.2-a*.16);
    pose.scaleX=1+a*.22-t*.16; pose.scaleY=1-a*.2+t*.3;
  } else if(branch==='water') {
    pose.x=nx*(t*13-a*9); pose.y=ny*(t*7-a*4)+a*3-t*9; pose.rotation=-ny*(t*.32-a*.16);
    pose.scaleX=1-a*.18+t*.16; pose.scaleY=1+a*.2-t*.1;
  } else if(branch==='wood') {
    pose.x=nx*(t*20-a*12); pose.y=ny*(t*8-a*4)+a*4-t*8; pose.rotation=ny*(t*.42-a*.2);
    pose.scaleX=1-a*.12+t*.1; pose.scaleY=1+a*.12-t*.08;
  } else if(branch==='earth') {
    pose.x=nx*(t*10-a*6); pose.y=a*19+t*27; pose.rotation=ny*(t*.18-a*.12);
    pose.scaleX=1-a*.16+t*.14; pose.scaleY=1+a*.18+t*.24;
  }
  return pose;
}
function modelPartPose(tower, part) {
  const action=modelActionProgress(tower), branch=towerBranch(tower), anticipation=action.anticipation, thrust=action.strike*action.recoil;
  const side=['leftLeg','leftFoot','leftArm','leftBranch','leftFin'].includes(part)?-1:1, pose={x:0,y:0,rotation:0,scaleX:1,scaleY:1};
  if(!tower.attackAnimation) return pose;
  if(part==='head') {
    pose.x=anticipation*-3+thrust*4; pose.y=anticipation*3-thrust*5;
    pose.rotation=branch==='fire' ? -anticipation*.12+thrust*.08 : anticipation*.08-thrust*.1;
    pose.scaleX=1+anticipation*.025; pose.scaleY=1-anticipation*.025;
  } else if(['leftLeg','rightLeg','leftFoot','rightFoot'].includes(part)) {
    const step=anticipation*.9+thrust*.45;
    pose.x=side*step*(branch==='earth'?5:3); pose.y=anticipation*3+thrust*2;
    pose.rotation=side*(anticipation*.12-thrust*.18);
    pose.scaleX=1+anticipation*.04; pose.scaleY=1-anticipation*.05;
  } else if(part==='topSprout') {
    pose.x=-anticipation*4+thrust*5; pose.y=anticipation*3-thrust*7;
    pose.rotation=-anticipation*.18+thrust*.28;
  } else if(part==='leftFin' || part==='rightFin') {
    pose.x=side*(anticipation*5-thrust*3); pose.y=anticipation*3-thrust*4;
    pose.rotation=side*(anticipation*.3-thrust*.58);
  }
  return pose;
}
function modelLimbPose(tower, side) {
  const animation=tower.attackAnimation, action=modelActionProgress(tower), branch=towerBranch(tower);
  const origin=center(tower), target=animation?.target;
  const dx=(target?.x ?? origin.x)-origin.x, dy=(target?.y ?? origin.y)-origin.y;
  const distance=Math.max(1,Math.hypot(dx,dy)), nx=dx/distance, ny=dy/distance;
  const sign=side==='left'?-1:1, anticipation=action.anticipation, thrust=action.strike*action.recoil;
  const pose={x:0,y:0,rotation:0};
  if(!animation) return pose;
  if(branch==='metal') {
    pose.x=nx*thrust*30-sign*anticipation*11; pose.y=ny*thrust*16-anticipation*10;
    pose.rotation=sign*(anticipation*.42-thrust*1.18);
  } else if(branch==='fire') {
    pose.x=nx*thrust*23+sign*thrust*11; pose.y=-anticipation*13-thrust*16;
    pose.rotation=sign*(anticipation*.62-thrust*1.55);
  } else if(branch==='water') {
    pose.x=nx*thrust*27+sign*thrust*12; pose.y=ny*thrust*13-anticipation*11;
    pose.rotation=sign*(anticipation*.5-thrust*1.05);
  } else if(branch==='wood') {
    pose.x=nx*thrust*34+sign*thrust*14; pose.y=ny*thrust*15-anticipation*12-thrust*10;
    pose.rotation=sign*(anticipation*.56-thrust*1.62);
  } else if(branch==='earth') {
    pose.x=nx*thrust*18; pose.y=anticipation*20+thrust*34;
    pose.rotation=sign*(anticipation*.25+thrust*.82);
  }
  return pose;
}
function drawPrimaryEvolutionArt(tower, data, art) {
  const action=modelActionProgress(tower), bodyPose=modelBodyPose(tower), layers=primaryEvolutionLayers[tower.evo];
  const artSize=58, artY=-7-artSize/2, sourceSize=layers?.width || 2048;
  const drawImageFrame=(image, framePose, alpha=1) => {
    ctx.save();
    ctx.globalAlpha=alpha;
    ctx.translate(framePose.x,framePose.y);
    ctx.rotate(framePose.rotation);
    ctx.scale(framePose.scaleX || 1,framePose.scaleY || 1);
    ctx.drawImage(image,-artSize/2,artY,artSize,artSize);
    ctx.restore();
  };
  if(!layers) { drawImageFrame(art,bodyPose); return; }
  drawImageFrame(layers.base,bodyPose);
  const drawPart=(layer,part,alpha=1,extra={}) => {
    const pose=['leftArm','rightArm','leftBranch','rightBranch','leftFin','rightFin'].includes(part)
      ? modelLimbPose(tower,part.startsWith('left')?'left':'right')
      : modelPartPose(tower,part);
    const pivotX=artY+layer.pivot[1]*artSize/sourceSize;
    const pivotY=-artSize/2+layer.pivot[0]*artSize/sourceSize;
    ctx.save();
    ctx.globalAlpha=alpha;
    ctx.translate(bodyPose.x,bodyPose.y);
    ctx.rotate(bodyPose.rotation);
    ctx.scale(bodyPose.scaleX,bodyPose.scaleY);
    ctx.translate(pose.x+extra.x+pivotY,pose.y+extra.y+pivotX);
    ctx.rotate(pose.rotation+extra.rotation);
    ctx.translate(-pivotY,-pivotX);
    ctx.drawImage(layer.canvas,0,0,sourceSize,sourceSize,-artSize/2,artY,artSize,artSize);
    ctx.restore();
  };
  const orderByBranch = {
    metal: ['leftLeg','rightLeg','head','leftArm','rightArm'],
    fire: [],
    earth: ['leftLeg','rightLeg','leftArm','rightArm'],
    water: ['leftFoot','rightFoot','leftFin','rightFin'],
    wood: ['leftFoot','rightFoot','topSprout','leftBranch','rightBranch']
  };
  const parts = new Map(layers.layers.map(layer => [layer.name, layer]));
  (orderByBranch[towerBranch(tower)] || []).forEach(part => {
    const layer=parts.get(part);
    if(layer) drawPart(layer,part);
  });
}
function drawModelActionAccent(tower,data,action) {
  if(!tower.attackAnimation || !tower.attackAnimation.released || runtime.reducedMotion) return;
  const branch=towerBranch(tower), origin=center(tower), target=tower.attackAnimation.target;
  const angle=target?Math.atan2(target.y-origin.y,target.x-origin.x):-Math.PI/2;
  const releaseAge=Math.max(0,tower.attackAnimation.age-tower.attackAnimation.releaseAt), impact=Math.max(0,Math.min(1,releaseAge/.18)), fade=1-action.recover*.7;
  const bodyPose=modelBodyPose(tower);
  ctx.save();ctx.translate(bodyPose.x,bodyPose.y);ctx.rotate(angle);ctx.globalAlpha=fade;
  ctx.lineCap='round';
  if(branch==='metal') {
    ctx.strokeStyle='#fff4b0';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(18,-8);ctx.lineTo(34+impact*27,8);ctx.stroke();ctx.strokeStyle='#ffe28a';ctx.lineWidth=3;ctx.stroke();
    ctx.globalAlpha=fade*.8;ctx.lineWidth=3;ctx.beginPath();ctx.arc(30,0,20+impact*15,-1.2,.35);ctx.stroke();
  } else if(branch==='fire') {
    ctx.strokeStyle='#fff3a2';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(19,0);ctx.lineTo(39+impact*30,0);ctx.stroke();ctx.strokeStyle='#ff7b2f';ctx.lineWidth=4;ctx.stroke();
    ctx.fillStyle='#ffb62e';ctx.strokeStyle='#fff0a0';ctx.lineWidth=2;for(let index=0;index<4;index++){const x=25+index*7+impact*10,y=(index%2?1:-1)*6;ctx.beginPath();ctx.moveTo(x,y+8);ctx.quadraticCurveTo(x-7,y-3,x,y-15-impact*5);ctx.quadraticCurveTo(x+8,y-2,x,y+8);ctx.fill();ctx.stroke()}
  } else if(branch==='water') {
    ctx.strokeStyle='#e5ffff';ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(18,0);ctx.lineTo(40+impact*34,0);ctx.stroke();ctx.strokeStyle='#75dff0';ctx.lineWidth=4;ctx.stroke();
    ctx.fillStyle='#a9f5ff';for(let index=0;index<7;index++){const x=26+impact*30+index*5,y=(index%3-1)*7;ctx.beginPath();ctx.arc(x,y,2.5,0,Math.PI*2);ctx.fill()}
  } else if(branch==='wood') {
    ctx.strokeStyle='#eaffae';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(17,-2);ctx.lineTo(43+impact*35,0);ctx.stroke();ctx.fillStyle='#caff70';ctx.strokeStyle='#4d813c';ctx.lineWidth=1.5;
    for(let index=0;index<5;index++){const x=26+impact*28+index*7,y=(index%2?1:-1)*(7+index*2);ctx.save();ctx.translate(x,y);ctx.rotate((index%2?-1:1)*(.65+impact));ctx.beginPath();ctx.ellipse(0,0,7,3.5,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore()}
  } else if(branch==='earth') {
    ctx.strokeStyle='#d1a16a';ctx.lineWidth=4;ctx.globalAlpha=.85*fade;ctx.beginPath();ctx.arc(20,24,14+impact*28,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='#b98751';for(let index=0;index<5;index++){const x=12+index*10+impact*9,y=27-Math.abs(index-2)*4;ctx.beginPath();ctx.arc(x,y,3+impact*2,0,Math.PI*2);ctx.fill()}
  }
  ctx.restore();
}
function modelMuzzlePoint(tower, target, data) {
  const origin=center(tower), branch=towerBranch(tower), dx=target.x-origin.x, dy=target.y-origin.y, length=Math.max(1,Math.hypot(dx,dy)), nx=dx/length, ny=dy/length;
  const side = branch==='metal' || branch==='wood' ? (target.y < origin.y ? -1 : 1) : 0;
  const offsets={ metal:36, fire:30, water:36, wood:34, earth:38 };
  const distance=offsets[branch]||30;
  const pose = modelBodyPose(tower);
  return { x: origin.x+pose.x+nx*distance-side*ny*10, y: origin.y+pose.y+ny*distance+side*nx*10 };
}
function attackOrigin(tower) {
  const origin=center(tower);
  if(!hasPrimaryEvolutionArt(tower) || !tower.attackAnimation) return origin;
  const pose=modelBodyPose(tower);
  return { x: origin.x+pose.x, y: origin.y+pose.y };
}
function drawTower(tower) {
  const position=drag&&drag.tower===tower?{x:drag.x,y:drag.y}:center(tower),data=evolution[tower.evo];
  const selected=tower===selectedTower&&!selectedEnemy;
  const modelArt=hasPrimaryEvolutionArt(tower)&&primaryEvolutionImages[tower.evo];
  const bob=0;
  const pose=modelArt?{x:0,y:0,rotation:0,scale:1}:towerAttackPose(tower);
  ctx.save();ctx.translate(position.x+pose.x,position.y+bob+pose.y);ctx.rotate(pose.rotation);ctx.scale(pose.scale,pose.scale);
  if(drag&&drag.tower===tower){ctx.shadowColor='rgba(35,60,40,.35)';ctx.shadowBlur=16;ctx.shadowOffsetY=8}
  ctx.fillStyle='rgba(38,70,40,.25)';ctx.beginPath();ctx.ellipse(0,18-bob,27,10,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=selected?'#f5d86b':'#805f3e';ctx.beginPath();ctx.ellipse(0,13,24,10,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#b98a54';roundedRect(-20,4,40,13,5);ctx.fill();ctx.strokeStyle='#60472f';ctx.lineWidth=2;ctx.stroke();
  if(!modelArt) drawTowerWeapon(tower, data);
  const art=modelArt;
  if(art){
    drawPrimaryEvolutionArt(tower,data,art);
  }else if(tower.evo==='base'){
    ctx.fillStyle='#9b6338';ctx.beginPath();ctx.arc(0,-7,19,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#68472f';ctx.beginPath();ctx.arc(0,-19,17,Math.PI,Math.PI*2);ctx.lineTo(17,-18);ctx.quadraticCurveTo(0,-10,-17,-18);ctx.fill();
    ctx.strokeStyle='#4f3928';ctx.lineWidth=2;for(let x=-10;x<=10;x+=7){ctx.beginPath();ctx.moveTo(x,-23);ctx.lineTo(x+4,-16);ctx.stroke()}
    ctx.fillStyle='#79a94f';ctx.beginPath();ctx.ellipse(11,-28,9,4,-.5,0,Math.PI*2);ctx.fill();drawFace(18);
  }else{
    ctx.fillStyle=data.color;ctx.beginPath();ctx.arc(0,-7,23,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.7)';ctx.lineWidth=3;ctx.stroke();ctx.font='27px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(data.icon,0,-7);
  }
  if(tower.level>=10){ctx.strokeStyle='#fff2a0';ctx.lineWidth=2;ctx.globalAlpha=.7+.3*Math.sin(visualClock*4);ctx.beginPath();ctx.arc(0,-7,28,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1}
  ctx.fillStyle='#26382d';roundedRect(-20,22,40,15,7);ctx.fill();ctx.fillStyle='#fff';ctx.font='900 10px Nunito';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(`Lv ${tower.level}`,0,29.5);
  if (tower.level < MAX_LEVEL && (tower.growth || 0) > 0) {
    const progress = Math.min(1, (tower.growth || 0) / growthThreshold(tower.level));
    ctx.fillStyle='rgba(24,43,31,.82)';roundedRect(-22,40,44,5,3);ctx.fill();
    ctx.fillStyle='#b9e87d';roundedRect(-21,41,42*progress,3,2);ctx.fill();
  }
  ctx.restore();
}
function drawEnemyBody(enemy) {
  const data=enemy.definition||enemyTypes[enemy.type],r=enemy.radius||15,primary=enemyTraits[enemy.traits[0]]||{color:'#6f8f66'};
  const route=currentPath(enemy.routeIndex||0),next=pointAt(Math.min(enemy.routeLength||pathLength(route),enemy.dist+5),route),direction=next.x<enemy.x?-1:1;
  const step=runtime.reducedMotion?0:Math.sin(visualClock*(enemy.type==='boss'?4:7)+enemy.dist*.05);
  const flying=enemy.archetype==='glimmermoth',lift=flying?-8+step*3:Math.abs(step)*-2;
  const hitScale=enemy.visualHit>0?1.12:1;
  ctx.save();ctx.fillStyle='rgba(39,63,40,.24)';ctx.beginPath();ctx.ellipse(enemy.x,enemy.y+r*.78,r*1.05,flying?4:r*.34,0,0,Math.PI*2);ctx.fill();ctx.translate(enemy.x,enemy.y+lift);ctx.scale(direction*hitScale,hitScale);ctx.rotate(flying?step*.04:step*.025);
  ctx.lineJoin='round';ctx.lineCap='round';
  if(enemy.archetype==='mossling'){
    ctx.fillStyle='#5f9d4d';ctx.beginPath();ctx.arc(0,1,r,0,Math.PI*2);ctx.fill();ctx.fillStyle='#8fca62';ctx.beginPath();ctx.ellipse(-5,-r+1,9,4,-.7,0,Math.PI*2);ctx.ellipse(5,-r-1,9,4,.7,0,Math.PI*2);ctx.fill();drawFace(r);
    ctx.strokeStyle='#426d3c';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-7,r-2);ctx.lineTo(-10,r+6+step*2);ctx.moveTo(7,r-2);ctx.lineTo(10,r+6-step*2);ctx.stroke();
  }else if(enemy.archetype==='bramblehog'){
    ctx.fillStyle='#6c8b4d';ctx.beginPath();ctx.ellipse(0,2,r*1.15,r*.82,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#b39a58';for(let i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(i*7-5,-r*.55);ctx.lineTo(i*7,-r-9-Math.abs(i)*2);ctx.lineTo(i*7+5,-r*.5);ctx.fill()}drawFace(r);
  }else if(enemy.archetype==='glimmermoth'){
    ctx.fillStyle='rgba(193,239,206,.82)';ctx.beginPath();ctx.ellipse(-r*.72,0,r*.75,r*.5,-.35-step*.12,0,Math.PI*2);ctx.ellipse(r*.72,0,r*.75,r*.5,.35+step*.12,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#e7fff1';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#557b63';ctx.beginPath();ctx.ellipse(0,0,r*.45,r*.75,0,0,Math.PI*2);ctx.fill();drawFace(r*.75);
  }else if(enemy.archetype==='shellguard'){
    ctx.fillStyle='#697784';ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#aeb9bd';ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,r*.67,-2.5,2.5);ctx.stroke();ctx.fillStyle='#4d5c62';roundedRect(-r*.78,-r*.3,r*1.56,r*.7,5);ctx.fill();drawFace(r,'boss');
  }else if(enemy.archetype==='mireseer'){
    ctx.fillStyle='#55785e';ctx.beginPath();ctx.arc(0,2,r*.9,0,Math.PI*2);ctx.fill();ctx.fillStyle='#725889';ctx.beginPath();ctx.moveTo(-r,-2);ctx.quadraticCurveTo(0,-r*1.55,r,-2);ctx.lineTo(r*.65,r*.75);ctx.lineTo(-r*.65,r*.75);ctx.closePath();ctx.fill();ctx.fillStyle='#b7ef80';ctx.beginPath();ctx.arc(0,-2,5,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#6c4d33';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(r*.85,-r*.4);ctx.lineTo(r*1.15,r);ctx.stroke();drawFace(r*.8);
  }else if(enemy.archetype==='ashenStag'){
    ctx.strokeStyle='#6e3d2d';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-9,-r*.65);ctx.lineTo(-17,-r-14);ctx.lineTo(-27,-r-18);ctx.moveTo(-17,-r-14);ctx.lineTo(-12,-r-23);ctx.moveTo(9,-r*.65);ctx.lineTo(17,-r-14);ctx.lineTo(27,-r-18);ctx.moveTo(17,-r-14);ctx.lineTo(12,-r-23);ctx.stroke();ctx.fillStyle='#b65e39';ctx.beginPath();ctx.ellipse(0,2,r*.82,r,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#f2c06c';ctx.beginPath();ctx.ellipse(0,r*.35,r*.38,r*.3,0,0,Math.PI*2);ctx.fill();drawFace(r,'boss');
  }else{
    ctx.fillStyle=enemy.type==='boss'?'#75533d':primary.color;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();
    if(enemy.type==='boss'){ctx.fillStyle='#5d3b2f';for(let i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(i*9-5,-r*.65);ctx.lineTo(i*9,-r-12-Math.abs(i)*2);ctx.lineTo(i*9+5,-r*.65);ctx.fill()}}
    drawFace(r,enemy.type==='boss'?'boss':'brave');
  }
  if(enemy.visualHit>0){ctx.fillStyle=`rgba(255,255,255,${Math.min(.48,enemy.visualHit*3)})`;ctx.strokeStyle='#fff';ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,r*.92,0,Math.PI*2);ctx.fill();ctx.stroke()}
  ctx.restore();
  ctx.save();
  if(enemy.type!=='normal'){ctx.strokeStyle=enemy.type==='boss'?'#ffd05a':'#e9dfff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(enemy.x,enemy.y+lift,r+4,0,Math.PI*2);ctx.stroke()}
  if(enemy.shield>0){ctx.strokeStyle='rgba(126,222,255,.9)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(enemy.x,enemy.y+lift,r+7,-Math.PI/2,-Math.PI/2+Math.PI*2*(enemy.shield/enemy.maxShield));ctx.stroke()}
  if(enemy.knockback>0){ctx.strokeStyle='#f1bf62';ctx.lineWidth=4;for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(enemy.x+r+8,enemy.y+i*8);ctx.lineTo(enemy.x+r+24,enemy.y+i*8);ctx.stroke()}}
  if(enemy.stun>0){ctx.fillStyle='#ffe76b';for(let i=0;i<4;i++){const a=visualClock*5+i*Math.PI/2;ctx.fillRect(enemy.x+Math.cos(a)*14-2,enemy.y-r-10+Math.sin(a)*7-2,4,4)}}
  if(enemy===selectedEnemy){ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.setLineDash([5,3]);ctx.beginPath();ctx.arc(enemy.x,enemy.y,r+10,0,Math.PI*2);ctx.stroke();ctx.setLineDash([])}
  const barWidth=r*2.25,barY=enemy.y-r-15;ctx.fillStyle='rgba(37,45,38,.72)';roundedRect(enemy.x-barWidth/2,barY,barWidth,6,3);ctx.fill();ctx.fillStyle=enemy.type==='boss'?'#f0ad35':enemy.type==='elite'?'#9f7cdb':'#79b957';roundedRect(enemy.x-barWidth/2+1,barY+1,(barWidth-2)*Math.max(0,enemy.hp/enemy.max),4,2);ctx.fill();
  if(enemy.type==='boss'||enemy===selectedEnemy){ctx.fillStyle='#24362d';ctx.font='900 10px Noto Sans SC';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(data.name||data.label,enemy.x,enemy.y+r+14)}
  const markerX=enemy.x-(enemy.traits.length*7-2)/2;enemy.traits.forEach((key,index)=>{ctx.fillStyle=enemyTraits[key].color;ctx.beginPath();ctx.arc(markerX+index*7,enemy.y+r+20,2.5,0,Math.PI*2);ctx.fill()});
  drawEnemyStatuses(enemy,r);ctx.restore();
}
function draw() {
  const field = currentBattlefield(), paths = currentPaths();
  ctx.clearRect(0, 0, W, H);ctx.save();
  ctx.fillStyle = field.palette.grass; ctx.fillRect(-10, -10, W+20, H+20);drawGroundTexture();drawBackfieldRoots();drawTerrainFeatures();drawGrid();
  ctx.lineCap = 'round'; ctx.lineJoin='round';
  [[66,'rgba(44,72,39,.2)'],[60,field.palette.roadEdge],[48,field.palette.road]].forEach(([width,color])=>{ctx.lineWidth=width;ctx.strokeStyle=color;paths.forEach((path,routeIndex)=>{ctx.save();ctx.globalAlpha=isRouteOpen(routeIndex)?1:.3;ctx.beginPath();path.forEach((point,index)=>index?ctx.lineTo(...point):ctx.moveTo(...point));ctx.stroke();ctx.restore()})});
  paths.forEach(drawPathDetails);drawRouteJunction();drawRitualSite();drawScenery();
  if (pendingDeployLevel || pendingDeployTowerIndex !== null) {
    ctx.save();
    for (let row=0;row<ROWS;row++) for(let col=0;col<COLS;col++) if(!isRoad(col,row)&&!occupied(col,row))drawBuildPad(col,row,'rgba(223,255,174,.13)','rgba(240,255,203,.28)');
    if(deployHover){const standby=pendingDeployTowerIndex!==null?standbyReserve[pendingDeployTowerIndex]:null,occupant=towers.find(t=>t.col===deployHover.col&&t.row===deployHover.row),seed=!standby&&pendingDeployLevel?towerFactory.create({col:deployHover.col,row:deployHover.row,level:pendingDeployLevel}):null,valid=!isRoad(deployHover.col,deployHover.row)&&(!occupant||canMergeTowers(occupant,seed)),p=center(deployHover);drawBuildPad(deployHover.col,deployHover.row,valid?'rgba(226,255,145,.72)':'rgba(211,65,53,.55)',valid?'#f4ffb5':'#ff9586');ctx.font='26px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(standby?evolution[standby.evo].icon:'🌰',p.x,p.y);ctx.fillStyle='#26382d';ctx.font='bold 10px Nunito';ctx.fillText(occupant&&valid?'合并':`Lv ${standby?standby.level:pendingDeployLevel}`,p.x,p.y+22)}
    ctx.restore();
  }
  drawFusionHint();
  if(selectedTower&&towers.includes(selectedTower)){const p=drag&&drag.tower===selectedTower?{x:drag.x,y:drag.y}:center(selectedTower),z=evolution[selectedTower.evo],r=currentAttackRadius(z,selectedTower);ctx.save();ctx.fillStyle=z.color+'22';ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();ctx.strokeStyle=z.color;ctx.lineWidth=3;ctx.stroke();ctx.restore()}
  if(drag){const col=Math.max(0,Math.min(COLS-1,Math.floor(drag.x/CELL))),row=Math.max(0,Math.min(ROWS-1,Math.floor(drag.y/CELL))),other=towers.find(t=>t!==drag.tower&&t.col===col&&t.row===row),valid=!isRoad(col,row)&&(!other||canMergeTowers(other,drag.tower)||canMergeTowers(drag.tower,other));ctx.save();drawBuildPad(col,row,valid?'rgba(229,255,178,.55)':'rgba(205,66,52,.46)',valid?'#f5ffb2':'#ff8a78');ctx.restore()}
  towers.forEach(drawTower);
  enemies.forEach(drawEnemyBody);
  drawAttackEvents();
  drawProjectiles();
  drawFxParticles();
  hits.forEach(p=>{ctx.save();ctx.globalAlpha=Math.min(1,p.life);if(p.type==='text'||p.type==='statusText'||p.type==='damageText'||p.type==='mergeText'){ctx.fillStyle=p.color;ctx.strokeStyle='rgba(25,35,30,.86)';ctx.lineWidth=p.type==='damageText'?3:4;ctx.font=p.type==='mergeText'?'900 14px Noto Sans SC':p.type==='statusText'?'900 13px Noto Sans SC':p.type==='damageText'?'900 12px Nunito':'900 17px Nunito';ctx.textAlign='center';const rise=p.type==='mergeText'?(1.45-p.life)*24:p.life*18;ctx.strokeText(p.label,p.x,p.y-rise);ctx.fillText(p.label,p.x,p.y-rise)}else if(p.type==='surge'){ctx.strokeStyle='#ffbd45';ctx.lineWidth=18*p.life;ctx.beginPath();ctx.arc(W/2,H/2,(1-p.life)*650,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#fff4a8';ctx.lineWidth=5;ctx.stroke()}else if(p.type==='impact'){const progress=1-p.life,scale=p.radius*(.35+progress*.85);ctx.translate(p.x,p.y);ctx.rotate(progress*1.5);ctx.strokeStyle=p.color;ctx.lineWidth=Math.max(2,6*p.life);ctx.beginPath();ctx.arc(0,0,scale,0,Math.PI*2);ctx.stroke();if(['rocket','meteor','mine'].includes(p.kind)){ctx.globalAlpha=p.life*.65;ctx.fillStyle=p.color+'55';ctx.beginPath();ctx.arc(0,0,scale*.62,0,Math.PI*2);ctx.fill()}for(let i=0;i<4;i++){const a=i*Math.PI/2+progress*2;ctx.beginPath();ctx.moveTo(Math.cos(a)*scale*.7,Math.sin(a)*scale*.7);ctx.lineTo(Math.cos(a)*scale*1.35,Math.sin(a)*scale*1.35);ctx.stroke()}}else{ctx.fillStyle=p.color;ctx.translate(p.x,p.y);ctx.rotate((1-p.life)*5);ctx.beginPath();ctx.moveTo(0,-4);ctx.lineTo(3,0);ctx.lineTo(0,4);ctx.lineTo(-3,0);ctx.closePath();ctx.fill()}ctx.restore()});
  ctx.restore();
  if(screenFlash>0){ctx.fillStyle=`rgba(255,226,116,${screenFlash*.38})`;ctx.fillRect(0,0,W,H)}
}
function unleashSurge() {
  if (surgeCharge < 100 || paused) return;
  const targets = enemies.filter(enemy => !enemy.dead);
  if (!targets.length) { $('message').textContent = '当前没有可打击的目标。'; return; }
  surgeCharge = 0; screenFlash = 1; hits.push({type:'surge',life:1}); audioBus.play(110,.5,'sawtooth',.05); audioBus.play(440,.7,'sine',.035);
  const source = selectedTower || towers[0];
  targets.forEach(enemy => { if (typeof enemy.receiveDamage === 'function') enemy.receiveDamage(enemy.max * .28, 'base'); else enemy.hp -= enemy.max * .28; applyEnemyStatus(enemy, 'stun', 1.2); burst(enemy.x,enemy.y,'#ffbd45'); if(enemy.hp<=0) damageTarget(source,enemy,{...evolution[source.evo],damage:0}); });
  score += targets.length * 60; $('message').textContent = `橙光席卷战场，命中 ${targets.length} 个目标！`; ui();
}
function drawFallback() {
  const field = currentBattlefield(), paths = currentPaths();
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = field.palette.grass; ctx.fillRect(0, 0, W, H);
  ctx.lineCap = 'round';[[58,field.palette.roadEdge],[46,field.palette.road]].forEach(([width,color])=>{ctx.lineWidth=width;ctx.strokeStyle=color;paths.forEach(path=>{ctx.beginPath();path.forEach((point,index)=>index?ctx.lineTo(...point):ctx.moveTo(...point));ctx.stroke()})});
  towers.forEach(tower => { const p = center(tower), data = evolution[tower.evo]; ctx.fillStyle = data.color; ctx.beginPath(); ctx.arc(p.x,p.y,22,0,Math.PI*2); ctx.fill(); const art=hasPrimaryEvolutionArt(tower)&&primaryEvolutionImages[tower.evo]; if(art){ctx.drawImage(art,p.x-30,p.y-37,60,60);}else{ctx.fillStyle='#fff';ctx.font='22px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(data.icon,p.x,p.y);} });
  enemies.forEach(enemy => { ctx.fillStyle='#5e6f66';ctx.beginPath();ctx.arc(enemy.x,enemy.y,enemy.radius||14,0,Math.PI*2);ctx.fill(); });
}
function completeWave() {
  running = false;
  const completedWave = wave;
  const reward = Math.round((gameSession.currentWave?.reward || 20 + wave * 4) * currentBattlefield().reward);
  gainSpirit(reward);
  const finaleReady = !gameSession.isFinite && finalWave && finaleRequirementsMet();
  const result = gameSession.completeWave({ finalEvolution: finaleReady });
  if (result.won) { gameWon = true; $('message').textContent = gameSession.isFinite ? `${gameSession.level.name}完成，甜橙谷的道路继续向前！` : '最终进化守住了甜橙谷，你胜利了！'; $('waveBtn').textContent = '重新开始'; score += 5000; ui(); return; }
  wave = gameSession.waveNumber;
  const opportunities = mergeOpportunityCount();
  intermissionSummary = opportunities ? `世界树抽芽已准备，当前可合成 ${opportunities} 组` : '世界树抽芽正在积蓄，阵容保持不变';
  if (finalWave && !finaleReady) intermissionSummary += ' · 最终试炼需要两座 Lv.5+ 不同谱系并激活一项羁绊';
  nextWaveTimer = 4;
  $('waveBtn').disabled = false;
  $('waveBtn').innerHTML = `提前开第 ${wave} 波 <span>▶</span>`;
  const nextThreat = waveThreatHint(gameSession.currentWave);
  $('message').textContent = `第 ${completedWave} 波结算：${intermissionSummary}${nextThreat ? ` · 下一波 ${nextThreat}` : ''}。${nextWaveTimer.toFixed(1)} 秒后自动开波。`; ui();
}
function update(dt) {
  visualClock += dt;
  cameraShake = Math.max(0, cameraShake - dt * 22);
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
      // Spawn cadence controls density; enemies themselves never body-block one another.
      spawnTimer = gameSession.currentWave.spawnInterval;
    }
    if (spawned >= waveSize() && enemies.length === 0) completeWave();
  }
  enemies.forEach(enemy => {const route=currentPath(enemy.routeIndex||0),routeLength=enemy.routeLength||pathLength(route);enemy.visualHit=Math.max(0,(enemy.visualHit||0)-dt);enemy.update(dt, {
    positionAt: distance=>pointAt(distance,route), pathLength: routeLength, enemies,
    onDotLethal: (source, target) => damageTarget(source, target, { ...evolution[source.evo], damage: 0 }),
    onEscape: target => { lives = gameSession.loseLife(target.lifeCost); ui(); },
    onPhaseChange: target => { burst(target.x, target.y, '#ff7b45'); $('message').textContent = `${target.definition.name} 进入第二阶段！`; }
  });enemy.routeProgress=Math.min(1,enemy.dist/routeLength)});
  updateAttackEvents(dt);
  updateProjectiles(dt);
  updateFxParticles(dt);
  const combatContext = towerCombatContext();
  towers.forEach(tower => { if (tower.updateCombat(dt, combatContext).length) ui(); });
  enemies=enemies.filter(e=>!e.dead&&e.hp>0);hits.forEach(p=>{p.life-=dt;if(!p.type){p.x+=p.vx*dt;p.y+=p.vy*dt}});hits=hits.filter(p=>p.life>0);
  if(lives<=0&&running){running=false;started=false;$('message').textContent='森林失守了，再试一次吧！';$('waveBtn').disabled=false;$('waveBtn').textContent='重新开始'}
}
function loop(ts){const dt=Math.min(.05,(ts-last)/1000||0);last=ts;if(!paused)update(dt*speed);try{draw()}catch(error){console.error('地图绘制已切换至兼容模式',error);drawFallback()}requestAnimationFrame(loop)}
function pointerCell(e){const r=canvas.getBoundingClientRect();return{col:Math.max(0,Math.min(COLS-1,Math.floor((e.clientX-r.left)*W/r.width/CELL))),row:Math.max(0,Math.min(ROWS-1,Math.floor((e.clientY-r.top)*H/r.height/CELL)))}}
function pointerPosition(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height}}
canvas.addEventListener('pointerdown',e=>{const c=pointerCell(e),p=pointerPosition(e);if(pendingDeployLevel||pendingDeployTowerIndex!==null){deployReserve(c.col,c.row);return}const tower=towers.find(t=>t.col===c.col&&t.row===c.row);if(tower){
  selectedEnemy=null; selectedTower=tower;drag={tower,x:p.x,y:p.y,origin:{col:tower.col,row:tower.row}};canvas.setPointerCapture(e.pointerId);ui();return
}const object=mapObjectAt(c.col,c.row);if(object){selectedEnemy=null;selectedTower=null;$('message').textContent=`${object.name}：${Math.ceil(object.hp)}/${object.max}，需要将一座塔切换为“清理地图目标”。`;ui();return}const enemy=[...enemies].reverse().find(item=>Math.hypot(item.x-p.x,item.y-p.y)<=item.radius+7);if(enemy){selectedEnemy=enemy;selectedTower=null;ui()}});
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
    $('message').textContent = '道路或地貌障碍上无法部署守卫。';
  } else if (other && mergeTowers(other, tower)) {
    lastMergeSnapshot = null;
  } else if (other) {
    tower.relocate(drag.origin.col, drag.origin.row);
    $('message').textContent = towerMergeIdentity(other) !== towerMergeIdentity(tower) ? '只有完全相同形态和分支的守卫才能合成。' : '素材等级不能高于主塔，或主塔已到达等级上限。';
  }
  if (tower.col !== drag.origin.col || tower.row !== drag.origin.row) lastMergeSnapshot = null;
  delete drag.origin; drag = null; tryFiveFusion(); tryTaijiFusion(); tryHiddenFusions(); ui();
});
canvas.addEventListener('pointercancel',()=>{if(!drag)return;drag.tower.col=drag.origin.col;drag.tower.row=drag.origin.row;drag=null;ui()});
function openEvolution(stage = 'branch') { const primary = stage === 'primary'; evolutionDecision = evolutionTree.begin(pendingEvolution, stage); const choices = evolutionDecision ? evolutionDecision.choices(primary ? routes : (branchKeys[pendingEvolution?.evolutionPath] || [])) : []; const dialog = document.querySelector('.evo-dialog'); const modal = $('evoModal'); const hasRare = choices.some(key => evolution[key].rare); if (!choices.length) { $('message').textContent = '当前进化树没有可用分支。'; return; } if (!modal.classList.contains('show')) evolutionWasPaused = paused; paused = true; $('pauseBtn').textContent = '▶'; $('evoTitle').textContent = primary ? 'Lv.5 · 选择进化主路线' : `Lv.10 · 选择${evolution[pendingEvolution?.evolutionPath]?.name || ''}分支`; $('rareBanner').hidden = !hasRare; dialog.classList.toggle('has-rare', hasRare); $('evoChoices').innerHTML = choices.map(key => { const route = evolution[key]; const rarity = primary ? (route.rare ? '稀有主路线' : '五行主路线') : '专属分支'; const stats = `伤害 ${route.damage} / 等级 · 实际半径 ${(attackRadius(route)/CELL).toFixed(1)} 格 · 攻速 ${(1 / route.rate).toFixed(1)}/秒`; return `<button class="${route.rare ? 'rare-route' : ''}" data-route="${key}" data-route-key="${key}">${route.rare ? '<span class="rare-badge">稀有</span>' : ''}<strong>${route.icon} ${route.name}</strong><small><b>${rarity}</b><br>${route.desc}</small><span class="evo-stats">${stats}</span><span class="evo-effect">${attackModeNames[route.attackMode]} · ${effectNames[route.effect] || '无附加效果'}</span><small>${primary ? 'Lv.10 解锁专属分支' : `终点：${route.ultimate}`}</small></button>`; }).join(''); document.querySelectorAll('[data-route]').forEach(button => button.onclick = () => chooseEvolution(button.dataset.route)); modal.classList.add('show'); modal.setAttribute('aria-hidden','false'); document.body.classList.add('modal-open'); }
function closeEvolution(){ $('evoModal').classList.remove('show');$('evoModal').setAttribute('aria-hidden','true');document.body.classList.remove('modal-open');paused=evolutionWasPaused;$('pauseBtn').textContent=paused?'▶':'Ⅱ'; }
function chooseEvolution(route){ const t = pendingEvolution; if (!t || !evolutionDecision) return; const stage = pendingEvolutionStage; const result = evolutionDecision.commit(route); if (!result.ok) { $('message').textContent = '这条进化分支当前不可用，请重新选择。'; return; } audioBus.evolve(); discoveredEvolutions.add(route); if (stage === 'primary' && t.level >= 10) { pendingEvolutionStage = 'branch'; openEvolution('branch'); return; } pendingEvolution = null; pendingEvolutionStage = null; evolutionDecision = null; closeEvolution(); $('message').textContent = stage === 'primary' ? `已进化为${evolution[route].name}，Lv.10 时解锁该路线的专属分支。` : `分支已确定：${evolution[t.evo].name}`; tryFiveFusion(); tryTaijiFusion(); tryHiddenFusions(); ui(); }
function tryHiddenFusions() {
  for (const recipe of hiddenFusions) {
    for (let row = 1; row < ROWS - 1; row++) for (let col = 1; col < COLS - 1; col++) {
      if(isRoad(col,row))continue;
      const parts = recipe.pattern.map(item => towers.find(t => towerBranch(t) === item.parent && t.col === col + item.dx && t.row === row + item.dy));
      if (parts.some(part => !part) || Math.min(...parts.map(part => part.level)) < recipe.minLevel) continue;
      const unique = new Set(parts); if (unique.size !== parts.length) continue;
      const centerOccupant=towers.find(tower=>tower.col===col&&tower.row===row);if(centerOccupant&&!parts.includes(centerOccupant))continue;
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
  if (running) { $('message').textContent = '合成仅在整备阶段开放。'; return; }
  if (pendingEvolution) { $('message').textContent = '请先完成当前守卫的进化选择。'; return; }
  const before = {
    towers: towers.map(tower => tower.snapshot()),
    reserve: { ...reserve },
    finalWave,
    discoveredEvolutions: [...discoveredEvolutions],
    fiveAttemptSignature
  };
  const reserveMerged = compactReserve();
  let battlefieldMerged = 0;
  while (true) {
    const candidate = mergeCandidates(towers)[0];
    if (!candidate || !mergeTowers(candidate.keeper, candidate.consumed)) break;
    battlefieldMerged++;
    if (pendingEvolution) break;
  }
  const totalMerged = reserveMerged + battlefieldMerged;
  lastMergeSnapshot = totalMerged ? before : null;
  if (!pendingEvolution) {
    const parts = [];
    if (reserveMerged) parts.push(`灵种仓 ${reserveMerged} 组`);
    if (battlefieldMerged) parts.push(`战场 ${battlefieldMerged} 组`);
    $('message').textContent = totalMerged ? `合成完成：${parts.join(' · ')}。可用撤销按钮恢复。` : '当前没有可合成的同形态守卫。';
  }
  ui();
}
function undoAutoMerge() {
  if (!lastMergeSnapshot || pendingEvolution) return;
  towers = lastMergeSnapshot.towers.map(state => towerFactory.create(state));
  reserve = { ...lastMergeSnapshot.reserve };
  finalWave = lastMergeSnapshot.finalWave;
  discoveredEvolutions = new Set(lastMergeSnapshot.discoveredEvolutions);
  fiveAttemptSignature = lastMergeSnapshot.fiveAttemptSignature;
  lastMergeSnapshot = null; selectedTower = null; selectedEnemy = null; pendingDeployLevel = null; pendingDeployTowerIndex = null;
  $('message').textContent = '已撤销上一次一键合成。';
  ui();
}
function startWave(){if(!gameSession.startWave())return;started=true;nextWaveTimer=0;intermissionSummary='';wave=gameSession.waveNumber;spawned=0;kills=0;combo=0;comboTimer=0;currentWaveEvent=contentRegistry.events.get(gameSession.currentWave.eventKey);running=true;spawnTimer=0;$('waveBtn').disabled=true;$('waveBtn').textContent='自动波次中';$('waveEvent').innerHTML=`<b>${currentWaveEvent.icon} ${currentWaveEvent.name}</b><small>${currentWaveEvent.desc}</small>`;const traitKey=waveTrait(),trait=traitKey?enemyTraits[traitKey]:null;const threat=waveThreatHint(gameSession.currentWave);$('message').textContent=`第 ${wave} 波${threat ? ` · ${threat}` : ''} · ${currentWaveEvent.name}。`;ui()}
function startMode(modeKey, levelKey = null){gameSession.reset({modeKey,levelKey,mapKey:gameSession.map.key});resetGame();selectedModeKey=modeKey;if(levelKey)selectedLevelKey=levelKey;if(document.body.dataset)document.body.dataset.mode=modeKey;setText('modeEntryText',gameSession.level?gameSession.level.name:gameSession.mode.name);setText('modeSubtitle',`森林守卫 · ${gameSession.level?.name || gameSession.mode.name}`);$('message').textContent=gameSession.level?`已进入${gameSession.level.name}，共 ${gameSession.level.waves.length} 波`:`已进入${gameSession.mode.name}`;ui();return gameSession.snapshot()}
function isDeveloperMode() { return gameSession.mode?.kind === 'developer'; }
function developerFreeCell() { return currentBattlefield().buildSlots.find(([col, row]) => !occupied(col, row) && !isTerrainBlocked(col, row)); }
function developerSpawnTower(level, evo = 'base', evolutionPath = null, evoTier = 1) {
  if (!isDeveloperMode()) return false;
  const slot = developerFreeCell();
  if (!slot) { $('message').textContent = '没有可用部署位，请先撤回一座塔。'; return false; }
  const tower = towerFactory.create({ col: slot[0], row: slot[1], level, evo, evolutionPath, evoTier, cool: 0 });
  towers.push(tower); selectedTower = tower; selectedEnemy = null;
  if (level >= 5 && evo === 'base' && !tower.evolutionPath) { pendingEvolution = tower; pendingEvolutionStage = 'primary'; openEvolution('primary'); }
  else if (level >= 10 && evoTier === 1 && !evolution[evo]?.fusion) { pendingEvolution = tower; pendingEvolutionStage = 'branch'; openEvolution('branch'); }
  $('message').textContent = `已生成 ${evolution[evo].name} Lv.${level}。`;
  ui(); return true;
}
function developerCompleteWave() {
  if (!isDeveloperMode()) return;
  enemies = []; spawned = waveSize(); kills = waveSize();
  if (!gameSession.startWave() && gameSession.status !== 'running') return;
  running = true; completeWave(); ui();
}
function developerAction(action) {
  if (!isDeveloperMode()) return;
  if (action === 'spirit') { coins += 100; processGrowth(); const ready = germinationOffers.findIndex(offer => !offer.claimed && offer.kind === 'seed'); if (ready >= 0) claimGermination(ready); $('message').textContent = '已获得 100 灵力并领取一枚抽芽灵种。'; ui(); return; }
  if (action === 'tower5') { developerSpawnTower(5); return; }
  if (action === 'tower10') { developerSpawnTower(10, 'fire', 'fire', 1); return; }
  if (action === 'tower20') { developerSpawnTower(20, 'fiveSpirit', 'fiveSpirit', 2); return; }
  if (action === 'enemy') { if (!running) startWave(); if (spawned < waveSize()) { addEnemy(); spawned++; $('message').textContent = '已生成 1 个敌人。'; ui(); } return; }
  if (action === 'clear') { enemies = []; $('message').textContent = '已清空当前敌人。'; ui(); return; }
  if (action === 'complete') { developerCompleteWave(); return; }
  if (action === 'next') { if (running) developerCompleteWave(); if (!running && !gameWon) startWave(); return; }
  if (action === 'win') { finalWave = true; developerCompleteWave(); }
}
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
if ($('fieldBtn')) $('fieldBtn').onclick=()=>{if(running||gameSession.mode.levelRequired)return;const unlocked=battlefields.filter(item=>item.unlock<=wave);if(unlocked.length<2)return;const current=unlocked.indexOf(currentBattlefield());battlefieldIndex=(current+1)%unlocked.length;gameSession.selectMap(currentBattlefield().key);mapObjects=createMapObjects(currentBattlefield());mapUnlockedSlots=new Set();const moved=fitTowersToBattlefield();$('message').textContent=`已切换至${currentBattlefield().name}：${currentBattlefield().desc}${moved?` · ${moved} 座守卫已移至最近安全地块`:''}`;screenFlash=.25;ui()};
$('waveBtn').onclick=()=>{if(lives<=0||gameWon||gameSession.status==='lost'){resetGame();started=true;startWave();return}if(!running){started=true;startWave()}};
$('pauseBtn').onclick=()=>{if(!started||gameWon)return;paused=!paused;$('pauseBtn').textContent=paused?'▶':'Ⅱ';$('message').textContent=paused?'游戏已暂停':'游戏继续';ui()};
$('speedBtn').onclick=()=>{speed=speed===1?2:speed===2?3:1;$('speedBtn').textContent=`${speed}×`};
$('mergeBtn').onclick=autoMerge;
$('undoMergeBtn').onclick=undoAutoMerge;
$('surgeBtn').onclick=unleashSurge;
$('soundBtn').onclick=()=>{runtime.soundEnabled=!runtime.soundEnabled;$('soundBtn').textContent=runtime.soundEnabled?'🔊':'🔇';if(runtime.soundEnabled)audioBus.play(520,.08,'sine',.03)};
$('modeEntryBtn').onclick=leaveBattle;
$('hubEndlessBtn').onclick=()=>{startMode('endless');paused=false;navigatePage('battle')};
$('hubCampaignBtn').onclick=()=>navigatePage('campaign');
if ($('hubDeveloperBtn')) $('hubDeveloperBtn').onclick=()=>{startMode('developer');paused=false;navigatePage('battle')};
$('campaignBackBtn').onclick=()=>navigatePage('hub');
$('battleBackBtn').onclick=leaveBattle;
if ($('mapRecallBtn')) $('mapRecallBtn').onclick=recallSelectedTower;
document.querySelectorAll('[data-dev-action]').forEach(button => button.onclick = () => developerAction(button.dataset.devAction));
const hubSoundButton=document.querySelector('.hub-sound-btn');if(hubSoundButton)hubSoundButton.onclick=()=>$('soundBtn').click();
window.addEventListener('keydown',event=>{if(event.key==='Escape'&&(pendingDeployLevel||pendingDeployTowerIndex!==null)){pendingDeployLevel=null;pendingDeployTowerIndex=null;deployHover=null;$('message').textContent='已取消部署。';ui();return}if(event.code==='Space'&&!event.repeat&&!pendingEvolution){event.preventDefault();unleashSurge()}if(event.key.toLowerCase()==='p'&&!event.repeat)$('pauseBtn').click()});
window.GameApp = Object.freeze({
  startMode,
  navigatePage,
  modes: () => contentRegistry.modes.values(),
  levels: () => contentRegistry.levels.values(),
  maps: () => contentRegistry.maps.values(),
  session: () => gameSession.snapshot(),
  developer: Object.freeze({ action: developerAction, spawnTower: developerSpawnTower })
});
renderChapterGrid();resetGame();ui();navigatePage('hub');requestAnimationFrame(loop);
