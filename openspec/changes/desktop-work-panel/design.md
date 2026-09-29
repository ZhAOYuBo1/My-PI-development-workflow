# Design

## Context

- 渲染进程 `App.tsx` 已有完整事件管线：`message_start` 建空 assistant 项（`status: "streaming"`，约 1805 行），`message_update/text_delta` 追加文本（约 1829 行），`message_end` 定稿（约 1891 行）。计时/计数可完全在 renderer 内完成，无需改主进程与 RPC。
- `ToolCallCard` 当前 `useState(false)` 起始即折叠，无运行/完成区分；`Output` 已区分 `terminal`/`diff` 渲染，可直接复用为看板预览体。
- Token 真值只在 `message_end` 的 provider `usage` 里；流式中途只有字符增量。`.pi/extensions/tps.ts` 已验证 `output/elapsed` 口径。
- 参考 vastsa/PI-Desktop `components/workpanel/`（`WorkPanel` 宿主 + `FilesTab`/`ReviewTab`/`SubagentTranscriptTab`/`PluginViewTab`）：借鉴“宿主 + 视图 Tab + 事件驱动刷新”模式，不引入其插件机制。

## Goals / Non-Goals

**Goals：**

- 右侧看板与左侧时间线同源（同一份 transcript/tool 事件），零新数据源。
- 速率/耗时纯前端派生，`message_end` 用 usage 校准终值。
- 折叠行为改动局限在 `ToolCallCard` 内部状态机，不改 `App.tsx` 数据流。

**Non-Goals：**

- 不做插件化视图、不可调布局拖拽、不做跨会话持久化看板内容。
- 不改 TUI；不改 `.pi/extensions/tps.ts`（TUI 侧统计保持独立）。

## Decisions

1. **看板数据源 = 主进程 fs 直读 + tool 事件触发自动打开。** 目录树与文件内容走新增 `workspace-fs` IPC（`listWorkspaceDir`/`readWorkspaceFile`，根目录钳制在项目内）；`write/edit/read` 工具完成时只传路径、由看板按路径打开，保证"所见即最新磁盘内容"。理由：文件管理器必须反映工作区真实状态；备选（沿用旧三视图的事件 text 投影）只能看到工具结果快照，否决。
2. **预览只做 PI-Desktop 支持的四种：md 渲染 / 文本代码行号 / 图片 / 空态。** md 复用 `MessageContent`（富文本 + 代码块）；代码高亮不引入 shiki 等新依赖，首版用等宽行号原文；图片走主进程 base64 dataUrl（8MB 上限）；二进制与超限文件（文本 512KB）显示空态。docx/xlsx/pdf 均归入"无法预览"空态——PI-Desktop 同样不支持，不做 office 解析。理由：零新依赖、与参考实现能力对齐。
3. **速率显示节流 500ms，计数用 `chars/4` 估算并标“约”。** 理由：`text_delta` 高频 setState 已存在，速率文本走同一节流避免额外渲染；中文场景下 4 偏保守，宁可低估不夸大，且 `message_end` 有 usage 即校准。
4. **折叠状态机：`auto | pinned-open | pinned-closed`。** 运行中默认展开、完成默认折叠；任何一次手动点击即进入 pinned，后续事件不再改它。理由：满足“自动收起 + 随时回看”且规则一条，无配置项。
5. **看板宽度内部 state + 拖拽柄，280–640px 钳制，localStorage 持久化。** 开关按钮用 header 的 `IconButton` + 新增 `panel` 图标（v3 风格）， active 态高亮。理由：开关是高频操作，文字按钮占行高且丑；宽度状态放 `WorkPanel` 内部，隐藏卸载后由 localStorage 恢复。

## Risks / Trade-offs

- [估算速率与真值偏差] → 终值必用 usage 校准；流式读数统一带“约”，不承诺精确。
- [看板与时间线抢注意力] → 默认跟随最新产物，但一切换即锁定，需显式点“跟随”恢复；首次实现若打扰可再加“仅失败时推送”开关（非本次范围）。
- [App.tsx 单体 5000+ 行继续膨胀] → 看板/统计拆独立组件文件（`components/WorkPanel.tsx`、`components/StreamStats.ts(x)`），`App.tsx` 只加数据源装配。
- [参考项目 LGPL-3.0] → 只借鉴交互模式，所有代码自行编写，不复制其源码。

## Migration Plan

纯新增 UI + 局部行为变更，无数据迁移。回滚 = 还原 renderer 三个文件。分三批落地：统计行 → 折叠状态机 → 看板，每批独立可验收。

## Open Questions

- 无。速率口径、Tab 范围、状态机均已定；若评审要砍范围，优先砍“终端 Tab”（bash 输出时间线内本就完整）。
