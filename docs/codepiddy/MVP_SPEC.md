# CodePIddy MVP 实现规格

- 状态：实施中
- 日期：2026-09-17

## 当前目标

CodePIddy 是基于 Pi Runtime 的 Windows 桌面客户端，采用 Codex 风格的侧边栏和 Agent 对话界面。

## 导航结构

```text
Project
├─ 新需求
│  └─ FEAT-001
│     ├─ 需求分析 Agent
│     ├─ Coding Agent
│     └─ Review Agent
└─ 修漏洞
   └─ BUG-001
      ├─ Bug Fix Agent
      └─ Review Agent
```

## 已实现

- Electron + React + TypeScript 客户端，Main/Preload/Renderer 隔离；
- 打开本地项目、最近项目列表、项目切换、关闭与移除记录；
- 最近项目与当前项目状态使用 SQLite 持久化，并自动迁移旧 JSON 数据；
- 可从本地 Agent Registry 和常用目录中的 `.codepiddy/manifest.json` 恢复旧项目记录；
- 显式关闭项目后不再在下次启动时自动打开；
- 自动初始化 `.codepiddy/requirements` 和 `.codepiddy/bugs`；
- 创建 FEAT/BUG Work Item 文件夹；
- 新需求线包含人工需求批准门：requirement.md、design.md、tasks.md 完整后用户才能批准并解锁 Coding Agent；
- Review Agent 只有在 implementation.md 或 fix.md 就绪后才解锁；
- 项目树展开/折叠、搜索以及不可用项目路径状态；
- Work Item 归档列表、恢复、重命名与确认后永久删除；
- 永久删除同步清理对应的本地 Agent session；
- Agent Slot 展示与单 Slot 单 Agent Instance 本地注册；默认交接提示改为显式快捷按钮，不再占用 Composer，保证 `/` 命令从空输入正常触发；
- Pi RPC 进程启动、Prompt、Abort 和事件流；
- Agent Role Prompt 注入 Work Item 路径与交接文件职责；
- Role Guard 在 Pi Tool Call 层强制职责边界：需求分析只写工作项文档，Review 只能写测试与审查文档；
- 长期 Pi session 使用 `--continue` 恢复，并通过 `get_messages` 回放历史；
- Agent Session Tree、指定用户消息 Fork、当前会话 Clone、Agent 重置归档和崩溃后自动重连；
- 项目级 Project Write Lease，冲突直接阻止；
- `pi-permission-system` 0.8.0 已 vendor 并适配 Pi 0.85.1；
- `.codepiddy/permissions.jsonc` 默认策略；
- RPC Extension UI 权限弹窗与响应；
- Tavily Search MCP，仅暴露 `web_search`；
- Tavily API Key 使用 Electron `safeStorage`；
- 模型搜索、切换与 Thinking Level 切换；
- 自定义 Provider 管理、safeStorage 密钥保存、连接测试与运行时动态注册；
- 每个 Agent Role 可保存默认模型和 Thinking Level，新启动或重置时由 Pi RPC 自动应用；
- Transcript 流式文本、Thinking 折叠块、基础 Markdown、代码块、复制、Tool Call、终端输出与 Diff UI；
- 遵循 Pi TUI 的运行状态语义：思考、生成回复、工具执行、Compaction、Retry、权限等待与 Steering 消息追加；
- 每个 Agent 的滚动位置本地持久化，并提供 jump-to-latest；
- `/` 命令菜单和 `@file` 菜单支持键盘导航，并采用与 Composer 关联的完整弹层样式；
- `/` 菜单沿用 Pi TUI 的 `BUILTIN_SLASH_COMMANDS` 元数据，并通过 Pi RPC `get_commands` 动态合并扩展命令、Prompt Template 和 Skill；命令在输入 `/` 时主动刷新，执行前再次兜底读取；
- 仅展示桌面端已完整实现的 Pi 内置命令；支持命令补全、Model 参数补全、Thinking Level 参数补全与 Extension/Prompt/Skill 执行；
- `/settings`、`/model`、`/tree`、`/thinking`、`/export`、`/copy`、`/name`、`/session`、`/fork`、`/clone`、`/new`、`/compact`、`/reload` 均连接真实行为；
- 过长 Tool Result 截断与“显示全部”；
- 项目服务、Agent Registry、写锁、最近项目 SQLite 存储和 Tavily 单元测试；
- Windows x64 NSIS 安装包、卸载程序、`.ico`、版本元数据和可运行的打包 Runtime。

## 剩余 MVP 工作

1. Transcript 图片输入与图片消息渲染；
2. Pi Session Resume/Import、OAuth Login/Logout、Scoped Models、Share 等剩余原生命令界面；
3. Electron IPC/React/Pi RPC/权限端到端测试；
4. 自动更新服务和正式代码签名。

## 明确不做

- 自动 Agent 调度；
- Work Item Dashboard；
- 前端文档管理器；
- 多写入 Agent 并行；
- 等待队列；
- worktree；
- Windows 沙箱。
