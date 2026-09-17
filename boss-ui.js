(function installBossUI() {
  'use strict';
  if (typeof bossEncounters === 'undefined' || !bossEncounters) return;
  const { SKILLS, CAST_TIME } = BossDomain;
  function emblem(context, shape, size) {
    context.beginPath();
    if (shape === 'roots') {
      context.moveTo(0, size); context.lineTo(0, -size);
      for (const side of [-1, 1]) { context.moveTo(0, size * .4); context.lineTo(side * size * .65, -size * .1); context.lineTo(side * size, -size * .6); }
    } else if (shape === 'embers') {
      for (const side of [-1, 1]) { context.moveTo(side * 3, -size); context.lineTo(side * size, -size * .2); context.lineTo(side * size * .7, size); context.lineTo(side * 3, size * .6); }
    } else if (shape === 'tide') {
      for (const offset of [-.55, .15, .8]) { context.moveTo(-size, size * offset); context.quadraticCurveTo(-size * .5, size * (offset - .6), 0, size * offset); context.quadraticCurveTo(size * .5, size * (offset + .6), size, size * offset); }
    } else if (shape === 'frost') {
      for (let i = 0; i < 6; i++) { const angle = i * Math.PI / 3; context.moveTo(0, 0); context.lineTo(Math.cos(angle) * size, Math.sin(angle) * size); }
    } else {
      for (let i = 0; i < 5; i++) { const angle = i * Math.PI * 2 / 5 - Math.PI / 2; context.moveTo(Math.cos(angle) * size, Math.sin(angle) * size); context.lineTo(Math.cos(angle + 1) * size * .5, Math.sin(angle + 1) * size * .5); context.lineTo(0, 0); }
    }
    context.stroke();
  }
  function drawWarning(context, warning, impact = false) {
    const skill = SKILLS[warning.archetype], progress = impact ? 1 - warning.remaining / .7 : 1 - warning.remaining / CAST_TIME;
    context.save(); context.translate(warning.x, warning.y);
    context.globalAlpha = impact ? Math.min(1, warning.remaining / .7) : 1;
    context.fillStyle = impact ? '#ffad7940' : '#341c2588';
    context.strokeStyle = impact ? skill.color : '#ffb18a'; context.lineWidth = 2;
    context.beginPath(); context.arc(0, 0, warning.radius, 0, Math.PI * 2); context.fill();
    context.setLineDash(impact ? [] : [5, 4]); context.stroke(); context.setLineDash([]);
    context.lineWidth = 4;
    context.strokeStyle = '#ffe0a5';
    context.beginPath(); context.arc(0, 0, warning.radius + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress); context.stroke();
    context.globalAlpha *= .48;
    context.strokeStyle = skill.color;
    context.lineWidth = 1.5;
    const spokeCount = skill.shape === 'frost' ? 6 : skill.shape === 'hollow' ? 5 : 8;
    for (let i = 0; i < spokeCount; i++) {
      const angle = i * Math.PI * 2 / spokeCount;
      context.save(); context.rotate(angle); context.translate(0, warning.radius * .74); emblem(context, skill.shape, 5); context.restore();
    }
    context.globalAlpha = impact ? warning.remaining / .7 : .8;
    context.strokeStyle = '#fff2ce'; context.lineWidth = 2;
    if (impact) { context.beginPath(); context.arc(0, 0, warning.radius * (.35 + progress), 0, Math.PI * 2); context.stroke(); }
    context.restore();
  }
  function drawGround(context) {
    if (!running || gameWon || lives <= 0) return;
    enemies.forEach(enemy => { const state = bossEncounters.stateOf(enemy); if (state?.warning) drawWarning(context, state.warning); });
    bossEncounters.impacts.forEach(impact => drawWarning(context, impact, true));
  }
  function caption(context, point, label, color, width = 102) {
    const x = Math.max(width / 2 + 3, Math.min(W - width / 2 - 3, point.x));
    const y = Math.max(14, Math.min(H - 14, point.y));
    context.fillStyle = '#112d29f2'; context.strokeStyle = color; context.lineWidth = 1;
    context.beginPath(); context.roundRect(x - width / 2, y - 10, width, 20, 5); context.fill(); context.stroke();
    context.fillStyle = color; context.textAlign = 'center'; context.textBaseline = 'middle'; context.font = '700 10px "Noto Sans SC",sans-serif';
    context.fillText(label, x, y + .5);
  }
  function drawStatus(context) {
    if (!running || gameWon || lives <= 0) return;
    context.save();
    enemies.forEach(enemy => {
      const state = bossEncounters.stateOf(enemy);
      if (state?.warning) caption(context, { x: state.warning.x, y: state.warning.y - state.warning.radius - 19 }, `${state.skill.name} ${state.warning.remaining.toFixed(1)}s`, state.skill.color, 116);
      if (state?.exposed > 0) caption(context, { x: enemy.x, y: enemy.y + enemy.radius + 35 }, `破绽 +15% · ${state.exposed.toFixed(1)}s`, '#f8d690', 108);
    });
    towers.forEach(tower => { const delay = bossEncounters.attackDelay(tower); if (delay > 0) caption(context, { x: center(tower).x, y: center(tower).y + 38 }, `整备 ${delay.toFixed(1)}s`, '#ffc9a0', 78); });
    context.restore();
  }
  window.BossUI = { drawGround, drawStatus };
})();
