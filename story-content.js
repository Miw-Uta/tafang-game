(function exposeStoryContent(root, factory) {
  const content = factory();
  if (typeof module === 'object' && module.exports) module.exports = content;
  root.StoryContent = content;
})(typeof globalThis !== 'undefined' ? globalThis : window, function createStoryContent() {
  const decisions = {
    groveGate: {
      id: 'gate_signal', atWave: 2, title: '门外的求救灯', speaker: '阿橙',
      body: '北侧巡林灯突然亮起，南侧却传来伤员的呼喊。只有一枚引路符：把敌群引到已有防线，还是让信号覆盖两侧？',
      choices: [
        { key: 'north', label: '点亮北侧引路灯', description: '后续敌群北路占 75%；射程 +8%，伤害 -8%。', outcome: '北侧灯火引走大部分追兵。南路伤员带回半枚巡林徽章，阿橙记住了第一条需要有人返回的路。', effects: { routeWeights: [3, 1], range: 1.08, damage: .92 } },
        { key: 'both', label: '把信号交给每个哨位', description: '后续敌群两路均分；伤害 +10%，射程 -8%。', outcome: '守卫们用短促灯号互相接力。伤员从两侧汇流，阿橙第一次听见整支小队报出自己的名字。', effects: { routeWeights: [1, 1], damage: 1.1, range: .92 } }
      ]
    },
    whisperGrove: {
      id: 'echo_reply', atWave: 2, title: '回声想要一个回答', speaker: '古树中的回声',
      body: '“上一次，你让我们等得太久。”树洞里的声音能替守卫束住敌人，也能把树脂化成火力；每种回应都会削弱另一种力量。',
      choices: [
        { key: 'listen', label: '等她把话说完', description: '控制持续时间 +20%；伤害 -8%。', outcome: '阿橙没有打断回声。迟到三百年的暗号终于完整响起，缠绕敌人的根须也学会了多等待一瞬。', effects: { controlDuration: 1.2, damage: .92 } },
        { key: 'answer', label: '用战鼓回应她', description: '伤害 +12%；控制持续时间 -15%。', outcome: '战鼓穿过树洞，回声第一次跟上了今夜的节拍。她不再重复求救，只把渡口的暗号交给阿橙。', effects: { damage: 1.12, controlDuration: .85 } }
      ]
    },
    rootCrossing: {
      id: 'ferry_roots', atWave: 2, title: '渡口只能升起一座桥', speaker: '守碑人',
      body: '两座根桥同时承重，渡口就会崩裂。北桥适合铺开火力，南桥能聚集散落灵息；留在水中的根仍需要少量守军。',
      choices: [
        { key: 'north', label: '升起北桥', description: '后续敌群北路占 75%；射程 +10%，灵力获取 -10%。', outcome: '北桥托起长长的撤离队伍。守碑人将自己的名字刻在桥底，答应守住仍浸在水中的南根。', effects: { routeWeights: [3, 1], range: 1.1, spirit: .9 } },
        { key: 'south', label: '升起南桥', description: '后续敌群南路占 75%；灵力获取 +15%，射程 -8%。', outcome: '南桥接回失散的根息。阿橙把第一面队旗留在北岸，让迟来的巡林者知道渡口没有被放弃。', effects: { routeWeights: [1, 3], spirit: 1.15, range: .92 } }
      ]
    },
    mirrorMarsh: {
      id: 'mirror_watch', atWave: 2, title: '水中的第二支小队', speaker: '旧军旗的守卫',
      body: '水中守卫请求与你交换哨位。让他们举灯，远处敌影将无所遁形；让他们列阵，黑潮便会追着旧军旗进入南侧水道。',
      choices: [
        { key: 'lantern', label: '请旧军举灯', description: '射程 +15%；伤害 -10%。', outcome: '水底的灯一盏盏升起。旧军终于看清接替自己的人，阿橙也看清那些身影从未真正离开战场。', effects: { range: 1.15, damage: .9 } },
        { key: 'banner', label: '与旧军共守南湾', description: '后续敌群南路占 80%；控制持续时间 +15%，灵力获取 -10%。', outcome: '旧军旗在南湾重新展开。亡者拖住黑潮，活着的人接过最后一班岗，两支小队第一次拥有同一条防线。', effects: { routeWeights: [1, 4], controlDuration: 1.15, spirit: .9 } }
      ]
    },
    tideShrine: {
      id: 'last_lantern', atWave: 2, title: '最后一盏灯的灯芯', speaker: '守灯人',
      body: '灯芯里封着守灯人的真名。将名字念出，能压低黑潮的潮头；让灯芯继续燃烧，则能为守卫聚拢最后的灵息。',
      choices: [
        { key: 'name', label: '念出守灯人的名字', description: '后续敌人生命 -12%；灵力获取 -12%。', outcome: '“守灯人。”名字落地时，潮头退了一尺。他找回了自己的声音，把档案坐标刻进已经熄灭的灯座。', effects: { hp: .88, spirit: .88 } },
        { key: 'flame', label: '护住灯芯直到退潮', description: '灵力获取 +18%；后续敌人生命 +10%。', outcome: '小队围着最后一盏灯撑过涨潮。灯光照出祭司的人脸，他用仅存的清醒把自己的真名说给阿橙听。', effects: { spirit: 1.18, hp: 1.1 } }
      ]
    },
    drownedArchive: {
      id: 'archive_seal', atWave: 2, title: '被封住的最后一页', speaker: '档案守卫',
      body: '太阳果核的记录沉在封印下。解开封印可释放灵潮，却会损伤束缚法阵；逐字临摹则能加固法阵，但会让灵潮沉寂。',
      choices: [
        { key: 'unseal', label: '拆开水下封印', description: '橙光爆发威力 +20%；控制持续时间 -15%。', outcome: '封印裂开，太阳果核的图样浮出水面。阿橙收起被潮水浸透的原稿，连同封存它的责任一起带走。', effects: { surgePower: 1.2, controlDuration: .85 } },
        { key: 'copy', label: '逐字临摹原稿', description: '控制持续时间 +20%；橙光爆发威力 -15%。', outcome: '阿橙抄完最后一笔才离开。档案仍留在水下，第一份属于地面世界的副本却已经指向赤霞关。', effects: { controlDuration: 1.2, surgePower: .85 } }
      ]
    },
    emberPass: {
      id: 'pass_bellows', atWave: 3, title: '铠甲里的风口', speaker: '赤霞哨兵',
      body: '关门后的巨大铠甲正在吸风。开北侧风口能把热浪变成火力，开南侧风口能让灵息回流；敌人也会追随风口涌入。',
      choices: [
        { key: 'north', label: '引热浪向北', description: '后续敌群北路占 75%；伤害 +12%，射程 -10%。', outcome: '热浪涌过北关，小队压低阵线迎击。铠甲内壁露出一道锁孔，囚禁世界树的计划第一次有了形状。', effects: { routeWeights: [3, 1], damage: 1.12, range: .9 } },
        { key: 'south', label: '引灵息向南', description: '后续敌群南路占 75%；灵力获取 +15%，伤害 -8%。', outcome: '南侧风口吐出积蓄多年的灵息。锻师的旧口令随风传来，阿橙循声辨认出铠甲里面仍有人工作。', effects: { routeWeights: [1, 3], spirit: 1.15, damage: .92 } }
      ]
    },
    cinderForge: {
      id: 'forge_temper', atWave: 3, title: '太阳楔的最后一锤', speaker: '旧时代的锻师',
      body: '太阳楔只能再承受一次淬炼。锤薄楔尖，守卫能触及更远的敌人；锤实楔身，爆发便能震裂重甲。锻师将锤柄交到你手上。',
      choices: [
        { key: 'reach', label: '把楔尖锤薄', description: '射程 +15%；橙光爆发威力 -12%。', outcome: '太阳楔细得像一道光。锻师点头说，钥匙不必伤人，也可以先碰到远处那扇不肯打开的门。', effects: { range: 1.15, surgePower: .88 } },
        { key: 'impact', label: '把楔身锤实', description: '橙光爆发威力 +20%；射程 -10%。', outcome: '最后一锤震落熔炉里的黑灰。太阳楔不再有锋刃，只有足以敲醒沉睡门锁的重量。', effects: { surgePower: 1.2, range: .9 } }
      ]
    },
    ashClimb: {
      id: 'stair_reformation', atWave: 3, title: '守门人收取的代价', speaker: '天梯守门人',
      body: '“留下你最依赖的东西。”守门人指着旧阵线。阿橙可以放弃宽阔视野，改守北脊；也可以放弃充足灵息，拉开两侧哨位。',
      choices: [
        { key: 'ridge', label: '收拢阵线守北脊', description: '后续敌群北路占 80%；伤害 +10%，射程 -12%。', outcome: '守卫撤离舒适的旧哨位，在北脊重新站定。守门人让开一步：你交出的不是同伴，而是不会改变的习惯。', effects: { routeWeights: [4, 1], damage: 1.1, range: .88 } },
        { key: 'watch', label: '把哨位延伸到两侧', description: '后续敌群两路均分；射程 +15%，灵力获取 -12%。', outcome: '阿橙将储能根撤成一串远哨。最后一位守卫登上天梯时，守门人记下了整支小队，没有划掉任何名字。', effects: { routeWeights: [1, 1], range: 1.15, spirit: .88 } }
      ]
    },
    frostGate: {
      id: 'frozen_hour', atWave: 3, title: '被冻住的一刻钟', speaker: '远古树灵',
      body: '树灵掌心藏着停滞的时间。将它留在关口，敌人会更久地受制；将它还给黎明，灵潮便能在一瞬间倾泻。',
      choices: [
        { key: 'hold', label: '请时间再停一刻', description: '控制持续时间 +20%；橙光爆发威力 -15%。', outcome: '霜钟放慢，树灵终于讲完那段被打断的梦。阿橙在沉默里听见黑潮最初只是一个害怕被遗忘的声音。', effects: { controlDuration: 1.2, surgePower: .85 } },
        { key: 'release', label: '让这一刻流向黎明', description: '橙光爆发威力 +20%；控制持续时间 -15%。', outcome: '冰里的时刻一齐奔向天空。树灵不再停留于旧日，用解冻后的第一句话告诉阿橙七枚灵种的位置。', effects: { surgePower: 1.2, controlDuration: .85 } }
      ]
    },
    moonlitVault: {
      id: 'seven_voices', atWave: 3, title: '七枚灵种的节拍', speaker: '灵种合唱',
      body: '灵种们同时醒来，却唱着不同的战歌。让一枚领唱能提高小队火力；允许七种节拍并行，则能让遗库回收更多灵息。',
      choices: [
        { key: 'solo', label: '请第一枚灵种领唱', description: '伤害 +12%；灵力获取 -12%。', outcome: '第一枚灵种唱完了它未曾活过的一生。其余六枚安静伴唱，阿橙听见自己的名字出现在旧战的最后一行。', effects: { damage: 1.12, spirit: .88 } },
        { key: 'chorus', label: '让七个声音都留下', description: '灵力获取 +20%；伤害 -10%。', outcome: '七个节拍渐渐织成新的合唱。没有谁被选作唯一的答案，遗库里的旧战也第一次出现了不同的讲述。', effects: { spirit: 1.2, damage: .9 } }
      ]
    },
    rootMemory: {
      id: 'remembered_guard', atWave: 3, title: '你曾经封住的那道门', speaker: '旧日的阿橙',
      body: '旧日的自己伸出手，要将守门人的力量交还。重新承认誓言能削弱黑潮，却让灵潮沉重；接受恐惧则会让黑潮和你一同变强。',
      choices: [
        { key: 'oath', label: '重述守门人的誓言', description: '后续敌人生命 -10%；橙光爆发威力 -15%。', outcome: '阿橙念出旧誓，却在末尾加上了同伴的名字。这一次，守门人不再独自守着不许任何人回来的门。', effects: { hp: .9, surgePower: .85 } },
        { key: 'fear', label: '承认当年的恐惧', description: '橙光爆发威力 +20%；后续敌人生命 +10%。', outcome: '她握住旧日自己的手，承认那时真的害怕。记忆没有因此变轻，却终于不必再躲进黑潮。', effects: { surgePower: 1.2, hp: 1.1 } }
      ]
    },
    starfall: {
      id: 'fallen_sun', atWave: 3, title: '星火落在哪里', speaker: '阿橙',
      body: '一块太阳果核正悬在两条山脊上方。引它落向北脊，可把余火用于近战；引它落向南脊，星光将照亮更远的战线。',
      choices: [
        { key: 'north', label: '接住北脊的余火', description: '后续敌群北路占 75%；伤害 +12%，控制持续时间 -15%。', outcome: '北脊燃起一道短暂日出。阿橙从热灰里拾回果核，发现新王的伤痕与旧守卫的徽记一模一样。', effects: { routeWeights: [3, 1], damage: 1.12, controlDuration: .85 } },
        { key: 'south', label: '引星光照向南脊', description: '后续敌群南路占 75%；射程 +15%，伤害 -8%。', outcome: '星光沿南脊铺到远处，王冠的影子无处藏身。小队循着那道光找到果核，也看见了王曾试图守护的人。', effects: { routeWeights: [1, 3], range: 1.15, damage: .92 } }
      ]
    },
    sunkenCrown: {
      id: 'crown_reflection', atWave: 3, title: '王冠许诺的唯一结局', speaker: '镜中的祭司',
      body: '王冠承诺替你锁定所有敌人的未来，却会让守卫失去远望的能力。也可以立即击碎镜面，用碎光打开视野，但不再借用预言束敌。',
      choices: [
        { key: 'read', label: '读完预言，再碎王冠', description: '控制持续时间 +20%；射程 -12%。', outcome: '阿橙记下预言，再亲手打碎王冠。曾经唯一的未来变成一块残片，留在她口袋里提醒她不要替所有人决定。', effects: { controlDuration: 1.2, range: .88 } },
        { key: 'break', label: '现在就打碎倒影', description: '射程 +15%；控制持续时间 -15%。', outcome: '王冠尚未说完便碎成星点。祭司们第一次看不清明天，却终于能在每一片水面上认出不同的自己。', effects: { range: 1.15, controlDuration: .85 } }
      ]
    },
    blackTide: {
      id: 'heart_reply', atWave: 3, title: '黑潮请求一个位置', speaker: '另一个阿橙',
      body: '“别再把我赶到根系之外。”黑潮愿意收拢北侧敌影，代价是让灵息染上它的颜色；也可以先压住心跳，以更短的控制换取直接火力。',
      choices: [
        { key: 'shelter', label: '为恐惧留一道回路', description: '后续敌群北路占 80%；灵力获取 +15%，后续敌人生命 +10%。', outcome: '阿橙在阵线后留下空位。黑潮没有坐下，只把第二块果核放在那里，像一个终于愿意归家的孩子。', effects: { routeWeights: [4, 1], spirit: 1.15, hp: 1.1 } },
        { key: 'steady', label: '先稳住失控的心跳', description: '伤害 +15%；控制持续时间 -20%。', outcome: '她把手按在黑潮心口，直到两边的心跳重新分明。阿橙承诺会带它去圣坛，但这次由彼此共同决定步伐。', effects: { damage: 1.15, controlDuration: .8 } }
      ]
    },
    fiveRoots: {
      id: 'roots_alliance', atWave: 3, title: '五根圣坛向谁借火', speaker: '圣坛守灵',
      body: '五根可以共同抬起一张远望之网，也可以轮流把力量交给树心。前者分散每次攻击，后者会让离树心最远的守卫失去视野。',
      choices: [
        { key: 'weave', label: '让五根织成远望之网', description: '射程 +15%；伤害 -10%。', outcome: '五种光没有汇成同一种颜色，而是在彼此之间留下连接。黑潮第一次成为网中的一根线，终门缓缓开启。', effects: { range: 1.15, damage: .9 } },
        { key: 'pulse', label: '让五根轮流托举树心', description: '橙光爆发威力 +20%；射程 -12%。', outcome: '圣坛轮流亮起，没有一根承担全部重量。黑潮学着等待自己的节拍，再把力量送回所有根共同托住的树心。', effects: { surgePower: 1.2, range: .88 } }
      ]
    },
    eclipseBridge: {
      id: 'captain_crossing', atWave: 3, title: '队长伸出的那只手', speaker: '巡林者队长',
      body: '桥上的队长只剩影子。沿北侧牵引影子，敌群会追随记忆而来；守住南侧实体桥面，则能为灵息开路，但束缚法阵必须撤下。',
      choices: [
        { key: 'shadow', label: '沿北桥接住他的影子', description: '后续敌群北路占 75%；控制持续时间 +20%，伤害 -10%。', outcome: '阿橙握住一团没有温度的影子。队长用尚能活动的那只手，在北桥霜面写出荆棘圣堂的位置。', effects: { routeWeights: [3, 1], controlDuration: 1.2, damage: .9 } },
        { key: 'bridge', label: '守住南桥让他回来', description: '后续敌群南路占 75%；灵力获取 +18%，控制持续时间 -15%。', outcome: '小队清出南桥，给一个暂时还没有身体的人留出归途。队长笑着承诺，等圣堂安静，他会亲自走完这座桥。', effects: { routeWeights: [1, 3], spirit: 1.18, controlDuration: .85 } }
      ]
    },
    thornCathedral: {
      id: 'last_prayer', atWave: 3, title: '终止祷告的方式', speaker: '巡林者队长',
      body: '队长让你击碎自己身上的容器。可以沿祷词逐段拆开束缚，也可以积蓄灵潮一次震碎外壳；他的声音越来越轻，选择必须现在作出。',
      choices: [
        { key: 'unravel', label: '一段一段解开祷词', description: '控制持续时间 +20%；橙光爆发威力 -15%。', outcome: '阿橙接着队长的声音念完每段祷词，再将它们逐一解开。容器落地时，圣堂第一次没有回声。', effects: { controlDuration: 1.2, surgePower: .85 } },
        { key: 'shatter', label: '让灵潮震碎容器', description: '橙光爆发威力 +20%；灵力获取 -15%。', outcome: '守卫们把积蓄的光交给阿橙。容器碎裂的瞬间，她冲进散落的荆棘里，接住终于拥有重量的队长。', effects: { surgePower: 1.2, spirit: .85 } }
      ]
    },
    heartRebirth: {
      id: 'dawn_sowing', atWave: 3, title: '黎明种子需要什么', speaker: '阿橙与队长',
      body: '种子握在两人掌中。向它讲述幸存者的明天，能唤醒更长的根；向它讲述未能归来的人，能让守卫的力量更坚定，也更沉重。',
      choices: [
        { key: 'tomorrow', label: '先讲明天要做的事', description: '射程 +15%；伤害 -10%。', outcome: '队长说起要修的巡林路，阿橙说起该换的新灯芯。种子伸出第一条根，为这些尚未发生的小事留出位置。', effects: { range: 1.15, damage: .9 } },
        { key: 'names', label: '先念出未归者的名字', description: '伤害 +15%；灵力获取 -15%。', outcome: '两人轮流念出未归者的名字，直到雪地不再寂静。黎明种子的第一片叶子记住了他们，却仍朝着明天展开。', effects: { damage: 1.15, spirit: .85 } }
      ]
    },
    worldTree: {
      id: 'new_growth', atWave: 3, title: '新年轮将如何记住今天', speaker: '世界树之心',
      body: '光与影都已归来，树心问你如何留下记忆。将旧伤收进年轮，根系能更久地保护后来者；将记忆送入每一片新叶，则会迎来更强的回响。',
      choices: [
        { key: 'rings', label: '把旧伤写入年轮', description: '后续敌人生命 -10%，控制持续时间 +10%；橙光爆发威力 -20%。', outcome: '新的年轮没有抹平旧伤。每一道痕迹都成为后来者可以触摸的记忆，阿橙将巡林徽记挂在树下，替归人留下路标。', effects: { hp: .9, controlDuration: 1.1, surgePower: .8 } },
        { key: 'leaves', label: '让每片新叶讲述它', description: '橙光爆发威力 +20%，灵力获取 +10%；后续敌人生命 +15%。', outcome: '记忆散入枝叶，光与影都能在风里说话。阿橙和队长走上新的巡林路，身后的树没有替他们写定下一段故事。', effects: { surgePower: 1.2, spirit: 1.1, hp: 1.15 } }
      ]
    }
  };

  for (const decision of Object.values(decisions)) {
    for (const choice of decision.choices) {
      if (choice.effects.routeWeights) Object.freeze(choice.effects.routeWeights);
      Object.freeze(choice.effects);
      Object.freeze(choice);
    }
    Object.freeze(decision.choices);
    Object.freeze(decision);
  }
  return Object.freeze({ decisions: Object.freeze(decisions) });
});
