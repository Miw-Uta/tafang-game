(function exposeExperience(root, factory) {
  const domain = factory();
  if (typeof module === 'object' && module.exports) module.exports = domain;
  root.ExperienceDomain = domain;
})(typeof globalThis !== 'undefined' ? globalThis : window, function createExperienceDomain() {
  const steps = Object.freeze([
    { key:'scout', title:'先读懂这一波', text:'点击「侦察」，查看敌军类型与两路比例。护盾需要破甲，成群敌人适合范围伤害。', target:'[data-action="scout"]', action:'侦察敌军' },
    { key:'deploy', title:'把灵种种在路口', text:'点击灵种仓中的一枚灵种，再点击道路旁的空地。射程圈要覆盖敌人经过的路线。', target:'#mapReserveList', action:'定位灵种仓' },
    { key:'merge', title:'让有限的塔位更强', text:'整备时点击「合成」，或把同形态守卫拖到一起。同级合成效率最高；一键合成可在开波前撤销。', target:'#mergeBtn', action:'定位合成' },
    { key:'evolve', title:'决定你的第一条谱系', text:'普通守卫达到 Lv.5 后选择进化。水系擅长控制，火系应对群体，金系克制护甲。暂未到 Lv.5 时可以先开波积累资源。', target:'#mapOffers', action:'查看成长来源' },
    { key:'wave', title:'让阵线接受考验', text:'确认两路覆盖后点击「开始守护」。战斗中可以变阵；橙光蓄满时用空格释放，P 可暂停思考。', target:'#waveBtn', action:'定位开波按钮' }
  ]);
  class TutorialProgress {
    constructor(saved = []) { this.done = new Set(Array.isArray(saved) ? saved.filter(key => steps.some(step => step.key === key)) : []); }
    observe(facts = {}) {
      const before = this.done.size;
      for (const key of ['scout','deploy','merge','evolve','wave']) if (facts[key] === true) this.done.add(key);
      return this.done.size !== before;
    }
    next() { return steps.find(step => !this.done.has(step.key)) || null; }
    snapshot() { return steps.filter(step => this.done.has(step.key)).map(step => step.key); }
    get complete() { return this.done.size === steps.length; }
  }
  function audioSettings(value = {}) {
    if (!value || typeof value !== 'object') value = {};
    const volume = (key, fallback) => typeof value[key] === 'number' && Number.isFinite(value[key]) ? Math.max(0, Math.min(1, value[key])) : fallback;
    return { music:volume('music', .38), ambience:volume('ambience', .28), musicMuted:value.musicMuted === true, ambienceMuted:value.ambienceMuted === true };
  }
  // Each score has its own harmonic language, meter, phrasing and voices.
  // MIDI motifs are composed against the associated eight-bar chord sequence;
  // null is a written rest. No imported samples or external audio are used.
  const scores = {
    main:{ title:'最后一盏灯', meter:8, tempo:[82,96,110], lead:'flute', answer:'harp', pad:'warm', bass:'round',
      chords:[[57,60,64],[53,57,60,64],[60,64,67,74],[55,60,62],[57,60,64,67],[50,53,57],[53,57,60,64],[55,59,62]],
      rhythm:[0,2,4,6], counter:[1,5],
      motifs:[[69,72,76,81,76,72,71,76],[69,72,77,76,72,71,69,64],[72,76,null,74,69,null,67,64],[76,74,72,null,71,67,64,null]],
      bridge:[[72,null,71,69],[64,67,null,69],[72,76,74,null],[71,69,67,64]] },
    grove:{ title:'树影中的回信', meter:8, tempo:[88,106,118], lead:'flute', answer:'wood', pad:'warm', bass:'round',
      chords:[[60,64,67,69],[64,67,71],[65,69,72,79],[62,65,69],[60,64,69],[57,60,64,67],[62,65,69],[55,59,62,69]],
      rhythm:[0,2,3,6], counter:[1,4,7],
      motifs:[[76,79,81,79,76,74,72,null],[79,81,84,81,79,null,76,74],[77,81,79,76,null,74,72,69],[74,77,76,72,71,74,null,67]],
      bridge:[[79,76,null,74],[72,69,72,null],[77,79,81,77],[74,null,71,67]] },
    wetland:{ title:'水面借来的名字', meter:6, tempo:[72,88,102], lead:'reed', answer:'glass', pad:'mist', bass:'bow',
      chords:[[50,57,60,64],[55,59,62,69],[52,55,59,62],[50,57,60,64],[48,55,59,62],[57,60,64,67],[55,59,62,69],[50,57,60,64]],
      rhythm:[0,3,5], counter:[2,4],
      motifs:[[74,77,76,69,72,74],[79,78,74,71,null,69],[76,74,71,67,71,null],[74,72,69,null,64,69]],
      bridge:[[69,null,72],[74,76,null],[71,null,67],[69,64,null]] },
    ember:{ title:'没有刃的钥匙', meter:8, tempo:[94,112,126], lead:'mallet', answer:'brass', pad:'ember', bass:'deep',
      chords:[[52,55,59],[53,57,60],[50,53,57],[52,55,59,62],[59,62,65],[48,52,55],[53,57,60,64],[52,55,59]],
      rhythm:[0,1,4,6,7], counter:[2,5],
      motifs:[[76,77,71,76,67,71,74,71,76,77],[77,81,79,77,null,74,72,69,72,74],[74,77,76,69,71,null,67,65,64,67],[71,74,77,76,71,67,null,64,65,64]],
      bridge:[[64,67,null,71,64],[65,null,69,72,65],[62,65,null,69,62],[64,67,71,null,64]] },
    frost:{ title:'钟声之后的空白', meter:8, tempo:[66,82,96], lead:'glass', answer:'flute', pad:'air', bass:'bow',
      chords:[[53,57,60,64],[53,59,62,67],[52,55,59,62],[57,60,64,71],[53,57,64,67],[48,55,59,64],[55,59,62,69],[53,57,60,64]],
      rhythm:[0,3,6], counter:[2,7],
      motifs:[[81,null,83,84,79,null],[83,79,null,78,74,76],[79,null,76,71,null,74],[81,76,null,72,71,null]],
      bridge:[[76,null,null],[79,78,null],[74,null,71],[76,null,72]] }
  };
  const deepFreeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(deepFreeze);Object.freeze(value);}return value;};
  deepFreeze(scores);
  function scoreKeyFor(page, mapKey) { return page==='battle'&&Object.hasOwn(scores,mapKey)&&mapKey!=='main'?mapKey:'main'; }
  function soundscape({ page = 'hub', mapKey = 'grove', paused = false, hidden = false, running = false, boss = false, danger = false } = {}) {
    const scoreKey=scoreKeyFor(page,mapKey), intensity=page==='battle'&&running?(boss||danger?2:1):0;
    const active=!(hidden||(page==='battle'&&paused));
    return { active, scoreKey, title:scores[scoreKey].title, theme:!active?'quiet':intensity===2?'storm':intensity===1?'frontier':'grove', tempo:scores[scoreKey].tempo[intensity], intensity };
  }
  function scoreFrame({ scoreKey='main', pulse=0, intensity=0 }={}) {
    if(!Object.hasOwn(scores,scoreKey))scoreKey='main';
    const score=scores[scoreKey];
    pulse=Number.isFinite(pulse)?Math.max(0,Math.floor(pulse)):0;
    intensity=Number.isFinite(intensity)?Math.max(0,Math.min(2,Math.floor(intensity))):0;
    const bar=Math.floor(pulse/score.meter), beat=pulse%score.meter, cycle=Math.floor(bar/32), section=Math.floor(bar%32/8);
    const barInSection=bar%8, cadence=barInSection===7, reflection=section===2;
    const sectionName=['arrival','dialogue','reflection','return'][section];
    const chord=score.chords[(barInSection+(section===1?2:section===2?4:0))%score.chords.length];
    const events=[];
    const emit=(layer,midi,duration,gain,voice,delay=0)=>{if(midi!==null)events.push({layer,midi,duration,gain,voice,delay});};
    // One cadence bar in each phrase, plus a two-bar silence in the lead at
    // the end of every 32 bars. Even a boss encounter keeps room to breathe.
    const leadRest=cadence||(section===3&&barInSection>=6);
    if(beat===0&&(!cadence||section===3)&&(!reflection||barInSection%2===0)) {
      const voicing=cycle%2?chord.map((pitch,index)=>index===0?pitch+12:pitch):chord;
      voicing.forEach(pitch=>emit('harmony',pitch,score.meter*(reflection?1.65:.94),reflection?.021:.027,score.pad));
    }
    if((beat===0&&(!reflection||barInSection%2===0)) || (!reflection&&!cadence&&intensity>0&&beat===Math.floor(score.meter/2)))emit('bass',chord[0]-12,reflection?score.meter*1.7:score.meter*.44,.075,score.bass);
    const rhythm=cycle%2?score.rhythm.map(position=>(position+1)%score.meter):score.rhythm;
    const rhythmIndex=rhythm.indexOf(beat);
    if(!leadRest&&rhythmIndex>=0) {
      const motifs=reflection?score.bridge:score.motifs, motif=motifs[(Math.floor(barInSection/2)+section+cycle)%motifs.length];
      const melodyIndex=(barInSection%2*rhythm.length+rhythmIndex)%motif.length;
      const midi=motif[melodyIndex];
      // Reflection phrases use only the first and last written gestures.
      if(!reflection||rhythmIndex===0||rhythmIndex===rhythm.length-1)emit('melody',midi,scoreKey==='frost'?3.4:scoreKey==='wetland'?2.5:1.35,reflection?.043:.063,score.lead);
    }
    if(section!==0&&!reflection&&!cadence&&score.counter.includes(beat)&&barInSection%2===1) {
      const pitch=chord[(beat+cycle)%chord.length]+12;
      emit('answer',pitch,1.7,.028,score.answer,scoreKey==='wetland'?.12:0);
    }
    // Dynamics add punctuating parts; they do not stack another permanent
    // arpeggio on top of every line. The reflection always drops percussion.
    if(intensity>0&&!reflection&&!cadence&&!leadRest) {
      if(beat===0||beat===Math.floor(score.meter/2))emit('pulse',scoreKey==='ember'?40:45,.7,intensity===2?.08:.05,'drum');
      if(intensity===2&&barInSection%2===0&&beat===score.meter-2)emit('warning',chord[1]+12,1.6,.035,score.answer);
    }
    if(beat===0&&bar%4===2)emit('environment',{main:88,grove:91,wetland:79,ember:55,frost:96}[scoreKey],2.2,.009,scoreKey==='ember'?'wood':'glass',.25);
    return { scoreKey,title:score.title,meter:score.meter,bar,beat,cycle,section:sectionName,leadRest,events };
  }
  return { steps, TutorialProgress, audioSettings, soundscape, scores, scoreKeyFor, scoreFrame };
});

(function installExperience() {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !window.GameApp) return;
  const { steps, TutorialProgress, audioSettings, soundscape, scoreFrame } = ExperienceDomain;
  const byId = id => document.getElementById(id);
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const tutorial = new TutorialProgress(read('tafang.fieldGuide.v1', []));
  const options = audioSettings(read('tafang.audio.v1', {}));
  const guidePreference = read('tafang.guidePreference', {});
  let guideDismissed = guidePreference?.dismissed === true, guideRequested = false;
  let runReference = null, baselineEvolutions = new Set(), deploymentObserved = false;
  let guideSignature = '', helpResume = false, helpFocus = null, highlighted = null, highlightTimer = null;
  let gridCell = { col:1, row:6 }, keyboardGrid = false;

  const guide = document.createElement('section');
  guide.id = 'fieldGuide'; guide.className = 'field-guide'; guide.hidden = true;
  guide.setAttribute('aria-label','巡林者入门指引');
  guide.innerHTML = '<div class="field-guide-top"><span>巡林者入门</span><span id="guideCount"></span><button id="guideDismiss" aria-label="收起入门指引" title="收起，可在操作手册中重看">×</button></div><div class="field-guide-steps" id="guideSteps" aria-label="入门进度"></div><h3 id="guideTitle"></h3><p id="guideText" aria-live="polite"></p><div class="field-guide-actions"><button id="guideLocate"></button><button id="guideHelp">操作手册</button></div>';
  document.querySelector('.tower-panel .panel-title')?.after(guide);
  const narrowGuide=window.matchMedia('(max-width:900px)');
  function placeGuide(){
    if(narrowGuide.matches)byId('mapOperations').before(guide);
    else {
      const commands=document.querySelector('.tower-panel .tactics-command');
      (commands||document.querySelector('.tower-panel .panel-title'))?.after(guide);
    }
  }
  narrowGuide.addEventListener('change',placeGuide);placeGuide();
  const help = document.createElement('div');
  help.id = 'experienceHelp'; help.className = 'experience-modal'; help.hidden = true;
  help.setAttribute('role','dialog'); help.setAttribute('aria-modal','true'); help.setAttribute('aria-labelledby','experienceTitle');
  help.innerHTML = `<section class="experience-dialog"><button class="experience-close" id="experienceClose" aria-label="关闭操作手册">×</button><span class="experience-kicker">FIELD MANUAL / 巡林者手册</span><h2 id="experienceTitle">每一次布阵，都有选择。</h2><p class="experience-intro">先看敌军，再定谱系。守住道路交汇处，把一轮收入变成下一轮的优势。</p><div class="manual-columns"><section><h3>从一枚灵种开始</h3><ol class="manual-lessons">${steps.map((step,index)=>`<li><span>${String(index+1).padStart(2,'0')}</span><div><b>${step.title}</b><p>${step.text}</p></div></li>`).join('')}</ol></section><section><h3>把指令交给双手</h3><dl class="manual-keys"><div><dt><kbd>P</kbd></dt><dd>暂停 / 继续</dd></div><div><dt><kbd>空格</kbd></dt><dd>橙光爆发（充能 100%）</dd></div><div><dt><kbd>N</kbd> / <kbd>M</kbd></dt><dd>开始下一波 / 一键合成</dd></div><div><dt><kbd>R</kbd> / <kbd>F</kbd></dt><dd>撤回选中守卫 / 切换速度</dd></div><div><dt><kbd>1</kbd> … <kbd>9</kbd></dt><dd>选择灵种仓中第几种灵种</dd></div><div><dt><kbd>Q</kbd> / <kbd>W</kbd> / <kbd>E</kbd></dt><dd>根缚 / 鼓舞 / 萤照战术；方向键调整，回车释放</dd></div><div><dt><kbd>K</kbd></dt><dd>进入键盘布阵（取消战术瞄准）</dd></div><div><dt><kbd>↑ ↓ ← →</kbd></dt><dd>键盘布阵时移动地块光标</dd></div><div><dt><kbd>Enter</kbd></dt><dd>部署灵种 / 选择地块上的守卫</dd></div><div><dt><kbd>Esc</kbd></dt><dd>取消部署 / 退出键盘布阵</dd></div><div><dt><kbd>H</kbd> / <kbd>?</kbd></dt><dd>打开本手册</dd></div></dl><div class="manual-tactics"><b>读懂战场</b><p>点击守卫，再点击射程内的敌人可指定集火。右键解除锁定。拖动守卫可移动或合成；战斗变阵会短暂整备，尽量在波次之间调整。</p><p>「前方」拦截漏怪，「反制」处理关键敌人。不同谱系能形成羁绊，过度合并也会损失路线覆盖。</p></div></section></div><div class="manual-bottom"><span id="guideRecord"></span><button id="guideReplay">展开入门指引</button><button id="manualReturn" class="manual-primary">返回</button></div></section>`;
  document.body.append(help);
  const manualButton = (id, label) => { const button=document.createElement('button');button.id=id;button.type='button';button.className='manual-entry';button.title='操作手册 · H';button.setAttribute('aria-label','操作手册');button.innerHTML=`<span aria-hidden="true">?</span>${label ? '<b>操作手册</b>' : ''}`;button.onclick=openHelp;return button; };
  document.querySelector('.battle-tools')?.prepend(manualButton('battleHelp',false));
  const hubHeader = document.querySelector('.hub-page .page-topbar');
  // The illustrated hub already supplies a guide entry in its footer.
  // Retain a fallback for older layouts without creating a duplicate button.
  if (byId('hubGuideBtn')) { byId('hubGuideBtn').onclick=openHelp;byId('hubGuideBtn').title='游玩指南 · H'; }
  else if (hubHeader) hubHeader.append(manualButton('hubHelp',true));
  document.querySelector('.campaign-nav')?.prepend(manualButton('campaignHelp',false));
  const cursor = document.createElement('div'); cursor.id='keyboardCell';cursor.className='keyboard-cell';cursor.hidden=true;cursor.setAttribute('aria-hidden','true');
  (document.querySelector('.map-viewport') || byId('game').parentElement).append(cursor);
  byId('game').tabIndex=0;
  byId('game').setAttribute('aria-label','战场。按 K 进入键盘布阵，方向键选择地块，回车部署或选择守卫。');

  function visibleModal() { return !help.hidden || !byId('storyModal').hidden || Boolean(pendingEvolution); }
  function openHelp() {
    if (pendingEvolution) return;
    if (!byId('storyModal').hidden) {
      if (byId('storyClose').hidden) return;
      byId('storyClose').click();
    }
    window.TacticsUI?.cancel();
    helpFocus=document.activeElement;helpResume=paused;paused=true;
    help.hidden=false; document.body.classList.add('experience-open');
    byId('guideRecord').textContent=`已实践 ${tutorial.done.size} / ${steps.length} 项操作 · 指引会记录实际操作`;
    byId('experienceClose').focus(); refreshAudio();
  }
  function closeHelp() {
    help.hidden=true; document.body.classList.remove('experience-open');
    paused=document.body.dataset.page==='battle'?helpResume:true;
    helpFocus?.focus?.();refreshAudio();
  }
  byId('experienceClose').onclick=closeHelp;
  byId('manualReturn').onclick=closeHelp;
  help.addEventListener('click',event=>{if(event.target===help)closeHelp();});
  byId('guideHelp').onclick=openHelp;
  byId('guideDismiss').onclick=()=>{guideDismissed=true;save('tafang.guidePreference',{dismissed:true});renderGuide();};
  byId('guideReplay').onclick=()=>{guideDismissed=false;guideRequested=true;save('tafang.guidePreference',{dismissed:false});closeHelp();renderGuide(true);};
  byId('guideLocate').onclick=()=>{
    const step=tutorial.next();if(!step)return;
    const node=document.querySelector(step.target);if(!node)return;
    if(step.key==='scout'){node.click();return;}
    highlighted?.classList.remove('guide-highlight');clearTimeout(highlightTimer);
    highlighted=node;node.classList.add('guide-highlight');node.scrollIntoView({block:'nearest',behavior:runtime.reducedMotion?'instant':'smooth'});
    (node.matches('button')?node:node.querySelector('button'))?.focus();
    highlightTimer=setTimeout(()=>node.classList.remove('guide-highlight'),3000);
  };
  function renderGuide(force=false) {
    const inBattle=document.body.dataset.page==='battle';
    guide.hidden=!inBattle || !campaignRun || guideDismissed || (gameSession.level?.missionNumber!==1 && !guideRequested);
    if(guide.hidden)return;
    const signature=tutorial.snapshot().join(',');if(guideSignature===signature && !force && byId('guideTitle').textContent)return;
    guideSignature=signature;const next=tutorial.next();
    byId('guideCount').textContent=`${tutorial.done.size} / ${steps.length}`;
    byId('guideSteps').innerHTML=steps.map(step=>`<span class="${tutorial.done.has(step.key)?'complete':next?.key===step.key?'current':''}" title="${step.title} · ${tutorial.done.has(step.key)?'已实践':'待实践'}"></span>`).join('');
    byId('guideTitle').textContent=next?next.title:'现在，写下你的战术。';
    byId('guideText').textContent=next?next.text:'你已实际完成侦察、部署、合成、进化和开波。试着用不同谱系守住两路，再挑战不漏怪通关。';
    byId('guideLocate').hidden=!next;byId('guideLocate').textContent=next?.action||'';
  }
  function observeGuide() {
    if (!campaignRun) { runReference=null;renderGuide();return; }
    if (campaignRun!==runReference) {
      runReference=campaignRun;baselineEvolutions=new Set(discoveredEvolutions);deploymentObserved=false;
    }
    const changed=tutorial.observe({
      scout:!byId('storyModal').hidden && Boolean(byId('scoutWave')),
      deploy:deploymentObserved,
      merge:campaignRun.stats.merges>0,
      evolve:[...discoveredEvolutions].some(key=>!baselineEvolutions.has(key)),
      wave:started===true && (running || gameSession.completedWaves>0)
    });
    if(changed)save('tafang.fieldGuide.v1',tutorial.snapshot());renderGuide();
  }

  // Five locally synthesized scores share the mixer and transport. The pure
  // scoreFrame function owns arrangement; this layer only renders its notes.
  let musicContext=null, musicGain=null, ambienceGain=null, audioUnlocked=false;
  let nextNote=0, pulse=0, ambienceSource=null, ambienceFilter=null, lastAudioActive=null, transportScore='main';
  const hz=note=>440*Math.pow(2,(note-69)/12);
  const voices={
    flute:{type:'sine',attack:.09,cutoff:3500,partial:[2,.12],pan:-.12},
    harp:{type:'triangle',attack:.008,cutoff:2200,pan:.18},
    wood:{type:'sine',attack:.006,cutoff:1700,partial:[3,.21],pan:.16},
    reed:{type:'triangle',attack:.13,cutoff:1350,partial:[2,.08],pan:-.17},
    glass:{type:'sine',attack:.006,cutoff:6200,partial:[2.76,.13],pan:.22},
    mallet:{type:'sine',attack:.008,cutoff:2400,partial:[4,.18],pan:-.15},
    brass:{type:'sawtooth',attack:.08,cutoff:850,pan:.14,scale:.64},
    warm:{type:'sine',attack:.45,cutoff:950,partial:[2,.1],pan:0},
    mist:{type:'triangle',attack:.6,cutoff:620,pan:-.08,scale:.7},
    ember:{type:'triangle',attack:.3,cutoff:720,pan:.07,scale:.75},
    air:{type:'sine',attack:.65,cutoff:2400,partial:[3,.09],pan:.12},
    round:{type:'sine',attack:.035,cutoff:480,pan:0},
    bow:{type:'triangle',attack:.2,cutoff:420,pan:0,scale:.65},
    deep:{type:'sine',attack:.018,cutoff:290,partial:[2,.15],pan:0},
    drum:{type:'sine',attack:.004,cutoff:250,pan:0}
  };
  const soundingNotes=new Set();
  function note(event,time,interval) {
    const {midi,duration,gain,voice,layer}=event,profile=voices[voice]||voices.flute;
    const length=Math.max(.07,duration*interval),attack=Math.min(profile.attack,length*.32);
    const envelope=musicContext.createGain(),filter=musicContext.createBiquadFilter(),panner=musicContext.createStereoPanner();
    filter.type='lowpass';filter.frequency.setValueAtTime(profile.cutoff,time);panner.pan.value=profile.pan;
    const volume=gain*(profile.scale||1);
    envelope.gain.setValueAtTime(.0001,time);envelope.gain.exponentialRampToValueAtTime(volume,time+attack);
    envelope.gain.exponentialRampToValueAtTime(Math.max(.0001,volume*.5),time+length*.65);
    envelope.gain.exponentialRampToValueAtTime(.0001,time+length);
    filter.connect(envelope);envelope.connect(panner);panner.connect(layer==='environment'?ambienceGain:musicGain);
    const partials=[[1,1],...(profile.partial?[profile.partial]:[])],nodes=[];
    const record={envelope,end:time+length};soundingNotes.add(record);
    for(const [ratio,strength] of partials) {
      const oscillator=musicContext.createOscillator(),balance=musicContext.createGain();nodes.push(oscillator,balance);
      oscillator.type=profile.type;oscillator.frequency.setValueAtTime(hz(midi)*ratio,time);
      if(voice==='drum')oscillator.frequency.exponentialRampToValueAtTime(32,time+length*.8);
      balance.gain.value=strength/(1+(profile.partial?.[1]||0));oscillator.connect(balance);balance.connect(filter);
      oscillator.start(time);oscillator.stop(time+length+.03);
    }
    nodes[0].onended=()=>{nodes.forEach(node=>node.disconnect());filter.disconnect();envelope.disconnect();panner.disconnect();soundingNotes.delete(record);};
  }
  function changeScore(key) {
    if(key===transportScore)return;
    const time=musicContext.currentTime;
    for(const active of soundingNotes){active.envelope.gain.cancelAndHoldAtTime(time);active.envelope.gain.exponentialRampToValueAtTime(.0001,time+.22);}
    transportScore=key;pulse=0;nextNote=time+.24;
  }
  function initAudio() {
    if(musicContext)return;
    const AudioClass=window.AudioContext||window.webkitAudioContext;if(!AudioClass)return;
    try {
      musicContext=new AudioClass();musicGain=musicContext.createGain();ambienceGain=musicContext.createGain();
      const compressor=musicContext.createDynamicsCompressor();compressor.threshold.value=-18;compressor.ratio.value=3;
      musicGain.connect(compressor);ambienceGain.connect(compressor);compressor.connect(musicContext.destination);
      musicGain.gain.value=0;ambienceGain.gain.value=0;
      const buffer=musicContext.createBuffer(1,musicContext.sampleRate*4,musicContext.sampleRate),channel=buffer.getChannelData(0);
      let brown=0,seed=117;for(let index=0;index<channel.length;index++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;brown=(brown+(seed/4294967296*2-1)*.014)/1.015;channel[index]=brown;}
      ambienceSource=musicContext.createBufferSource();ambienceSource.buffer=buffer;ambienceSource.loop=true;
      ambienceFilter=musicContext.createBiquadFilter();ambienceFilter.type='lowpass';ambienceFilter.frequency.value=560;
      ambienceSource.connect(ambienceFilter);ambienceFilter.connect(ambienceGain);ambienceSource.start();
      nextNote=musicContext.currentTime+.1;
    } catch { musicContext=null; }
  }
  function currentSoundscape() {
    return soundscape({page:document.body.dataset.page,mapKey:gameSession.map.key,paused,hidden:document.hidden,running,boss:enemies.some(enemy=>!enemy.dead&&enemy.type==='boss'),danger:lives>0&&lives<=3});
  }
  function refreshAudio() {
    if(!musicContext)return;
    const scene=currentSoundscape();
    ambienceFilter.frequency.setTargetAtTime({main:560,grove:720,wetland:340,ember:940,frost:1150}[scene.scoreKey],musicContext.currentTime,.8);
    const active=audioUnlocked&&scene.active&&((!options.musicMuted&&options.music>0)||(!options.ambienceMuted&&options.ambience>0));
    musicGain.gain.setTargetAtTime(options.musicMuted?0:options.music*.46,musicContext.currentTime,.12);
    ambienceGain.gain.setTargetAtTime(options.ambienceMuted?0:options.ambience*.5,musicContext.currentTime,.2);
    if(active!==lastAudioActive || (active&&musicContext.state==='suspended')) {
      lastAudioActive=active;
      if(active){nextNote=Math.max(nextNote,musicContext.currentTime+.06);musicContext.resume().catch(()=>{});}
      else if(musicContext.state==='running')musicContext.suspend().catch(()=>{});
    }
  }
  function scheduleMusic() {
    refreshAudio();if(!musicContext||musicContext.state!=='running'||!lastAudioActive)return;
    const scene=currentSoundscape(), interval=60/scene.tempo/2;
    changeScore(scene.scoreKey);
    // Clamp after throttled tabs: never play a backlog of missed notes.
    if(nextNote<musicContext.currentTime-.1)nextNote=musicContext.currentTime+.03;
    while(nextNote<musicContext.currentTime+.18) {
      const frame=scoreFrame({scoreKey:scene.scoreKey,pulse,intensity:scene.intensity});
      for(const event of frame.events)if(event.layer!=='environment'||!options.ambienceMuted)note(event,nextNote+event.delay*interval,interval);
      nextNote+=interval;pulse++;
    }
  }
  function unlockAudio(event) { if(!event.isTrusted)return;audioUnlocked=true;initAudio();refreshAudio(); }
  window.addEventListener('pointerdown',unlockAudio,{passive:true});
  window.addEventListener('keydown',unlockAudio,{capture:true});
  document.addEventListener('visibilitychange',()=>{refreshAudio();});
  let scheduler=window.setInterval(scheduleMusic,100);
  window.addEventListener('pagehide',()=>{window.clearInterval(scheduler);musicContext?.suspend().catch(()=>{});});
  window.addEventListener('pageshow',event=>{if(event.persisted){scheduler=window.setInterval(scheduleMusic,100);refreshAudio();}});
  function enhanceSettings() {
    const soundToggle=byId('settingSound');if(!soundToggle||byId('experienceAudio'))return;
    const mixer=document.createElement('fieldset');mixer.id='experienceAudio';mixer.className='experience-audio';
    mixer.innerHTML=`<legend>森林的声音</legend><p>配乐会随整备、交战与首领出现而变化。切换到后台或暂停战斗时静音。</p>${[['music','自适应配乐'],['ambience','林间环境声']].map(([key,label])=>`<div class="audio-channel"><label for="audio-${key}">${label}<output id="audio-${key}-value">${Math.round(options[key]*100)}%</output></label><input id="audio-${key}" type="range" min="0" max="100" step="1" value="${Math.round(options[key]*100)}"><label class="audio-mute"><input id="audio-${key}-mute" type="checkbox" ${options[key+'Muted']?'checked':''}>静音</label></div>`).join('')}`;
    soundToggle.closest('.settings-row').after(mixer);
    for(const key of ['music','ambience']) {
      byId(`audio-${key}`).oninput=event=>{options[key]=Number(event.target.value)/100;byId(`audio-${key}-value`).textContent=`${event.target.value}%`;save('tafang.audio.v1',options);refreshAudio();};
      byId(`audio-${key}-mute`).onchange=event=>{options[key+'Muted']=event.target.checked;save('tafang.audio.v1',options);refreshAudio();};
    }
    const manual=document.createElement('button');manual.className='settings-manual';manual.textContent='操作手册与入门指引';manual.onclick=openHelp;mixer.after(manual);
  }
  function updateKeyboardCursor() {
    cursor.hidden=!keyboardGrid||document.body.dataset.page!=='battle'||Boolean(window.TacticsUI?.state().armed);if(cursor.hidden)return;
    const board=byId('game'), cellWidth=board.clientWidth/COLS, cellHeight=board.clientHeight/ROWS;
    cursor.style.left=`${gridCell.col*cellWidth}px`;cursor.style.top=`${gridCell.row*cellHeight}px`;
    cursor.style.width=`${cellWidth}px`;cursor.style.height=`${cellHeight}px`;
    const tower=towers.find(tower=>tower.col===gridCell.col&&tower.row===gridCell.row);
    board.setAttribute('aria-label',`战场第 ${gridCell.row+1} 行，第 ${gridCell.col+1} 列。${tower?evolution[tower.evo].name+' Lv.'+tower.level:isRoad(gridCell.col,gridCell.row)?'道路':mapObjectAt(gridCell.col,gridCell.row)?'地图目标':'空地'}。回车选择或部署。`);
  }
  function focusGrid() { window.TacticsUI?.cancel();keyboardGrid=true;if(selectedTower)gridCell={col:selectedTower.col,row:selectedTower.row};byId('game').focus({preventScroll:true});updateKeyboardCursor(); }
  function trapFocus(event,container) {
    const nodes=[...container.querySelectorAll('button:not(:disabled):not([hidden]),input:not(:disabled),select:not(:disabled),[tabindex="0"]')].filter(node=>node.getClientRects().length>0);
    const first=nodes[0],last=nodes.at(-1);if(!first)return;
    if(event.shiftKey&&(document.activeElement===first||!container.contains(document.activeElement))){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&(document.activeElement===last||!container.contains(document.activeElement))){event.preventDefault();first.focus();}
  }
  window.addEventListener('keydown',event=>{
    if(!help.hidden) {
      if(event.key==='Escape'){event.preventDefault();closeHelp();}
      else if(event.key==='Tab')trapFocus(event,help);
      event.stopImmediatePropagation();return;
    }
    if(pendingEvolution) {
      if(event.key==='Tab')trapFocus(event,byId('evoModal'));
      if(/^[1-9]$/.test(event.key)&&!event.repeat){const button=byId('evoChoices').querySelectorAll('[data-route]')[Number(event.key)-1];if(button){event.preventDefault();button.click();}}
      // Let Enter activate the focused choice, but never pass battle shortcuts.
      if(event.key!=='Tab')event.stopImmediatePropagation();return;
    }
    if(!byId('storyModal').hidden)return;
    if(event.ctrlKey||event.metaKey||event.altKey||event.target?.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName))return;
    const key=event.key.toLowerCase();
    if((key==='h'||key==='?')&&!event.repeat){event.preventDefault();openHelp();return;}
    if(document.body.dataset.page!=='battle'||gameWon||lives<=0)return;
    if(key==='k'&&!event.repeat){event.preventDefault();focusGrid();return;}
    const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
    if(keyboardGrid&&document.activeElement===byId('game')&&delta){event.preventDefault();event.stopImmediatePropagation();gridCell.col=Math.max(0,Math.min(COLS-1,gridCell.col+delta[0]));gridCell.row=Math.max(0,Math.min(ROWS-1,gridCell.row+delta[1]));updateKeyboardCursor();return;}
    if(keyboardGrid&&document.activeElement===byId('game')&&event.key==='Enter'&&!event.repeat){event.preventDefault();if(pendingDeployLevel||pendingDeployTowerIndex!==null)deployReserve(gridCell.col,gridCell.row);else{selectedTower=towers.find(tower=>tower.col===gridCell.col&&tower.row===gridCell.row)||null;selectedEnemy=null;selectedMapObject=null;ui();}updateKeyboardCursor();return;}
    if(key==='escape'&&keyboardGrid&&!pendingDeployLevel&&pendingDeployTowerIndex===null){keyboardGrid=false;updateKeyboardCursor();return;}
    if(event.repeat)return;
    if(/^[1-9]$/.test(key)){const levels=Object.keys(reserve).map(Number).filter(level=>reserve[level]>0).sort((a,b)=>a-b);const level=levels[Number(key)-1];if(level){event.preventDefault();beginDeploy(level);focusGrid();}return;}
    const control={n:'waveBtn',m:'mergeBtn',r:'mapRecallBtn',f:'speedBtn'}[key];
    if(control){event.preventDefault();const button=byId(control);if(button&&!button.disabled)button.click();}
  },true);
  byId('game').addEventListener('pointerdown',()=>{keyboardGrid=false;updateKeyboardCursor();});
  const boardModeObserver=new MutationObserver(()=>{
    if(byId('game').classList.contains('tactics-aiming'))keyboardGrid=false;
    updateKeyboardCursor();
  });
  boardModeObserver.observe(byId('game'),{attributes:true,attributeFilter:['class']});
  window.addEventListener('resize',updateKeyboardCursor);
  const previousUpdate=window.CampaignUI.update;
  window.CampaignUI.update=function(...args){const result=previousUpdate.apply(this,args);observeGuide();updateKeyboardCursor();return result;};
  const deployWithCoreRules=deployReserve;
  deployReserve=function(...args){
    const before=new Set(towers),result=deployWithCoreRules(...args);
    // Loading a checkpoint or producing a fusion also changes the roster;
    // only a successful deployment can satisfy the deployment lesson.
    if(result&&towers.some(tower=>!before.has(tower))){deploymentObserved=true;observeGuide();}
    return result;
  };
  const observer=new MutationObserver(()=>{observeGuide();enhanceSettings();refreshAudio();});
  observer.observe(document.body,{attributes:true,attributeFilter:['data-page']});
  observer.observe(byId('storyBody'),{childList:true,subtree:true});
  observer.observe(byId('storyModal'),{attributes:true,attributeFilter:['hidden']});
  byId('evoModal').setAttribute('role','dialog');byId('evoModal').setAttribute('aria-modal','true');byId('evoModal').setAttribute('aria-labelledby','evoTitle');
  let evolutionOpen=false,evolutionFocus=null;
  const evolutionObserver=new MutationObserver(()=>{
    const isOpen=byId('evoModal').classList.contains('show');
    if(isOpen&&!evolutionOpen){
      evolutionFocus=document.activeElement;
      requestAnimationFrame(()=>{if(byId('evoModal').classList.contains('show'))byId('evoChoices').querySelector('button')?.focus();});
    }
    else if(!isOpen&&evolutionOpen)evolutionFocus?.focus?.();
    evolutionOpen=isOpen;refreshAudio();
  });
  evolutionObserver.observe(byId('evoModal'),{attributes:true,attributeFilter:['class']});
  window.GameExperience=Object.freeze({openHelp,guide:()=>tutorial.snapshot(),audio:()=>{const scene=currentSoundscape(),frame=scoreFrame({scoreKey:scene.scoreKey,pulse:scene.scoreKey===transportScore?pulse:0,intensity:scene.intensity});return {...options,theme:scene.theme,scoreKey:scene.scoreKey,title:scene.title,section:frame.section,bar:frame.bar,cycle:frame.cycle,state:musicContext?.state||'locked'};},refresh:()=>{observeGuide();refreshAudio();}});
  observeGuide();
})();
