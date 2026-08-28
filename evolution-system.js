(function exposeEvolutionDomain(root, factory) {
  const domain = factory();
  if (typeof module === 'object' && module.exports) module.exports = domain;
  root.EvolutionDomain = domain;
})(typeof globalThis !== 'undefined' ? globalThis : window, function createEvolutionDomain() {
  // Immutable design-time data. Runtime state remains on Tower instances.
  class EvolutionDefinition {
    constructor(key, data = {}) {
      if (!key || !data.name) throw new Error(`Invalid evolution definition: ${key || 'unknown'}`);
      const stage = data.stage || (data.fusion ? 'fusion' : data.parent ? 'branch' : key === 'base' ? 'origin' : 'primary');
      Object.assign(this, data, { key, stage, parent: data.parent || null, tags: Object.freeze([...(data.tags || [])]) });
      Object.freeze(this);
    }
    get isRoot() { return this.stage === 'primary'; }
    get isBranch() { return this.stage === 'branch'; }
    get isFusion() { return this.stage === 'fusion' || Boolean(this.fusion); }
  }

  class EvolutionGraph {
    constructor(definitions) {
      this.nodes = definitions;
      this.childrenByParent = new Map();
      for (const node of definitions.values()) {
        if (!node.parent) continue;
        if (!this.childrenByParent.has(node.parent)) this.childrenByParent.set(node.parent, []);
        this.childrenByParent.get(node.parent).push(node.key);
      }
      for (const children of this.childrenByParent.values()) Object.freeze(children);
      Object.freeze(this);
    }
    children(parent) { return [...(this.childrenByParent.get(parent) || [])]; }
    roots() { return [...this.nodes.values()].filter(node => node.isRoot).map(node => node.key); }
    lineage(key) {
      const path = []; let node = this.nodes.get(key);
      while (node) { path.unshift(node.key); node = node.parent ? this.nodes.get(node.parent) : null; }
      return path;
    }
    descendants(key) {
      const result = []; const visit = parent => this.children(parent).forEach(child => { result.push(child); visit(child); });
      visit(key); return result;
    }
  }

  class EvolutionDecision {
    constructor(tree, tower, stage, random = Math.random) {
      if (!tree || !tower || !stage) throw new Error('Evolution decision requires tree, tower and stage');
      this.tree = tree; this.tower = tower; this.stage = stage; this.random = random; this.committed = false;
      this.parent = stage === 'branch' ? tower.evolutionPath : null;
    }
    choices(pool, count = 3) { return this.tree.choices(this.stage, this.parent, pool, count, this.random); }
    validate(key) { return this.tree.validateChoice(this.tower, this.stage, key); }
    commit(key) {
      if (this.committed) return { ok: false, reason: 'already-committed' };
      const validation = this.validate(key); if (!validation.ok) return validation;
      const tier = this.stage === 'primary' ? 1 : 2;
      const path = this.stage === 'primary' ? key : this.tower.evolutionPath;
      if (typeof this.tower.evolveTo === 'function') this.tower.evolveTo(key, { tier, path });
      else Object.assign(this.tower, { evo: key, evoTier: tier, evolutionPath: path });
      this.committed = true; return { ok: true, node: this.tree.get(key), tower: this.tower };
    }
  }

  class EvolutionTree {
    constructor(definitions = {}) {
      this.definitions = new Map(); Object.entries(definitions).forEach(([key, value]) => this.register(key, value));
      this.graph = new EvolutionGraph(this.definitions);
    }
    register(key, data) {
      if (this.definitions.has(key)) throw new Error(`Evolution already exists: ${key}`);
      this.definitions.set(key, data instanceof EvolutionDefinition ? data : new EvolutionDefinition(key, data));
      return this;
    }
    get(key) { return this.definitions.get(key); }
    has(key) { return this.definitions.has(key); }
    values() { return [...this.definitions.values()]; }
    roots() { return this.graph.roots(); }
    children(parent) { return this.graph.children(parent); }
    lineage(key) { return this.graph.lineage(key); }
    stageFor(tower) {
      if (!tower || this.get(tower.evo)?.isFusion) return null;
      if (tower.evo === 'base' && !tower.evolutionPath && tower.level >= 5) return 'primary';
      if (tower.evoTier === 1 && tower.level >= 10) return 'branch';
      return null;
    }
    begin(tower, stage = this.stageFor(tower), random = Math.random) { return stage ? new EvolutionDecision(this, tower, stage, random) : null; }
    choices(stage, parent, pool, count = 3, random = Math.random) {
      const candidates = pool.filter(key => { const definition = this.get(key); return definition && (stage !== 'branch' || definition.parent === parent); });
      const picks = [];
      while (picks.length < count && candidates.length) {
        const total = candidates.reduce((sum, key) => sum + (this.get(key).weight || 1), 0); let roll = random() * total;
        const index = candidates.findIndex(key => (roll -= this.get(key).weight || 1) <= 0);
        picks.push(candidates.splice(index < 0 ? 0 : index, 1)[0]);
      }
      return picks;
    }
    validateChoice(tower, stage, key) {
      const definition = this.get(key); if (!definition) return { ok: false, reason: 'unknown' };
      if (stage === 'primary' && (tower.evo !== 'base' || tower.evolutionPath || tower.level < 5 || definition.stage !== 'primary')) return { ok: false, reason: 'primary-locked' };
      if (stage === 'branch' && (tower.evoTier !== 1 || tower.level < 10 || definition.parent !== tower.evolutionPath)) return { ok: false, reason: 'branch-locked' };
      return { ok: true, node: definition };
    }
  }
  return { EvolutionDefinition, EvolutionGraph, EvolutionDecision, EvolutionTree };
});
