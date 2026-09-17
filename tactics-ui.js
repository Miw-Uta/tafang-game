(function installTacticsUI() {
  'use strict';
  if (typeof battleTactics === 'undefined' || !battleTactics || !document.createElement) return;
  const board = document.getElementById('game'), footer = document.querySelector('.stage-foot');
  if (!board || !footer?.parentNode) return;
  const { ABILITIES, MAX_ENERGY } = TacticsDomain;
  const iconPaths = {
    bramble: '<path d="M12 21V8m0 9-6-5m6 1 6-5"/><path d="M12 9C7 9 5 6 5 3c4 0 7 2 7 6Zm0 4c0-5 3-8 8-8 0 5-3 8-8 8Z"/>',
    rally: '<circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
    flare: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/><path d="m19 2 .8 2.2L22 5l-2.2.8L19 8l-.8-2.2L16 5l2.2-.8Z"/>'
  };
  const iconMarkup = key => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[key]}</svg>`;
  const bar = document.createElement('section');
  bar.className = 'tactics-command';
  bar.setAttribute('aria-label', '巡林战术');
  bar.innerHTML = `<div class="tactics-energy"><span class="tactics-eyebrow">巡林指令</span><strong><span id="tacticsEnergy">100</span><small> / 100</small></strong><div class="tactics-meter" role="meter" aria-label="指令能量" aria-valuemin="0" aria-valuemax="100"><i></i></div><small>仅战斗中每秒 +1.8</small></div><div class="tactics-abilities">${Object.values(ABILITIES).map(ability => `<button type="button" data-tactic="${ability.key}" style="--tactic-color:${ability.color}" aria-pressed="false" title="${ability.description}"><span class="tactic-sigil" aria-hidden="true">${iconMarkup(ability.key)}</span><span class="tactic-copy"><b>${ability.name}<kbd>${ability.shortcut}</kbd></b><small>${ability.summary}</small><em data-tactic-status>${ability.cost} 指令</em></span><i class="tactic-cooldown"></i></button>`).join('')}</div><div class="tactics-instruction"><span id="tacticsHelp">指令有限：封住快敌、鼓舞主力，或照出重甲的弱点。</span><button type="button" id="tacticsConfirm" hidden>释放</button><button type="button" id="tacticsCancel" hidden aria-label="取消战术瞄准">取消 <kbd>Esc</kbd></button></div>`;
  footer.parentNode.insertBefore(bar, footer);
  const nodes = Object.fromEntries(Object.keys(ABILITIES).map(key => [key, bar.querySelector(`[data-tactic="${key}"]`)]));
  const energy = bar.querySelector('#tacticsEnergy'), meter = bar.querySelector('.tactics-meter');
  const help = bar.querySelector('#tacticsHelp'), confirm = bar.querySelector('#tacticsConfirm'), cancelButton = bar.querySelector('#tacticsCancel');
  const statuses = Object.fromEntries(Object.keys(nodes).map(key => [key, nodes[key].querySelector('[data-tactic-status]')]));
  const cooldownBars = Object.fromEntries(Object.keys(nodes).map(key => [key, nodes[key].querySelector('.tactic-cooldown')]));
  let armed = null, aim = null, touchPointer = null, lastSignature = '', consumedContextMenu = false;
  function available() { const context = tacticsContext(); return context.running && !context.paused && !context.blocked && !context.won && context.lives > 0; }
  function announce(text) { const message = document.getElementById('message'); if (message) message.textContent = text; }
  function cancel(announceCancel = true) {
    if (!armed) return;
    armed = null; aim = null; touchPointer = null; board.classList.remove('tactics-aiming');
    if (announceCancel) announce('已取消战术；未消耗指令。');
    refresh();
  }
  function arm(key) {
    if (!available()) return;
    if (armed === key) { cancel(); return; }
    if (battleTactics.cooldowns[key] > 0 || battleTactics.energy < ABILITIES[key].cost) return;
    // A targeting gesture owns the board until it is cast or cancelled.
    if (drag) { drag.tower.col = drag.origin.col; drag.tower.row = drag.origin.row; drag = null; }
    pendingDeployLevel = null; pendingDeployTowerIndex = null; deployHover = null;
    const panButton = document.getElementById('panMapBtn');
    if (panButton?.getAttribute('aria-pressed') === 'true') panButton.click();
    armed = key;
    aim = key === 'rally' && towers.length ? center(selectedTower || towers[0]) : enemies.find(enemy => !enemy.dead && enemy.hp > 0) ? { x: enemies.find(enemy => !enemy.dead && enemy.hp > 0).x, y: enemies.find(enemy => !enemy.dead && enemy.hp > 0).y } : pointAt(pathLength(currentPath()) * .4);
    board.classList.add('tactics-aiming');
    board.tabIndex = 0;
    board.focus({ preventScroll: true });
    announce(`${ABILITIES[key].name}：点击战场释放；触屏按住预览、松手释放；方向键移动落点、Enter 释放、Esc 取消。`);
    refresh();
  }
  function release() {
    if (!armed || !aim) return;
    const result = castTactic(armed, aim);
    if (result.ok) { cancel(false); }
    else { announce(result.reason); audioBus.cue('deny'); }
    refresh();
  }
  function refresh() {
    if (armed && !available()) cancel(false);
    const isAvailable = available();
    const preview = armed && aim ? battleTactics.check(armed, aim, tacticsContext()) : null;
    const signature = [Math.floor(battleTactics.energy), ...Object.values(battleTactics.cooldowns).map(Math.ceil), armed, isAvailable, preview?.ok, preview?.reason].join('|');
    if (signature === lastSignature) return;
    lastSignature = signature;
    energy.textContent = Math.floor(battleTactics.energy);
    meter.setAttribute('aria-valuenow', Math.floor(battleTactics.energy));
    meter.firstElementChild.style.width = `${battleTactics.energy / MAX_ENERGY * 100}%`;
    Object.entries(nodes).forEach(([key, button]) => {
      const ability = ABILITIES[key], remaining = battleTactics.cooldowns[key];
      button.disabled = !isAvailable || remaining > 0 || battleTactics.energy < ability.cost;
      button.setAttribute('aria-pressed', String(armed === key));
      statuses[key].textContent = remaining > 0 ? `${Math.ceil(remaining)} 秒冷却` : battleTactics.energy < ability.cost ? `${ability.cost} 指令 · 能量不足` : `${ability.cost} 指令`;
      cooldownBars[key].style.transform = `scaleX(${remaining / ability.cooldown})`;
    });
    confirm.hidden = cancelButton.hidden = !armed;
    confirm.disabled = !preview?.ok;
    help.textContent = armed ? `${preview?.reason || ''} · 点击 / Enter 释放，Esc 取消` : paused ? '前线暂停 · 指令与冷却已冻结。' : running ? '指令有限：封住快敌、鼓舞主力，或照出重甲的弱点。' : '整备时阅读战术；敌潮开始后按 Q / W / E 瞄准。';
    help.classList.toggle('invalid', Boolean(armed && !preview?.ok));
  }
  Object.entries(nodes).forEach(([key, button]) => button.addEventListener('click', () => arm(key)));
  cancelButton.addEventListener('click', () => cancel());
  confirm.addEventListener('click', release);
  board.addEventListener('pointerdown', event => {
    if (!armed) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.button === 2) { consumedContextMenu = true; cancel(); return; }
    if (event.button && event.button !== 0) return;
    aim = pointerPosition(event);
    if (event.pointerType === 'touch' || event.pointerType === 'pen') {
      touchPointer = event.pointerId;
      board.setPointerCapture(event.pointerId);
      refresh();
    } else release();
  }, true);
  board.addEventListener('pointermove', event => {
    if (!armed) return;
    event.preventDefault(); event.stopImmediatePropagation();
    aim = pointerPosition(event); refresh();
  }, true);
  board.addEventListener('pointerup', event => {
    if (!armed) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (touchPointer !== event.pointerId) return;
    aim = pointerPosition(event); touchPointer = null;
    if (board.hasPointerCapture?.(event.pointerId)) board.releasePointerCapture(event.pointerId);
    release();
  }, true);
  board.addEventListener('pointercancel', () => { if (touchPointer !== null) cancel(); }, true);
  board.addEventListener('contextmenu', event => { if (armed || consumedContextMenu) { event.preventDefault(); consumedContextMenu = false; cancel(); } });
  window.addEventListener('keydown', event => {
    const editing = node => node?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(node?.tagName);
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || editing(event.target) || editing(document.activeElement)) return;
    if (!available()) return;
    if (armed && event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); cancel(); return; }
    const key = Object.keys(ABILITIES).find(key => ABILITIES[key].shortcut.toLowerCase() === event.key.toLowerCase());
    if (key && !event.repeat) { event.preventDefault(); event.stopImmediatePropagation(); arm(key); return; }
    if (!armed) return;
    const offset = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (offset) {
      event.preventDefault(); event.stopImmediatePropagation();
      const step = event.shiftKey ? 60 : 20;
      aim = { x: Math.max(0, Math.min(W, aim.x + offset[0] * step)), y: Math.max(0, Math.min(H, aim.y + offset[1] * step)) };
      refresh();
    } else if (event.key === 'Enter' && !event.repeat && !event.target?.closest?.('button')) {
      event.preventDefault(); event.stopImmediatePropagation(); release();
    }
  }, true);
  function drawZone(context, zone, preview = false, valid = true) {
    const ability = ABILITIES[zone.key], color = valid ? ability.color : '#ff9b8d';
    const alpha = preview ? .17 : .11;
    context.save(); context.translate(zone.x, zone.y);
    context.fillStyle = color; context.globalAlpha = alpha;
    context.beginPath(); context.arc(0, 0, ability.radius, 0, Math.PI * 2); context.fill();
    context.globalAlpha = preview ? .95 : .7; context.strokeStyle = color; context.lineWidth = preview ? 2.5 : 1.5;
    context.setLineDash(preview ? [7, 5] : []);
    context.beginPath(); context.arc(0, 0, ability.radius, 0, Math.PI * 2); context.stroke(); context.setLineDash([]);
    if (!preview) {
      context.lineWidth = 4;
      context.beginPath(); context.arc(0, 0, ability.radius + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * zone.remaining / ability.duration); context.stroke();
      const time = runtime.reducedMotion ? 0 : visualClock * .7;
      for (let i = 0; i < 7; i++) {
        const angle = i / 7 * Math.PI * 2 + time, radius = ability.radius * (.6 + .12 * Math.sin(time + i));
        const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
        context.globalAlpha = .4 + .25 * Math.sin(time * 2 + i);
        context.beginPath(); context.arc(x, y, zone.key === 'flare' ? 2.5 : 2, 0, Math.PI * 2); context.fill();
      }
    }
    context.globalAlpha = 1; context.fillStyle = '#153c32'; context.strokeStyle = color; context.lineWidth = 1.5;
    context.beginPath(); context.arc(0, 0, 15, 0, Math.PI * 2); context.fill(); context.stroke();
    context.strokeStyle = color; context.lineWidth = 1.7; context.lineCap = 'round'; context.beginPath();
    if (zone.key === 'bramble') {
      context.moveTo(0, 8); context.lineTo(0, -7);context.moveTo(0, 3); context.lineTo(-6, -2);context.moveTo(0, -1); context.lineTo(6, -6);
    } else if (zone.key === 'rally') {
      context.arc(0, 0, 4, 0, Math.PI * 2);
      for(let i=0;i<8;i++){const a=i*Math.PI/4;context.moveTo(Math.cos(a)*7,Math.sin(a)*7);context.lineTo(Math.cos(a)*10,Math.sin(a)*10);}
    } else {
      context.moveTo(0,-10);context.lineTo(3,-3);context.lineTo(10,0);context.lineTo(3,3);context.lineTo(0,10);context.lineTo(-3,3);context.lineTo(-10,0);context.lineTo(-3,-3);context.closePath();
    }
    context.stroke();
    if (preview) {
      context.beginPath(); context.moveTo(-24, 0); context.lineTo(-18, 0); context.moveTo(18, 0); context.lineTo(24, 0); context.moveTo(0, -24); context.lineTo(0, -18); context.moveTo(0, 18); context.lineTo(0, 24); context.stroke();
    }
    context.restore();
  }
  function draw(context) {
    refresh();
    battleTactics.zones.forEach(zone => drawZone(context, zone));
    if (armed && aim) drawZone(context, { key: armed, ...aim }, true, battleTactics.check(armed, aim, tacticsContext()).ok);
  }
  window.TacticsUI = { draw, refresh, cancel: () => cancel(false), arm, state: () => ({ armed, aim: aim && { ...aim } }) };
  refresh();
})();
