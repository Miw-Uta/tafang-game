(function (root, factory) {
  const domain = factory(root.StoryContent || (typeof require === 'function' ? require('./story-content.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = domain;
  root.ChroniclesDomain = domain;
})(typeof globalThis !== 'undefined' ? globalThis : window, function (content) {
  const endings = {
    sanctuary: { title:'留灯之森', subtitle:'旧伤成为归途', paragraphs:[
      '第一场春雨落下时，世界树没有长得更高。它把新根伸向旧军曾经驻守的沼泽，给那些无人记得的哨位，逐一接上灯。',
      '黑潮住进年轮里。它偶尔还会害怕，树就替它把灯留到天亮。队长在根桥旁开了一间修灯铺，门上写着：晚归的人不必敲门。',
      '阿橙成为新的巡林者。她不再问每一个影子来自哪里，只问：“你记得回家的路吗？”'
    ]},
    watch: { title:'年轮守望', subtitle:'守护也需要交班', paragraphs:[
      '世界树把漫长的黑夜收进一圈深色年轮。人们仍能摸到它，却不必再一次次活过它。黑潮与守卫各自放下武器，约定每日在根桥相见。',
      '队长写下新的守门人誓言：没有谁必须独自站到黎明。旧军第一次领到了轮休表，阿橙在最后一栏，认真填上自己的名字。',
      '清晨，第二班巡林者来接她。阿橙摘下灯，发现山后还有一条从未走过的路。'
    ]},
    chorus: { title:'万叶合唱', subtitle:'每个声音都有位置', paragraphs:[
      '新叶在一夜之间铺满谷地。有的唱起旧军的行进曲，有的记得守灯人的名字，还有一片，只会重复队长那句不太好笑的笑话。',
      '黑潮化作树下的荫凉。孩子们第一次知道，影子也能替人挡住盛夏的太阳。没有人再要求它证明自己属于这里。',
      '阿橙与队长走进新的巡林路。风从身后追上来，每片叶子都说着不同的再见。她终于听清：这座森林，从来不只有一个故事。'
    ]},
    horizon: { title:'向光而行', subtitle:'明天不必预先写好', paragraphs:[
      '世界树放飞了记忆。它们随新叶越过山脊，落在远处还没有名字的河流边。没人能保证每枚种子都会发芽，但这一次，也没人替它们决定。',
      '黑潮在树根旁学会安静地呼吸。守卫们留下足够的灯与粮食，然后把旧防线改成了一条通往山外的路。',
      '阿橙交还巡林徽记，带上一枚新种子。队长问她下一站在哪里。她看着第一次没有预言的天空，说：“走到了，再给它起名字。”'
    ]}
  };
  function summarize(records = {}) {
    const choices = {};
    for (const [key, decision] of Object.entries(content.decisions)) {
      const record = Object.prototype.hasOwnProperty.call(records,key) ? records[key] : null;
      const chosen = record && decision.choices.find(choice => choice.key === record.choice);
      if (chosen) choices[key] = chosen;
    }
    const echoes = ['groveGate','tideShrine','rootMemory','eclipseBridge','heartRebirth']
      .filter(key => choices[key]).map(key => ({ title:content.decisions[key].title, text:choices[key].outcome }));
    const complete = Boolean(choices.worldTree);
    const accepted = choices.blackTide?.key === 'shelter';
    const leaves = choices.worldTree?.key === 'leaves';
    const key = complete ? (leaves ? (accepted ? 'chorus' : 'horizon') : (accepted ? 'sanctuary' : 'watch')) : null;
    return { memories:Object.keys(choices).length, total:20, complete, echoes,
      ending:key ? { key,...endings[key],paragraphs:[...endings[key].paragraphs] } : null };
  }
  return { summarize };
});
