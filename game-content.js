(function exposeGameContent(root, factory) {
  const content = factory(root.ContentDomain || (typeof require === 'function' ? require('./content-system.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = content;
  root.GameContent = content;
})(typeof globalThis !== 'undefined' ? globalThis : window, function createGameContent(ContentDomain) {
  if (!ContentDomain) throw new Error('ContentDomain must be loaded before GameContent');

  const growthModes = Object.freeze({
    sprout: Object.freeze({ name: '繁育', threshold: 100, absorb: 1.35, desc: '灵力吸收 +35%，固定产出 Lv.1', sequence: Object.freeze([1]) }),
    balanced: Object.freeze({ name: '均衡', threshold: 100, absorb: 1, desc: '标准吸收，稳定产出 Lv.1、Lv.2、Lv.3、Lv.4', sequence: Object.freeze([1,2,1,3,2,4]) }),
    refine: Object.freeze({ name: '精炼', threshold: 115, absorb: .72, desc: '吸收较慢，但会直接凝结 Lv.3、Lv.4、Lv.5', sequence: Object.freeze([3,4,3,5]) })
  });

  const synergies = Object.freeze({
    forged: { name:'烈铸盟',icon:'⚒',tag:'faction:forged',scope:'members',desc:'金、火、土与相关融合塔造成额外伤害',tiers:[{count:2,damage:.08},{count:4,damage:.16},{count:6,damage:.28}] },
    verdant: { name:'生息庭',icon:'❖',tag:'faction:verdant',scope:'members',desc:'木、水、风与相关融合塔提高攻击速度',tiers:[{count:2,attackSpeed:.08},{count:4,attackSpeed:.16},{count:6,attackSpeed:.28}] },
    celestial: { name:'天象仪',icon:'✦',tag:'faction:celestial',scope:'members',desc:'阴、阳、雷与相关融合塔同时强化伤害和攻速',tiers:[{count:2,damage:.05,attackSpeed:.05},{count:4,damage:.1,attackSpeed:.1},{count:6,damage:.18,attackSpeed:.18}] },
    vanguard: { name:'破军',icon:'◆',tag:'role:single',scope:'members',desc:'单体守卫强化重击伤害',tiers:[{count:2,damage:.1},{count:4,damage:.22}] },
    ranger: { name:'贯星',icon:'➶',tag:'role:pierce',scope:'members',desc:'穿透守卫提高攻击速度',tiers:[{count:2,attackSpeed:.1},{count:4,attackSpeed:.22}] },
    channeler: { name:'引脉',icon:'⌁',tag:'role:chain',scope:'members',desc:'连锁守卫同时强化伤害和攻速',tiers:[{count:2,damage:.06,attackSpeed:.08},{count:4,damage:.12,attackSpeed:.18}] },
    artillery: { name:'燎原',icon:'✹',tag:'role:splash',scope:'members',desc:'范围守卫强化爆发伤害',tiers:[{count:2,damage:.12},{count:4,damage:.26}] },
    oracle: { name:'神谕',icon:'◎',tag:'role:omni',scope:'all',desc:'融合塔的全域灵场强化整支军团',tiers:[{count:1,damage:.05},{count:2,damage:.12,attackSpeed:.06}] }
  });

  const maps = {
    grove: { name: '翠影林地', icon: '🌲', unlock: 1, desc: '普通守卫伤害 +12%', bonus: ['base'], damage: 1.12, range: 1, enemySpeed: 1, reward: 1, path: [[-30,90],[150,90],[150,270],[390,270],[390,150],[690,150],[690,390],[990,390]], palette: { grass:'#add69c',roadEdge:'#c3ad75',road:'#efdda9',accent:'#4f8b4e',shrub:'#76b66b',mote:'#e9f5b5' } },
    wetland: { name: '镜水湿地', icon: '💧', unlock: 2, desc: '水、风路线伤害 +20%', bonus: ['water','wind'], damage: 1.2, range: 1.05, enemySpeed: .96, reward: 1, path: [[-30,150],[210,150],[210,390],[450,390],[450,90],[750,90],[750,330],[990,330]], palette: { grass:'#8fc9b5',roadEdge:'#8fae9b',road:'#cce1c8',accent:'#318aa0',shrub:'#58a58d',mote:'#bdeff1' } },
    ember: { name: '赤霞山径', icon: '🔥', unlock: 4, desc: '火、金路线伤害 +18% · 奖励 +10%', bonus: ['fire','metal'], damage: 1.18, range: .96, enemySpeed: 1.04, reward: 1.1, path: [[-30,390],[150,390],[150,150],[330,150],[330,450],[570,450],[570,210],[810,210],[810,90],[990,90]], palette: { grass:'#c9aa78',roadEdge:'#9b704c',road:'#dfbd83',accent:'#ce5831',shrub:'#8e8852',mote:'#ffbf62' } },
    frost: { name: '霜月高地', icon: '❄️', unlock: 6, desc: '木、土路线射程 +15% · 奖励 +15%', bonus: ['wood','earth'], damage: 1.08, range: 1.15, enemySpeed: 1.08, reward: 1.15, path: [[-30,270],[150,270],[150,90],[510,90],[510,330],[330,330],[330,450],[750,450],[750,210],[990,210]], palette: { grass:'#aebfc0',roadEdge:'#90a3a2',road:'#d9dddd',accent:'#5c8fa5',shrub:'#789a8f',mote:'#f1ffff' } }
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
    campaign: { name:'守护征程',kind:'campaign',levelRequired:true,autoAdvance:true }
  };

  const levels = {
    groveGate: { name:'第一章 · 林地之门',mapKey:'grove',startingLives:12,objectives:['survive'],waves:[
      { enemyCount:8,eventKey:'calm',reward:24 }, { enemyCount:11,eventKey:'bounty',traitKey:'armored',reward:30 }, { enemyCount:14,eventKey:'rush',boss:'groveTyrant',reward:80 }
    ],rewards:{ spirit:120,unlock:'wetland' } },
    mirrorMarsh: { name:'第二章 · 镜沼迷踪',mapKey:'wetland',startingLives:10,objectives:['survive'],waves:[
      { enemyCount:12,eventKey:'mist',traitKey:'resistant',reward:36 }, { enemyCount:16,eventKey:'resonance',traitKey:'regenerating',reward:48 }, { enemyCount:18,eventKey:'rush',boss:'groveTyrant',reward:100 }
    ],rewards:{ spirit:180,unlock:'ember' } },
    emberPass: { name:'第三章 · 赤霞关',mapKey:'ember',startingLives:8,objectives:['survive'],waves:[
      { enemyCount:15,eventKey:'rush',traitKey:'swift',reward:55 }, { enemyCount:20,eventKey:'mist',traitKey:'fortified',reward:70 }, { enemyCount:22,eventKey:'bounty',boss:'ashenStag',reward:140 }
    ],rewards:{ spirit:260,unlock:'frost' } }
  };

  const enemyArchetypes = {
    mossling:{name:'苔芽精',role:'normal',icon:'芽',hp:1,speed:1,reward:1,radius:14,traitCount:1,lifeCost:1,weight:6,desc:'成群沿根系迁徙的基础敌人'},
    bramblehog:{name:'棘背兽',role:'normal',icon:'棘',hp:1.3,speed:.82,reward:1.2,radius:16,traitCount:1,lifeCost:1,unlockWave:3,weight:3,modifiers:{armor:.08},desc:'披着荆棘甲壳，移动较慢但更耐打'},
    glimmermoth:{name:'流光蛾',role:'normal',icon:'蛾',hp:.72,speed:1.32,reward:1.15,radius:12,traitCount:1,lifeCost:1,unlockWave:4,weight:3,modifiers:{slowResist:.2},desc:'高速飞行并天然抵抗部分减速'},
    shellguard:{name:'岩壳卫',role:'elite',icon:'岩',hp:2.5,speed:.78,reward:2.2,radius:21,traitCount:2,lifeCost:1,unlockWave:2,weight:3,modifiers:{armor:.12,shieldRatio:.18},abilities:['岩壳护盾'],desc:'厚重的精英前锋，拥有可吸收伤害的岩壳护盾'},
    mireseer:{name:'沼泽祭司',role:'elite',icon:'沼',hp:2.05,speed:.92,reward:2.4,radius:20,traitCount:2,lifeCost:1,unlockWave:4,weight:2,modifiers:{regenRatio:.006},desc:'不断汲取湿地灵力恢复生命'},
    groveTyrant:{name:'腐根暴君',role:'boss',icon:'王',hp:7,speed:.62,reward:8,radius:29,traitCount:3,lifeCost:3,unlockWave:5,weight:3,modifiers:{healthMultiplier:1.1,shieldRatio:.12,enraged:true},abilities:['腐根护盾','半血狂暴'],desc:'拥有腐根护盾，生命过半后进入狂暴'},
    ashenStag:{name:'烬角鹿王',role:'boss',icon:'鹿',hp:8.2,speed:.7,reward:10,radius:30,traitCount:3,lifeCost:3,unlockWave:10,weight:2,modifiers:{slowResist:.25,armor:.08},desc:'穿越赤霞而来的高阶首领'}
  };
  const enemyTraits = {
    armored:{name:'重甲',label:'重甲',icon:'盾',color:'#697784',modifiers:{armor:.22}}, swift:{name:'迅捷',label:'迅捷',icon:'速',color:'#e98a32',modifiers:{speedMultiplier:1.28}},
    resistant:{name:'抗性',label:'抗性',icon:'抗',color:'#398fc1',modifiers:{slowResist:.45}}, regenerating:{name:'再生',label:'再生',icon:'愈',color:'#4c9b64',modifiers:{regenRatio:.012}},
    fortified:{name:'强韧',label:'强韧',icon:'韧',color:'#956d48',modifiers:{healthMultiplier:1.5}}, enraged:{name:'狂暴',label:'狂暴',icon:'怒',color:'#d34a43',modifiers:{enraged:true}}
  };

  function createRegistry() {
    const registry = new ContentDomain.ContentRegistry();
    registry.maps.registerAll(maps); registry.events.registerAll(events); registry.modes.registerAll(modes); registry.levels.registerAll(levels);
    return registry.validate();
  }
  return { growthModes, synergies, maps, events, modes, levels, enemyArchetypes, enemyTraits, createRegistry };
});
