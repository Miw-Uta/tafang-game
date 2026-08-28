# 塔领域架构

塔系统分为四个稳定层次，内容数据和运行行为彼此独立：

1. `TowerDefinition`：不可变的塔蓝图，描述名称、数值、血脉、标签和战斗参数。
2. `TowerCatalog`：全局蓝图库。当前基础塔、九条元素路线、63 个专属分支和融合塔都会在启动时注册。
3. `Tower`：战场实体，持有位置、等级、进化阶段、冷却等可变状态，并负责移动、合成、进化和攻击生命周期。
4. `AttackPatternRegistry`：攻击策略注册表。单体、连锁、穿透、溅射、全域是独立对象，战斗循环不再认识具体模式。
5. `attackEvents`：非弹体攻击队列。近战、光束、连锁、落点范围、持续弹雨和全域阵法拥有各自的前摇、命中阶段与表现。
6. `projectiles`：仅服务远程弹幕和抛物轰炸。游戏层负责弹道、分波齐射、命中时刻和范围载荷，伤害不在开火帧瞬间结算。

`attackMode` 表示目标规则，`combat.delivery` 表示伤害如何抵达目标。两者正交，例如 `splash + bombard` 是火球落点爆炸，`splash + rain` 是区域持续降雨，`single + melee` 是近战重击。

战场编队上限与塔资产解耦：`towers` 只保存当前上场实体，普通塔灵种保存在 `reserve`，已进化塔快照保存在 `standbyReserve`。撤回和部署不会重置进化塔的 `evo`、`evolutionPath`、`evoTier` 或等级。

## 新增一座塔

通常只需向 `game.js` 的 `evolution` 内容表增加蓝图。使用现有攻击模式时，不需要修改战斗循环：

```js
star: {
  name: '星辉守卫', icon: '✦', color: '#6f78c9',
  damage: 36, rangeCells: 6, rate: .55,
  attackMode: 'chain', effect: 'weaken',
  combat: { maxTargets: 4 },
  desc: '星光在四个目标间折射'
}
```

需要全新攻击规则时，继承 `AttackPattern`，实现 `select()`，再注册到 `AttackPatternRegistry`。塔蓝图只引用策略键，符合开闭原则。

## 下一步边界

敌人对象化时只需保持塔使用的最小契约：坐标 `x/y`、路径进度 `dist`、存活标记 `dead`。伤害结算目前仍由游戏层的 `damageTarget` 负责，后续可平滑迁移为 `DamagePacket -> Enemy.receiveDamage()`，无需再次改动塔的攻击生命周期。
