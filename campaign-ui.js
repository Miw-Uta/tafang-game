(function () {
  const byId = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const iconCache = new Map();
  function icon(name, extra = '') {
    if (!iconCache.has(name)) {
      const definition = window.lucide?.icons[name];
      if (!definition) return '';
      const create = ([tag, attributes, children = []]) => {
        const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
        Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
        children.forEach(child => node.append(create(child)));
        return node;
      };
      const node = create(definition);
      node.classList.add('lucide'); node.setAttribute('aria-hidden', 'true');
      iconCache.set(name, node.outerHTML);
    }
    return iconCache.get(name).replace('class="lucide"', `class="lucide ${extra}"`);
  }
  const acts = [
    ['林地来信','一封来自古树的求救信，唤醒了甜橙谷最后的守卫。'],
    ['镜沼旧梦','点亮潮汐灯，找回被水面藏起的名字。'],
    ['赤霞余烬','熔炉尚未熄灭，太阳果核的秘密藏在灰烬之下。'],
    ['霜月回声','七枚记忆灵种，拼出第一任守门人的过去。'],
    ['黑潮真相','黑潮不是异乡的入侵者，而是一段被抛弃的记忆。'],
    ['五根归途','让所有谱系共守一条根，带队长回家。'],
    ['黎明新生','把光与影一同收入年轮，决定世界树的未来。']
  ];
  let chapter = contentRegistry.levels.get(campaignProgress.nextUncompleted()).chapter || 1;
  let modalKind = '', modalResume = false, lastFocus = null, mission = null;
  let support = 'seeds', difficulty = 'normal', selectedReward = '', rewardWave = '';
  let lastObjectives = '', lastDispatch = '', lastTargetTower = null, lastTargetPriority = '', settings = {};
  try { settings = JSON.parse(localStorage.getItem('tafang.settings') || '{}') || {}; } catch {}
  runtime.soundEnabled = settings.sound !== false;
  runtime.reducedMotion = settings.reducedMotion ?? runtime.reducedMotion;
  const portrait = key => `resources/scenes/${['metal','fire','water','wood','earth'].includes(key) ? key : 'wood'}-portrait.webp`;
  function speakerPortrait(speaker = '') {
    if (/守灯|潮汐|渡灯|祭司/.test(speaker)) return portrait('water');
    if (/锻师|关尉|铸场|观星/.test(speaker)) return portrait('fire');
    if (/树灵|古树|世界树|回声/.test(speaker)) return portrait('wood');
    if (/守门|档案|守碑|队长/.test(speaker)) return portrait('metal');
    return portrait('earth');
  }
  const labels = { front:'前方', back:'后方', strong:'最强', weak:'最弱', counter:'反制' };
  const eventIcons = { calm:'Leaf', bounty:'Sparkles', mist:'CloudFog', rush:'Wind', resonance:'TreeDeciduous' };
  function saveSettings() {
    try { localStorage.setItem('tafang.settings', JSON.stringify({ sound:runtime.soundEnabled, reducedMotion:runtime.reducedMotion })); } catch {}
  }
  function objectiveMarkup(objectives, evaluated = false) {
    return `<ul class="objective-list">${objectives.map(item => `<li class="${evaluated && item.complete ? 'complete' : ''}">${icon(evaluated && item.complete ? 'CircleCheck' : 'Star')}<span>${escape(item.label)}${evaluated ? ` <b>${item.value}/${item.target}</b>` : ''}</span></li>`).join('')}</ul>`;
  }
  function show(kind, markup, dismissable = true) {
    if (byId('storyModal').hidden) { modalResume = paused; lastFocus = document.activeElement; }
    paused = true; modalKind = kind;
    byId('storyBody').innerHTML = markup;
    byId('storyClose').hidden = !dismissable;
    byId('storyModal').hidden = false;
    document.body.classList.add('modal-open');
    byId('storyBody').querySelector('button,input')?.focus();
  }
  function close() {
    byId('storyModal').hidden = true; modalKind = '';
    document.body.classList.remove('modal-open');
    paused = document.body.dataset.page === 'battle' ? modalResume : true;
    lastFocus?.focus?.();
  }
  function renderCampaign() {
    const levels = contentRegistry.levels.values(), records = campaignProgress.load();
    const checkpoint=window.CampaignSave?.peek();
    byId('continueCampaignBtn').innerHTML=icon('Play')+(checkpoint?`续战 · 第 ${checkpoint.waveIndex+1} 波`:'继续征程');
    byId('continueCampaignBtn').title=checkpoint?`${contentRegistry.levels.get(checkpoint.levelKey).name} · 已保存波前阵容`:'继续征程';
    setText('campaignProgressCount', `${campaignProgress.completedCount()} / ${levels.length}`);
    setText('campaignStars', `${Object.values(records).reduce((sum, r) => sum + Math.min(3, Number(r.stars) || 1), 0)} / ${levels.length * 3}`);
    setText('campaignChapterStory', acts[chapter - 1][1]);
    byId('chapterTabs').innerHTML = acts.map(([name], index) => {
      const inAct = levels.filter(level => level.chapter === index + 1);
      return `<button class="${chapter === index + 1 ? 'active' : ''}" data-act="${index + 1}" aria-pressed="${chapter === index + 1}">${String(index + 1).padStart(2,'0')} ${name}<small>${inAct.filter(level => campaignProgress.has(level.key)).length} / ${inAct.length}</small></button>`;
    }).join('');
    byId('chapterGrid').innerHTML = levels.filter(level => level.chapter === chapter).map(level => {
      const unlocked = campaignProgress.isUnlocked(level.key), record = records[level.key];
      return `<button class="chapter-card${record ? ' is-complete' : ''}${unlocked ? '' : ' is-locked'}" data-mission="${level.key}" ${unlocked ? '' : 'disabled'}><span class="chapter-map-preview"><img src="resources/scenes/${level.mapKey}.webp" alt="${contentRegistry.maps.get(level.mapKey).name}" loading="lazy"><span>${icon(unlocked ? 'Flag' : 'LockKeyhole')} ${unlocked ? (record ? '已收复' : '待出征') : '尚未抵达'}</span><b>${String(level.missionNumber).padStart(2,'0')}</b></span><span class="chapter-card-copy"><span class="chapter-index">第 ${level.missionNumber} 关 / ${contentRegistry.maps.get(level.mapKey).name}</span><h3>${level.name.split(' · ')[1]}</h3><p>${escape(level.story)}</p><small class="chapter-tactical">${escape(level.objectives[1].label)}</small><span class="chapter-meta"><span>${level.waves.length} 波</span><span>${level.startingLives} 生命</span><span>${enemyArchetypes[level.waves.at(-1).boss]?.name || '最终防线'}</span></span><em>${record ? `${'★'.repeat(record.stars || 1)}${'☆'.repeat(3-(record.stars || 1))}　最佳 ${record.score} 分` : unlocked ? '战前整备 →' : '完成上一关后抵达'}</em></span></button>`;
    }).join('');
  }
  function openMission(key) {
    if (!campaignProgress.isUnlocked(key)) return;
    mission = contentRegistry.levels.get(key); support = 'seeds'; difficulty = 'normal';
    // Keep the chapter tab aligned when the result screen opens a mission in
    // the next chapter.
    chapter = mission.chapter || chapter;
    const loadout = mission.startingLoadout, map = contentRegistry.maps.get(mission.mapKey);
    show('briefing', `<div class="mission-cover"><img src="resources/scenes/${mission.mapKey}.webp" alt="${map.name}"><span class="mission-number">第 ${mission.missionNumber} 关 / ${map.name}</span></div><div class="mission-content"><span class="page-kicker">${acts[mission.chapter-1][0]} / 战前整备</span><h2 id="storyTitle">${mission.name.split(' · ')[1]}</h2><div class="mission-columns"><div><p>${escape(mission.story)}</p><div class="mission-facts"><span>${icon('Waves')}${mission.waves.length} 波</span><span>${icon('Heart')}${mission.startingLives} 生命</span><span>${icon('Swords')}${mission.waves.reduce((sum,w) => sum+w.enemyCount,0)} 敌军</span></div><h3>守护之星</h3>${objectiveMarkup(mission.objectives)}<h3>初始编队</h3><p>${evolution[loadout.tower.evo].name} Lv.${loadout.tower.level} · ${loadout.spirit} 灵力<br>${Object.entries(loadout.seeds).map(([lv,n])=>`Lv.${lv} 灵种 ×${n}`).join(' · ')}</p></div><div><h3>战役难度</h3><div class="choice-segments" id="difficultyChoices"><button data-difficulty="story">叙事</button><button class="active" data-difficulty="normal">标准</button><button data-difficulty="veteran">精锐</button></div><p id="difficultyDescription" style="font-size:11px;margin-top:10px">标准敌军强度 · 完整守护之星</p><h3>携行支援</h3><div class="support-choices">${[['seeds','Sprout','灵种补给','额外 2 枚 Lv.2 灵种（提前铺场）'],['charge','Sun','橙光灯芯','开局 100% 战技充能'],['power','Swords','锐锋符印','守卫伤害 +8%']].map(([key,symbol,name,desc])=>`<button class="support-choice${key==='seeds'?' active':''}" data-support="${key}">${icon(symbol)}<b>${name}</b><small>${desc}</small></button>`).join('')}</div><h3>侦察报告</h3><p style="font-size:12px">${escape(mission.tactical)}<br>${escape(map.desc)}</p></div></div><div class="mission-actions"><small>战后自动保存 · 整备阶段由你决定开波</small><button class="primary-command" data-action="deploy">${icon('Flag')}出征</button></div></div>`);
    const checkpoint=window.CampaignSave?.peek();
    if(checkpoint){
      const actions=byId('storyBody').querySelector('.mission-actions');
      actions.querySelector('small').textContent=`续战保存在「${contentRegistry.levels.get(checkpoint.levelKey).name.split(' · ')[1]}」第 ${checkpoint.waveIndex+1} 波，重新出征会替换该记录。`;
      actions.querySelector('[data-action="deploy"]').innerHTML=icon('Flag')+'重新出征';
      if(checkpoint.levelKey===key)actions.insertAdjacentHTML('beforeend',`<button data-action="resume">${icon('Play')}继续战斗</button>`);
    }
  }
  function launchMission() {
    const key = mission.key, chosenSupport = support, chosenDifficulty = difficulty;
    close(); startMode('campaign', key);
    window.campaignModifiers = { damage:chosenSupport === 'power' ? 1.08 : 1, hp:chosenDifficulty === 'story' ? .7 : chosenDifficulty === 'veteran' ? 1.45 : 1, difficulty:chosenDifficulty, support:chosenSupport };
    if (chosenSupport === 'seeds') reserve[2] = (reserve[2] || 0) + 2;
    if (chosenSupport === 'charge') surgeCharge = 100;
    if (chosenDifficulty === 'story') { reserve[4] = (reserve[4] || 0) + 2; }
    selectedReward = ''; rewardWave = ''; lastObjectives = ''; lastDispatch = '';
    navigatePage('battle'); paused = false; ui();
  }
  function showDecision() {
    if (!missionStory?.pending(wave)) return false;
    // Restore and intermission callbacks can converge in the same frame. Keep
    // the existing decision modal instead of rebuilding its focused controls.
    if (modalKind === 'decision' && !byId('storyModal').hidden) return true;
    audioBus.cue('decision');
    const decision=missionStory.decision;
    show('decision',`<div class="mission-content"><span class="page-kicker">${escape(decision.speaker)} / 战地抉择</span><h2 id="storyTitle">${escape(decision.title)}</h2><div class="story-voice decision-voice"><img src="${speakerPortrait(decision.speaker)}" alt="${escape(decision.speaker)}"><p>${escape(decision.body)}</p></div><div class="story-decisions">${decision.choices.map((choice,index)=>`<button data-decision="${choice.key}" class="story-choice">${icon(index?'GitBranch':'Route')}<b>${escape(choice.label)}</b><span>${escape(choice.description)}</span></button>`).join('')}</div></div>`,false);
    return true;
  }
  function chooseDecision(key) {
    if (modalKind!=='decision' || !missionStory?.choose(key,wave)) return;
    audioBus.cue('select');
    modalResume=false;close();
    setText('message',missionStory.selected().outcome);ui();
  }
  function canStartWave() {
    return !gameSession.isFinite || ((wave===1 || Boolean(campaignRewards[wave])) && !missionStory?.pending(wave));
  }
  function restored() {
    selectedReward=campaignRewards[wave] || '';rewardWave=`${gameSession.level.key}:${wave}`;
    lastObjectives='';lastDispatch='';
    if(wave>1 && !selectedReward)intermission();else showDecision();
  }
  function intermission() {
    if (!campaignRun || gameWon) return;
    const key = `${gameSession.level.key}:${wave}`;
    if (rewardWave !== key) { rewardWave = key; selectedReward = ''; }
    selectedReward=campaignRewards[wave] || '';
    if (selectedReward) {showDecision();return;}
    const text = gameSession.level.dispatches[Math.min(2, Math.floor((wave-1)*3/gameSession.level.waves.length))];
    const nextEvent = contentRegistry.events.get(gameSession.currentWave.eventKey);
    show('intermission', `<div class="mission-content"><span class="page-kicker">第 ${wave-1} 波已守住 / 第 ${wave} 波整备</span><h2 id="storyTitle">前线补给抵达</h2><div class="story-voice"><img src="${portrait('wood')}" alt="守卫信使"><p>${escape(text)}</p></div><p>${escape(waveThreatHint(gameSession.currentWave))}</p><div class="reward-choices">${[['reinforce','Sprout','新生援军',`获得 1 枚 Lv.${Math.min(5,3+Math.floor(wave/2))} 灵种`],['repair','HeartPulse','根系修复','恢复 2 点生命，至初始上限'],['charge','Sun','日光储备','战技充能增加 60%']].map(([key,symbol,name,desc])=>`<button class="reward-choice" data-reward="${key}">${icon(symbol)}<b>${name}</b><small>${desc}</small></button>`).join('')}</div><div class="mission-actions"><small>第 ${wave} 波：${gameSession.currentWave.enemyCount} 敌军 · ${nextEvent.name}</small><small>选择一项补给</small></div></div>`, false);
  }
  function chooseReward(key) {
    if (selectedReward || modalKind !== 'intermission' || !['reinforce','repair','charge'].includes(key)) return;
    selectedReward = key;
    campaignRewards[wave]=key;
    if (key === 'reinforce') { const lv = Math.min(5,3+Math.floor(wave/2)); reserve[lv] = (reserve[lv] || 0)+1; }
    if (key === 'repair') { lives=Math.min(gameSession.level.startingLives,lives+2); gameSession.lives=lives; }
    if (key === 'charge') surgeCharge=Math.min(100,surgeCharge+60);
    audioBus.cue('reward');
    modalResume=false; close(); paused=false; setText('message',`补给已领取。第 ${wave} 波等待出发。`); ui();showDecision();
  }
  function result(data) {
    if (!data) return;
    renderCampaign();
    const next = data.won ? campaignProgress.next(gameSession.level.key) : null;
    show('result', `<div class="mission-content"><span class="page-kicker">${escape(gameSession.level.name)} / 战役结算</span><h2 id="storyTitle">${data.title}</h2><div class="result-stars">${[1,2,3].map(n=>icon('Star',n<=data.stars?'lit':'')).join('')}</div><div class="mission-facts"><span>${icon('Trophy')}${score} 分</span><span>${icon('Heart')}${lives} 生命</span><span>${icon('Flag')}${gameSession.completedWaves} / ${gameSession.level.waves.length} 波</span></div>${objectiveMarkup(data.objectives,true)}<div class="story-voice"><img src="${portrait('wood')}" alt="阿橙的守卫"><p>${escape(data.story)}</p></div>${!campaignProgress.storageAvailable?'<p>浏览器未允许保存，本次进度将在关闭页面后丢失。</p>':''}<div class="dialog-actions"><button data-action="map">${icon('Map')}战役地图</button><button data-action="retry">${icon('RotateCcw')}重新整备</button>${next?`<button class="primary-command" data-next="${next}">${icon('ArrowRight')}下一关</button>`:data.won?'<button class="primary-command" data-action="map">守护之旅完成</button>':''}</div></div>`);
    const choice=missionStory?.selected();
    if(choice)byId('storyBody').querySelector('.story-voice')?.insertAdjacentHTML('afterend',`<section class="decision-record"><h3>${escape(choice.label)}</h3><p>${escape(choice.outcome)}</p></section>`);
    if(data.won && gameSession.level.key==='worldTree' && window.ChroniclesDomain) {
      const journey=window.ChroniclesDomain.summarize(campaignProgress.load());
      byId('storyBody').querySelector('.dialog-actions')?.insertAdjacentHTML('beforebegin',endingMarkup(journey));
    }
  }
  function endingMarkup(journey) {
    if(!journey.ending)return '';
    return `<section class="ending-card"><small>属于你的终章 / ${escape(journey.ending.subtitle)}</small><h3>${escape(journey.ending.title)}</h3>${journey.ending.paragraphs.map(text=>`<p>${escape(text)}</p>`).join('')}<small>${journey.memories} / 20 段抉择已刻入年轮</small>${journey.echoes.map(echo=>`<div class="ending-echo"><b>${escape(echo.title)}</b><p>${escape(echo.text)}</p></div>`).join('')}</section>`;
  }
  function openSettings() {
    show('settings', `<div class="mission-content"><span class="page-kicker">甜橙谷</span><h2 id="storyTitle">设置</h2><label class="settings-row"><span>战斗音效</span><input id="settingSound" type="checkbox" ${runtime.soundEnabled?'checked':''}></label><label class="settings-row"><span>减少动态效果</span><input id="settingMotion" type="checkbox" ${runtime.reducedMotion?'checked':''}></label><div class="settings-row"><span>战役存档</span><small>${campaignProgress.completedCount()} / 20 关 · ${campaignProgress.storageAvailable?'已保存在此浏览器':'存储不可用'}</small></div><div class="dialog-actions"><button data-action="export">${icon('Download')}导出战绩</button><button class="primary-command" data-action="close">完成</button></div></div>`);
    const checkpoint=window.CampaignSave?.peek();
    const label=checkpoint?`${contentRegistry.levels.get(checkpoint.levelKey).name.split(' · ')[1]} · 第 ${checkpoint.waveIndex+1} 波`:'暂无进行中的战役';
    const saved=window.CampaignSave?.available()!==false;
    byId('storyBody').querySelector('.dialog-actions')?.insertAdjacentHTML('beforebegin',`<div class="settings-row"><span>波前续战</span><small>${escape(label)}<br>${saved?'保存在此浏览器':'仅在当前页面保留，关闭后丢失'}</small></div>`);
  }
  function openCodex(tab='guards') {
    const content = tab === 'guards' ? Object.entries(evolution).filter(([key,data])=>key==='base'||(!data.parent&&!data.fusion)).map(([key,data])=>`<article class="codex-entry"><img src="${portrait(key)}" alt="${data.name}"><h3>${data.name}</h3><small>${attackModeNames[data.attackMode]} · ${data.rangeCells*.6} 格射程</small><p>${data.desc}</p></article>`).join('') : Object.entries(enemyArchetypes).map(([key,data])=>`<article class="codex-entry">${icon(data.role==='boss'?'Crown':data.role==='elite'?'Shield':'Swords')}<h3>${data.name}</h3><small>${data.role==='boss'?'首领':data.role==='elite'?'精英':'先锋'} · 基础生命 ×${data.hp}</small><p>${data.desc}</p></article>`).join('');
    show('codex', `<div class="mission-content"><span class="page-kicker">巡林者档案</span><h2 id="storyTitle">${tab==='guards'?'守卫谱系':'敌军情报'}</h2><div class="choice-segments codex-tabs"><button data-codex="guards" class="${tab==='guards'?'active':''}">守卫</button><button data-codex="enemies" class="${tab==='enemies'?'active':''}">敌军</button></div><div class="codex-grid">${content}</div></div>`);
  }
  function openScout(waveNumber=wave) {
    if (!campaignRun || pendingEvolution) return;
    const planned=gameSession.level.waves[waveNumber-1];
    if (!planned) return;
    const counts=new Map();
    planned.spawnPlan.forEach(spawn=>counts.set(spawn.archetype,(counts.get(spawn.archetype)||0)+1));
    const weights=routeWeightsForWave(waveNumber), total=weights.reduce((sum,n)=>sum+n,0);
    const waveEvent=contentRegistry.events.get(planned.eventKey);
    const traits=planned.traitKey ? enemyTraits[planned.traitKey].label : '无额外词缀';
    const rows=[...counts].map(([key,count])=>{
      const enemy=enemyArchetypes[key];
      return `<tr><td><b>${escape(enemy.name)}</b><small>${escape(enemy.desc)}</small></td><td>${count}</td><td>${enemy.role==='boss'?'首领':enemy.role==='elite'?'精英':'普通'}</td></tr>`;
    }).join('');
    show('scout',`<div class="mission-content"><span class="page-kicker">${escape(gameSession.level.name)} / 敌军侦察</span><h2 id="storyTitle">第 ${waveNumber} 波</h2><label class="scout-wave">波次<select id="scoutWave" aria-label="侦察波次">${gameSession.level.waves.map((item,i)=>`<option value="${i+1}" ${waveNumber===i+1?'selected':''}>第 ${i+1} 波 · ${item.enemyCount} 敌军</option>`).join('')}</select></label><div class="mission-facts"><span>${icon('Waves')}${escape(waveEvent.name)}</span><span>${icon('Shield')}${escape(traits)}</span></div><p>${escape(waveEvent.desc)}<br>${weights.map((weight,i)=>`${i===0?'上侧':'下侧'}路线 ${Math.round(weight/total*100)}%`).join(' · ')}<br>${escape(waveThreatHint(planned))}</p><table class="scout-table"><thead><tr><th>敌军</th><th>数量</th><th>类型</th></tr></thead><tbody>${rows}</tbody></table><div class="dialog-actions"><button class="primary-command" data-action="close">${icon('ArrowLeft')}返回布阵</button></div></div>`);
  }
  function openChronicle() {
    const records=campaignProgress.load();
    const entries=contentRegistry.levels.values().filter(level=>records[level.key]).map(level=>{
      const decision=StoryContent.decisions[level.key];
      const choice=decision?.choices.find(item=>item.key===records[level.key].choice);
      return `<article class="chronicle-entry"><small>第 ${level.missionNumber} 关 / ${escape(acts[level.chapter-1][0])}</small><h3>${escape(level.name.split(' · ')[1])}</h3><p>${escape(level.epilogue)}</p>${choice?`<b>${escape(choice.label)}</b><p>${escape(choice.outcome)}</p>`:''}</article>`;
    }).join('');
    const journey=window.ChroniclesDomain?.summarize(records);
    show('chronicle',`<div class="mission-content"><span class="page-kicker">阿橙的巡林手记</span><h2 id="storyTitle">根脉纪事</h2>${journey?`<p>${journey.memories} / 20 段记忆。你如何回应黑潮、如何安放最后的记忆，将决定森林的明天。</p>${endingMarkup(journey)}`:''}${entries||'<p>第一封战报尚未抵达。</p>'}</div>`);
  }
  function update() {
    if (!byId('battleObjectives')) return;
    byId('battleObjectives').hidden = !campaignRun;
    if (campaignRun) {
      const objectives = campaignRun.objectives(); const signature = JSON.stringify(objectives);
      if (signature !== lastObjectives) { lastObjectives=signature; byId('battleObjectives').innerHTML=`<div><b>本关挑战</b><span>第 ${gameSession.level.missionNumber} / 20 关</span><button data-action="scout" title="敌军侦察" aria-label="敌军侦察">${icon('Binoculars')}</button></div>${objectiveMarkup(objectives,true)}`; }
      const dispatch = gameSession.level.dispatches[Math.min(2,Math.floor((wave-1)*3/gameSession.level.waves.length))];
      if (dispatch !== lastDispatch) { lastDispatch=dispatch; byId('dispatchStrip').textContent=dispatch; }
    }
    byId('dispatchStrip').hidden = !campaignRun;
    const target = byId('targetingControls'); target.hidden=!selectedTower;
    if (selectedTower && (selectedTower!==lastTargetTower || selectedTower.targetPriority!==lastTargetPriority)) {
      lastTargetTower=selectedTower;lastTargetPriority=selectedTower.targetPriority;
      target.innerHTML=Object.entries(labels).map(([key,label])=>`<button data-priority="${key}" class="${selectedTower.targetPriority===key?'active':''}" aria-pressed="${selectedTower.targetPriority===key}">${label}</button>`).join('')+`<button data-action="unlockTarget" title="解除锁定" aria-label="解除锁定">${icon('Target')}</button>`;
    }
    const image = selectedTower && portrait(towerBranch(selectedTower));
    if (image && !selectedEnemy) { const holder=byId('selectedInfo').querySelector('.info-icon'); if(holder) holder.innerHTML=`<img src="${image}" alt="">`; }
    document.querySelectorAll('[data-roster-evo] .tower-art').forEach(holder=>{holder.innerHTML=`<img src="${portrait(branchOf[holder.parentElement.dataset.rosterEvo]||holder.parentElement.dataset.rosterEvo)}" alt="">`;});
    document.querySelectorAll('.hud-seed>span').forEach(holder=>{holder.innerHTML=icon('Sprout');});
    byId('soundBtn').innerHTML=icon(runtime.soundEnabled?'Volume2':'VolumeX');
    byId('soundBtn').setAttribute('aria-label',runtime.soundEnabled?'关闭音效':'开启音效');
    const event = contentRegistry.events.get(gameSession.currentWave.eventKey);
    byId('waveEvent').innerHTML=`<b>${icon(eventIcons[event.key] || eventIcons[gameSession.currentWave.eventKey] || 'Leaf')} ${event.name}</b><small>${event.desc}</small>`;
    const choice=missionStory?.selected(), status=byId('decisionStatus');
    status.hidden=!choice;
    if(choice)status.innerHTML=`${icon('GitBranch')}<div><b>${escape(choice.label)}</b><small>${escape(choice.description)}</small></div>`;
    if(campaignRun && !running && !gameWon && lives>0)byId('waveBtn').disabled=!canStartWave() || Boolean(pendingEvolution);
  }
  function goMap() { window.CampaignSave?.save();close(); renderChapterGrid(); navigatePage('campaign'); renderCampaign(); }
  function pauseMenu() {
    if (pendingEvolution) return;
    show('pause', `<div class="mission-content"><span class="page-kicker">${escape(gameSession.level?.name || '无尽远征')}</span><h2 id="storyTitle">前线暂歇</h2><p>第 ${wave} 波 · ${lives} 点生命 · ${score} 分${campaignRun?'<br>战役保留本波开战前的阵容与选择。':''}</p><div class="dialog-actions"><button data-action="map">${icon('Map')}${campaignRun?'保留续战并返回':'结束本次战斗'}</button><button class="primary-command" data-action="close">${icon('Play')}继续守护</button></div></div>`);
  }
  document.addEventListener('click', event => {
    const node=event.target.closest('button'); if(!node)return;
    if(node.dataset.act){chapter=Number(node.dataset.act);renderCampaign();}
    if(node.dataset.mission)openMission(node.dataset.mission);
    if(node.dataset.support){support=node.dataset.support;document.querySelectorAll('[data-support]').forEach(b=>b.classList.toggle('active',b.dataset.support===support));}
    if(node.dataset.difficulty){difficulty=node.dataset.difficulty;document.querySelectorAll('[data-difficulty]').forEach(b=>b.classList.toggle('active',b.dataset.difficulty===difficulty));setText('difficultyDescription',difficulty==='story'?'敌军生命 -30% · 额外 2 枚 Lv.4 灵种':difficulty==='veteran'?'敌军生命 +45% · 更严峻的前线':'标准敌军强度 · 完整守护之星');}
    if(node.dataset.reward)chooseReward(node.dataset.reward);
    if(node.dataset.decision)chooseDecision(node.dataset.decision);
    if(node.dataset.next){close();openMission(node.dataset.next);}
    if(node.dataset.codex)openCodex(node.dataset.codex);
    if(node.dataset.priority&&selectedTower){selectedTower.targetPriority=node.dataset.priority;selectedTower.manualTarget=null;ui();}
    const action=node.dataset.action;
    if(action==='deploy')launchMission();
    if(action==='resume'){close();window.CampaignSave?.restore();}
    if(action==='scout')openScout();
    if(action==='map')goMap();
    if(action==='retry'){const key=gameSession.level.key;close();openMission(key);}
    if(action==='close')close();
    if(action==='unlockTarget'&&selectedTower){selectedTower.manualTarget=null;ui();}
    if(action==='export'){const url=URL.createObjectURL(new Blob([JSON.stringify({game:'甜橙谷',version:2,records:campaignProgress.load()},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='orangewood-record.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  });
  document.addEventListener('change',event=>{
    if(event.target.id==='scoutWave')openScout(Number(event.target.value));
    if(event.target.id==='settingSound')runtime.soundEnabled=event.target.checked;
    if(event.target.id==='settingMotion')runtime.reducedMotion=event.target.checked;
    if(event.target.id.startsWith('setting')){saveSettings();update();}
  });
  document.addEventListener('keydown',event=>{
    if(byId('storyModal').hidden)return;
    if(event.key==='Escape'&&!byId('storyClose').hidden){event.preventDefault();close();}
    if(event.key==='Tab') { const focusable=[...byId('storyModal').querySelectorAll('button:not([hidden]):not(:disabled),input,select')];const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();} }
  });
  byId('storyClose').onclick=close;
  byId('continueCampaignBtn').onclick=()=>{if(window.CampaignSave?.peek())window.CampaignSave.restore();else openMission(campaignProgress.nextUncompleted());};
  byId('codexBtn').onclick=()=>openCodex();
  byId('settingsBtn').onclick=openSettings;
  byId('soundBtn').onclick=()=>{runtime.soundEnabled=!runtime.soundEnabled;saveSettings();if(runtime.soundEnabled)audioBus.play(520,.08,'sine',.03);update();};
  byId('hubCampaignBtn').onclick=goMap;
  // The base game owns navigation for endless/developer runs. Campaign runs
  // need the pause menu so the player can preserve the current checkpoint.
  byId('battleBackBtn').onclick=()=>{
    if (gameSession.isFinite || campaignRun) pauseMenu();
    else leaveBattle();
  };
  byId('modeEntryBtn').onclick=()=>{
    if (gameSession.isFinite || campaignRun) pauseMenu();
    else leaveBattle();
  };
  // Developer mode is a first-class local mode exposed from the command hub.
  // Hiding it behind a query string made the existing tools unreachable.
  byId('hubDeveloperBtn').hidden = false;
  const tools=document.createElement('div');tools.className='battle-tools';tools.innerHTML=`<button id="battleCodex" title="守卫档案" aria-label="守卫档案">${icon('BookOpen')}</button><button id="battleSettings" title="设置" aria-label="设置">${icon('Settings2')}</button>`;byId('soundBtn').before(tools);
  byId('battleCodex').onclick=()=>{if(!pendingEvolution)openCodex();};byId('battleSettings').onclick=()=>{if(!pendingEvolution)openSettings();};
  const objectives=document.createElement('section');objectives.id='battleObjectives';objectives.className='battle-objectives';document.querySelector('.tower-panel .panel-title').after(objectives);
  const dispatch=document.createElement('div');dispatch.id='dispatchStrip';dispatch.className='dispatch-strip';objectives.after(dispatch);
  const decisionStatus=document.createElement('div');decisionStatus.id='decisionStatus';decisionStatus.className='decision-status';decisionStatus.hidden=true;dispatch.after(decisionStatus);
  const targeting=document.createElement('div');targeting.id='targetingControls';targeting.className='targeting-controls';byId('selectedInfo').after(targeting);
  document.querySelectorAll('.brand-mark').forEach(el=>el.innerHTML=icon('Citrus'));
  document.querySelectorAll('.stat-icon').forEach((el,i)=>el.innerHTML=icon(['Heart','Sparkles','Trophy'][i]));
  document.querySelectorAll('[data-map-growth]').forEach(el=>{const label=el.querySelector('small').outerHTML;el.innerHTML=icon({sprout:'Sprout',balanced:'Leaf',refine:'Gem'}[el.dataset.mapGrowth])+label;});
  document.querySelector('.hud-spirit>span').innerHTML=icon('TreeDeciduous');
  byId('fieldIcon').style.display='none';
  const chronicle=document.createElement('button');chronicle.id='chronicleBtn';chronicle.title='根脉纪事';chronicle.setAttribute('aria-label','根脉纪事');chronicle.innerHTML=icon('ScrollText');byId('codexBtn').before(chronicle);chronicle.onclick=openChronicle;
  window.CampaignUI={update,intermission,result,openMission,renderCampaign,canStartWave,restored};
  window.lucide?.createIcons();
  // game.js establishes the initial hub page. Do not override it here: this
  // module is also loaded for endless mode and should only hydrate the UI.
  renderCampaign();
  update();
})();
