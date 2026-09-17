// Real Chromium canvas regression: load all articulated guardians, exercise
// attack poses, reject invalid transforms, and measure the texture cache.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.GAME_URL || 'http://127.0.0.1:4175';
const output = path.resolve(__dirname, '../artifacts/final-qa');
(async () => {
  await fs.mkdir(output, { recursive:true });
  const browser = await chromium.launch({ headless:true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath:process.env.CHROMIUM_EXECUTABLE } : {}) });
  try {
    const page = await browser.newPage({ viewport:{ width:1440,height:960 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.waitForFunction(() => Object.keys(primaryEvolutionLayers).length === 5);
    await page.locator('#hubEndlessBtn').click();
    const report = await page.evaluate(async () => {
      paused=true;
      const badTransforms=[], originals={};
      for(const name of ['translate','rotate','scale','transform','setTransform','drawImage']) {
        originals[name]=ctx[name];
        ctx[name]=function(...args){
          if(args.some(value=>typeof value==='number'&&!Number.isFinite(value))) badTransforms.push({name,args:args.map(v=>typeof v==='number'?String(v):typeof v)});
          return originals[name].apply(this,args);
        };
      }
      const keys=['metal','fire','water','wood','earth','wind','thunder','yin'];
      const slots=currentBattlefield().buildSlots.filter(([col,row])=>isBuildSlot(col,row));
      towers=keys.map((evo,index)=>towerFactory.create({col:slots[index][0],row:slots[index][1],level:5,evo,evoTier:1,evolutionPath:evo}));
      enemies=Array.from({length:60},(_,index)=>{
        const enemy=enemyFactory.create({archetype:index%3===0?'shellguard':'mossling',maxHp:100000,baseSpeed:20});
        const distance=100+index*23;Object.assign(enemy,pointAt(distance),{dist:distance,routeIndex:0});return enemy;
      });
      towers.forEach(tower=>launchAttack(tower,[enemies[6]],evolution[tower.evo]));
      const drawMs=[], frameMs=[];
      let previous=performance.now();
      try {
        for(let frame=0;frame<180;frame++) {
          await new Promise(requestAnimationFrame);
          const now=performance.now();frameMs.push(now-previous);previous=now;
          visualClock+=1/60;
          towers.forEach(tower=>{if(tower.attackAnimation)tower.attackAnimation.age=(frame%50)/60;});
          const start=performance.now();draw();drawMs.push(performance.now()-start);
        }
      } finally { for(const name of Object.keys(originals))ctx[name]=originals[name]; }
      const cache=Object.entries(primaryEvolutionLayers).map(([key,pack])=>{
        const canvases=[primaryEvolutionImages[key],pack.base,...pack.layers.map(layer=>layer.canvas)];
        return {key,textures:canvases.length,width:pack.width,height:pack.height,rgbaBytes:canvases.reduce((sum,c)=>sum+c.width*c.height*4,0)};
      });
      const percentiles=values=>{const sorted=values.slice(10).sort((a,b)=>a-b);return {p50:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)],max:sorted.at(-1)};};
      return {fixture:'8 guardians, 60 live enemy objects, rendered attack poses; paused simulation. Headless WSL timing, not minimum hardware certification.',frames:180,badTransforms,cache,cacheBytes:cache.reduce((sum,c)=>sum+c.rgbaBytes,0),drawMs:percentiles(drawMs),frameMs:percentiles(frameMs)};
    });
    assert.deepEqual(report.badTransforms,[], 'Every articulated guardian must use finite canvas transforms');
    assert.ok(report.cacheBytes < 40 * 1024 * 1024, 'Battlefield art must stay within the 40 MiB RGBA cache budget');
    assert.equal(report.cache.length,5);
    assert.deepEqual(errors,[]);
    await page.screenshot({path:path.join(output,'renderer-stress.png')});
    await fs.writeFile(path.join(output,'renderer.json'),JSON.stringify({generatedAt:new Date().toISOString(),...report,errors},null,2)+'\n');
    console.log(JSON.stringify({cacheMiB:report.cacheBytes/1024/1024,drawMs:report.drawMs,frameMs:report.frameMs,errors}));
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
