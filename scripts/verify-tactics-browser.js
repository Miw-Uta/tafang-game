// Run against npm start. Point PLAYWRIGHT_MODULE and PLAYWRIGHT_EXECUTABLE at
// an existing installation when Playwright is not a project dependency.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.GAME_URL || 'http://127.0.0.1:4175';
const output = process.env.SCREENSHOT_DIR || '/tmp/tafang-tactics-verification';

(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}) });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, hasTouch: width === 390, isMobile: width === 390 });
      const errors = [], failures = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(base)) failures.push(response.url()); });
      await page.goto(base);
      await page.locator('#hubEndlessBtn').click();
      assert.equal(await page.locator('[data-tactic]').count(), 3);
      assert.equal(await page.locator('[data-tactic="bramble"]').isDisabled(), true);
      assert.equal(await page.locator('.tactics-command').evaluate(node => getComputedStyle(node).display), 'grid', 'Command stylesheet must load');
      await page.locator('#waveBtn').click();
      await page.keyboard.press('q');
      assert.equal(await page.evaluate(() => TacticsUI.state().armed), 'bramble');
      await page.keyboard.press('Escape');
      assert.equal(await page.evaluate(() => TacticsUI.state().armed), null);
      assert.equal(await page.evaluate(() => battleTactics.casts), 0);
      await page.keyboard.press('p');
      const pausedState = await page.evaluate(() => JSON.stringify(battleTactics.snapshot()));
      await page.keyboard.press('q');
      assert.equal(await page.evaluate(() => TacticsUI.state().armed), null);
      assert.equal(await page.evaluate(() => JSON.stringify(battleTactics.snapshot())), pausedState);
      await page.keyboard.press('p');
      await page.locator('[data-tactic="bramble"]').click();
      const position = await page.evaluate(() => ({ point: pointAt(160), rect: document.getElementById('game').getBoundingClientRect().toJSON() }));
      const x = position.rect.x + position.point.x / 960 * position.rect.width;
      const y = position.rect.y + position.point.y / 540 * position.rect.height;
      if (width === 390) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
      assert.equal(await page.evaluate(() => battleTactics.casts), 1);
      assert.equal(await page.evaluate(() => TacticsUI.state().armed), null);
      assert.equal(await page.evaluate(() => battleTactics.zones[0].key), 'bramble');
      assert.ok(await page.evaluate(() => battleTactics.energy < 69));
      await page.keyboard.press('w');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(() => battleTactics.casts), 2, 'Keyboard aiming must work after a button was focused');
      await page.keyboard.press('p');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      await page.screenshot({ path: path.join(output, `tactics-${width}.png`), fullPage: true });
      assert.deepEqual(errors, []); assert.deepEqual(failures, []);
      console.log(`Tactics ${width}px: stylesheet, resource budget, mouse/touch cast, keyboard aim, cancellation and pause passed.`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
