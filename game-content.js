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
    forged: { name:'烈铸盟',icon:'⚒',tag:'faction:forged',scope:'members',desc:'先破甲，再破盾，最后专门处理首领',tiers:[{count:2,armorBreak:.12},{count:4,shieldBreak:.25},{count:6,bossDamage:.22}] },
    verdant: { name:'生息庭',icon:'❖',tag:'faction:verdant',scope:'members',desc:'延长减速与持续效果，并扩大控制覆盖',tiers:[{count:2,statusDuration:.25},{count:4,range:.12},{count:6,goldBonus:.2}] },
    celestial: { name:'天象仪',icon:'✦',tag:'faction:celestial',scope:'members',desc:'以高速循环技能，换取更稳定的灵力产出',tiers:[{count:2,attackSpeed:.1},{count:4,spiritBonus:2},{count:6,damage:.12,attackSpeed:.08}] },
    vanguard: { name:'破军',icon:'◆',tag:'role:single',scope:'members',desc:'单体守卫专门终结精英与 Boss',tiers:[{count:2,bossDamage:.12},{count:4,bossDamage:.25}] },
    ranger: { name:'贯星',icon:'➶',tag:'role:pierce',scope:'members',desc:'穿透守卫撕开重甲',tiers:[{count:2,armorBreak:.1},{count:4,armorBreak:.24}] },
    channeler: { name:'引脉',icon:'⌁',tag:'role:chain',scope:'members',desc:'连锁守卫高效瓦解护盾',tiers:[{count:2,shieldBreak:.25},{count:4,shieldBreak:.55}] },
    artillery: { name:'燎原',icon:'✹',tag:'role:splash',scope:'members',desc:'范围守卫扩大覆盖并处理兽潮',tiers:[{count:2,damage:.08},{count:4,damage:.14,range:.1}] },
    oracle: { name:'神谕',icon:'◎',tag:'role:omni',scope:'all',desc:'融合塔把少量全域增益分享给整支军团',tiers:[{count:1,damage:.04},{count:2,statusDuration:.35,attackSpeed:.06}] }
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
    groveGate: { name:'第一章 · 林地之门',mapKey:'grove',startingLives:12,objectives:['survive'],waves:[
      { enemyCount:8,eventKey:'calm',reward:24 }, { enemyCount:14,eventKey:'bounty',traitKey:'armored',hpScale:1.18,roster:['bramblehog','shellguard'],reward:36 }, { enemyCount:18,eventKey:'rush',boss:'groveTyrant',hpScale:1.35,roster:['mossling','glimmermoth','shellguard'],reward:96 }
    ],rewards:{ spirit:120,unlock:'wetland' } },
    mirrorMarsh: { name:'第二章 · 镜沼迷踪',mapKey:'wetland',startingLives:10,objectives:['survive'],waves:[
      { enemyCount:12,eventKey:'mist',traitKey:'resistant',hpScale:1.12,roster:['glimmermoth','mireseer'],reward:42 }, { enemyCount:18,eventKey:'resonance',traitKey:'regenerating',hpScale:1.28,roster:['mireseer','bramblehog','shellguard'],reward:60 }, { enemyCount:22,eventKey:'rush',boss:'groveTyrant',hpScale:1.42,roster:['glimmermoth','mireseer','shellguard'],reward:120 }
    ],rewards:{ spirit:180,unlock:'ember' } },
    emberPass: { name:'第三章 · 赤霞关',mapKey:'ember',startingLives:8,objectives:['survive'],waves:[
      { enemyCount:15,eventKey:'rush',traitKey:'swift',hpScale:1.15,roster:['glimmermoth','bramblehog'],reward:62 }, { enemyCount:22,eventKey:'mist',traitKey:'fortified',hpScale:1.38,roster:['shellguard','bramblehog','mireseer'],reward:86 }, { enemyCount:26,eventKey:'bounty',boss:'ashenStag',hpScale:1.55,roster:['glimmermoth','shellguard','mireseer'],reward:165 }
    ],rewards:{ spirit:260,unlock:'frost' } }
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

  function createRegistry() {
    const registry = new ContentDomain.ContentRegistry();
    registry.maps.registerAll(maps); registry.events.registerAll(events); registry.modes.registerAll(modes); registry.levels.registerAll(levels);
    return registry.validate();
  }
  return { growthModes, synergies, maps, events, modes, levels, enemyArchetypes, enemyTraits, createRegistry };
});
