const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);
const W = 960, H = 540, CELL = 60, COLS = 16, ROWS = 9, MAX_LEVEL = 10;
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
  taiji: { name: '太极塔', icon: '☯️', color: '#252832', damage: 230, rangeCells: 7, rate: .34, attackMode: 'omni', effect: 'taiji', desc: '阴阳归一，全域打击并使敌人受到的后续伤害提高', ultimate: '太极无极', fusion: true }
};
const routes = Object.keys(evolution).filter(key => key !== 'base' && !evolution[key].fusion);
const fiveKeys = ['metal','wood','water','fire','earth'];
const branchOf = Object.fromEntries(Object.keys(evolution).map(key => [key, key]));
const routeWeights = Object.fromEntries(routes.map(key => [key, evolution[key].rare ? 1 : 7]));
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

let towers, crates, enemies, hits, coins, lives, score, wave, kills, spawned;
let running, gameWon, finalWave, spawnTimer, crateTimer, drag, selectedTower, selectedEnemy, pendingEvolution, nextWaveTimer, started, paused, speed, last, fiveAttemptSignature;

function resetGame() {
  towers = [{ col: 1, row: 6, level: 1, evo: 'base', evoTier: 0, cool: 0 }];
  crates = []; enemies = []; hits = [];
  coins = 80; lives = 12; score = 0; wave = 1; kills = 0; spawned = 0;
  running = false; gameWon = false; finalWave = false; spawnTimer = 0; crateTimer = 5; drag = null; selectedTower = towers[0]; selectedEnemy = null; pendingEvolution = null; nextWaveTimer = 0; started = false; paused = false; speed = 1; fiveAttemptSignature = null;
}

function center(item) { return { x: item.col * CELL + CELL / 2, y: item.row * CELL + CELL / 2 }; }
function attackRadius(towerData) { return towerData.rangeCells * CELL / 2; }
function segmentDistance(x, y, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy));
}
function isRoad(col, row) {
  const x = col * CELL + CELL / 2, y = row * CELL + CELL / 2;
  return path.slice(1).some((p, i) => segmentDistance(x, y, path[i], p) < CELL * .56);
}
function occupied(col, row, except = null) {
  return towers.some(t => t !== except && t.col === col && t.row === row) || crates.some(c => c.col === col && c.row === row);
}
function randomFreeCell() {
  const cells = [];
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
    if (!isRoad(col, row) && !occupied(col, row)) cells.push({ col, row });
  }
  return cells[Math.floor(Math.random() * cells.length)];
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
    const modeNames = { single: '单体', pierce: '穿透', chain: '链式', splash: '溅射' };
    $('selectedInfo').innerHTML = `<span class="info-icon">${z.icon}</span><div><b>${z.name} · Lv.${selectedTower.level}</b><small>${z.desc || '基础单体攻击'} · 伤害 ${z.damage * selectedTower.level} · 射程 ${z.rangeCells}×${z.rangeCells} 格 · ${modeNames[z.attackMode] || '特殊攻击'}</small></div>`;
  } else {
    $('selectedInfo').innerHTML = '<span class="info-icon">🌰</span><div><b>拖动橡果塔改变位置</b><small>点击敌人可查看属性 · Lv.5 选择进化路线</small></div>';
  }
}
function ui() {
  $('coins').textContent = coins; $('lives').textContent = lives; $('score').textContent = score; $('wave').textContent = wave;
  $('progressText').textContent = `${kills} / ${waveSize()}`;
  $('progressBar').style.width = `${Math.min(100, kills / waveSize() * 100)}%`;
  document.querySelector('#towerList').innerHTML = `<div class="tower-card active"><div class="tower-art" style="background:${evolution.base.color}33">🌰</div><div><b>橡果守卫</b><small>范围近战 · 网格移动</small></div><span class="price">Lv.1-${MAX_LEVEL}</span></div>`;
  updateSelectionInfo();
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
  const hp = (38 + wave * 20 + spawned * 2.5) * type.hp;
  const neutral = waveTrait() === null;
  const resist = Object.fromEntries(['metal','wood','water','fire','earth','yin','yang','wind','thunder'].map(key => [key, neutral ? 0 : .08 + Math.random() * .14]));
  const enemy = { dist: 0, x: -30, y: 90, hp, max: hp, baseSpeed: (35 + wave * 4.5) * type.speed, speed: (35 + wave * 4.5) * type.speed, type: typeKey, kind: type.icon, slow: 0, armor: 0, slowResist: 0, regen: 0, radius: type.radius, traits: [], resist };
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
function addCrate() {
  const cell = randomFreeCell();
  if (!cell) return;
  const maxCrateLevel = Math.min(MAX_LEVEL - 1, 1 + Math.floor(wave / 2));
  const allowedLevels = Array.from({ length: maxCrateLevel }, (_, i) => i + 1).filter(level => level !== 5 && level !== MAX_LEVEL);
  const level = allowedLevels[Math.floor(Math.random() * allowedLevels.length)] || 1;
  const hp = 45 + wave * 14 + level * 18;
  crates.push({ ...cell, level, hp, max: hp });
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
function burst(x, y, color) {
  for (let i = 0; i < 7; i++) hits.push({ x, y, life: 1, color, vx: (Math.random() - .5) * 55, vy: (Math.random() - .5) * 55 });
}
function attackEffect(t, target, z) {
  const p = center(t), q = 'dist' in target ? target : center(target), angle = Math.atan2(q.y - p.y, q.x - p.x);
  const effectType = t.evo === 'fiveSpirit' ? 'five' : t.evo === 'taiji' ? 'taiji' : t.evo === 'earth' || z.attackMode === 'splash' ? 'impact' : z.attackMode === 'chain' ? 'chain' : z.attackMode === 'pierce' ? 'pierce' : 'slash';
  hits.push({ type: effectType, x: q.x, y: q.y, originX: p.x, originY: p.y, angle, radius: attackRadius(z) * .72, life: 1, color: z.color, evo: t.evo, glyph: z.icon });
  burst(q.x, q.y, z.color);
}
function damageTarget(t, target, z) {
  const rawDamage = z.damage * t.level * (target.taiji > 0 ? 1.3 : 1);
  const resistance = target.resist?.[t.evo] || 0;
  target.hp -= rawDamage * (1 - Math.max(0, (target.armor || 0) - (target.weaken > 0 ? .15 : 0))) * (1 - resistance);
  if ('dist' in target) {
    if (z.effect === 'slow') target.slow = Math.max(target.slow || 0, 1.6 * (1 - (target.slowResist || 0)));
    if (z.effect === 'burn') { target.burn = Math.max(target.burn || 0, 3); target.burnSource = t; }
    if (z.effect === 'weaken') target.weaken = Math.max(target.weaken || 0, 3);
    if (z.effect === 'stun' && Math.random() < (t.evo==='earth'?.38:.22)) { target.stun = Math.max(target.stun || 0, t.evo==='earth'?.85:.6); if(t.evo==='earth'){target.dist=Math.max(0,target.dist-42);target.knockback=1;} }
    if (z.effect === 'silence') target.slow = Math.max(target.slow || 0, 1.1);
    if (z.effect === 'fiveElements') { target.slow=Math.max(target.slow||0,2);target.burn=Math.max(target.burn||0,4);target.burnSource=t;target.weaken=Math.max(target.weaken||0,5);if(Math.random()<.35)target.stun=Math.max(target.stun||0,.8); }
    if (z.effect === 'taiji') { target.taiji = Math.max(target.taiji || 0, 5); target.slow = Math.max(target.slow || 0, 1.8); }
  }
  if (branchOf[t.evo] === 'water' && 'dist' in target) target.slow = Math.max(target.slow || 0, 1.6 * (1 - (target.slowResist || 0)));
  if (target.hp > 0 || target.dead) return;
  target.dead = true;
  if ('dist' in target) { coins += (10 + wave) * enemyTypes[target.type].reward; score += 100 * t.level * enemyTypes[target.type].reward; kills++; }
  else { const crateRoute=target.level>5?fiveKeys[Math.floor(Math.random()*fiveKeys.length)]:'base';towers.push({ col: target.col, row: target.row, level: target.level, evo: crateRoute, evoTier: crateRoute==='base'?0:1, cool: 0 }); $('message').textContent = `Lv.${target.level} 宝箱转化为${evolution[crateRoute].name}！`; tryFiveFusion(); }
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
function draw() {
  ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#b6dda5'; ctx.fillRect(0, 0, W, H); drawGrid();
  ctx.lineCap = 'round'; ctx.lineWidth = 58; ctx.strokeStyle = '#d8c58d'; ctx.beginPath(); path.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.stroke();
  ctx.lineWidth = 48; ctx.strokeStyle = '#f0dfad'; ctx.beginPath(); path.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.stroke();
  crates.forEach(c => { const p = center(c); ctx.fillStyle = '#a66b35'; ctx.fillRect(p.x-19,p.y-19,38,38); ctx.strokeStyle='#f2c36a';ctx.lineWidth=3;ctx.strokeRect(p.x-15,p.y-15,30,30);ctx.font='18px serif';ctx.textAlign='center';ctx.fillText('🎁',p.x,p.y+6);ctx.fillStyle='#26382d';ctx.font='bold 11px Nunito';ctx.fillText(`Lv.${c.level}`,p.x,p.y+30);ctx.fillStyle='#fff';ctx.fillRect(p.x-20,p.y-27,40,4);ctx.fillStyle='#d67d3b';ctx.fillRect(p.x-20,p.y-27,40*Math.max(0,c.hp/c.max),4); });
  if(selectedTower&&towers.includes(selectedTower)){const p=drag&&drag.tower===selectedTower?{x:drag.x,y:drag.y}:center(selectedTower),z=evolution[selectedTower.evo],r=attackRadius(z);ctx.save();ctx.fillStyle=z.color+'22';ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();ctx.strokeStyle=z.color;ctx.lineWidth=3;ctx.stroke();ctx.restore()}
  towers.forEach(t => { const p=drag&&drag.tower===t?{x:drag.x,y:drag.y}:center(t), z=evolution[t.evo];ctx.save();if(drag&&drag.tower===t){ctx.shadowColor='rgba(35,60,40,.35)';ctx.shadowBlur=16;ctx.shadowOffsetY=8}ctx.fillStyle='rgba(49,89,44,.18)';ctx.beginPath();ctx.arc(p.x,p.y,27,0,7);ctx.fill();ctx.fillStyle=z.color;ctx.beginPath();ctx.arc(p.x,p.y,t.evo==='base'?20:23,0,7);ctx.fill();if(t.evo!=='base'){ctx.strokeStyle='#fff9';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,18,0,7);ctx.stroke()}ctx.font=t.evo==='base'?'24px serif':'27px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(z.icon,p.x,p.y);ctx.fillStyle='#fff';ctx.font='bold 11px Nunito';ctx.fillText(`Lv ${t.level}`,p.x,p.y+31);ctx.restore(); });
  enemies.forEach(e=>{const type=enemyTypes[e.type],r=e.radius||15,primary=enemyTraits[e.traits[0]]||{color:'#748079'};ctx.save();ctx.fillStyle=primary.color;ctx.beginPath();ctx.arc(e.x,e.y,r,0,7);ctx.fill();if(e.burn>0){ctx.fillStyle=`rgba(255,92,28,${.25+.18*Math.sin(performance.now()/80)})`;ctx.beginPath();ctx.arc(e.x,e.y,r+2,0,7);ctx.fill()}if(e.type!=='normal'){ctx.strokeStyle=e.type==='boss'?'#ffd05a':'#eadfff';ctx.lineWidth=3;ctx.stroke()}if(e.slow>0){ctx.strokeStyle='#77d5eb';ctx.lineWidth=3;ctx.beginPath();ctx.arc(e.x,e.y,r+4,0,7);ctx.stroke()}if(e.knockback>0){e.knockback-=.03;ctx.strokeStyle='#f1bf62';ctx.lineWidth=3;ctx.beginPath();ctx.arc(e.x,e.y,r+10,0,7);ctx.stroke()}if(e.stun>0){ctx.strokeStyle='#ffe76b';ctx.lineWidth=3;ctx.beginPath();ctx.arc(e.x,e.y-22,9,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#ffe76b';for(let i=0;i<4;i++){const a=performance.now()/220+i*Math.PI/2;ctx.fillRect(e.x+Math.cos(a)*14-2,e.y-22+Math.sin(a)*14-2,4,4)}}if(e===selectedEnemy){ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(e.x,e.y,r+8,0,7);ctx.stroke()}ctx.fillStyle='#fff';ctx.font=`bold ${e.type==='boss'?20:14}px Nunito`;ctx.textAlign='center';ctx.fillText(e.kind,e.x,e.y+1);ctx.fillRect(e.x-r,e.y-r-9,r*2,5);ctx.fillStyle=e.type==='boss'?'#e5a52b':e.type==='elite'?'#9a72db':primary.color;ctx.fillRect(e.x-r,e.y-r-9,r*2*Math.max(0,e.hp/e.max),5);ctx.fillStyle='#3b2d2a';ctx.font='bold 10px Nunito';const traitText=e.traits.length?e.traits.map(key=>enemyTraits[key].icon).join('·'):'无';ctx.fillText(`${type.label} ${traitText}`,e.x,e.y+r+13);const markerX=e.x-(e.traits.length*7-2)/2;e.traits.forEach((key,i)=>{ctx.fillStyle=enemyTraits[key].color;ctx.fillRect(markerX+i*7,e.y+r+17,5,5)});ctx.restore()});
  hits.forEach(p=>{ctx.save();ctx.globalAlpha=p.life;if(p.type==='slash'){ctx.translate(p.originX,p.originY);ctx.rotate(p.angle);ctx.strokeStyle=p.color;ctx.lineWidth=10;ctx.lineCap='round';ctx.beginPath();ctx.arc(0,0,p.radius,-.7,.7);ctx.stroke()}else if(p.type==='impact'){ctx.strokeStyle=p.color;ctx.lineWidth=p.evo==='earth'?10:6;ctx.beginPath();ctx.arc(p.x,p.y,Math.max(8,p.radius*(1-p.life*.35)),0,Math.PI*2);ctx.stroke()}else if(p.type==='pierce'){ctx.strokeStyle=p.color;ctx.lineWidth=p.evo==='wind'?7:5;ctx.beginPath();ctx.moveTo(p.originX,p.originY);ctx.lineTo(p.x,p.y);ctx.stroke();ctx.lineWidth=2;ctx.strokeStyle='#fff';ctx.stroke()}else if(p.type==='chain'){ctx.strokeStyle=p.color;ctx.lineWidth=p.evo==='thunder'?6:4;ctx.beginPath();ctx.moveTo(p.originX,p.originY);ctx.lineTo((p.originX+p.x)/2+10,p.y-10);ctx.lineTo(p.x,p.y);ctx.stroke()}else if(p.type==='five'){['#c99b36','#4f9d50','#399dc4','#d95832','#9c754d'].forEach((color,i)=>{ctx.strokeStyle=color;ctx.lineWidth=4;ctx.beginPath();ctx.arc(p.x,p.y,22+i*10,0,Math.PI*2);ctx.stroke()})}else if(p.type==='taiji'){ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(p.x,p.y,55,0,Math.PI*2);ctx.fill();ctx.fillStyle='#222';ctx.beginPath();ctx.arc(p.x,p.y,55,Math.PI/2,Math.PI*1.5);ctx.fill();ctx.font='bold 40px serif';ctx.textAlign='center';ctx.fillText('☯',p.x,p.y+3)}else{ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,4,4)}if(p.glyph&&p.type!=='taiji'){ctx.fillStyle=p.color;ctx.font='bold 25px serif';ctx.textAlign='center';ctx.fillText(p.glyph,p.x,p.y-25)}ctx.restore()});
}
function completeWave() {
  running = false;
  if (finalWave) { gameWon = true; $('message').textContent = '最终进化守住了甜橙谷，你胜利了！'; $('waveBtn').textContent = '重新开始'; score += 5000; ui(); return; }
  wave++; nextWaveTimer = 2.5; $('message').textContent = `第 ${wave - 1} 波完成，${nextWaveTimer.toFixed(1)} 秒后进入第 ${wave} 波。`; ui();
}
function update(dt) {
  if (started && !running && !gameWon && lives > 0 && nextWaveTimer > 0) { nextWaveTimer -= dt; $('message').textContent = `第 ${wave} 波将在 ${Math.max(0, nextWaveTimer).toFixed(1)} 秒后开始。`; if (nextWaveTimer <= 0) startWave(); }
  if (running) {
    spawnTimer -= dt; crateTimer -= dt;
    if (spawned < waveSize() && spawnTimer <= 0) { addEnemy(); spawned++; spawnTimer = Math.max(.25, .78 - wave * .025); }
    if (crateTimer <= 0) { addCrate(); crateTimer = Math.max(5, 10 - wave * .15) + Math.random() * 4; }
    if (spawned >= waveSize() && enemies.length === 0) completeWave();
  }
  enemies.forEach(e=>{if(e.slow>0)e.slow-=dt;if(e.stun>0)e.stun-=dt;if(e.taiji>0)e.taiji-=dt;if(e.burn>0){e.burn-=dt;e.hp-=8*dt;if(e.hp<=0&&!e.dead&&e.burnSource){damageTarget(e.burnSource,e,{...evolution[e.burnSource.evo],damage:0})}}if(e.weaken>0)e.weaken-=dt;if(e.regen>0)e.hp=Math.min(e.max,e.hp+e.regen*dt);const rage=e.enraged&&e.hp/e.max<.5?1.45:1;e.dist+=e.stun>0?0:e.speed*rage*(e.slow>0?.4:1)*dt;Object.assign(e,pointAt(e.dist));if(e.dist>=pathLength){e.dead=true;lives-=enemyTypes[e.type].lifeCost;ui()}});
  towers.forEach(t=>{const p=center(t),z=evolution[t.evo],range=attackRadius(z);t.cool-=dt;if(t.cool<=0){const enemyTargets=enemies.filter(e=>!e.dead&&Math.hypot(e.x-p.x,e.y-p.y)<range).sort((a,b)=>b.dist-a.dist);const crateTargets=crates.filter(c=>{const q=center(c);return!c.dead&&Math.hypot(q.x-p.x,q.y-p.y)<range});let targets=[...enemyTargets,...crateTargets];if(enemyTargets.length){if(z.attackMode==='single')targets=[enemyTargets[0]];else if(z.attackMode==='chain')targets=enemyTargets.slice(0,3);else if(z.attackMode==='pierce')targets=enemyTargets.slice(0,5);else if(z.attackMode==='splash'){const hit=enemyTargets[0];targets=enemyTargets.filter(e=>Math.hypot(e.x-hit.x,e.y-hit.y)<72).slice(0,6)}else if(z.attackMode==='omni')targets=enemyTargets.slice(0,t.evo==='taiji'?16:12)}if(targets.length){t.cool=z.rate;targets.forEach(target=>damageTarget(t,target,z));if(z.attackMode==='chain'||z.attackMode==='pierce')targets.forEach(target=>attackEffect(t,target,z));else attackEffect(t,targets[0],z);ui()}}});
  crates=crates.filter(c=>!c.dead);enemies=enemies.filter(e=>!e.dead&&e.hp>0);hits.forEach(p=>{p.life-=dt*(p.type==='slash'?3.4:1);if(!p.type){p.x+=p.vx*dt;p.y+=p.vy*dt}});hits=hits.filter(p=>p.life>0);
  if(lives<=0&&running){running=false;started=false;$('message').textContent='森林失守了，再试一次吧！';$('waveBtn').disabled=false;$('waveBtn').textContent='重新开始'}
}
function loop(ts){const dt=Math.min(.05,(ts-last)/1000||0);last=ts;if(!paused)update(dt*speed);draw();requestAnimationFrame(loop)}
function pointerCell(e){const r=canvas.getBoundingClientRect();return{col:Math.max(0,Math.min(COLS-1,Math.floor((e.clientX-r.left)*W/r.width/CELL))),row:Math.max(0,Math.min(ROWS-1,Math.floor((e.clientY-r.top)*H/r.height/CELL)))}}
function pointerPosition(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height}}
canvas.addEventListener('pointerdown',e=>{const c=pointerCell(e),p=pointerPosition(e);const tower=towers.find(t=>t.col===c.col&&t.row===c.row);if(tower){selectedEnemy=null;selectedTower=tower;drag={tower,x:p.x,y:p.y,origin:{col:tower.col,row:tower.row}};canvas.setPointerCapture(e.pointerId);ui();return}const enemy=[...enemies].reverse().find(item=>Math.hypot(item.x-p.x,item.y-p.y)<=item.radius+7);if(enemy){selectedEnemy=enemy;selectedTower=null;ui()}});
canvas.addEventListener('pointermove',e=>{if(!drag)return;const r=canvas.getBoundingClientRect();drag.x=(e.clientX-r.left)*W/r.width;drag.y=(e.clientY-r.top)*H/r.height});
canvas.addEventListener('pointerup',()=>{if(!drag)return;const tower=drag.tower,c=Math.max(0,Math.min(COLS-1,Math.floor(drag.x/CELL))),r=Math.max(0,Math.min(ROWS-1,Math.floor(drag.y/CELL)));tower.col=c;tower.row=r;const other=towers.find(t=>t!==tower&&t.col===c&&t.row===r);const sameBranch=other&&branchOf[other.evo]===branchOf[tower.evo];if(isRoad(c,r)||crates.some(x=>x.col===c&&x.row===r)){tower.col=drag.origin.col;tower.row=drag.origin.row;$('message').textContent='道路或宝箱占用此格。'}else if(other&&other.level===tower.level&&sameBranch&&tower.level<MAX_LEVEL){other.level++;towers=towers.filter(t=>t!==tower);selectedTower=other;if(other.level===5&&other.evo==='base'){pendingEvolution=other;openEvolution()}else if(other.level===MAX_LEVEL){finalWave=true;$('message').textContent=running?`${evolution[other.evo].ultimate}诞生，当前波成为决胜波！`:`${evolution[other.evo].ultimate}诞生，下一波成为决胜波！`}else $('message').textContent=`合成成功！${evolution[other.evo].name} Lv.${other.level}`;}else if(other){tower.col=drag.origin.col;tower.row=drag.origin.row;$('message').textContent=other.level!==tower.level?'只有同等级炮塔才能合成。':'只有相同进化路线的炮塔才能合并。'}delete drag.origin;drag=null;tryFiveFusion();tryTaijiFusion();ui()});
function openEvolution(){ const choices=pickRoutes();const rare=choices.some(key=>evolution[key].rare),dialog=document.querySelector('.evo-dialog');$('evoTitle').textContent=rare?'稀有进化路线出现！':'选择永久进化分支';$('evoTitle').classList.toggle('rare-alert',rare);$('rareBanner').hidden=!rare;dialog.classList.toggle('has-rare',rare);$('evoChoices').innerHTML=choices.map(key=>{const route=evolution[key],rarity=route.rare?'★ 稀有路线 ★':'五行路线';return `<button class="${route.rare?'rare-route':''}" data-route="${key}" data-rare-route="${route.rare?'true':'false'}" data-route-key="${key}">${route.rare?'<span class="rare-badge">稀有</span>':''}<strong>${route.icon} ${route.name}</strong><small><b>${rarity}</b><br>${route.desc}<br>Lv.10：${route.ultimate}</small></button>`}).join('');document.querySelectorAll('[data-route]').forEach(button=>button.onclick=()=>chooseEvolution(button.dataset.route));const modal=$('evoModal');modal.classList.add('show');modal.setAttribute('aria-hidden','false');document.body.classList.add('modal-open'); }
function closeEvolution(){ $('evoModal').classList.remove('show');$('evoModal').setAttribute('aria-hidden','true');document.body.classList.remove('modal-open'); }
function chooseEvolution(route){const t=pendingEvolution;if(!t)return;t.evo=route;t.evoTier=1;pendingEvolution=null;closeEvolution();$('message').textContent=`路线已确定：${evolution[t.evo].name}，此后将沿该分支持续进化`;tryFiveFusion();tryTaijiFusion();ui()}
function tryFiveFusion() {
  let parts = null;
  for (const metal of towers.filter(t => t.evo === 'metal')) {
    const at = (evo, col, row) => towers.find(t => t.evo === evo && t.col === col && t.row === row);
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
  anchor.evo = 'fiveSpirit'; anchor.evoTier = 1; anchor.level = level; anchor.cool = 0;
  towers.push(anchor); selectedTower = anchor; finalWave = finalWave || level === MAX_LEVEL;
  $('message').textContent = `五行合体成功！五灵塔 Lv.${level} 诞生。`;
  return true;
}
function tryTaijiFusion() {
  const pattern = [['yang',-1,-1],['yang',0,-1],['yin',1,-1],['yin',-1,0],['yang',1,0],['yang',-1,1],['yin',0,1],['yin',1,1]];
  for (let row=1;row<ROWS-1;row++) for(let col=1;col<COLS-1;col++) {
    if (isRoad(col,row)||occupied(col,row)) continue;
    const match = inverted => pattern.map(([evo,dx,dy]) => towers.find(t => t.evo === (inverted?(evo==='yin'?'yang':'yin'):evo) && t.col===col+dx && t.row===row+dy));
    let parts=match(false);if(parts.some(t=>!t))parts=match(true);if(parts.some(t=>!t))continue;
    const level=Math.min(...parts.map(t=>t.level)),anchor=parts[0];
    towers=towers.filter(t=>!parts.includes(t));Object.assign(anchor,{col,row,evo:'taiji',evoTier:1,level,cool:0});towers.push(anchor);selectedTower=anchor;finalWave=finalWave||level===MAX_LEVEL;
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
      const mate = towers.find((tower, j) => j > i && tower.level === towers[i].level && tower.evo === towers[i].evo && tower.level < MAX_LEVEL);
      if (mate) pair = [towers[i], mate];
    }
    if (!pair) break;
    const [keeper, consumed] = pair;
    keeper.level++; towers = towers.filter(tower => tower !== consumed); selectedTower = keeper; merged++;
    if (keeper.level === 5 && keeper.evo === 'base') {
      pendingEvolution = keeper; ui(); openEvolution();
      $('message').textContent = `已完成 ${merged} 次合成，请为 Lv.5 守卫选择进化路线。`;
      return;
    }
    if (keeper.level === MAX_LEVEL) finalWave = true;
  }
  $('message').textContent = merged ? `一键合成完成，共合成 ${merged} 次。` : '当前没有同等级、同路线的守卫可以合成。';
  ui();
}
function startWave(){spawned=0;kills=0;running=true;spawnTimer=0;crateTimer=4;$('waveBtn').disabled=true;$('waveBtn').textContent='自动波次中';const traitKey=waveTrait(),trait=traitKey?enemyTraits[traitKey]:null;$('message').textContent=trait?(finalWave?`最终决战开始！本波主属性：${trait.label}`:`第 ${wave} 波主属性：${trait.label}，敌人显示为对应颜色。`):`第 ${wave} 波：无属性敌人来袭。`;ui()}
$('waveBtn').onclick=()=>{if(lives<=0||gameWon)resetGame();if(!started){started=true;startWave()}else if(gameWon){resetGame();started=true;startWave()}};
$('pauseBtn').onclick=()=>{if(!started||gameWon)return;paused=!paused;$('pauseBtn').textContent=paused?'▶':'Ⅱ';$('message').textContent=paused?'游戏已暂停':'游戏继续'};
$('speedBtn').onclick=()=>{speed=speed===1?2:speed===2?3:1;$('speedBtn').textContent=`${speed}×`};
$('mergeBtn').onclick=autoMerge;
$('soundBtn').onclick=()=>{$('soundBtn').textContent=$('soundBtn').textContent==='🔊'?'🔇':'🔊'};
resetGame();ui();requestAnimationFrame(loop);
