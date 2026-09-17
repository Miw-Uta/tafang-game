const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const { SynergyCatalog } = require('../synergy-system.js');
const { synergies } = require('../game-content.js');
const { createSandbox } = require('../scripts/simulate-campaign.js');

test('authored synergy upgrades keep every previously earned combat and economy benefit', () => {
  const catalog = new SynergyCatalog(synergies);
  const effects = ['damage', 'attackSpeed', 'range', 'shieldBreak', 'armorBreak', 'statusDuration', 'spiritBonus', 'bossDamage'];
  for (const definition of catalog.values()) {
    for (let i = 1; i < definition.tiers.length; i++) {
      for (const effect of effects) {
        assert.ok(definition.tiers[i][effect] >= definition.tiers[i - 1][effect],
          `${definition.key} ${definition.tiers[i].count} members must preserve ${effect}`);
      }
    }
  }
});

test('six verdant forms earn the advertised kill income only for their members and keep control coverage', () => {
  const result = vm.runInContext(`(() => {
    startMode('endless');
    const forms = ['wood', 'water', 'wind', 'woodBranch1', 'waterBranch1', 'windBranch1'];
    towers = forms.map((evo, col) => towerFactory.create({ col, row: 0, evo, level: 10 }));
    const source = towers[0];
    const high = formationCombatModifiers(source);
    const outsider = towerFactory.create({ col: 7, row: 0, evo: 'metal', level: 10 });
    towers.push(outsider);
    const killIncome = tower => {
      coins = 0;
      const enemy = enemyFactory.create({ archetype: 'mossling', maxHp: 1, baseSpeed: 30 });
      damageTarget(tower, enemy, { ...evolution[tower.evo], effect: null });
      return coins;
    };
    const memberIncome = killIncome(source);
    const outsiderIncome = killIncome(outsider);
    const text = synergyEffectText(formationSynergies().find(item => item.definition.key === 'verdant').tier);
    towers[5] = towerFactory.create({ col: 5, row: 0, evo: 'wood', level: 10 });
    const duplicate = formationCombatModifiers(source);
    const duplicateIncome = killIncome(source);
    return { high, memberIncome, outsiderIncome, text, duplicate, duplicateIncome };
  })()`, createSandbox(20260907));
  assert.equal(result.high.statusDuration, 1.25);
  assert.equal(result.high.range, 1.12);
  assert.equal(result.high.spiritBonus, 3);
  assert.equal(result.memberIncome - result.outsiderIncome, 3);
  assert.match(result.text, /击杀灵力 \+3/);
  assert.equal(result.duplicate.spiritBonus, 0, 'duplicate forms cannot unlock the six-form economy tier');
  assert.equal(result.duplicate.statusDuration, 1.25);
  assert.equal(result.duplicate.range, 1.12);
  assert.equal(result.duplicateIncome, result.outsiderIncome);
});
