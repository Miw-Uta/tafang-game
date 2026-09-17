// The fixture creates a durable live boss beside a legal tower; all warnings,
// impacts, mouse relocations and E interrupts then use production game code.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.GAME_URL || 'http://127.0.0.1:4175';
const output = process.env.SCREENSHOT_DIR || '/tmp/tafang-boss-verification';

(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem('tafang.campaignProgress', JSON.stringify(Object.fromEntries(['groveGate', 'whisperGrove', 'rootCrossing'].map(key => [key, { stars: 1, completedAt: 1, score: 0 }])))));
    await page.goto(base);
    async function setup() {
      return page.evaluate(() => {
        startMode('campaign', 'mirrorMarsh'); navigatePage('battle');
        document.getElementById('storyModal').hidden = true;
        running = true; paused = false; started = true; spawnTimer = 999; spawned = 0;
        window.campaignModifiers.difficulty = 'normal';
        const tower = towers[0], field = currentBattlefield();
        let fixture;
        for (const [col, row] of field.buildSlots) {
          if (!isBuildSlot(col, row)) continue;
          const safe = field.buildSlots.find(([otherCol, otherRow]) => isBuildSlot(otherCol, otherRow) && Math.abs(otherCol - col) + Math.abs(otherRow - row) === 1);
          if (!safe) continue;
          tower.relocate(col, row);
          const origin = center(tower);
          for (let distance = 80; distance < currentPathLength(); distance += 20) {
            const point = pointAt(distance);
            if (Math.hypot(point.x - origin.x, point.y - origin.y) < currentAttackRadius(evolution[tower.evo], tower) - 15) { fixture = { origin, safe, point, distance }; break; }
          }
          if (fixture) break;
        }
        if (!fixture) throw new Error('No legal adjacent dodge fixture');
        const boss = enemyFactory.create({ archetype: 'tideArchivist', maxHp: 1e9, baseSpeed: 1 });
        boss.baseSpeed = 0; boss.speed = 0;
        Object.assign(boss, { ...fixture.point, dist: fixture.distance, routeIndex: 0 });
        enemies = [boss]; tower.cool = 100;
        advanceBossEncounters(6);
        return { ...fixture, initial: bossEncounters.stateOf(boss).warning.remaining, sourceCell: { col: tower.col, row: tower.row } };
      });
    }
    async function mouseCell(col, row, down) {
      const rect = await page.locator('#game').boundingBox();
      await page.mouse.move(rect.x + (col * 60 + 30) / 960 * rect.width, rect.y + (row * 60 + 30) / 540 * rect.height, { steps: 4 });
      if (down) await page.mouse.down();
    }
    const first = await setup();
    assert.equal(first.initial, 3);
    await page.screenshot({ path: path.join(output, 'boss-warning.png'), fullPage: true });
    await page.keyboard.press('p');
    const paused = await page.evaluate(() => bossEncounters.stateOf(enemies[0]).warning.remaining);
    await page.waitForTimeout(160);
    assert.equal(await page.evaluate(() => bossEncounters.stateOf(enemies[0]).warning.remaining), paused);
    await page.keyboard.press('p');
    await mouseCell(first.sourceCell.col, first.sourceCell.row, true);
    await mouseCell(first.safe[0], first.safe[1]); await page.mouse.up();
    assert.equal(await page.evaluate(() => towers[0].col), first.safe[0]);
    assert.equal(await page.evaluate(() => towers[0].row), first.safe[1]);
    await page.evaluate(() => advanceBossEncounters(3));
    assert.equal(await page.evaluate(() => bossEncounters.events.dodges), 1);
    assert.equal(await page.evaluate(() => bossEncounters.attackDelay(towers[0])), 0);

    await setup();
    await page.keyboard.press('e');
    assert.equal(await page.evaluate(() => TacticsUI.state().armed), 'flare');
    const position = await page.evaluate(() => ({ x: enemies[0].x, y: enemies[0].y }));
    const rect = await page.locator('#game').boundingBox();
    await page.mouse.click(rect.x + position.x / 960 * rect.width, rect.y + position.y / 540 * rect.height);
    assert.equal(await page.evaluate(() => bossEncounters.events.interrupts), 1);
    assert.equal(await page.evaluate(() => bossEncounters.stateOf(enemies[0]).warning), null);
    assert.ok(await page.evaluate(() => bossEncounters.stateOf(enemies[0]).exposed > 2.5));
    assert.equal(await page.evaluate(() => battleTactics.casts), 1);
    await page.screenshot({ path: path.join(output, 'boss-interrupted.png'), fullPage: true });

    await setup();
    await page.evaluate(() => { enemies[0].dead = true; draw(); });
    assert.equal(await page.evaluate(() => bossEncounters.stateOf(enemies[0])), null);
    assert.equal(await page.evaluate(() => bossEncounters.events.impacts), 0);
    assert.deepEqual(errors, []);
    console.log('Boss browser: visible cast warning, pause freeze, real mouse dodge, real E interrupt and death cancellation passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
