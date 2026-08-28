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

世界树进度、根系、灵种仓和培育方针常驻地图内的 `mapOperations` HUD；开波、爆发、合成和速度固定在地图底边。选中塔后，撤回、祭炼、灌注与主脉操作通过 `towerContextActions` 直接显示在塔旁。以后新增图鉴、局外养成、商店或设置，应增加新的 `app-page`，不应塞入战斗侧栏。

## 模式与关卡

`GameSession` 是一局游戏的唯一流程真相。它管理模式、关卡、地图、当前波次、生命和胜负状态。

- `endless`：动态生成任意波次，允许整备时切换已解锁地图。
- `campaign`：必须引用 `LevelDefinition`，使用有限波次和固定地图，最后一波结束即胜利。

现有界面仍默认启动无尽模式。应用层可调用 `startMode('campaign', 'groveGate')` 启动关卡，未来的关卡选择界面只需调用这个入口。

## 新增地图

在 `game-content.js` 的 `maps` 中添加定义。每张地图拥有自己的路径，不再只是调色板：

```js
starLake: {
  name: '星湖', icon: '✦', unlock: 8,
  desc: '水系射程提高', bonus: ['water'],
  damage: 1, range: 1.2, enemySpeed: .95, reward: 1.2,
  path: [[-30, 120], [300, 120], [300, 420], [990, 420]],
  palette: { grass: '#...', roadEdge: '#...', road: '#...', accent: '#...', shrub: '#...', mote: '#...' }
}
```

注册时会校验路径至少包含两个点。路径长度、道路碰撞、敌人移动和绘制都从当前地图读取。

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
