(function exposeGameContent(root, factory) {
  const content = factory(root.ContentDomain || (typeof require === 'function' ? require('./content-system.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = content;
  root.GameContent = content;
})(typeof globalThis !== 'undefined' ? globalThis : window, function createGameContent(ContentDomain) {
  if (!ContentDomain) throw new Error('ContentDomain must be loaded before GameContent');

  const growthModes = Object.freeze({
    sprout: Object.freeze({ name: '繁育', threshold: 100, absorb: 1.35, damage: .72, cooldown: .8, desc: '灵力吸收 +35%，选项偏向低级灵种，适合铺场和凑羁绊', sequence: Object.freeze([1,1,2,1,2,3]) }),
    balanced: Object.freeze({ name: '均衡', threshold: 100, absorb: 1, damage: 1, cooldown: 1, desc: '标准吸收与战斗性能，稳定提供多档抽芽选择', sequence: Object.freeze([1,2,1,3,2,4]) }),
    refine: Object.freeze({ name: '精炼', threshold: 115, absorb: .72, damage: 1.35, cooldown: 1.3, desc: '吸收较慢但选项偏向高级灵种，适合攒力争取关键塔', sequence: Object.freeze([3,4,3,5]) })
  });

  const synergies = Object.freeze({
    forged: { name:'烈铸盟',icon:'⚒',tag:'faction:forged',scope:'members',desc:'破甲随阵容保留，逐档追加破盾与首领伤害',tiers:[{count:2,armorBreak:.12},{count:4,armorBreak:.12,shieldBreak:.25},{count:6,armorBreak:.12,shieldBreak:.25,bossDamage:.22}] },
    verdant: { name:'生息庭',icon:'❖',tag:'faction:verdant',scope:'members',desc:'逐档延长状态、扩大射程；六形态成员击杀额外获得 3 灵力',tiers:[{count:2,statusDuration:.25},{count:4,statusDuration:.25,range:.12},{count:6,statusDuration:.25,range:.12,spiritBonus:3}] },
    celestial: { name:'天象仪',icon:'✦',tag:'faction:celestial',scope:'members',desc:'保留快速施法，逐档追加击杀灵力与伤害',tiers:[{count:2,attackSpeed:.1},{count:4,attackSpeed:.1,spiritBonus:2},{count:6,attackSpeed:.1,spiritBonus:2,damage:.12}] },
    vanguard: { name:'破军',icon:'◆',tag:'role:single',scope:'members',desc:'单体守卫专门终结精英与 Boss',tiers:[{count:2,bossDamage:.12},{count:4,bossDamage:.25}] },
    ranger: { name:'贯星',icon:'➶',tag:'role:pierce',scope:'members',desc:'穿透守卫撕开重甲',tiers:[{count:2,armorBreak:.1},{count:4,armorBreak:.24}] },
    channeler: { name:'引脉',icon:'⌁',tag:'role:chain',scope:'members',desc:'连锁守卫高效瓦解护盾',tiers:[{count:2,shieldBreak:.25},{count:4,shieldBreak:.55}] },
    artillery: { name:'燎原',icon:'✹',tag:'role:splash',scope:'members',desc:'范围守卫扩大覆盖并处理兽潮',tiers:[{count:2,damage:.08},{count:4,damage:.14,range:.1}] },
    oracle: { name:'神谕',icon:'◎',tag:'role:omni',scope:'all',desc:'融合塔把少量全域增益分享给整支军团',tiers:[{count:1,damage:.04},{count:2,damage:.04,statusDuration:.35,attackSpeed:.06}] }
  });

  const maps = {
    grove: { name: '翠影回廊', icon: '🌲', unlock: 1, desc: '双路穿过上下回廊后汇流 · 普通守卫伤害 +12%', bonus: ['base'], damage: 1.12, range: 1, enemySpeed: 1, reward: 1, routeStyle:'orthogonal', terrainType:'grove', blockedCells:[[0,0],[5,0],[9,0],[14,0],[0,8],[4,8],[8,8],[15,8]], objectives:[{name:'荆棘林',icon:'♣',kind:'thicket',col:4,row:2,hp:220,reward:55,unlocks:[[5,2],[6,2]]},{name:'古灵库',icon:'◆',kind:'cache',col:12,row:6,hp:300,reward:90,unlocks:[[11,6],[12,5]]}], routes: [
      [[-30,90],[510,90],[510,210],[150,210],[150,270],[690,270],[690,390],[930,390],[930,270],[990,270]],
      [[-30,450],[510,450],[510,330],[150,330],[150,270],[690,270],[690,390],[930,390],[930,270],[990,270]]
    ], buildSlots:'auto', initialSlot:[1,4], ritualSite:[12,2], routePlan:[{from:1,weights:[1,0]},{from:3,weights:[2,1]},{from:5,weights:[1,1]}], specialSlots:[{col:1,row:4,type:'lookout'},{col:9,row:3,type:'conduit'},{col:9,row:5,type:'rapid'},{col:7,row:2,type:'spring'}], palette:{grass:'#8fbe78',roadEdge:'#a47e4e',road:'#dfc58d',accent:'#4f8b4e',shrub:'#5d9e51',mote:'#e9f5b5'} },
    wetland: { name: '镜水折返湾', icon: '💧', unlock: 2, desc: '水道折返包围中央灵岛 · 水、风路线伤害 +20%', bonus: ['water','wind'], damage: 1.2, range: 1.05, enemySpeed: .96, reward: 1, routeStyle:'orthogonal', terrainType:'water', blockedCells:[[0,0],[5,0],[9,8],[14,0],[0,8],[5,8],[13,8],[15,8]], objectives:[{name:'沉水灵碑',icon:'◇',kind:'monolith',col:6,row:1,hp:260,reward:70,unlocks:[[7,1]]},{name:'回潮池',icon:'◈',kind:'spring',col:10,row:7,hp:340,reward:110,unlocks:[[10,6],[11,7]]}], routes: [
      [[-30,150],[450,150],[450,30],[810,30],[810,210],[570,210],[570,270],[690,270],[690,150],[930,150],[930,270],[990,270]],
      [[-30,390],[450,390],[450,510],[810,510],[810,330],[570,330],[570,270],[690,270],[690,150],[930,150],[930,270],[990,270]]
    ], buildSlots:'auto', initialSlot:[8,4], ritualSite:[3,4], routePlan:[{from:1,weights:[1,0]},{from:3,weights:[2,1]},{from:5,weights:[1,1]}], specialSlots:[{col:8,row:4,type:'lookout'},{col:8,row:3,type:'conduit'},{col:8,row:5,type:'rapid'},{col:14,row:3,type:'spring'}], palette:{grass:'#72ae91',roadEdge:'#6b8f7e',road:'#b7cbb1',accent:'#318aa0',shrub:'#448b73',mote:'#bdeff1'} },
    ember: { name: '赤霞盘山关', icon: '🔥', unlock: 4, desc: '双线盘山折返后进入赤角关 · 火、金路线伤害 +18%', bonus: ['fire','metal'], damage: 1.18, range: .96, enemySpeed: 1.04, reward: 1.1, routeStyle:'orthogonal', terrainType:'rock', blockedCells:[[4,1],[8,1],[11,1],[4,7],[8,7],[11,7],[0,6],[15,6]], routes: [
      [[-30,30],[750,30],[750,150],[210,150],[210,270],[630,270],[630,390],[930,390],[930,270],[990,270]],
      [[-30,510],[750,510],[750,390],[210,390],[210,270],[630,270],[630,390],[930,390],[930,270],[990,270]]
    ], buildSlots:'auto', initialSlot:[2,4], ritualSite:[14,2], routePlan:[{from:1,weights:[1,0]},{from:3,weights:[2,1]},{from:5,weights:[1,1]}], specialSlots:[{col:2,row:4,type:'lookout'},{col:4,row:3,type:'conduit'},{col:4,row:5,type:'rapid'},{col:13,row:3,type:'spring'}], palette:{grass:'#b88d61',roadEdge:'#774f38',road:'#c89b68',accent:'#ce5831',shrub:'#737447',mote:'#ffbf62'} },
    frost: { name: '霜月回锋阵', icon: '❄️', unlock: 6, desc: '双脊长廊反复折返夹击霜月台 · 木、土路线射程 +15%', bonus: ['wood','earth'], damage: 1.08, range: 1.15, enemySpeed: 1.08, reward: 1.15, routeStyle:'orthogonal', terrainType:'ice', blockedCells:[[0,0],[5,0],[12,0],[15,0],[0,8],[3,8],[12,8],[15,8]], routes: [
      [[-30,90],[570,90],[570,30],[870,30],[870,210],[330,210],[330,270],[690,270],[690,150],[930,150],[930,270],[990,270]],
      [[-30,450],[570,450],[570,510],[870,510],[870,330],[330,330],[330,270],[690,270],[690,150],[930,150],[930,270],[990,270]]
    ], buildSlots:'auto', initialSlot:[4,4], ritualSite:[1,4], routePlan:[{from:1,weights:[1,0]},{from:3,weights:[2,1]},{from:5,weights:[1,1]}], specialSlots:[{col:4,row:4,type:'lookout'},{col:4,row:3,type:'conduit'},{col:4,row:5,type:'rapid'},{col:10,row:2,type:'spring'}], palette:{grass:'#94acaa',roadEdge:'#71898a',road:'#cbd3d1',accent:'#5c8fa5',shrub:'#668980',mote:'#f1ffff'} }
  };

  const events = {
    calm: { name:'林地微风',icon:'🍃',desc:'平稳波次',enemySpeed:1,enemyHp:1,reward:1,range:1,spirit:1 },
    bounty: { name:'丰饶时刻',icon:'✨',desc:'灵力收益提高 50%',enemySpeed:1.05,enemyHp:1.08,reward:1.5,range:1,spirit:1 },
    mist: { name:'迷雾侵袭',icon:'🌫️',desc:'塔射程降低 15%',enemySpeed:.94,enemyHp:1.12,reward:1.2,range:.85,spirit:1 },
    rush: { name:'兽潮奔袭',icon:'💨',desc:'敌人更快但更脆弱',enemySpeed:1.18,enemyHp:.88,reward:1.25,range:1,spirit:1 },
    resonance: { name:'根系共鸣',icon:'🌳',desc:'世界树吸收效率提高 60%',enemySpeed:1,enemyHp:1.16,reward:1.1,range:1,spirit:1.6 }
  };

  const modes = {
    endless: { name:'无尽远征',kind:'endless',levelRequired:false,autoAdvance:true },
    campaign: { name:'守护征程',kind:'campaign',levelRequired:true,autoAdvance:true },
    developer: { name:'开发者模式',kind:'developer',levelRequired:false,autoAdvance:false }
  };

  const levels = {
    groveGate: { name:'第一章 · 林地之门', mapKey:'grove', chapter:1, story:'世界树的第一片叶子正在枯萎。年轻守卫阿橙奉命守住林地之门，寻找失踪的巡林者。', tactical:'熟悉双路分流与基础合成', startingLives:12, objectives:['survive'], waves:[
      { enemyCount:8,eventKey:'calm',reward:24,roster:['mossling'] }, { enemyCount:14,eventKey:'bounty',traitKey:'armored',hpScale:1.18,roster:['bramblehog','shellguard'],reward:36 }, { enemyCount:18,eventKey:'rush',boss:'groveTyrant',hpScale:1.35,roster:['mossling','glimmermoth','shellguard'],reward:96 }
    ],rewards:{ spirit:120,unlock:'wetland' } },
    whisperGrove: { name:'第一章 · 低语古树', mapKey:'grove', chapter:1, story:'古树记得每一位守卫的名字。阿橙在树洞里听见求救声，却发现声音来自未来。', tactical:'用减速与穿透守住汇流点', startingLives:12, objectives:['survive'], waves:[
      {enemyCount:12,eventKey:'mist',roster:['mossling','glimmermoth'],reward:32}, {enemyCount:18,eventKey:'resonance',traitKey:'swift',hpScale:1.2,roster:['glimmermoth','bramblehog'],reward:52}, {enemyCount:22,eventKey:'bounty',boss:'groveTyrant',hpScale:1.5,roster:['shellguard','mireseer'],reward:110}
    ],rewards:{spirit:140}},
    rootCrossing: { name:'第一章 · 根脉渡口', mapKey:'grove', chapter:1, story:'根脉被黑色藤蔓缠住，渡口的守碑人交出一枚会发光的种子，指向镜沼。', tactical:'平衡两条路线，保留至少两种谱系', startingLives:11, objectives:['survive'], waves:[
      {enemyCount:14,eventKey:'calm',roster:['mossling','bramblehog'],reward:38}, {enemyCount:20,eventKey:'rush',traitKey:'swift',hpScale:1.3,roster:['glimmermoth','bramblehog','shellguard'],reward:62}, {enemyCount:26,eventKey:'resonance',boss:'groveTyrant',hpScale:1.65,roster:['mireseer','shellguard','glimmermoth'],reward:132}
    ],rewards:{spirit:160,unlock:'wetland'}},
    mirrorMarsh: { name:'第二章 · 镜沼迷踪', mapKey:'wetland', chapter:2, story:'镜沼映出另一支守卫军。它们来自被遗忘的旧世界树，正等待有人替它们点亮潮汐灯。', tactical:'利用水、风路线克制高速敌群', startingLives:10, objectives:['survive'], waves:[
      { enemyCount:12,eventKey:'mist',traitKey:'resistant',roster:['glimmermoth','mireseer'],reward:42}, { enemyCount:18,eventKey:'resonance',traitKey:'regenerating',hpScale:1.28,roster:['mireseer','bramblehog','shellguard'],reward:60}, { enemyCount:22,eventKey:'rush',boss:'groveTyrant',hpScale:1.42,roster:['glimmermoth','mireseer','shellguard'],reward:120}
    ],rewards:{ spirit:180,unlock:'ember' } },
    tideShrine: { name:'第二章 · 回潮神龛', mapKey:'wetland', chapter:2, story:'潮汐每退一次，神龛就少一盏灯。阿橙必须在最后一盏熄灭前找到沼泽祭司的真名。', tactical:'用连锁攻击先破盾，再处理再生', startingLives:10, objectives:['survive'], waves:[
      {enemyCount:15,eventKey:'bounty',roster:['mossling','shellguard'],reward:48}, {enemyCount:22,eventKey:'mist',traitKey:'regenerating',hpScale:1.4,roster:['mireseer','shellguard'],reward:72}, {enemyCount:28,eventKey:'resonance',boss:'ashenStag',hpScale:1.58,roster:['mireseer','glimmermoth','shellguard'],reward:140}
    ],rewards:{spirit:195}},
    drownedArchive: { name:'第二章 · 沉水档案', mapKey:'wetland', chapter:2, story:'沉水档案记载着黑潮的源头：一枚被折断的太阳果核。档案守卫要求你证明自己配得上真相。', tactical:'在迷雾事件中用射程与手动索敌补位', startingLives:9, objectives:['survive'], waves:[
      {enemyCount:16,eventKey:'mist',roster:['glimmermoth','mossling'],reward:52}, {enemyCount:24,eventKey:'rush',traitKey:'resistant',hpScale:1.45,roster:['glimmermoth','mireseer'],reward:80}, {enemyCount:30,eventKey:'bounty',boss:'ashenStag',hpScale:1.72,roster:['shellguard','mireseer','bramblehog'],reward:158}
    ],rewards:{spirit:210,unlock:'ember'}},
    emberPass: { name:'第三章 · 赤霞关', mapKey:'ember', chapter:3, story:'赤霞关燃起没有影子的火。阿橙登上盘山道，得知黑潮正在锻造一副属于世界树的铠甲。', tactical:'火、金路线处理重甲与兽潮', startingLives:8, objectives:['survive'], waves:[
      { enemyCount:15,eventKey:'rush',traitKey:'swift',hpScale:1.15,roster:['glimmermoth','bramblehog'],reward:62}, { enemyCount:22,eventKey:'mist',traitKey:'fortified',hpScale:1.38,roster:['shellguard','bramblehog','mireseer'],reward:86}, { enemyCount:26,eventKey:'bounty',boss:'ashenStag',hpScale:1.55,roster:['glimmermoth','shellguard','mireseer'],reward:165}
    ],rewards:{ spirit:260,unlock:'frost' } },
    cinderForge: { name:'第三章 · 余烬铸场', mapKey:'ember', chapter:3, story:'铸场深处传来锤声，那是旧时代守卫在打造最后一枚太阳楔。每一次敲击都会唤醒一批敌人。', tactical:'在丰饶波积攒灵力，抢先完成一次进化', startingLives:8, objectives:['survive'], waves:[
      {enemyCount:18,eventKey:'bounty',roster:['mossling','bramblehog'],reward:68}, {enemyCount:26,eventKey:'rush',traitKey:'armored',hpScale:1.48,roster:['shellguard','glimmermoth'],reward:94}, {enemyCount:32,eventKey:'resonance',boss:'groveTyrant',hpScale:1.82,roster:['shellguard','mireseer','bramblehog'],reward:188}
    ],rewards:{spirit:280}},
    ashClimb: { name:'第三章 · 灰烬天梯', mapKey:'ember', chapter:3, story:'通往关顶的天梯被灰烬覆盖。守门人说，只有愿意牺牲一座塔的指挥官才能看见真正的道路。', tactical:'撤回与重部署，构建临时防线', startingLives:7, objectives:['survive'], waves:[
      {enemyCount:20,eventKey:'mist',roster:['glimmermoth','mireseer'],reward:74}, {enemyCount:30,eventKey:'rush',traitKey:'swift',hpScale:1.62,roster:['glimmermoth','bramblehog','shellguard'],reward:108}, {enemyCount:36,eventKey:'bounty',boss:'ashenStag',hpScale:1.92,roster:['ashenStag','mireseer','shellguard'],reward:220}
    ],rewards:{spirit:300,unlock:'frost'}},
    frostGate: { name:'第四章 · 霜月关', mapKey:'frost', chapter:4, story:'霜月关冻结了时间。远古树灵告诉阿橙，黑潮并非入侵者，而是世界树舍弃的噩梦。', tactical:'木、土路线扩大射程，控制精英', startingLives:9, objectives:['survive'], waves:[
      {enemyCount:18,eventKey:'calm',roster:['mossling','bramblehog'],reward:70}, {enemyCount:28,eventKey:'mist',traitKey:'resistant',hpScale:1.48,roster:['glimmermoth','shellguard'],reward:100}, {enemyCount:34,eventKey:'resonance',boss:'groveTyrant',hpScale:1.88,roster:['mireseer','shellguard','bramblehog'],reward:205}
    ],rewards:{spirit:320}},
    moonlitVault: { name:'第四章 · 月下遗库', mapKey:'frost', chapter:4, story:'遗库里保存着七枚未孵化的灵种。它们要求你在兽潮中保持连击，否则将永远沉睡。', tactical:'连击与范围攻击管理', startingLives:9, objectives:['survive'], waves:[
      {enemyCount:20,eventKey:'rush',traitKey:'swift',roster:['glimmermoth','mossling'],reward:78}, {enemyCount:32,eventKey:'bounty',traitKey:'fortified',hpScale:1.65,roster:['shellguard','bramblehog'],reward:116}, {enemyCount:40,eventKey:'resonance',boss:'ashenStag',hpScale:2.02,roster:['ashenStag','mireseer','glimmermoth'],reward:238}
    ],rewards:{spirit:340}},
    rootMemory: { name:'第四章 · 根系记忆', mapKey:'frost', chapter:4, story:'每一根根须都播放一段旧战。阿橙终于看见自己的身影：她曾是黑潮的第一任守门人。', tactical:'混合抗性考验阵容宽度', startingLives:8, objectives:['survive'], waves:[
      {enemyCount:22,eventKey:'resonance',roster:['mireseer','mossling'],reward:84}, {enemyCount:34,eventKey:'mist',traitKey:'resistant',hpScale:1.72,roster:['glimmermoth','shellguard','mireseer'],reward:126}, {enemyCount:44,eventKey:'bounty',boss:'groveTyrant',hpScale:2.12,roster:['groveTyrant','shellguard','bramblehog'],reward:255}
    ],rewards:{spirit:360}},
    starfall: { name:'第五章 · 星坠荒原', mapKey:'ember', chapter:5, story:'天空裂开一道缝，星火坠入荒原。黑潮借星火塑成新的王，阿橙必须夺回第一块太阳果核。', tactical:'面对高速与重甲混编，灵活切换索敌', startingLives:8, objectives:['survive'], waves:[
      {enemyCount:24,eventKey:'rush',roster:['glimmermoth','bramblehog'],reward:90}, {enemyCount:38,eventKey:'mist',traitKey:'armored',hpScale:1.78,roster:['shellguard','mireseer','glimmermoth'],reward:138}, {enemyCount:48,eventKey:'resonance',boss:'ashenStag',hpScale:2.24,roster:['ashenStag','shellguard','mireseer'],reward:275}
    ],rewards:{spirit:390}},
    sunkenCrown: { name:'第五章 · 沉日王冠', mapKey:'wetland', chapter:5, story:'沉日王冠让所有水面倒映同一个结局：世界树倒下。祭司们将王冠交给你，换取一场没有退路的战争。', tactical:'保护核心路口，优先击杀光环敌人', startingLives:7, objectives:['survive'], waves:[
      {enemyCount:26,eventKey:'mist',roster:['mireseer','glimmermoth'],reward:96}, {enemyCount:42,eventKey:'bounty',traitKey:'regenerating',hpScale:1.92,roster:['mireseer','shellguard'],reward:148}, {enemyCount:52,eventKey:'rush',boss:'groveTyrant',hpScale:2.36,roster:['groveTyrant','glimmermoth','shellguard'],reward:295}
    ],rewards:{spirit:420}},
    blackTide: { name:'第五章 · 黑潮心脏', mapKey:'wetland', chapter:5, story:'黑潮心脏在潮汐深处跳动。阿橙听见另一个自己低声说：只要拔掉根，所有痛苦都会停止。', tactical:'用五行复合效果压制持续再生', startingLives:7, objectives:['survive'], waves:[
      {enemyCount:28,eventKey:'resonance',roster:['mossling','mireseer','shellguard'],reward:102}, {enemyCount:46,eventKey:'rush',traitKey:'fortified',hpScale:2.02,roster:['shellguard','bramblehog','glimmermoth'],reward:160}, {enemyCount:58,eventKey:'bounty',boss:'ashenStag',hpScale:2.48,roster:['ashenStag','mireseer','shellguard'],reward:320}
    ],rewards:{spirit:450}},
    fiveRoots: { name:'第六章 · 五根圣坛', mapKey:'grove', chapter:6, story:'五根圣坛同时苏醒，五种元素向你借火。只有组成完整羁绊，圣坛才会为你开启终门。', tactical:'激活至少两项羁绊并完成五灵阵', startingLives:9, objectives:['survive'], waves:[
      {enemyCount:26,eventKey:'calm',roster:['mossling','bramblehog'],reward:108}, {enemyCount:44,eventKey:'resonance',traitKey:'resistant',hpScale:1.95,roster:['glimmermoth','mireseer','shellguard'],reward:168}, {enemyCount:56,eventKey:'mist',boss:'groveTyrant',hpScale:2.5,roster:['groveTyrant','shellguard','mireseer'],reward:335}
    ],rewards:{spirit:480}},
    eclipseBridge: { name:'第六章 · 日蚀桥', mapKey:'frost', chapter:6, story:'日蚀桥横跨世界树的两半意识。桥的另一端，站着失踪已久的巡林者队长。', tactical:'在低射程事件中用站位与撤回创造空窗', startingLives:8, objectives:['survive'], waves:[
      {enemyCount:30,eventKey:'mist',roster:['glimmermoth','mossling'],reward:114}, {enemyCount:48,eventKey:'rush',traitKey:'swift',hpScale:2.15,roster:['glimmermoth','bramblehog','shellguard'],reward:178}, {enemyCount:62,eventKey:'resonance',boss:'ashenStag',hpScale:2.62,roster:['ashenStag','mireseer','shellguard'],reward:350}
    ],rewards:{spirit:510}},
    thornCathedral: { name:'第六章 · 荆棘圣堂', mapKey:'grove', chapter:6, story:'圣堂唱起没有歌词的歌。队长承认自己已成为黑潮的容器，请你在最后一节终止这场祷告。', tactical:'多路汇流终局，手动聚焦 Boss', startingLives:8, objectives:['survive'], waves:[
      {enemyCount:32,eventKey:'bounty',roster:['mossling','bramblehog','glimmermoth'],reward:122}, {enemyCount:52,eventKey:'mist',traitKey:'fortified',hpScale:2.28,roster:['shellguard','mireseer'],reward:190}, {enemyCount:68,eventKey:'rush',boss:'groveTyrant',hpScale:2.76,roster:['groveTyrant','ashenStag','shellguard'],reward:380}
    ],rewards:{spirit:540}},
    heartRebirth: { name:'终章 · 黎明种子', mapKey:'frost', chapter:7, story:'队长把最后的种子交到阿橙手中。黑潮化作一片寂静的雪，新的世界树等待你的最后一次选择。', tactical:'终局决策：保留羁绊并完成最终进化', startingLives:9, objectives:['survive'], waves:[
      {enemyCount:40,eventKey:'bounty',roster:['mossling','glimmermoth','mireseer'],reward:145}, {enemyCount:64,eventKey:'mist',traitKey:'fortified',hpScale:2.58,roster:['shellguard','bramblehog','mireseer'],reward:225}, {enemyCount:78,eventKey:'resonance',boss:'groveTyrant',hpScale:3.08,roster:['groveTyrant','ashenStag','shellguard','glimmermoth'],reward:460}
    ],rewards:{spirit:580}},
    worldTree: { name:'终章 · 世界树之心', mapKey:'grove', chapter:7, story:'所有故事在树心汇合：阿橙、队长、黑潮，都是世界树为了活下去舍弃的部分。现在由你决定它如何重生。', tactical:'终局混合威胁，完成最终进化与核心防守', startingLives:10, objectives:['survive'], waves:[
      {enemyCount:36,eventKey:'resonance',roster:['mossling','glimmermoth','mireseer'],reward:132}, {enemyCount:58,eventKey:'bounty',traitKey:'fortified',hpScale:2.42,roster:['shellguard','bramblehog','mireseer'],reward:210}, {enemyCount:72,eventKey:'rush',boss:'ashenStag',hpScale:2.95,roster:['ashenStag','groveTyrant','shellguard','mireseer'],reward:430}
    ],rewards:{spirit:600,unlock:'frost'}}
  };

  const enemyArchetypes = {
    mossling:{name:'苔芽精',role:'normal',icon:'芽',hp:1,speed:1,reward:1,radius:14,traitCount:1,lifeCost:1,weight:6,desc:'成群沿根系迁徙的基础敌人'},
    bramblehog:{name:'棘背兽',role:'normal',icon:'棘',hp:1.3,speed:.82,reward:1.2,radius:16,traitCount:1,lifeCost:1,unlockWave:3,weight:3,modifiers:{armor:.08,resist:{wood:.18}},desc:'披着荆棘甲壳，移动较慢但更耐打'},
    glimmermoth:{name:'流光蛾',role:'normal',icon:'蛾',hp:.72,speed:1.32,reward:1.15,radius:12,traitCount:1,lifeCost:1,unlockWave:4,weight:3,modifiers:{slowResist:.2,evasion:.42},abilities:['未受控时闪避 42% 伤害'],desc:'高速飞行，未被减速、冻结或眩晕时会闪避大量伤害'},
    shellguard:{name:'岩壳卫',role:'elite',icon:'岩',hp:2.5,speed:.78,reward:2.2,radius:21,traitCount:2,lifeCost:1,unlockWave:2,weight:3,modifiers:{armor:.12,resist:{metal:.3,earth:.24},shieldRatio:.18,shieldResist:{fire:.35,poison:.2},shieldModeMultipliers:{chain:1.55},shieldStatusImmunity:['stun','freeze','knockback'],shieldRechargeDelay:7,shieldRegenRatio:.004},abilities:['岩壳护盾','连锁破盾','破盾易伤'],desc:'厚重精英，护盾抵抗强控但会被连锁攻击迅速瓦解'},
    mireseer:{name:'沼泽祭司',role:'elite',icon:'沼',hp:2.05,speed:.92,reward:2.4,radius:20,traitCount:2,lifeCost:1,unlockWave:4,weight:2,modifiers:{regenRatio:.006,resist:{water:.28,yin:.18},shieldRatio:.08,shieldRegenRatio:.012,shieldRechargeDelay:3,aura:{radius:110,damageReduction:.1}},abilities:['沼息再生','腐沼光环'],desc:'恢复生命与护盾，并让附近敌人受到的伤害降低 10%'},
    groveTyrant:{name:'腐根暴君',role:'boss',icon:'王',hp:7,speed:.62,reward:8,radius:29,traitCount:3,lifeCost:3,unlockWave:5,weight:3,modifiers:{healthMultiplier:1.1,resist:{base:.2,wood:.16},shieldRatio:.12,shieldResist:{fire:.25},shieldStatusImmunity:['stun','freeze','knockback'],shieldRechargeDelay:9,shieldRegenRatio:.003,enraged:true},abilities:['腐根护盾','半血狂暴','破盾易伤'],desc:'拥有腐根护盾，免疫强控；生命过半后狂暴，破盾时暴露弱点'},
    ashenStag:{name:'烬角鹿王',role:'boss',icon:'鹿',hp:8.2,speed:.7,reward:10,radius:30,traitCount:3,lifeCost:3,unlockWave:10,weight:2,modifiers:{slowResist:.25,armor:.08,resist:{fire:.22},phase:{threshold:.55,speedMultiplier:1.3,statusImmunity:['slow','freeze'],shieldRatio:.08}},abilities:['赤角冲锋','二阶段'],desc:'生命低于 55% 后进入冲锋阶段，速度提升并免疫减速'}
  };
  const enemyTraits = {
    armored:{name:'重甲',label:'重甲',icon:'盾',color:'#697784',modifiers:{armor:.22,resist:{metal:.12,earth:.12}}}, swift:{name:'迅捷',label:'迅捷',icon:'速',color:'#e98a32',modifiers:{speedMultiplier:1.28}},
    resistant:{name:'抗性',label:'抗性',icon:'抗',color:'#398fc1',modifiers:{slowResist:.45,resist:{water:.24,wind:.24}}}, regenerating:{name:'再生',label:'再生',icon:'愈',color:'#4c9b64',modifiers:{regenRatio:.012,resist:{fire:.16,poison:.2}}},
    fortified:{name:'强韧',label:'强韧',icon:'韧',color:'#956d48',modifiers:{healthMultiplier:1.5,resist:{base:.22},attackModeMultipliers:{splash:.62,chain:.78,omni:.68}}}, enraged:{name:'狂暴',label:'狂暴',icon:'怒',color:'#d34a43',modifiers:{enraged:true}}
  };

  Object.assign(enemyArchetypes, {
    tideArchivist: {name:'溯潮典狱长',role:'boss',icon:'潮',hp:7.5,speed:.58,reward:9,radius:29,traitCount:2,lifeCost:3,unlockWave:25,weight:1,modifiers:{shieldRatio:.3,shieldModeMultipliers:{chain:1.8},shieldStatusImmunity:['stun','freeze'],resist:{water:.18},phase:{threshold:.5,speedMultiplier:1.2,shieldRatio:.1}},abilities:['镜面护盾','连锁破盾','半血回潮'],desc:'沉水档案的守门者。镜面护盾惧怕连锁，半血时恢复一层护盾并加速。'},
    frostOracle: {name:'霜月司钟者',role:'boss',icon:'霜',hp:8,speed:.56,reward:10,radius:30,traitCount:2,lifeCost:3,unlockWave:30,weight:1,modifiers:{slowResist:.6,resist:{water:.28},regenRatio:.003,aura:{radius:125,damageReduction:.12},phase:{threshold:.45,speedMultiplier:1.3,statusImmunity:['freeze']}},abilities:['霜钟光环','冰霜抗性','终曲加速'],desc:'钟声保护附近敌群。优先锁定司钟者，用水系以外的火力突破其冰霜抗性；进入终曲后不再被冻结。'},
    hollowHeart: {name:'蚀心树灵',role:'boss',icon:'心',hp:9,speed:.55,reward:12,radius:33,traitCount:2,lifeCost:4,unlockWave:40,weight:1,modifiers:{armor:.1,shieldRatio:.2,shieldModeMultipliers:{chain:1.6},resist:{base:.25},phase:{threshold:.5,speedMultiplier:1.35,statusImmunity:['slow'],shieldRatio:.12}},abilities:['树心双相','连锁裂盾','半血暗潮'],desc:'失落记忆凝成的树心。先由连锁守卫破盾，再集中单体火力；半血后的暗潮免疫减速。'}
  });

  const campaignMissions = {
    groveGate: {
      objective:['merges',2,'结伴守门：完成 2 次合成'], lossLimit:2,
      loadout:{tower:{level:3,evo:'base'},spirit:60,seeds:{1:4}},
      epilogue:'阿橙在暴君的面具里发现巡林者徽章。徽章仍在发热，沿根须指向低语古树。她第一次明白，敌人带来的也许是一封求救信。',
      dispatches:['阿橙：先把小队留在汇流口，别让第一批苔芽靠近树心。','巡林手册：石壳之后还有伏兵，保留灵种才能扩充防线。','阿橙：那顶王冠上有队长的徽记。把它留下！']
    },
    whisperGrove: {
      objective:['maxCombo',8,'低语回响：达成 8 连击'], lossLimit:2,
      loadout:{tower:{level:3,evo:'base'},spirit:100,seeds:{2:2,3:2,4:1}},
      epilogue:'树洞的声音不是预言，而是旧战的回声。一个陌生的阿橙说出了根脉渡口的暗号，替她指明第一条未被黑潮吞没的道路。',
      dispatches:['古树：雾里的人影，会从你身后走来。','阿橙：第二条根脉亮了，小队转向！','回声：不要一座一座地守。让它们在同一瞬间停下。']
    },
    rootCrossing: {
      objective:['maxLineages',2,'根脉均衡：同时部署 2 种进化谱系'], lossLimit:2,
      loadout:{tower:{level:3,evo:'base'},spirit:80,seeds:{3:2,4:1}},
      epilogue:'两条防线都传回了信号。守碑人把潮汐种子交给阿橙：镜沼的亡者只承认共同守护过的队伍。林地与镜沼的根脉重新接通。',
      dispatches:['守碑人：两边的根都不能被放弃。','阿橙：让新谱系守住另一侧，我们在中央会合。','守碑人：种子已经醒了，最后一批敌人冲着它来。']
    },
    mirrorMarsh: {
      objective:['mapCleared',1,'点亮潮汐：清理 1 处地图目标'], lossLimit:2,
      loadout:{tower:{level:3,evo:'base'},spirit:100,seeds:{3:2,4:2}},
      epilogue:'潮汐灯照见水底的旧军旗。亡者为小队让开河道，却警告阿橙：潮汐灯的光正在被回潮神龛一点点抽走。',
      dispatches:['渡灯者：沉水灵碑遮住灯光，先为它打开缺口。','阿橙：再生祭司藏在盾卫后面，别让它们抱团过桥。','渡灯者：潮水反向了！王的影子会从回湾出现。']
    },
    tideShrine: {
      objective:['controls',16,'神龛护灯：控制 16 个不同敌人'], lossLimit:1,
      loadout:{tower:{level:5,evo:'water'},spirit:100,seeds:{3:2,4:2}},
      epilogue:'沼泽祭司的真名是“守灯人”。被驱散的黑潮露出一张人脸，他把沉水档案的位置刻进最后一盏潮汐灯。',
      dispatches:['守灯人：灯越暗，它们恢复得越快。','阿橙：压住前排，把祭司和盾卫拆开。','潮汐灯：典狱长把真名封在镜盾里，击碎它！']
    },
    drownedArchive: {
      objective:['focusedBossKills',1,'档案审判：锁定并击败 1 名首领'], lossLimit:2,
      loadout:{tower:{level:5,evo:'wood'},spirit:120,seeds:{4:3,5:1}},
      epilogue:'档案里画着完整的太阳果核。三百年前，世界树为封住裂隙折断了它；锻造裂隙钥匙的熔炉，至今仍在赤霞关燃烧。',
      dispatches:['档案守卫：雾会遮住远方，证据不会。','阿橙：守住内环，别追离开防线的诱饵。','档案守卫：审判者来了。让你的守卫亲自指出目标。']
    },
    emberPass: {
      objective:['forgedBossKills',1,'赤霞破甲：由金、火或土谱系终结首领'], lossLimit:2,
      loadout:{tower:{level:5,evo:'fire'},spirit:120,seeds:{4:3,5:1}},
      epilogue:'鹿王的角刺穿关门，露出仍在跳动的铸场。铠甲不是为了武装世界树，而是有人试图把整个世界树永远囚禁。',
      dispatches:['关尉：上坡的敌人只是先锋，下坡的重甲才是主力。','阿橙：把火力压在回转处，别让盾阵连成一片。','铸场传音：把角上的太阳楔带来，熔炉还有最后一口火。']
    },
    cinderForge: {
      objective:['merges',6,'铸场抢火：完成 6 次合成'], lossLimit:2,
      loadout:{tower:{level:5,evo:'metal'},spirit:160,seeds:{3:4,4:2,5:1}},
      epilogue:'旧时代的锻师将太阳楔锤成一把没有刃的钥匙。他说，天梯上的守門人索取的并非牺牲，而是一次愿意重新布阵的勇气。',
      dispatches:['锻师：第一锤聚火，第二锤引敌。趁现在把灵种锻成阵线。','阿橙：两条山路都在震动，把新守卫放到最需要的地方。','锻师：最后一锤落下之前，守住暴君！']
    },
    ashClimb: {
      objective:['redeployments',1,'灰烬变阵：撤回并重新部署 1 座进化守卫'], lossLimit:1,
      loadout:{tower:{level:5,evo:'earth'},spirit:140,seeds:{4:3,5:2}},
      epilogue:'阿橙带着所有守卫抵达天梯顶端。守门人让开道路：所谓牺牲，是放弃一套已经失效的站位。霜月关的钟声从云后响起。',
      dispatches:['守门人：上侧山道正在崩落，下侧会替它承担进攻。','阿橙：撤回前排，换到下一条路。每一个守卫都要带走。','守门人：你改变了阵线，却没有抛弃同伴。最后一道阶梯正在显现。']
    },
    frostGate: {
      objective:['controls',24,'霜月封锁：控制 24 个不同敌人'], lossLimit:2,
      loadout:{tower:{level:6,evo:'water'},spirit:140,seeds:{4:2,5:2}},
      epilogue:'树灵从冰中醒来，告诉阿橙黑潮也是世界树的一部分。旧记忆被分成七枚灵种，藏在月下遗库；每少一枚，就会少一个被记住的名字。',
      dispatches:['树灵：冰不是敌人。赶路的人才会滑向裂缝。','阿橙：控制前排，让后续敌群在弯道聚拢。','树灵：司钟者要把此刻永远冻结，守住钟楼。']
    },
    moonlitVault: {
      objective:['maxCombo',15,'月下连环：达成 15 连击'], lossLimit:2,
      loadout:{tower:{level:6,evo:'fire'},spirit:180,seeds:{4:2,5:3}},
      epilogue:'七枚灵种随着连续的战鼓一一苏醒。它们没有指向敌人的巢穴，而是围着阿橙，映出她从未经历过的一场旧战。',
      dispatches:['第一枚灵种：每一次断开的鼓点，都会失去一个名字。','阿橙：等敌群汇合，再让范围守卫齐射。','第七枚灵种：我们记得你，第一任守门人。']
    },
    rootMemory: {
      objective:['maxLineages',3,'记忆拼图：同时部署 3 种进化谱系'], lossLimit:2,
      loadout:{tower:{level:6,evo:'wood'},spirit:180,seeds:{5:4}},
      epilogue:'阿橙曾主动封住黑潮，而世界树抹去了她的记忆。她拾起三段互相矛盾的旧战，决定带着全部真相走向星坠荒原。',
      dispatches:['旧战记录：单一的力量无法解释全部过去。','阿橙：让不同谱系共守一条根，我们会记住每一次选择。','回声：天空将裂，第一块太阳果核在那里等你。']
    },
    starfall: {
      objective:['bossKills',2,'夺回星火：击败 2 名首领'], lossLimit:2,
      loadout:{tower:{level:7,evo:'metal'},spirit:200,seeds:{4:2,5:3}},
      epilogue:'第一块太阳果核被夺回。星火照出两位王共同的伤痕：它们都曾试图挽救世界树，却被沉日王冠许诺的结局困住。',
      dispatches:['观星者：第一轮坠落在上侧，第二轮会反向而来。','阿橙：两名王在争夺同一束光，别让它们分散我们的火力。','星火：王冠仍在深水中，把我带到那里。']
    },
    sunkenCrown: {
      objective:['focusedBossKills',1,'王冠断链：锁定并击败 1 名首领'], lossLimit:0,
      loadout:{tower:{level:7,evo:'thunder'},spirit:200,seeds:{4:2,5:3}},
      epilogue:'阿橙没有戴上王冠。她打碎了它，让水面第一次映出不同的未来。黑潮心脏因此暴露，却开始召回所有失散的敌群。',
      dispatches:['潮汐灯：所有水面都在命令你退后。','阿橙：切断祭司光环，再向王发出攻击命令。','王冠：最后一条退路即将消失。']
    },
    blackTide: {
      objective:['maxSynergies',2,'黑潮逆转：同时激活 2 项羁绊'], lossLimit:2,
      loadout:{tower:{level:7,evo:'water'},spirit:220,seeds:{5:4}},
      epilogue:'黑潮承认了阿橙：它不是另一个敌人，而是被世界树舍弃的恐惧。它把第二块果核交出，请她前往五根圣坛，为这些恐惧留一个位置。',
      dispatches:['黑潮：你只能选择一边。','阿橙：不。每种力量都可以在同一条防线上找到位置。','黑潮：那就带我们一起去见树心。']
    },
    fiveRoots: {
      objective:['maxLineages',5,'五根齐鸣：同时部署 5 种进化谱系'], lossLimit:2,
      loadout:{tower:{level:7,evo:'wood'},spirit:220,seeds:{5:5}},
      epilogue:'五根圣坛亮起。阿橙没有把黑潮烧尽，而是让它成为承托新芽的土壤。日蚀桥的另一端，巡林者队长终于回应了呼叫。',
      dispatches:['金根：我们各自守望，不能互相替代。','木根：把第五种颜色带进阵线。','阿橙：终门已经打开，所有人一起过桥。']
    },
    eclipseBridge: {
      objective:['redeployments',2,'穿越日蚀：重新部署 2 次进化守卫'], lossLimit:1,
      loadout:{tower:{level:8,evo:'water'},spirit:240,seeds:{5:4}},
      epilogue:'桥上的队长没有影子。他承认，自己把身体留在荆棘圣堂，只为替阿橙守住最后一条回路。日蚀结束前，圣堂仍能被找到。',
      dispatches:['队长：桥会轮流隐去两端，跟着根脉的亮光移动。','阿橙：回撤到中央，等另一侧显现。','队长：不要停在桥上。圣堂的祷告已经开始。']
    },
    thornCathedral: {
      objective:['focusedBossKills',2,'圣堂终曲：锁定并击败 2 名首领'], lossLimit:2,
      loadout:{tower:{level:8,evo:'metal'},spirit:240,seeds:{5:4}},
      epilogue:'阿橙击碎容器，将队长从黑潮中带回。圣堂安静下来，最后一块太阳果核化作黎明种子，落在队长掌心。',
      dispatches:['队长：第一节是祈祷，第二节是求救。','阿橙：锁住两名首领，别让盾卫替它们承受全部火力。','队长：最后一节，由你替我结束。']
    },
    heartRebirth: {
      objective:['maxEvolvedLevel',10,'黎明重生：部署一座 Lv.10 进化守卫'], lossLimit:2,
      loadout:{tower:{level:9,evo:'fire'},spirit:260,seeds:{5:5},standby:[{level:9,evo:'fire',evolutionPath:'fire',evoTier:1}]},
      epilogue:'黎明种子在最终进化的光里发芽。队长把巡林徽记交还给阿橙：树心不是一扇必须攻破的门，而是一场终于可以由所有人参加的选择。',
      dispatches:['队长：把最后的火留给新生的守卫。','阿橙：两股同源的火将在这里合为一体。','黎明种子：世界树正在等待完整的我们。']
    },
    worldTree: {
      objective:['maxSynergies',3,'终局共生：同时激活 3 项羁绊'], lossLimit:0,
      loadout:{tower:{level:9,evo:'wood'},spirit:300,seeds:{5:6},standby:[{level:9,evo:'wood',evolutionPath:'wood',evoTier:1}]},
      epilogue:'阿橙将太阳果核拼合，却没有再次封住黑潮。世界树把光与影一同收入年轮。队长重新踏上巡林路，潮汐灯照见新的枝叶；甜橙谷终于记住了所有守护过它的人。',
      dispatches:['世界树：你会删去谁的记忆，换来下一次黎明？','阿橙：一个也不删。让所有谱系一起守住这颗心。','队长：七幕故事已经汇合。全军，守住最后一波。']
    }
  };
  Object.entries(campaignMissions).forEach(([key, mission], index) => {
    const level = levels[key], [metric, target, label] = mission.objective;
    level.objectives = [
      {metric:'livesLost',operator:'max',target:mission.lossLimit,label:mission.lossLimit ? `根系守护：最多损失 ${mission.lossLimit} 点生命` : '根系无伤：不损失生命'},
      {metric,operator:'min',target,label}
    ];
    level.startingLoadout = mission.loadout;
    level.epilogue = mission.epilogue;
    level.retryStory = `阿橙在${level.name.split(' · ')[1]}外重新点起营火。未完成的约定仍在前方。`;
    level.dispatches = mission.dispatches;
    level.missionNumber = index + 1;
    level.routePlan = index < 1 ? [{from:1,weights:[1,0]},{from:3,weights:[2,1]}]
      : index % 3 === 0 ? [{from:1,weights:[1,0]},{from:2,weights:[0,1]},{from:3,weights:[1,1]}]
      : index % 3 === 1 ? [{from:1,weights:[0,1]},{from:2,weights:[1,0]},{from:3,weights:[1,1]}]
      : [{from:1,weights:[1,1]},{from:2,weights:[3,1]},{from:3,weights:[1,3]}];
    const targetWaveCount = index < 6 ? 3 : index < 12 ? 4 : index < 18 ? 5 : index === 18 ? 6 : 7;
    while (level.waves.length < targetWaveCount) {
      const n = level.waves.length - 2;
      level.waves.splice(-1, 0, {
        enemyCount:Math.min(56, 18 + index * 2 + n * 3),
        eventKey:n % 2 ? 'resonance' : 'bounty',
        traitKey:n % 2 ? 'resistant' : 'armored',
        hpScale:1.2 + index * .065,
        spawnInterval:n % 2 ? .84 : 1.05,
        roster:n % 2 ? ['glimmermoth','mireseer','mossling'] : ['bramblehog','shellguard','mossling'],
        reward:70 + index * 7,
        ...(index >= 12 && n === 1 ? {boss:index % 2 ? 'groveTyrant' : 'ashenStag'} : {})
      });
    }
  });
  for (const key of ['mirrorMarsh','tideShrine','drownedArchive','sunkenCrown']) levels[key].waves.at(-1).boss = 'tideArchivist';
  for (const key of ['frostGate','moonlitVault','rootMemory','eclipseBridge','heartRebirth']) levels[key].waves.at(-1).boss = 'frostOracle';
  for (const key of ['blackTide','thornCathedral','worldTree']) levels[key].waves.at(-1).boss = 'hollowHeart';

  // A campaign wave is a fixed encounter. Rendering and replay RNG must not
  // change its composition or introduce unannounced resistance combinations.
  const chapterPressure = [1, 1.5, 2.1, 3, 3.25, 3.5, 4];
  Object.values(levels).forEach(level => level.waves.forEach(wave => {
    wave.hpScale = (wave.hpScale || 1) * chapterPressure[level.chapter - 1];
    const roster = (wave.roster || ['mossling']).filter(key => enemyArchetypes[key].role !== 'boss');
    if (!roster.length) roster.push('mossling');
    wave.roster = roster;
    const weights = roster.map(key => enemyArchetypes[key].weight || 1);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const deficits = weights.map(() => 0);
    wave.spawnPlan = Array.from({ length: wave.enemyCount }, (_, index) => {
      if (wave.boss && index === wave.enemyCount - 1) return { archetype:wave.boss, traits:wave.traitKey ? [wave.traitKey] : [] };
      weights.forEach((weight, i) => { deficits[i] += weight; });
      const next = deficits.indexOf(Math.max(...deficits));
      deficits[next] -= totalWeight;
      return { archetype:roster[next], traits:wave.traitKey ? [wave.traitKey] : [] };
    });
  }));

  function createRegistry() {
    const registry = new ContentDomain.ContentRegistry();
    registry.maps.registerAll(maps); registry.events.registerAll(events); registry.modes.registerAll(modes); registry.levels.registerAll(levels);
    return registry.validate();
  }
  return { growthModes, synergies, maps, events, modes, levels, enemyArchetypes, enemyTraits, createRegistry };
});
