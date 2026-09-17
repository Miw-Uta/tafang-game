# Steam 商店胶囊候选

游戏标题：甜橙谷 · 黑潮纪事。以下为四种本地候选图，尚未上传或通过 Steam 审核。Steam 发行账户尚未建立。

| 用途 | 像素尺寸 | PNG 文件 |
| --- | --- | --- |
| header | 920 × 430 | [header-capsule-920x430.png](header-capsule-920x430.png) |
| small | 462 × 174 | [small-capsule-462x174.png](small-capsule-462x174.png) |
| main | 1232 × 706 | [main-capsule-1232x706.png](main-capsule-1232x706.png) |
| vertical | 748 × 896 | [vertical-capsule-748x896.png](vertical-capsule-748x896.png) |

仅使用仓库原创场景 `resources/scenes/frontier.svg` 与本地 Noto Sans SC 字体（许可：`resources/vendor/noto-LICENSE`）；没有下载图片，也未使用五张角色图。画面文字仅包含游戏标题。

尺寸依据 [Steamworks 标准商店图形资产文档](https://partner.steamgames.com/doc/store/assets/standard)，2026-09-17 核对。小胶囊使用独立的大字构图；上传前仍须在实际商店预览检查缩图可读性。

重建：Node.js 22.12+，设置 `PLAYWRIGHT_MODULE` 与 `CHROMIUM_EXECUTABLE`（或 `PLAYWRIGHT_BROWSERS_PATH`），运行 `node scripts/build-store-assets.js`。字体和 SVG 从磁盘嵌入后以 Chromium 栅格化，不依赖在线字体。

源图 SHA-256：`7b5bb2048aa1a1619ace7fd2e8e405f8a29d4fff429a84ebbee3c0f2dd92ed67`。
