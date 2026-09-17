# 素材来源记录

更新：2026-09-17。此文件记录目前已知来源，不能代替生成服务条款、委托合同或法律意见。

| 内容 | 已知来源 | 随包许可 / 记录 |
| --- | --- | --- |
| 五张守卫原图 `resources/images/*.jpg` | 用户于 2026-09-17 确认：由本人使用即梦，通过纯文字提示 AI 原创生成，无图像参考输入 | 已记录工具为即梦；具体版本、当时服务条款、原始提示与输出记录待补全；并非已认定未经授权的外部素材 |
| `resources/scenes/*-portrait.webp` | 从上述角色原图派生 | 与原图来源关联 |
| 四张地图预览 `resources/scenes/{grove,wetland,ember,frost}.webp` | 从项目自身实际战场导出 | 场景及代码资源来源随项目记录 |
| `resources/scenes/frontier.svg` | 本轮以代码绘制的森林主视觉，无外部图像输入 | 源码 `scripts/draw-key-art.js`，可确定性重建 |
| Canvas 地表、植物、世界树与首领预警 | 本轮代码绘制及项目既有程序图形 | `world-renderer.js`、`guardian-renderer.js`、`game.js`、`boss-ui.js` |
| 音乐与环境声 | 本轮原创音序和 WebAudio 合成，无第三方采样文件 | `experience.js`；实录在 `artifacts/experience-qa/` |
| Noto Sans SC | Google / Noto 中文字体 | SIL OFL 1.1，`resources/vendor/noto-LICENSE` |
| Lucide | Lucide 图标库 | ISC，`resources/vendor/lucide-LICENSE` |
| Tween.js | Tween.js 库 | MIT，构建时从依赖复制 LICENSE 至发布包 |
| Electron | Electron 发行运行时 | 运行时自带 LICENSE 与 Chromium 第三方许可 |

商店内容调查需如实说明 AI 辅助的角色原图；最终填写以 Steamworks 后台当时的问卷字段为准。游戏没有运行时生成图片或调用 AI 服务。用户尚未建立 Steam 开发者账户及 App ID，本轮未提交商店或上传 depot。
