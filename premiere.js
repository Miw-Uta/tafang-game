(function () {
  const id = value => document.getElementById(value);
  const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const chapters = ['林地来信','镜沼旧梦','赤霞余烬','霜月回声','黑潮真相','五根归途','黎明新生'];
  const atlas = document.createElement('section');atlas.className='journey-atlas';atlas.setAttribute('aria-label','七幕远征地图');
  id('chapterTabs').before(atlas);
  const strip = document.createElement('div');strip.className='encounter-strip';strip.id='encounterStrip';
  id('mapOperations').before(strip);
  const boss = document.createElement('div');boss.className='boss-health';boss.hidden=true;boss.setAttribute('role','meter');boss.setAttribute('aria-label','首领生命');
  document.querySelector('.canvas-frame').append(boss);
  const commandBar=document.querySelector('.tactics-command'),wide=matchMedia('(min-width:901px)');
  function placeCommands(){if(!commandBar)return;if(wide.matches)document.querySelector('.tower-panel .panel-title').after(commandBar);else document.querySelector('.stage-foot').before(commandBar);}
  wide.addEventListener('change',placeCommands);placeCommands();
  let lastAtlas='',lastHub='',lastEncounter='',lastBoss='';
  function renderAtlas() {
    const records=campaignProgress.load(),chapter=Number(document.querySelector('[data-act].active')?.dataset.act || 1);
    const sig=JSON.stringify([records,chapter]);if(sig===lastAtlas)return;lastAtlas=sig;
    const coords=[[8,53],[22,37],[36,55],[50,32],[64,50],[78,35],[92,51]];
    const route=coords.map(([x,y],index)=>`${index?'L':'M'}${x*10},${y*2}`).join(' ');
    atlas.innerHTML=`<svg class="atlas-route" viewBox="0 0 1000 200" preserveAspectRatio="none" aria-hidden="true"><path d="${route}" fill="none" stroke="#bdbe8866" stroke-width="1.5" stroke-dasharray="4 7"/></svg>`+chapters.map((name,i)=>{
      const levels=contentRegistry.levels.values().filter(level=>level.chapter===i+1),done=levels.filter(level=>records[level.key]).length;
      return `<button class="atlas-node ${chapter===i+1?'current':''} ${done===levels.length?'complete':''}" style="--x:${coords[i][0]}%;--y:${coords[i][1]}%" data-atlas-act="${i+1}" aria-label="第 ${i+1} 幕 ${name}，${done}/${levels.length} 已完成" aria-pressed="${chapter===i+1}"><i>${done===levels.length?'✦':String(i+1).padStart(2,'0')}</i><span>${name}</span><small>${levels.map(level=>`<i class="${records[level.key]?'done':''}"></i>`).join('')}</small></button>`;
    }).join('')+'<span class="atlas-caption">循着根脉，走向黎明</span>';
  }
  atlas.addEventListener('click',event=>{const b=event.target.closest('[data-atlas-act]');if(b)document.querySelector(`[data-act="${b.dataset.atlasAct}"]`)?.click();renderAtlas();});
  function renderHub() {
    const checkpoint=window.CampaignSave?.peek(),count=campaignProgress.completedCount();
    const sig=JSON.stringify([checkpoint?.levelKey,checkpoint?.waveIndex,count,runtime.soundEnabled]);if(sig===lastHub)return;lastHub=sig;
    id('hubSave').innerHTML='<span class="save-dot"></span><span>'+escape(checkpoint?`${contentRegistry.levels.get(checkpoint.levelKey).name.split(' · ')[1]} · 第 ${checkpoint.waveIndex+1} 波整备已保存`:count?`已收复 ${count} 处根脉 · 旅程已保存`:'新的旅程正在等你')+'</span>';
    id('hubResumeBtn').hidden=!checkpoint;
    id('hubCampaignBtn').querySelector('b').textContent=count?'继续守护征程':'踏入甜橙谷';
  }
  function renderEncounter() {
    const plan=gameSession.currentWave,weights=routeWeightsForWave(),total=weights.reduce((a,b)=>a+b,0)||1;
    const sig=JSON.stringify([wave,plan.enemyCount,plan.boss,gameSession.level?.key,weights,running]);if(sig===lastEncounter)return;lastEncounter=sig;
    const waves=gameSession.level?.waves;
    strip.innerHTML=`<b>${running?'敌军来袭':'来敌预报'}</b><div class="encounter-markers">${waves?waves.map((w,i)=>`<span class="encounter-dot ${i+1<wave?'past':''} ${i+1===wave?'current':''} ${w.boss?'boss':''}" title="第 ${i+1} 波：${w.enemyCount} 敌军${w.boss?'，含首领':''}">${w.boss?'♜ ':''}${i+1}</span>`).join(''):`<span>第 ${wave} 波</span>`}<span>${plan.enemyCount} 敌军</span></div><span class="route-forecast">A ${Math.round(weights[0]/total*100)}% · B ${Math.round((weights[1]||0)/total*100)}%</span>`;
  }
  function renderBoss() {
    const target=enemies.find(enemy=>enemy.type==='boss'&&!enemy.dead&&enemy.hp>0);boss.hidden=!target;
    if(!target){lastBoss='';return;}
    const pct=Math.max(0,Math.min(100,Math.ceil(target.hp/target.max*100))),phase=target.phase?.active?2:1;
    const sig=`${target.definition.name}:${pct}:${phase}`;if(sig===lastBoss)return;lastBoss=sig;
    boss.setAttribute('aria-valuenow',String(pct));boss.setAttribute('aria-valuemin','0');boss.setAttribute('aria-valuemax','100');
    boss.innerHTML=`<div><span>♜ ${escape(target.definition.name)}</span><small>${pct}%${phase>1?' · 狂暴':''}</small></div><div class="boss-health-track"><i style="width:${pct}%"></i></div>`;
  }
  function update(){const page=document.body.dataset.page;if(page==='hub')renderHub();if(page==='campaign')renderAtlas();if(page==='battle'){renderEncounter();renderBoss();}}
  id('hubResumeBtn').onclick=()=>{id('hubCampaignBtn').click();id('continueCampaignBtn').click();};
  id('hubJournalBtn').onclick=()=>id('chronicleBtn').click();
  id('hubGuideBtn').onclick=()=>{if(window.GameExperience?.openHelp)window.GameExperience.openHelp();else id('codexBtn').click();};
  document.querySelector('.hub-sound-btn').onclick=()=>id('settingsBtn').click();
  window.Premiere={update,renderAtlas};
  update();setInterval(update,200);window.lucide?.createIcons();
})();
