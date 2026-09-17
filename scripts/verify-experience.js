const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.GAME_URL || 'http://127.0.0.1:4175';

(async () => {
  const browser = await chromium.launch({ headless:true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath:process.env.CHROMIUM_EXECUTABLE } : {}) });
  try {
    for (const [width,height] of [[1280,720],[1440,960],[390,844]]) {
      const page = await browser.newPage({ viewport:{width,height} });
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto(base);
      assert.equal(await page.evaluate(()=>GameExperience.audio().state),'locked');
      await page.locator('#hubGuideBtn, #hubHelp').click();
      assert.equal(await page.locator('#hubGuideBtn, #hubHelp').count(),1,'the hub should have one help entry');
      assert.equal(await page.locator('#experienceHelp').isVisible(),true);
      await page.keyboard.press('Shift+Tab');
      assert.equal(await page.evaluate(()=>document.activeElement.id),'manualReturn','the help dialog traps keyboard focus');
      await page.keyboard.press('Escape');
      await page.locator('#hubCampaignBtn').click();
      await page.locator('[data-mission="groveGate"]').click();
      await page.locator('[data-action="deploy"]').click();
      assert.equal(await page.locator('#fieldGuide').isVisible(),true);
      if(width<900)assert.ok((await page.locator('#fieldGuide').boundingBox()).y<height/2,'the first lesson must appear before the mobile battlefield');
      assert.deepEqual(await page.evaluate(()=>GameExperience.guide()),[],'the starting army must not count as practiced actions');
      await page.locator('#guideLocate').click();
      await page.waitForFunction(()=>GameExperience.guide().includes('scout'));
      await page.locator('[data-action="close"]').click();
      await page.keyboard.press('1');await page.keyboard.press('ArrowUp');await page.keyboard.press('Enter');
      await page.waitForFunction(()=>GameExperience.guide().includes('deploy'));
      await page.keyboard.press('m');
      assert.ok(await page.evaluate(()=>GameExperience.guide().includes('merge')));
      await page.keyboard.press('h');
      const before=await page.evaluate(()=>({paused,started,speed,merges:campaignRun.stats.merges}));
      for(const key of ['n','m','p','f','q','w','e'])await page.keyboard.press(key);
      assert.deepEqual(await page.evaluate(()=>({paused,started,speed,merges:campaignRun.stats.merges})),before,'modal shortcuts must not reach combat');
      await page.keyboard.press('Escape');
      assert.equal(await page.evaluate(()=>paused),false);
      // Fixture a legitimate level-five seed to exercise the real selection
      // dialog. The tutorial can only credit evolution after a committed choice.
      await page.evaluate(()=>{reserve[5]=1;beginDeploy(5);});
      await page.keyboard.press('k');await page.keyboard.press('ArrowUp');await page.keyboard.press('ArrowUp');await page.keyboard.press('Enter');
      assert.equal(await page.locator('#evoModal').getAttribute('aria-hidden'),'false');
      await page.waitForFunction(()=>document.activeElement.hasAttribute('data-route'));
      assert.equal(await page.evaluate(()=>GameExperience.guide().includes('evolve')),false);
      await page.keyboard.press('1');
      await page.waitForFunction(()=>GameExperience.guide().includes('evolve'));
      await page.locator('#battleSettings').click();
      await page.locator('#audio-music').fill('72');await page.locator('#audio-music-mute').check();
      await page.locator('#audio-ambience').fill('14');
      assert.equal(await page.evaluate(()=>GameExperience.audio().music),.72);
      assert.equal(await page.evaluate(()=>GameExperience.audio().ambience),.14);
      await page.locator('.settings-manual').click();
      assert.equal(await page.locator('#experienceHelp').isVisible(),true);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
      await page.keyboard.press('Escape');await page.keyboard.press('n');
      await page.waitForFunction(()=>GameExperience.guide().includes('wave'));
      assert.equal(await page.evaluate(()=>GameExperience.guide().length),5);
      await page.keyboard.press('k');
      assert.equal(await page.locator('#keyboardCell').isVisible(),true);
      await page.keyboard.press('q');
      await page.waitForFunction(()=>document.getElementById('keyboardCell').hidden);
      assert.equal(await page.evaluate(()=>TacticsUI.state().armed),'bramble');
      const aim=await page.evaluate(()=>TacticsUI.state().aim);
      await page.keyboard.press('ArrowRight');
      assert.notDeepEqual(await page.evaluate(()=>TacticsUI.state().aim),aim);
      await page.keyboard.press('k');
      assert.equal(await page.evaluate(()=>TacticsUI.state().armed),null);
      assert.equal(await page.locator('#keyboardCell').isVisible(),true);
      await page.keyboard.press('p');
      await page.waitForFunction(()=>GameExperience.audio().state==='suspended');
      await page.reload();
      assert.equal(await page.evaluate(()=>GameExperience.audio().music),.72);
      assert.equal(await page.evaluate(()=>GameExperience.audio().musicMuted),true);
      assert.equal(await page.evaluate(()=>GameExperience.audio().state),'locked','reloading never starts audio without a new gesture');
      assert.equal(await page.evaluate(()=>GameExperience.guide().length),5);
      assert.deepEqual(errors,[]);
      console.log(`Experience browser checks passed at ${width}px`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
