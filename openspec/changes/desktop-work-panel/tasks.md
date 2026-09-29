# Tasks

## 1. 流式速率与耗时（desktop-stream-stats）

- [x] 1.1 在 assistant 消息项补 `streamStartedAt`/`streamStats` 字段，`message_start` 打点、`message_end` 用 provider usage 校准终值，跑 `npm run typecheck --workspace=@codepiddy/desktop` 通过
- [x] 1.2 抽 `StreamStats` 展示组件（500ms 节流、`约` 估算标注），为估算函数写 vitest 单测并通过
- [ ] 1.3 消息下方接入统计行，手动验证：长回复流式显示 `⚡ 约 xx tok/s · x.xs`、结束后定格终值且刷新仍在

## 2. 工具卡自动折叠（desktop-tool-collapse）

- [x] 2.1 `ToolCallCard` 改 `auto/pinned-open/pinned-closed` 三态机（运行展、完成收、手动 pin），为状态转换写 vitest 单测并通过
- [x] 2.2 摘要行补耗时显示，跑 `npm run typecheck --workspace=@codepiddy/desktop` 通过；手动验证失败卡可 pin 住排查、新卡片仍自动收
- [x] 2.3 一轮一折：唯一折叠点作用于轮内中间过程（用户消息与最终结果常显，中间 AI 回复不再单独折叠），历史轮默认收起，中间过程行显示条数与整轮用时
- [x] 2.4 复制按钮移到正文下方左对齐
- [x] 2.5 代码块改浅色底（与终端/diff 输出一致），语言栏与工具按钮同步浅色
- [x] 2.6 为轮分组/切段/用时格式化函数写 vitest 单测并通过，`openspec validate` + typecheck + build 全绿
- [x] 2.7 新增 `caret` chevron 图标（assets/icons/caret.svg + AppIcon/ToolIcon），替换工具卡 `⌄`/`⌃` 与轮折 `›` 文本符号
- [x] 2.8 工具耗时与整轮耗时各自独立成行，显示在各自折叠行上方
- [x] 2.9 修复历史消息时间戳：会话历史 `timestamp` 是 Unix 毫秒数而非 ISO 字符串，导致旧会话永远算不出轮次耗时；统一归一化为 ISO
- [x] 2.10 折叠行精简为「chevron + N 条过程 + 整轮耗时」单行，去掉左侧竖线与冗余文案

## 3. 右侧文件管理器（desktop-work-panel，v2 方向：对标 PI-Desktop 文件管理器）

- [x] 3.1 主进程 `workspace-fs` IPC（`listWorkspaceDir`/`readWorkspaceFile`，根目录钳制 + 文本 512KB/图片 8MB 上限）+ shared 类型 + preload 暴露，为 core 读写写 vitest 单测并通过
- [x] 3.2 文件树组件（懒加载/文件名搜索/大小显示）+ 预览组件（md 复用 MessageContent、代码文本行号、图片、二进制空态），跑 typecheck 通过
- [ ] 3.3 跟随（write/edit/read 工具完成自动打开）+ 拖拽调宽（280–640px 持久化）+ 开关改图标按钮，手动验证：Agent 写文件后看板自动打开、拖拽宽度刷新保持、窄窗自动隐藏

## 4. 集成验收

- [x] 4.1 全量 `npm run test --workspace=@codepiddy/desktop` 通过（除已知 `permission-settings` 缺 dist 的预置失败外无新增失败）
- [ ] 4.2 构建并启动 Electron 实测一遍三条主路径，截图或录屏留档
