# 交接文档（HANDOVER）

> 日期：2026-09-29｜分支：`main`（已设 upstream `origin/main`）｜HEAD：`aaadda3`（已 push）
> ⚠️ 工作区有**未提交**改动：v2 图标重做 + settings 齿轮修复（见“二”末尾），待审核后决定是否提交。

## 一、已完成

1. **Skill 安装**：`svg-precision-skill` 装到 `~/.config/opencode/skills/svg-precision-skill/`（ZIP 包方式，git clone 当时连不上）。
2. **桌面端工具图标集**（commit `aaadda3`，已 push 到 `origin/main`）：
   - `packages/codepiddy-desktop/src/renderer/assets/icons/*.svg`——15 个源文件（eye、terminal、file-plus、text-search、file-search、list、sparkles、plug、checklist、message-question、globe、clock、check-circle、x-circle、shield），24px 网格 / 线宽 1.7 / 圆角，经 `svg_cli.py build + validate` 15/15 通过。
   - `packages/codepiddy-desktop/src/renderer/components/tool-icons.tsx`（新建）：`ToolIcon` + `toolIconForTool` 映射。
   - `packages/codepiddy-desktop/src/renderer/components/ToolCallCard.tsx`：标题 `› name` 改为图标+名称，状态区加 clock/check-circle/x-circle 图标。
   - `packages/codepiddy-desktop/src/renderer/App.tsx`：`AppIcon` 从 16 扩展到 31。
   - `packages/codepiddy-desktop/src/renderer/styles.css`：`.tool-title/.tool-status/.tool-glyph` 对齐与状态着色。
3. **验证结果**：desktop `typecheck` 干净；vitest 24 通过，仅 `permission-settings.test.ts` 预置失败（`packages/coding-agent/dist` 从未构建，与图标无关）；Electron 实测启动正常，图标预览页见下。

## 二、构建产物位置（图标可复现源）

| 内容 | 位置 | 说明 |
|---|---|---|
| 仓库内 SVG（事实源） | `packages/codepiddy-desktop/src/renderer/assets/icons/` | 已提交，可直接用 |
| spec JSON（生成输入） | `C:\Users\zhaoy\AppData\Local\Temp\opencode\icons\specs\` | ⚠️ Temp 目录，清系统会丢；如需长期保留请拷入仓库 |
| 构建/校验/预览脚本 | `C:\Users\zhaoy\AppData\Local\Temp\opencode\icons\build_all.py`、`gen_specs.py`、`preview.html` | 重跑：`python build_all.py` |
| 预览页（浏览器打开） | `C:\Users\zhaoy\AppData\Local\Temp\opencode\icons\preview.html` | 浅色卡片 + 深色终端条 |

## 三、进行中（未动手，等指令）

- **OpenSpec change `desktop-work-panel`**（planning 完成，`openspec validate` 有效）：右侧预览看板 + 流式 tok/s 与耗时 + 工具卡自动折叠。artifacts 在 `openspec/changes/desktop-work-panel/`（proposal / 3 个 spec / design / tasks 11 项）。下一步：用户说开始后进 apply 逐任务实现。

## 二点五、未提交改动（v2 图标 + 齿轮修复，待审核）

- v2 重做 15 图标：更瘦剪影、一主一次、list 实心圆点、checklist 变剪贴板、globe 真椭圆经线；同文件名覆盖 `assets/icons/`，同步改 `tool-icons.tsx` 与 `App.tsx`（AppIcon 几何）。
- `AppIcon settings` 齿轮：老齿形手画不对称致视觉偏右，已换程序生成的 8 齿对称齿轮（外径 8、齿根 6.2、孔 r3 不变），spec 见 Temp `specs/settings.json`。
- 验证：skill 校验全过、`typecheck` 干净、renderer 已重构建、Electron 已重启（含新版）。`git status` 应显示 App.tsx + 15 SVG + tool-icons.tsx 为 Modified，未提交。

## 四、待决策

1. `openspec/` 目录未提交（远程没有）：是否把 `config.yaml` + changes 历史纳入版本管理？
2. `permission-settings.test.ts` 预置失败：构建一次 `coding-agent` 包（`dist` 缺失）即可修，是否做？
3. Temp 下的图标 spec/脚本是否迁入仓库长期保存？

## 五、常用命令（仓库根目录）

```powershell
npm install --ignore-scripts                                   # 装依赖（含 electron 二进制需另跑 node node_modules/electron/install.js）
npm run typecheck --workspace=@codepiddy/desktop               # 类型检查
npm run test --workspace=@codepiddy/desktop                    # 单测
npm run build --workspace=@codepiddy/desktop                   # 构建 main+renderer
# 启动客户端（后台，窗口直接弹出）：
Start-Process -FilePath ".\node_modules\electron\dist\electron.exe" -ArgumentList "." -WorkingDirectory ".\packages\codepiddy-desktop"
openspec status --change desktop-work-panel --json             # 看 change 进度
```

## 六、长期规则（已与用户确认）

1. 简体中文回复；技术 prose，直接简洁。
2. 后续开发走 OpenSpec 流程：propose → apply → archive；测试与文档落在产生它们的任务组内。
3. **不自动 push**，只提交到本地分支，等明确命令。
4. 每次改完必须运行验证（validate / typecheck / 单测 / 启动实测）并贴结果，等审核。
5. Git：显式路径暂存，不用 `git add -A`；commit 信息格式 `{feat,fix,docs}[(scope)]: ...`；不改 git config（身份已有：zyb）。
6. 参考但不复制 vastsa/PI-Desktop 源码（LGPL-3.0）；token 口径复用 `.pi/extensions/tps.ts`。
