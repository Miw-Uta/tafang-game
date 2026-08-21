const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);
const W = 960, H = 540, CELL = 60, COLS = 16, ROWS = 9, MAX_LEVEL = 10;
const path = [[-30, 90], [150, 90], [150, 270], [390, 270], [390, 150], [690, 150], [690, 390], [990, 390]];
const pathLength = path.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - path[i][0], p[1] - path[i][1]), 0);
const evolution = {
  base: { name: '橡果守卫', icon: '🌰', color: '#8a633c', damage: 16, range: 100, rate: .72 },
  metal: { name: '金锋守卫', icon: '⚔️', color: '#c99b36', damage: 40, range: 110, rate: .7, desc: '锋锐斩击，高爆发伤害', ultimate: '天罡金刃' },
  wood: { name: '青木守卫', icon: '🌿', color: '#4f9d50', damage: 25, range: 145, rate: .5, desc: '藤蔓横扫，超大攻击范围', ultimate: '万象神木' },
  water: { name: '玄水守卫', icon: '💧', color: '#399dc4', damage: 18, range: 135, rate: .34, desc: '流水连击，强力减速敌人', ultimate: '沧澜水灵' },
  fire: { name: '赤焰守卫', icon: '🔥', color: '#d95832', damage: 34, range: 120, rate: .56, desc: '烈焰冲击，持续范围灼烧', ultimate: '焚天炎皇' },
  earth: { name: '厚土守卫', icon: '🪨', color: '#9c754d', damage: 54, range: 105, rate: .92, desc: '巨岩重击，极高单次伤害', ultimate: '镇岳地灵' },
  yin: { name: '幽阴守卫', icon: '🌑', color: '#625b9d', damage: 48, range: 150, rate: .52, desc: '稀有：暗影横扫，范围与伤害兼备', ultimate: '太阴冥主', rare: true },
  yang: { name: '耀阳守卫', icon: '☀️', color: '#edaf31', damage: 62, range: 135, rate: .62, desc: '稀有：炽阳爆发，最高范围爆发', ultimate: '大日神辉', rare: true },
  wind: { name: '御风守卫', icon: '🌪️', color: '#62aeb0', damage: 29, range: 165, rate: .25, desc: '稀有：疾风连斩，极快范围攻击', ultimate: '九霄风君', rare: true },
  thunder: { name: '惊雷守卫', icon: '⚡', color: '#8466cf', damage: 55, range: 145, rate: .43, desc: '稀有：雷霆震荡，强力全场打击', ultimate: '紫霄雷帝', rare: true }
};
const routes = Object.keys(evolution).filter(key => key !== 'base');
const branchOf = Object.fromEntries(['base', ...routes].map(key => [key, key]));
const routeWeights = Object.fromEntries(routes.map(key => [key, evolution[key].rare ? 1 : 7]));

let towers, crates, enemies, hits, coins, lives, score, wave, kills, spawned;
let running, gameWon, finalWave, spawnTimer, crateTimer, drag, selectedTower, pendingEvolution, nextWaveTimer, started, paused, speed, last;

function resetGame() {
  towers = [{ col: 1, row: 6, level: 1, evo: 'base', evoTier: 0, cool: 0 }];
  crates = []; enemies = []; hits = [];
  coins = 80; lives = 12; score = 0; wave = 1; kills = 0; spawned = 0;
  running = false; gameWon = false; finalWave = false; spawnTimer = 0; crateTimer = 5; drag = null; selectedTower = towers[0]; pendingEvolution = null; nextWaveTimer = 0; started = false; paused = false; speed = 1;
}

function center(item) { return { x: item.col * CELL + CELL / 2, y: item.row * CELL + CELL / 2 }; }
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
function ui() {
  $('coins').textContent = coins; $('lives').textContent = lives; $('score').textContent = score; $('wave').textContent = wave;
  $('progressText').textContent = `${kills} / ${waveSize()}`;
  $('progressBar').style.width = `${Math.min(100, kills / waveSize() * 100)}%`;
  document.querySelector('#towerList').innerHTML = `<div class="tower-card active"><div class="tower-art" style="background:${evolution.base.color}33">🌰</div><div><b>橡果守卫</b><small>范围近战 · 网格移动</small></div><span class="price">Lv.1-${MAX_LEVEL}</span></div>`;
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
  const hp = 38 + wave * 20 + spawned * 2.5;
  enemies.push({ dist: 0, x: -30, y: 90, hp, max: hp, speed: 35 + wave * 4.5, kind: wave % 3 === 0 ? '🔴' : wave % 2 ? '🟢' : '🟣', slow: 0 });
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
  hits.push({ type: 'slash', x: p.x, y: p.y, angle, radius: z.range * .72, life: 1, color: z.color, evo: branchOf[t.evo] });
  burst(q.x, q.y, z.color);
}
function damageTarget(t, target, z) {
  target.hp -= z.damage * t.level;
  if (branchOf[t.evo] === 'water' && 'dist' in target) target.slow = 1.6;
  if (target.hp > 0 || target.dead) return;
  target.dead = true;
  if ('dist' in target) { coins += 10 + wave; score += 100 * t.level; kills++; }
  else { const crateRoute=target.level>5?routes[Math.floor(Math.random()*routes.length)]:'base';towers.push({ col: target.col, row: target.row, level: target.level, evo: crateRoute, evoTier: crateRoute==='base'?0:1, cool: 0 }); $('message').textContent = `Lv.${target.level} 宝箱转化为${evolution[crateRoute].name}！`; }
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
  if(selectedTower&&towers.includes(selectedTower)){const p=drag&&drag.tower===selectedTower?{x:drag.x,y:drag.y}:center(selectedTower),z=evolution[selectedTower.evo];ctx.fillStyle=z.color+'20';ctx.strokeStyle=z.color+'aa';ctx.setLineDash([8,7]);ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,z.range,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([])}
  towers.forEach(t => { const p=drag&&drag.tower===t?{x:drag.x,y:drag.y}:center(t), z=evolution[t.evo];ctx.save();if(drag&&drag.tower===t){ctx.shadowColor='rgba(35,60,40,.35)';ctx.shadowBlur=16;ctx.shadowOffsetY=8}ctx.fillStyle='rgba(49,89,44,.18)';ctx.beginPath();ctx.arc(p.x,p.y,27,0,7);ctx.fill();ctx.fillStyle=z.color;ctx.beginPath();ctx.arc(p.x,p.y,t.evo==='base'?20:23,0,7);ctx.fill();if(t.evo!=='base'){ctx.strokeStyle='#fff9';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,18,0,7);ctx.stroke()}ctx.font=t.evo==='base'?'24px serif':'27px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(z.icon,p.x,p.y);ctx.fillStyle='#fff';ctx.font='bold 11px Nunito';ctx.fillText(`Lv ${t.level}`,p.x,p.y+31);ctx.restore(); });
  enemies.forEach(e=>{ctx.fillStyle=e.slow>0?'#78c6d4':'#d96d62';ctx.beginPath();ctx.arc(e.x,e.y,15,0,7);ctx.fill();ctx.font='17px serif';ctx.fillText(e.kind,e.x,e.y+1);ctx.fillStyle='#fff';ctx.fillRect(e.x-15,e.y-24,30,4);ctx.fillStyle='#65aa4f';ctx.fillRect(e.x-15,e.y-24,30*Math.max(0,e.hp/e.max),4)});
  hits.forEach(p=>{ctx.save();ctx.globalAlpha=p.life;if(p.type==='slash'){ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.strokeStyle=p.color;ctx.lineWidth=p.evo==='earth'||p.evo==='yang'?11:7;ctx.lineCap='round';ctx.beginPath();ctx.arc(0,0,p.radius,-.65,.65);ctx.stroke();if(p.evo==='wood'||p.evo==='thunder'){ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(18,-15);ctx.lineTo(p.radius,0);ctx.lineTo(18,15);ctx.stroke()}}else{ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,4,4)}ctx.restore()});
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
  enemies.forEach(e=>{if(e.slow>0)e.slow-=dt;e.dist+=e.speed*(e.slow>0?.4:1)*dt;Object.assign(e,pointAt(e.dist));if(e.dist>=pathLength){e.dead=true;lives--;ui()}});
  towers.forEach(t=>{const p=center(t),z=evolution[t.evo];t.cool-=dt;if(t.cool<=0){const enemyTargets=enemies.filter(e=>!e.dead&&Math.hypot(e.x-p.x,e.y-p.y)<z.range);const crateTargets=crates.filter(c=>{const q=center(c);return!c.dead&&Math.hypot(q.x-p.x,q.y-p.y)<z.range});const targets=[...enemyTargets,...crateTargets];if(targets.length){t.cool=z.rate;targets.forEach(target=>damageTarget(t,target,z));attackEffect(t,enemyTargets[0]||crateTargets[0],z);ui()}}});
  crates=crates.filter(c=>!c.dead);enemies=enemies.filter(e=>!e.dead&&e.hp>0);hits.forEach(p=>{p.life-=dt*(p.type==='slash'?3.4:1);if(!p.type){p.x+=p.vx*dt;p.y+=p.vy*dt}});hits=hits.filter(p=>p.life>0);
  if(lives<=0&&running){running=false;started=false;$('message').textContent='森林失守了，再试一次吧！';$('waveBtn').disabled=false;$('waveBtn').textContent='重新开始'}
}
function loop(ts){const dt=Math.min(.05,(ts-last)/1000||0);last=ts;if(!paused)update(dt*speed);draw();requestAnimationFrame(loop)}
function pointerCell(e){const r=canvas.getBoundingClientRect();return{col:Math.max(0,Math.min(COLS-1,Math.floor((e.clientX-r.left)*W/r.width/CELL))),row:Math.max(0,Math.min(ROWS-1,Math.floor((e.clientY-r.top)*H/r.height/CELL)))}}
canvas.addEventListener('pointerdown',e=>{const c=pointerCell(e);const tower=towers.find(t=>t.col===c.col&&t.row===c.row);if(tower){selectedTower=tower;drag={tower,x:e.offsetX*W/canvas.clientWidth,y:e.offsetY*H/canvas.clientHeight,origin:{col:tower.col,row:tower.row}};canvas.setPointerCapture(e.pointerId)}});
canvas.addEventListener('pointermove',e=>{if(!drag)return;const r=canvas.getBoundingClientRect();drag.x=(e.clientX-r.left)*W/r.width;drag.y=(e.clientY-r.top)*H/r.height});
canvas.addEventListener('pointerup',()=>{if(!drag)return;const tower=drag.tower,c=Math.max(0,Math.min(COLS-1,Math.floor(drag.x/CELL))),r=Math.max(0,Math.min(ROWS-1,Math.floor(drag.y/CELL)));tower.col=c;tower.row=r;const other=towers.find(t=>t!==tower&&t.col===c&&t.row===r);const sameBranch=other&&branchOf[other.evo]===branchOf[tower.evo];if(isRoad(c,r)||crates.some(x=>x.col===c&&x.row===r)){tower.col=drag.origin.col;tower.row=drag.origin.row;$('message').textContent='道路或宝箱占用此格。'}else if(other&&other.level===tower.level&&sameBranch&&tower.level<MAX_LEVEL){other.level++;towers=towers.filter(t=>t!==tower);selectedTower=other;if(other.level===5&&other.evo==='base'){pendingEvolution=other;openEvolution()}else if(other.level===MAX_LEVEL){finalWave=true;$('message').textContent=running?`${evolution[other.evo].ultimate}诞生，当前波成为决胜波！`:`${evolution[other.evo].ultimate}诞生，下一波成为决胜波！`}else $('message').textContent=`合成成功！${evolution[other.evo].name} Lv.${other.level}`;}else if(other){tower.col=drag.origin.col;tower.row=drag.origin.row;$('message').textContent=other.level!==tower.level?'只有同等级炮塔才能合成。':'只有相同进化路线的炮塔才能合并。'}delete drag.origin;drag=null;ui()});
function openEvolution(){ const choices=pickRoutes();$('evoChoices').innerHTML=choices.map(key=>{const route=evolution[key],rarity=route.rare?'稀有路线':'五行路线';return `<button data-route="${key}"><strong>${route.icon} ${route.name}</strong><small><b>${rarity}</b><br>${route.desc}<br>Lv.10：${route.ultimate}</small></button>`}).join('');document.querySelectorAll('[data-route]').forEach(button=>button.onclick=()=>chooseEvolution(button.dataset.route));const modal=$('evoModal');modal.classList.add('show');modal.setAttribute('aria-hidden','false');document.body.classList.add('modal-open'); }
function closeEvolution(){ $('evoModal').classList.remove('show');$('evoModal').setAttribute('aria-hidden','true');document.body.classList.remove('modal-open'); }
function chooseEvolution(route){const t=pendingEvolution;if(!t)return;t.evo=route;t.evoTier=1;pendingEvolution=null;closeEvolution();$('message').textContent=`路线已确定：${evolution[t.evo].name}，此后将沿该分支持续进化`;ui()}
function startWave(){spawned=0;kills=0;running=true;spawnTimer=0;crateTimer=4;$('waveBtn').disabled=true;$('waveBtn').textContent='自动波次中';$('message').textContent=finalWave?'最终决战开始！':'敌人变强了，守住无尽林地！';ui()}
$('waveBtn').onclick=()=>{if(lives<=0||gameWon)resetGame();if(!started){started=true;startWave()}else if(gameWon){resetGame();started=true;startWave()}};
$('pauseBtn').onclick=()=>{if(!started||gameWon)return;paused=!paused;$('pauseBtn').textContent=paused?'▶':'Ⅱ';$('message').textContent=paused?'游戏已暂停':'游戏继续'};
$('speedBtn').onclick=()=>{speed=speed===1?2:speed===2?3:1;$('speedBtn').textContent=`${speed}×`};
$('soundBtn').onclick=()=>{$('soundBtn').textContent=$('soundBtn').textContent==='🔊'?'🔇':'🔊'};
resetGame();ui();requestAnimationFrame(loop);
