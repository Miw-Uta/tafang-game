# 游戏架构

## 设计目标

游戏采用“内容定义、领域规则、战局编排、表现层”四层结构。新增内容应优先注册数据或策略，不应在 `game.js` 中增加具体塔名、敌人名或关卡编号判断。

```text
game-content.js       tower/enemy definitions
       |                       |
       v                       v
ContentRegistry     TowerCatalog / EnemyCatalog
       |                       |
       +--------> GameSession <+-------- mode and level rules
                         |
                         v
                game.js application shell
                         |
                  Canvas + DOM + input
```

## 模块职责

| 模块 | 职责 | 禁止承担 |
| --- | --- | --- |
| `content-system.js` | 地图、波次、关卡、模式定义；内容目录；战局会话 | DOM、Canvas、具体游戏内容 |
| `game-content.js` | 地图路径、关卡波次、事件、敌人蓝图和成长模式 | 修改运行状态 |
| `tower-system.js` | 塔蓝图、塔实体、工厂和索敌策略 | 关卡流程和 UI |
| `synergy-system.js` | 阵营/职业羁绊定义、唯一形态计数、阶位和战斗修正 | 具体塔名、DOM 和战局流程 |
| `enemy-system.js` | 敌人实体、状态、工厂和生成导演 | 地图绘制和 UI |
| `evolution-system.js` | 进化谱系与进化决策事务 | 战斗循环 |
| `game.js` | 组装领域对象、处理输入、运行循环和表现 | 定义关卡与地图内容 |

## 页面结构

应用使用三个互斥页面，而不是把全部功能堆在战斗视图：

- `hubPage`：远征大厅，只负责模式选择和全局进度概览。
- `campaignPage`：章节地图，展示关卡地图、波次、生命和 Boss，并负责发起闯关战局。
- `battlePage`：实际战斗。地图周围只放置即时战斗操作，右侧栏只显示目标详情、当前编队、羁绊与进化情报。

世界树进度、根系和灵种仓收束在地图上方单行 `mapOperations` HUD；开波、爆发、合成、撤销和速度固定在地图边缘。右侧只保留选中目标、当前编队与羁绊信息，不承载独立成长系统。以后新增图鉴、局外养成、商店或设置，应增加新的 `app-page`，不应塞入战斗侧栏。

## 模式与关卡

`GameSession` 是一局游戏的唯一流程真相。它管理模式、关卡、地图、当前波次、生命和胜负状态。

世界树根系可在整备阶段切换，不仅影响灵种序列，也直接改变全队伤害与攻速。灵种仓不设硬容量上限，玩家通过保留、部署和合成不同等级灵种形成取舍。

- `endless`：动态生成任意波次，允许整备时切换已解锁地图；每波结束后自动进入短暂整备倒计时，也可提前开波。
- `campaign`：必须引用 `LevelDefinition`，使用有限波次和固定地图，最后一波结束即胜利；波次之间保留自动整备倒计时。

关卡的 `objectives` 仅作为内容元数据保留，当前胜负仍由基地生命与波次完成状态决定。最终波结束即完成关卡。

现有界面仍默认启动无尽模式。应用层可调用 `startMode('campaign', 'groveGate')` 启动关卡，未来的关卡选择界面只需调用这个入口。

## 新增地图

在 `game-content.js` 的 `maps` 中添加定义。路线与部署位是两套独立数据：

```js
starLake: {
  name: '星湖', icon: '✦', unlock: 8,
  desc: '水系射程提高', bonus: ['water'],
  damage: 1, range: 1.2, enemySpeed: .95, reward: 1.2,
  routeStyle: 'orthogonal',
  routes: [
    [[-30, 90], [510, 90], [510, 210], [150, 210], [150, 270], [990, 270]],
    [[-30, 450], [510, 450], [510, 330], [150, 330], [150, 270], [990, 270]]
  ],
  blockedCells: [[0, 0], [15, 8]],
  buildSlots: 'auto',
  initialSlot: [7, 3],
  ritualSite: [12, 1],
  routePlan: [{ from: 1, weights: [1, 0] }, { from: 3, weights: [2, 1] }, { from: 5, weights: [1, 1] }],
  specialSlots: [{ col: 7, row: 3, type: 'lookout' }],
  palette: { grass: '#...', roadEdge: '#...', road: '#...', accent: '#...', shrub: '#...', mote: '#...' }
}
```

注册时会校验至少存在一条包含两个点的路线。战略地图使用 `orthogonal` 路线：控制点之间必须严格水平或垂直，只在拐角 22px 范围内采样圆角，避免斜线切碎部署网格。敌人按 `routes` 分流并使用归一化路线进度索敌；当前地图要求单路有效长度不低于约 1800px。`routePlan` 按波次声明各路生成权重，权重为 0 的路线处于封锁状态。

`buildSlots: 'auto'` 会从最终采样道路自动生成安全部署格，同时排除 `blockedCells`，塔位中心与全部道路至少相距 55px。`specialSlots` 提供带取舍的战略位：`lookout` 提升射程，`conduit` 提升伤害，`rapid` 提升攻速，`spring` 提升击杀灵力；这些效果不可只做视觉标记，必须同时进入索敌、冷却、伤害和结算。`initialSlot` 应使用 `lookout`，并保证基础守卫可覆盖所有计划路线的关键段。`ritualSite` 必须是完整 3×3 塔位，用于五灵、太极和隐藏阵式。

## 新增闯关关卡

在 `levels` 中注册关卡，引用地图 ID 并声明波次：

```js
starLakeTrial: {
  name: '第四章 · 星湖', mapKey: 'starLake', startingLives: 8,
  objectives: ['survive'],
  waves: [
    { enemyCount: 18, eventKey: 'mist', roster: ['mossling', 'mireseer'] },
    { enemyCount: 1, eventKey: 'calm', boss: 'ashenStag', reward: 180 }
  ],
  rewards: { spirit: 300, unlock: 'nextLevel' }
}
```

`ContentRegistry.validate()` 会阻止关卡引用不存在的地图。波次支持数量、生命/速度倍率、生成间隔、事件、主词缀、允许出现的敌人池、指定 Boss 和奖励。

## 新增塔与敌人

塔继续通过 `TowerCatalog` 注册；新增索敌规则时实现 `AttackPattern`，新增伤害交付表现时在表现层注册对应 renderer。具体规范见 `TOWER_ARCHITECTURE.md`。

现有塔同时拥有阵营与职业标签。羁绊门槛和效果注册在 `game-content.js` 的 `synergies` 中，`SynergySystem` 按不同 `evo` 形态计数；重复塔共享羁绊效果但不会重复贡献人数。融合塔可以返回多个阵营标签，因此无需先扩充大量基础塔，就能通过分支和融合结果扩展阵容组合。

敌人蓝图集中在 `game-content.js`，由 `EnemyFactory` 创建。关卡可以用 `roster` 限定阵容或用 `boss` 指定首领；新增主动行为应注册敌人能力策略。具体规范见 `ENEMY_ARCHITECTURE.md`。

## 维护规则

1. 所有内容使用稳定的英文 ID，显示名称可以修改但 ID 不可随意变化。
2. 定义对象不可保存本局状态；生命、等级、冷却等状态只能在实体或 `GameSession` 中。
3. 领域层不读取 DOM，不调用 Canvas，不播放声音。
4. 新内容先补目录/会话测试，再接表现资源。
5. 存档只保存 ID 和 `snapshot()`，加载时重新从目录解析蓝图，避免把整份配置复制进存档。
