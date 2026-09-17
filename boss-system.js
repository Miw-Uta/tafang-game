(function exposeBossMechanics(root, factory) {
  const domain = factory();
  if (typeof module === 'object' && module.exports) module.exports = domain;
  root.BossDomain = domain;
})(typeof globalThis !== 'undefined' ? globalThis : window, function createBossDomain() {
  'use strict';
  const CAST_TIME = 3;
  const FIRST_WARNING_DELAY = 6;
  const ATTACK_INTERVAL = 16;
  const ATTACK_DELAY = 2;
  const EXPOSED_TIME = 3;
  const EXPOSED_DAMAGE = 1.15;
  const SKILLS = Object.freeze({
    groveTyrant: Object.freeze({ key: 'roots', name: '腐根缚阵', verb: '腐根将缠住守卫', color: '#b1d88d', radius: 46, shape: 'roots' }),
    ashenStag: Object.freeze({ key: 'embers', name: '烬角踏火', verb: '火蹄将踏碎阵位', color: '#ffb075', radius: 46, shape: 'embers' }),
    tideArchivist: Object.freeze({ key: 'tide', name: '逆潮涌泉', verb: '逆潮将在阵位喷涌', color: '#95e2dc', radius: 46, shape: 'tide' }),
    frostOracle: Object.freeze({ key: 'frost', name: '霜钟回响', verb: '霜钟将在阵位落下', color: '#b9d9ff', radius: 46, shape: 'frost' }),
    hollowHeart: Object.freeze({ key: 'hollow', name: '蚀心烙印', verb: '暗根将封住阵位', color: '#d8b2ef', radius: 46, shape: 'hollow' })
  });
  const alive = boss => boss && !boss.dead && boss.hp > 0 && boss.type === 'boss' && Object.prototype.hasOwnProperty.call(SKILLS, boss.archetype);
  const active = context => context.running && !context.paused && !context.blocked && !context.won && context.lives > 0;
  function enabled(context) {
    if (context.finite) return context.difficulty !== 'story' && context.missionNumber >= 4;
    return context.wave >= 10;
  }

  class BossEncounters {
    constructor() { this.reset(); }
    reset() {
      this.states = new WeakMap();
      this.disruptions = new WeakMap();
      this.impacts = [];
      this.events = { warnings: 0, impacts: 0, hits: 0, dodges: 0, interrupts: 0 };
    }
    eligible(context = {}) { return Boolean(active(context) && enabled(context)); }
    stateOf(boss) {
      if (!alive(boss)) { if (boss && typeof boss === 'object') this.states.delete(boss); return null; }
      const state = this.states.get(boss);
      if (!state) return null;
      return { cooldown: state.cooldown, exposed: state.exposed, warning: state.warning && { ...state.warning }, skill: SKILLS[boss.archetype] };
    }
    tick(dt, context = {}) {
      if (!Number.isFinite(dt) || dt <= 0) return [];
      const bosses = context.enemies || [];
      bosses.forEach(boss => { if (!alive(boss)) this.states.delete(boss); });
      if (!this.eligible(context)) return [];
      this.impacts.forEach(impact => { impact.remaining -= dt; });
      this.impacts = this.impacts.filter(impact => impact.remaining > 0);
      const events = [];
      bosses.forEach(boss => {
        if (!alive(boss)) return;
        let state = this.states.get(boss);
        if (!state) { state = { cooldown: FIRST_WARNING_DELAY, exposed: 0, warning: null }; this.states.set(boss, state); }
        state.exposed = Math.max(0, state.exposed - dt);
        if (state.warning) {
          state.warning.remaining = Math.max(0, state.warning.remaining - dt);
          if (state.warning.remaining > 1e-8) return;
          const warning = state.warning;
          const struck = (context.towers || []).filter(tower => {
            const point = context.positionOf(tower);
            return Math.hypot(point.x - warning.x, point.y - warning.y) <= warning.radius;
          });
          struck.forEach(tower => { this.disruptions.set(tower, Math.max(this.disruptions.get(tower) || 0, ATTACK_DELAY)); });
          this.impacts.push({ ...warning, remaining: .7, hit: struck.length > 0 });
          state.warning = null;
          state.cooldown = ATTACK_INTERVAL - CAST_TIME;
          this.events.impacts++; this.events.hits += struck.length;
          if (!struck.length) this.events.dodges++;
          events.push({ type: 'impact', boss, warning, towers: struck });
          return;
        }
        // The first countdown begins only once the boss can be engaged. It
        // never snipes a tower across the map or follows a relocating target.
        const reachable = (context.towers || []).filter(tower => context.inRange(boss, tower));
        if (!reachable.length) return;
        state.cooldown = Math.max(0, state.cooldown - dt);
        if (state.cooldown > 1e-8) return;
        const target = reachable.reduce((best, tower) => !best || tower.level > best.level ? tower : best, null);
        const point = context.positionOf(target), skill = SKILLS[boss.archetype];
        state.warning = { x: point.x, y: point.y, radius: skill.radius, remaining: CAST_TIME, archetype: boss.archetype };
        this.events.warnings++;
        events.push({ type: 'warning', boss, warning: { ...state.warning }, target, skill });
      });
      return events;
    }
    interrupt(boss, context = {}) {
      if (!this.eligible(context) || !alive(boss)) return null;
      const state = this.states.get(boss);
      if (!state?.warning) return null;
      const warning = { ...state.warning };
      state.warning = null; state.cooldown = ATTACK_INTERVAL - CAST_TIME; state.exposed = EXPOSED_TIME;
      this.events.interrupts++;
      return { type: 'interrupt', boss, warning, duration: EXPOSED_TIME, multiplier: EXPOSED_DAMAGE };
    }
    damageMultiplier(boss) { return alive(boss) && this.states.get(boss)?.exposed > 0 ? EXPOSED_DAMAGE : 1; }
    attackDelay(tower) { return this.disruptions.get(tower) || 0; }
    combatDelta(tower, dt) {
      if (!Number.isFinite(dt) || dt <= 0) return 0;
      const remaining = this.attackDelay(tower), withheld = Math.min(remaining, dt);
      if (remaining > 0) this.disruptions.set(tower, Math.max(0, remaining - dt));
      return Math.max(0, dt - withheld);
    }
    clearWave() { this.states = new WeakMap(); this.disruptions = new WeakMap(); this.impacts = []; }
  }
  return { BossEncounters, SKILLS, CAST_TIME, FIRST_WARNING_DELAY, ATTACK_INTERVAL, ATTACK_DELAY, EXPOSED_TIME, EXPOSED_DAMAGE, enabled };
});
