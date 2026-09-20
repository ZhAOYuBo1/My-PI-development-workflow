# CodePIddy MVP 实现规格

- 状态：可公开测试
- 日期：2026-09-20

## 产品目标

CodePIddy 是基于 Pi Runtime 的 Windows 桌面 Coding Agent。它不尝试自动调度一群 Agent，而是把程序员日常工作拆成两种可管理的工作方式，并让用户手动进入不同职责的长期 Agent。

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

## 工作流

### 新需求

```text
Grill 澄清需求
  -> OpenSpec proposal / specs / design / tasks
  -> 用户批准需求
  -> Coding Agent 实现并维护 OpenSpec tasks
  -> Review Agent 使用 OpenSpec + Git diff + tests 审核
```

### 修漏洞

```text
Bug 描述
  -> Bug Fix Agent 使用 OpenSpec 记录根因、决策和任务并完成修复
  -> Review Agent 使用 OpenSpec + Git diff + tests 审核
```

CodePIddy 不要求固定的交接文件名。Grill、OpenSpec、真实代码、Git diff 和测试结果共同构成交接事实源。

## 已实现

- Electron + React + TypeScript 客户端，Main/Preload/Renderer 隔离；
- Windows 原生窗口、液态玻璃层次、项目树、工作项和 Agent 对话界面；
- 最近项目、当前项目、窗口、草稿、滚动位置和未读状态使用 SQLite 持久化；
- 新需求与修漏洞两条独立工作流；
- Work Item 创建、重命名、归档、恢复和永久删除；
- 单 Slot 单长期 Agent Instance；
- 新需求保留人工批准门，但不校验固定 Markdown 文件结构；
- Pi RPC 流式回复、Thinking、Tool Card、中断、Retry、Compaction 和上下文容量；
- Session Tree、Fork、Clone、Reset、Resume 和 Import；
- Pi 自动重连和 RPC 超时恢复；
- 图片选择、拖放、粘贴和发送；
- 动态 Pi Slash Commands、模型选择、Thinking Level 和 Scoped Models；
- OAuth Provider 登录与退出；
- 默认允许项目内文件读取和修改，并可在设置中配置；
- 项目级单写入 Lease；
- Tavily Search-only Web Search；
- 按 Agent 类型管理 Skill；
- 内置 Grill With Docs、OpenSpec 全套 Skills 和 Open Code Review；
- 项目自定义 Skill 目录 `.codepiddy/.pi/skills`；
- 结构化错误状态、工具失败恢复和指数退避重试；
- Electron IPC 运行时校验、单实例锁、CSP、Context Isolation 和 Renderer Sandbox；
- Core、Desktop 与 Electron E2E 测试。

## 明确不做

- 自动 Agent 流水线；
- 多写入 Agent 并行；
- 后台等待队列；
- 前端文档管理器；
- 自动创建 Git worktree；
- Windows 强沙箱。

## 发布前仍可继续完善

- Windows 代码签名；
- 自动更新服务；
- 更长时间的真实 Provider 与 RPC soak test；
- 更多 Provider、Skill 和工作流模板；
- 社区反馈驱动的交互和稳定性优化。
