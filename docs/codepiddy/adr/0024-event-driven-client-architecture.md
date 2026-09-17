# ADR-0024：事件驱动的客户端架构

- 状态：已接受，具体桌面框架待实施选型
- 日期：2026-09-16

## 背景

CodePIddy 的 UI 类似 Codex：项目树负责导航，中央区域显示当前 Agent thread。成熟 TUI 和 Agent 客户端的共同点不是视觉样式，而是将 Agent Runtime、事件状态和视图渲染分离。

Pi 已提供 RPC 事件流，包括消息流、Tool Call、Bash 输出、队列、压缩、重试和 Extension UI 请求。因此客户端不应解析终端 ANSI，也不应嵌入 Pi TUI，而应直接消费结构化 RPC 事件。

## 决策

1. Pi Runtime 与桌面 UI 进程解耦。
2. 每个活跃 Agent Instance 由 Agent Host 管理对应 Pi session/process。
3. Pi RPC 事件进入统一 Event Normalizer。
4. Normalizer 将事件转换为 CodePIddy Client Event。
5. Client Event 通过单向 reducer/store 更新状态。
6. UI 只根据状态渲染，不直接修改 Runtime 内部数据。
7. UI 操作通过 Command Bus 发送给 Agent Host。
8. 切换 Agent 只切换当前选中的 transcript，不把多个 Agent 对话混合。

## 数据流

```text
Pi Process
  -> JSONL RPC Events
  -> PiRpcAdapter
  -> EventNormalizer
  -> ClientStore / Reducer
  -> UI Render

UI Action
  -> CommandBus
  -> AgentHost
  -> Pi RPC Command
```

## UI 组件

```text
AppShell
├─ Sidebar
│  ├─ ProjectNode
│  ├─ LaneNode
│  ├─ WorkItemNode
│  └─ AgentNode
└─ AgentPane
   ├─ AgentHeader
   ├─ TranscriptViewport
   │  ├─ UserMessage
   │  ├─ AssistantMessage
   │  ├─ ToolCallBlock
   │  ├─ PermissionBlock
   │  └─ StatusEvent
   └─ Composer
```

## Client Event

```typescript
type ClientEvent =
  | { type: "agent.message.started"; agentId: string; messageId: string }
  | { type: "agent.message.delta"; agentId: string; messageId: string; delta: string }
  | { type: "agent.message.completed"; agentId: string; messageId: string }
  | { type: "agent.tool.started"; agentId: string; toolCallId: string; name: string }
  | { type: "agent.tool.updated"; agentId: string; toolCallId: string; output: string }
  | { type: "agent.tool.completed"; agentId: string; toolCallId: string; result: unknown }
  | { type: "agent.permission.requested"; agentId: string; requestId: string }
  | { type: "agent.status.changed"; agentId: string; status: AgentStatus };
```

## Transcript 渲染

- Message 和 Tool Call 使用稳定 ID；
- 文本 delta 追加到已有 message，不创建大量临时节点；
- Tool update 根据 `toolCallId` 更新同一个块；
- 流式事件按动画帧或短时间窗口批量刷新；
- 长 transcript 使用虚拟列表或增量窗口；
- 当前在底部时自动跟随输出；
- 用户向上滚动后停止自动跟随；
- 显示“跳到最新”按钮；
- Composer 固定在底部，不随 transcript 滚动。

## Agent 切换

- 每个 Agent 保持独立 transcript state；
- 切换侧边栏 Agent 不终止正在运行的其他 Agent；
- 当前 Agent 滚动位置分别保存；
- 返回 Agent 时恢复原位置；
- 运行、等待权限和失败状态在侧边栏显示；
- 只有当前 Agent 的 Composer 接收输入。

## 权限请求

Pi Extension UI/RPC 请求转换为客户端原生对话框或内联块。权限请求必须绑定：

- agentInstanceId；
- workItemId；
- toolCallId/requestId；
- 请求内容；
- 当前 `pi-permission-system` 决策上下文。

用户响应通过 RPC 返回，不直接修改 Tool Call 状态。

## 不采用

- 解析 Pi TUI ANSI 输出；
- 把终端组件直接嵌入桌面 UI；
- Runtime 直接调用前端组件；
- 每个 token delta 触发完整应用重渲染；
- 将多个 Agent transcript 合并为一个消息列表；
- 在 UI 内重做 `.codepiddy/` 文档管理器。

## 与 Pi TUI 的关系

复用思想而不是 renderer：

- differential/incremental update；
- fixed input dock；
- follow-end scrolling；
- focus management；
- overlays/dialogs；
- Tool Call 折叠；
- keyboard-first navigation。

Pi TUI 源码可作为行为参考：

```text
packages/tui/
packages/coding-agent/src/modes/interactive/
```

桌面客户端仍使用自己的 GUI renderer。
