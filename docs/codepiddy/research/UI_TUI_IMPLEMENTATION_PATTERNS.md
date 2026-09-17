# Codex 与成熟 TUI 实现模式调研

- 状态：初步结论
- 日期：2026-09-16

## 结论

CodePIddy 应采用 Codex 式客户端布局，但内部借鉴成熟 TUI 的事件驱动和单向状态更新。不要复用终端字符 renderer，也不要构建复杂 Dashboard。

## Codex App

值得借鉴：

- Agent thread 按 Project 组织；
- 侧边栏快速切换 thread；
- 主界面以对话和执行过程为中心；
- Runtime/App Server 与 UI 分离；
- thread manager 维护独立上下文；
- UI 可以在 thread 内监督执行和处理权限。

CodePIddy 的差异仅在侧边栏层级：

```text
Codex: Project -> Thread
CodePIddy: Project -> Lane -> Work Item -> Agent
```

## Pi TUI

本地 `@earendil-works/pi-tui` 已展示这些成熟行为：

- 差分渲染；
- 同步输出避免闪烁；
- 主屏/Alt Screen renderer；
- 固定 dock + 可滚动 transcript；
- follow-end；
- 鼠标、键盘和 focus；
- Markdown、Editor、Select、Overlay；
- Tool execution 与 streaming output。

CodePIddy 不复用其 ANSI renderer，但可以沿用组件边界与滚动语义。

## Bubble Tea

核心模式：

```text
Model
Update(Event)
View(Model)
```

可借鉴：

- 所有 UI 变化来自事件；
- 副作用通过 Command 单独执行；
- View 是状态的纯投影；
- 键盘、鼠标、窗口变化和异步结果使用统一事件模型。

CodePIddy 对应：

```text
ClientStore
reduce(ClientEvent)
React/View render
CommandBus
```

## Codex CLI / Ratatui

可借鉴：

- 文本 span 和 wrapping 使用统一 helper；
- 样式语义化，而不是在业务代码中硬编码颜色；
- 组件保持简单；
- 长文本、patch 和 Tool Call 独立渲染。

## Gemini CLI / Ink

可借鉴：

- UI package 与 core package 分开；
- React component model 适合消息、工具结果和输入组件；
- Agent Core 不依赖具体 renderer。

## CodePIddy MVP 应采用的模式

1. Agent Runtime 与 GUI 解耦；
2. 结构化事件，不解析终端文本；
3. 单向数据流；
4. 每个 Agent 独立 transcript；
5. 固定底部 Composer；
6. 长列表虚拟化；
7. 流式事件合并刷新；
8. Tool Call 原位更新和折叠；
9. 用户上滚后暂停 follow-tail；
10. 权限请求与 Agent/Tool Call 强关联；
11. 键盘和鼠标都可用；
12. UI 保持 Codex 式极简。

## 不需要复制的能力

- 多 worktree 并行；
- 自动 Agent 调度；
- 复杂任务 Dashboard；
- 前端项目文档管理；
- 终端字符 renderer；
- 多 Agent 同屏拼接。
