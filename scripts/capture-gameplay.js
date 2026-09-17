const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'artifacts','steam-assets','gameplay');
const base=process.env.GAME_URL||'http://127.0.0.1:4176';
(async()=>{
 await fs.mkdir(output,{recursive:true});
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
 const levels=Object.keys(require('../game-content').levels),shots=[];
 try{
 for(const level of ['groveGate','mirrorMarsh','emberPass','frostGate','worldTree']){
  const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  // Only chapter access is pre-unlocked. Army, resources, enemies, growth,
  // damage and progression are entirely the game's actual authored values.
  await page.addInitScript(keys=>localStorage.setItem('tafang.campaignProgress',JSON.stringify(Object.fromEntries(keys.map(key=>[key,{stars:1,completedAt:1,score:0}])))),levels);
  await page.goto(base);await page.evaluate(()=>document.fonts.ready);
  await page.locator('#hubCampaignBtn').click();
  await page.evaluate(key=>CampaignUI.openMission(key),level);
  await page.locator('[data-action="deploy"]').click();
  await page.locator('#mergeBtn').click();
  // Resolve only the evolution candidates the game actually offers.
  for(let index=0;index<12;index++){
   if(await page.locator('#evoModal').getAttribute('aria-hidden')==='true')break;
   const option=page.locator('[data-route]').first();if(!await option.count())break;await option.click();
  }
  await page.locator('#waveBtn').click();
  if(await page.locator('[data-decision]').count())await page.locator('[data-decision]').first().click();
  await page.waitForTimeout(8000);
  const cast=page.locator('[data-tactic="bramble"]');
  if(!await cast.isDisabled()){
   await cast.click();
   const point=await page.evaluate(()=>{const enemy=enemies.find(e=>!e.dead);const r=document.getElementById('game').getBoundingClientRect();return enemy?{x:r.x+enemy.x/960*r.width,y:r.y+enemy.y/540*r.height}:null});
   if(point)await page.mouse.click(point.x,point.y);else await page.keyboard.press('Escape');
  }
  await page.waitForTimeout(150);
  const state=await page.evaluate(()=>({level:gameSession.level.key,wave,running,enemies:enemies.length,towers:towers.length,lives,paused}));
  if(!state.running||state.enemies<1)throw new Error(`No active battle to capture: ${level}`);
  if(errors.length)throw new Error(errors.join('\n'));
  const filename=`${level}-1920x1080.png`;await page.screenshot({path:path.join(output,filename)});shots.push({filename,...state});await page.close();
 }
 await fs.writeFile(path.join(output,'capture.json'),JSON.stringify({generatedAt:new Date().toISOString(),method:'Five live battles at 1920x1080. Chapter-access save fixture only; legal authored loadout, real enemies and UI commands. No overlays, fake victory or modified health/damage.',shots},null,2)+'\n');
 console.log(`Captured ${shots.length} live battles.`);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
