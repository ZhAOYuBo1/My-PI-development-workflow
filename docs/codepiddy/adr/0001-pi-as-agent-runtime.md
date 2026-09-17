# ADR-0001：以 Pi 作为 Agent Runtime，而不是直接修改其 TUI

- 状态：已接受
- 日期：2026-09-15

## 背景

CodePIddy 需要类似 Codex 的图形界面、多 Agent 研发流程、流式状态、取消、恢复以及角色化 Prompt/Skill。Pi 默认提供终端 TUI，但也提供 SDK 和 RPC 嵌入接口。

## 决策

1. CodePIddy UI 与 Pi TUI 解耦。
2. 新增 CodePIddy Orchestrator，负责工作流状态、Agent 生命周期、权限、事件和 UI 数据。
3. MVP 优先使用独立 Pi 子进程的 RPC 模式运行 Agent；每个 Agent Instance 有独立 session/context。
4. UI 只与 Orchestrator 通信，不直接解析 Pi 内部 session 文件。
5. 对启动开销敏感的场景可在后续评估 Pi SDK 的进程内 `AgentSession`。
6. 不依赖 `pi-client`/`pi-server` 实验协议作为 MVP 基础；官方开发文档说明该远程 harness 集成仍是 development-only。

## 理由

- RPC 官方定位就是嵌入 IDE 与自定义 UI；
- 子进程为每个 Agent 提供更清晰的取消、崩溃和资源边界；
- Orchestrator 可将 Pi 版本变化隔离在 Adapter 中；
- 避免把 CodePIddy UI 绑定到终端渲染组件；
- 不押注尚无兼容性保证的实验 server/client 协议。

## 后果

正面：

- UI、工作流与 Agent Runtime 分层清晰；
- 可以单独替换或升级 Pi；
- 多 Agent 的运行状态更容易隔离和观察。

负面：

- 需要维护 RPC Adapter、进程生命周期和事件归一化；
- 每个 Agent 子进程有启动和内存成本；
- Extension 的部分 TUI-only UI 能力在 RPC 下不可用，必须由 CodePIddy UI 自己实现。

## 备选方案

- 直接 Fork Pi TUI：无法满足图形桌面体验，且长期维护成本高。
- 全部进程内 SDK：性能更好，但 Agent 级故障与取消边界较弱。
- 使用实验 server/client：当前协议无兼容保证，不适合作为 MVP 稳定基础。

