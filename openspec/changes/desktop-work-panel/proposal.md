# Proposal

## Why

桌面端目前只有单列对话流：Agent 生成的文字、读取的文件、执行的命令输出全部挤在左侧时间线里，长会话下关键产物（刚写的文件、刚跑的命令结果）被淹没；用户也无法感知生成速度与耗时。参考 vastsa/PI-Desktop 的右侧 Work Panel 模式，补上「右侧实时预览看板 + 流式速率/耗时 + 工具卡自动折叠」，让长会话冷静可读（呼应 PRODUCT.md）。

## What Changes

- 新增右侧文件管理器（对标 PI-Desktop 文件管理器，只借鉴交互模式）：工作区文件树（懒加载 + 文件名搜索 + 大小显示），点击打开多格式预览——`md` 渲染富文本、代码/文本带行号原文、常见图片直接显示、二进制与超大文件给空态（docx/xlsx/pdf 等暂不解析，与参考实现能力对齐）。
  - Agent `write`/`edit`/`read` 完成后自动在看板打开对应文件；用户手动切换后暂停跟随，可一键恢复。
- Assistant 流式回复下方显示实时速率（`⚡ xx.x tok/s`）与已耗时；回复结束时定格为终值（`⚡ 25.0 tok/s · 150 tok / 6.0s`），写入消息元数据。
- 工具调用卡片行为变更：运行时自动展开（实时输出可见），完成后自动折叠为一行摘要；用户可随时手动展开回看全过程，手动状态不被后续更新覆盖。

## Capabilities

### New Capabilities

- `desktop-work-panel`：右侧预览看板的展示内容、切换时机、空态与开关行为。
- `desktop-stream-stats`：流式 token 速率与耗时的计算口径、展示位置与终值语义。
- `desktop-tool-collapse`：工具卡片运行/完成/手动三种展开状态的转换规则。

### Modified Capabilities

（空——`openspec/specs/` 尚无既有 capability，本次全部为新增。）

## Impact

- 仅影响 `packages/codepiddy-desktop/src/renderer/`：新增 `WorkPanel` 相关组件与样式，`App.tsx` 转录流处理补计时/计数，`ToolCallCard` 改受控折叠。主进程、RPC 协议、TUI 均不改。
- Token 计数口径复用 `.pi/extensions/tps.ts` 的 usage 累加；流式中无 provider usage 时用字符数估算（`≈ chars/4`，明确标注为估算）。
- 参考但不复制 vastsa/PI-Desktop 代码（对方 LGPL-3.0 且架构不同：Rust host + 插件市场）；只借鉴「右侧多视图 + 事件驱动刷新」的交互模式，自行实现。
