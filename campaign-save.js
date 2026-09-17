(function () {
  const store = new CheckpointDomain.CampaignCheckpointStore(contentRegistry, { evolutionKeys:Object.keys(evolution) });
  let restoring = false, lastSaved = '';

  function save() {
    if (restoring || !campaignRun || running || gameWon || lives <= 0 || pendingEvolution || gameSession.status !== 'preparing') return false;
    const state = {
      levelKey:gameSession.level.key, waveIndex:wave-1, completedWaves:gameSession.completedWaves,
      lives, score, coins, kills, towers:towers.map(tower=>tower.snapshot()), reserve:{...reserve}, standby:standbyReserve,
      growthMode, growthCycles, germinationOffers, surgeCharge,
      ...(battleTactics ? { tactics: battleTactics.snapshot() } : {}),
      mapObjects:mapObjects.map(object=>({id:object.id,hp:object.hp,cleared:object.cleared})),
      mapUnlockedSlots:[...mapUnlockedSlots], discoveredEvolutions:[...discoveredEvolutions],
      campaign:{stats:{...campaignRun.stats},lastObservedLives:campaignRun.lastObservedLives},
      modifiers:{...window.campaignModifiers},
      missionDecisions:{...(missionStory?.snapshot() || {}),...Object.fromEntries(Object.entries(campaignRewards).map(([key,value])=>[`reward:${key}`,value]))}
    };
    const signature = JSON.stringify(state);
    if (lastSaved === signature) return store.storageAvailable;
    const saved = store.save(state);
    if (saved) lastSaved = signature;
    return saved;
  }

  function restore() {
    const state = store.load();
    if (!state || !campaignProgress.isUnlocked(state.levelKey)) return false;
    restoring = true;
    try {
      startMode('campaign',state.levelKey);
      wave = state.waveIndex+1;
      Object.assign(gameSession,{waveNumber:wave,completedWaves:state.completedWaves,lives:state.lives,status:'preparing'});
      lives=state.lives;score=state.score;coins=state.coins;kills=state.kills;
      towers=state.towers.map(tower=>towerFactory.create(tower));selectedTower=towers[0] || null;
      reserve=state.reserve;standbyReserve=state.standby;growthMode=state.growthMode;growthCycles=state.growthCycles;
      germinationOffers=state.germinationOffers;surgeCharge=state.surgeCharge;
      if (state.tactics) battleTactics?.restore(state.tactics);
      mapObjects.forEach((object,index)=>{Object.assign(object,state.mapObjects[index]);object.dead=object.cleared;});
      mapUnlockedSlots=new Set(state.mapUnlockedSlots);discoveredEvolutions=new Set(state.discoveredEvolutions);
      campaignRun.stats={...state.campaign.stats};campaignRun.lastObservedLives=state.campaign.lastObservedLives;
      window.campaignModifiers={...state.modifiers};
      campaignRewards=Object.fromEntries(Object.entries(state.missionDecisions).filter(([key])=>key.startsWith('reward:')).map(([key,value])=>[key.slice(7),value]));
      missionStory?.restore(Object.fromEntries(Object.entries(state.missionDecisions).filter(([key])=>!key.startsWith('reward:'))));
      started=state.completedWaves>0;paused=false;running=false;
      currentWaveEvent=contentRegistry.events.get(gameSession.currentWave.eventKey);
      $('waveBtn').disabled=false;$('waveBtn').textContent=`开始第 ${wave} 波`;
      navigatePage('battle');
      $('message').textContent=`已回到第 ${wave} 波整备，阵容与本关选择已恢复。`;
      window.CampaignUI?.restored?.();
      ui();
      return true;
    } finally { restoring=false; }
  }

  function clear() { lastSaved='';return store.clear(); }
  window.CampaignSave={save,restore,clear,peek:()=>store.load(),available:()=>store.storageAvailable};
  window.addEventListener('pagehide',save);
})();
