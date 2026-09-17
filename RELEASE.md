# 甜橙谷桌面构建与 Steam 发行记录

## 当前交付边界

工程增加了 Electron 桌面宿主、Windows / Linux x64 打包入口、完整存档导入导出、独立的图标与安全边界回归。游戏内容从本地 `dist/` 读取；游戏窗口不需要 CDN、网络服务或单独安装 Node.js。

**桌面打包能力不等于 Steam 上架完成。** 当前没有真实 Steam App ID、Steamworks SDK 接入、Steam 云、成就、商店页提交、发行审核记录、代码签名或实机兼容性认证。本文件中的未完成项不能视为已通过。

## 开发和构建

桌面工具链需要 **Node.js 22.12.0 或更高版本**。Electron 固定为 44.4.1，electron-builder 固定为 26.15.3；锁文件纳入仓库。Electron 二进制首次使用时需要下载，构建机还需要下载对应平台的 Electron 发行包和打包工具；成品运行完全离线。

```bash
npm ci
npm run test:desktop
npm run desktop

# 在 Windows 构建 Windows 版本；在 Linux 构建 Linux 版本。
npm run package:windows
npm run package:linux
```

输出目录为 `release/`。Windows 目标是便携 ZIP；解压后运行 `Orangewood.exe`。Linux 目标是 `tar.gz`；解压后运行 `./Orangewood`。Windows 上的构建会更新可执行文件的图标与版本资源；Linux 交叉构建 Windows 包时会跳过这一步，因此最终 Windows 候选版应在 Windows 上重建。Steam depot 使用解包后的应用目录，不上传 ZIP 本身。

`.github/workflows/desktop.yml` 提供手动或 `desktop-v*` 标签触发的 Windows / Linux 原生构建矩阵：使用 Node 22、运行测试、打包并保留工作流产物。该工作流已提供配置，本轮未在 GitHub Actions 服务器上执行。设置 `ORANGEWOOD_ELECTRON_DIST` 可指定已校验的 Electron 原始 ZIP，用于离线或受限网络构建。

仅生成解包目录用于检查：

```bash
npm run package:windows -- --dir
npm run package:linux -- --dir
```

打包脚本每次重新执行静态构建，将游戏、桌面宿主与最小运行时元数据放入 `artifacts/desktop-app/`，再交给 electron-builder。成品不包含 Sharp、构建工具、源码测试、开发者缓存或 npm 的运行时依赖；Tween.js 已在静态构建阶段拷入本地资源。Electron 自身许可随其发行文件保留。

Linux 成品依赖桌面发行版的标准图形系统与系统库。当前未承诺特定发行版、Wayland、SteamOS 或 ARM64 的兼容性；发布前需要实际安装并测试。不要通过禁用沙箱来规避发行环境问题。

## 桌面行为与存档

- `F11` 切换全屏；`P` 暂停、空格战技、`Esc` 取消操作由游戏处理。窗口最小尺寸为 960×640，默认 1440×960。
- 一次仅允许一个游戏实例，重复启动会聚焦已打开的窗口。
- 菜单“甜橙谷 → 导出完整存档”或 `Ctrl+Shift+S` 导出战役成绩、波前续战与设置。“导入完整存档”在确认后自动备份当前进度，重新载入游戏。
- 完整存档有版本、大小限制与 SHA-256 损坏校验。校验用于发现损坏，不是反作弊或身份认证。旧网页菜单导出的“战绩 JSON”不是完整存档，桌面导入会明确拒绝。
- 导入在新文档初始化阶段应用，避免旧页面的自动保存覆盖导入结果。写入失败会尝试恢复之前的存储内容；导入前的原始完整备份仍保存在 `save-backups/`。
- 战斗中的导出保留最近一次有效波前整备点，不保存波中敌人和弹体。

桌面存储位置固定为 Electron `appData` 下的 `Orangewood` 目录，更新版本不会改变名称：

| 系统 | 常见路径 |
| --- | --- |
| Windows | `%APPDATA%\Orangewood` |
| Linux | `$XDG_CONFIG_HOME/Orangewood`，未配置时通常为 `~/.config/Orangewood` |

菜单可打开实际存档目录。`Local Storage/` 是 Chromium 管理的持久化存储，`save-backups/` 是导入前生成的 JSON 备份。迁移设备应使用完整存档导出与导入；不要在运行时复制 Chromium 的数据库目录。当前没有配置 Steam Auto-Cloud；将 Chromium 数据库目录直接设置为云同步目录会产生冲突与损坏风险。

## 宿主安全边界

游戏运行于 `orangewood://game/index.html`。主进程只提供打包内资源；路径解析拒绝越界、外部源和 Windows 反斜杠绕过。浏览器窗口启用沙箱、上下文隔离和 Web 安全，关闭 Node 集成。预加载脚本不向网页暴露 Node、文件系统或通用 IPC；存档只允许六个明确的存储键（战役、续战、设置、入门记录、音量、指引偏好）。

权限请求、网页弹窗、嵌入 webview 和外部导航默认拒绝。请求限制与 CSP 共同限制外站连接。允许的内联样式是现有游戏布局和 Canvas 辅助控件所需，不允许内联脚本或 `eval`。主进程校验存档 IPC 的窗口、主框架、来源和请求 ID。打开目录仅使用固定的本地存档路径。

## 真正上线前的验收门槛

| 项目 | 当前状态 / 需要完成的工作 |
| --- | --- |
| Steamworks 应用 | 用户已确认尚未建立开发者账户或 App ID。需登记发行主体、税务与收款信息，创建真实 App ID。 |
| Depot 与 Launch Options | 未配置。分别建立 Windows / Linux depot，上传对应解包目录，设置正确可执行文件与操作系统限制，在测试分支安装。 |
| 商店页和分级 | 未提交。准备商店短/长描述、胶囊、截图、实机视频、内容调查问卷、语言与功能说明。商店功能勾选须与实测一致。 |
| 美术、字体、音频、代码权利 | 用户确认五张历史角色原图为本人通过纯文字提示 AI 原创生成。来源及派生关系已列入 `ASSET_PROVENANCE.md`；生成服务条款与原始输出记录待补，字体/脚本许可已随包保留。 |
| Steamworks 功能 | 未接入。购买启动、覆盖层、成就、统计、云存档、离线模式、用户切换需按产品承诺实现和验证。SDK 不是纯单机游戏上传 Steam 的必要前提，但不能宣称未实现的功能。 |
| 云存档 | 未实现。建议先建立独立 JSON 存档协议与冲突策略，再配置 Steam 云；至少测试跨设备新旧存档冲突、离线后重连、账户切换与损坏恢复。 |
| 发行包验收 | 需要在干净 Windows 与 Linux 机器上进行安装、卸载、首次启动、断网、全屏、不同 DPI、多显示器、中文路径、只读安装目录、存档迁移和 2 小时以上长时间战斗测试。 |
| 手柄 / Steam Deck | 未声明支持。手柄焦点、全部菜单可达、战场选择、虚拟键盘与小屏文字需要专门设计和实测；不能凭可启动勾选完整手柄支持或 Verified。 |
| 质量与趣味性 | 自动化可以发现规则与流程错误，不能证明“超越植物大战僵尸 / 保卫萝卜”。需独立玩家测试首局理解、持续游玩意愿、策略多样性、卡关率与可访问性，并据数据迭代。 |
| 发布审核与运营 | 未开始。完成 Steamworks 检查、测试分支验收、商店和构建审核，再设置定价、发行日、支持渠道与补丁回滚流程。 |

官方入口：[Steamworks 发布流程](https://partner.steamgames.com/doc/store/releasing)、[SteamPipe](https://partner.steamgames.com/doc/sdk/uploading)、[Steam Cloud](https://partner.steamgames.com/doc/features/cloud)、[Steam Deck](https://partner.steamgames.com/doc/steamdeck)。具体提交规则以发行账户中显示的最新要求为准。

## 本轮验证记录

`npm run test:desktop` 覆盖资源路径隔离、存档损坏/格式拒绝、原子替换、导入与自动保存顺序，以及预加载脚本仅导出游戏存储项。真实桌面打包与宿主启动的结果由本轮的 `artifacts/desktop-verification.json` 记录；没有记录为通过的目标不视为已完成发行验收。

安装兼容的 Playwright 后，可运行 `PLAYWRIGHT_MODULE=/absolute/path/to/playwright npm run verify:desktop`。该检查使用隔离的临时用户目录启动真实 Electron 窗口，进入战役、通过实际菜单和 IPC 导出/导入、验证导入前备份与重新加载后的存档，检查页面无 Node 权限并拒绝弹窗。只有系统文件选择对话框由自动化替代；游戏、预加载、存档读写与导航均使用实际实现。测试后删除临时用户目录，不触碰玩家存档。

本轮 Linux **已打包可执行文件**检查通过，页面错误为 0；Windows ZIP 的生成成功不代表 Windows 实机测试通过。打包后自动审计 `app.asar`，拒绝混入 `node_modules`、测试或 Git 数据；具体文件数由最终成品审计记录，运行时不包含 npm 开发依赖。每个平台另输出 `.build.json`，记录内容哈希、原生/交叉构建状态与成品 SHA-256。

本次 Windows 自动化工具无法解析当前 Linux 工作区路径，实际 Windows 运行测试因此未执行，仍标记为未验证。最终候选包需重新执行桌面验证，不沿用较早构建的通过记录。

素材工具链已升级为 Sharp 0.35.4；已检查 SVG 与历史 JPEG 解码及 WebP 输出。最终依赖审计记录为 `artifacts/dependency-audit.json`，本轮审计为 0 个已知漏洞；Sharp 不进入桌面成品。
