# ADR-0012：人工驱动的 Agent 工作区

- 状态：已接受，Agent 创建方式由 D-012 补充
- 日期：2026-09-15

## 背景

此前设计把 Agent 当成由 Orchestrator 自动连续调度的流水线阶段。真实产品意图是：用户打开项目后选择“新需求”或“修漏洞”，在对应工作区内看到若干职责不同的 Agent。每个 Agent 是独立会话，用户手动切换和触发，文件负责交接。

## 决策

1. 工作流不自动连续执行，不自动启动下一 Agent。
2. 新需求 Work Item 提供三个 Agent Slot：Requirement Analysis、Coding、Review；实例由用户按需单独创建。
3. 修漏洞 Work Item 提供两个 Agent Slot：Bug Fix、Review；实例由用户按需单独创建。
4. 用户手动创建、切换 Agent Instance 并触发工作。
5. 当前 Agent 完成后生成交接文件并停止。
6. UI 可以预填下一 Agent 的启动指令，但必须由用户触发。
7. 不设置独立 Planner Agent。
8. 需求分析 Agent 在完成需求澄清后，继续生成实施计划和任务拆解，再生成 Coding Handoff。
9. Review 不通过后，用户手动切回本线写代码 Agent；系统不自动循环。
10. Orchestrator 只管理会话、文件、权限、状态展示和可恢复性，不自主决定何时启动 Agent。

## UI 结构

### 项目首页

```text
┌─────────────────────────┐  ┌─────────────────────────┐
│         新需求           │  │         修漏洞           │
│ 3 个 Agent 工作面板      │  │ 2 个 Agent 工作面板      │
└─────────────────────────┘  └─────────────────────────┘
```

### 新需求工作区

```text
[需求分析] [Coding] [测试+审核]
```

### 修漏洞工作区

```text
[Bug Fix] [测试+审核]
```

每个标签包含：

- 独立 Pi session/context；
- 对话与工具调用；
- 当前 Agent 状态；
- 输入交接文件；
- 输出交接文件；
- 权限请求；
- 用户可编辑的启动 Prompt。

## 新需求交接

Requirement Analysis Agent 输出：

```text
requirements.md
acceptance-criteria.json
implementation-plan.md
task-breakdown.json
handoff-to-coding.md
```

用户进入 Coding Agent 后，UI 可预填：

```text
请读取当前工作项的需求、验收条件、实施计划、任务拆解和交接文档，然后按计划编写代码。完成后生成交给 Review Agent 的交接文件。
```

Coding Agent 输出：

```text
implementation-handoff.json
implementation-report.md
```

用户进入 Review Agent 后，UI 可预填：

```text
请读取需求、验收条件和代码交接文档，独立检查实际 Git diff，补充或修改测试，运行测试并完成代码审核。不要修改生产代码。
```

## 修漏洞交接

Bug Fix Agent 输出：

```text
bug-fix-handoff.json
bug-fix-report.md
```

Review Agent 的启动方式与新需求线相同，但只读取当前 bugfix Work Item 的文件和状态。

## 手动推进语义

```text
Agent 完成
  -> 状态 READY_FOR_HANDOFF
  -> UI 高亮推荐的下一个 Agent
  -> 用户打开该 Agent
  -> UI 展示/预填启动指令
  -> 用户触发
  -> Agent 状态 RUNNING
```

系统可以推荐，但不能自动触发。

## Orchestrator 职责收缩

保留：

- 创建和恢复 Agent session；
- 管理 Agent 标签与当前状态；
- 记录 Handoff 和 Artifact；
- 注入当前工作项文件路径；
- 对接权限插件；
- 显示 diff、测试和审核结果；
- 记录用户触发动作。

不负责：

- 自动从一个 Agent 调度到另一个；
- 自动批准需求或计划；
- 自动执行修复循环；
- 代替用户决定下一步。

## 后果

- 产品更符合用户可控、可理解的交互；
- 多 Agent 主要用于职责和上下文隔离，而不是自动自治；
- 文件交接成为核心；
- 自动工作流复杂度显著下降；
- UI 必须把推荐动作和实际触发动作明显区分。

## D-012 补充

项目不是只存在一组固定 Agent 会话，而是固定存在两个分区。每个分区可以创建多个 Work Item；每个 Work Item 下的 Agent Instance 按需创建并隔离。所有角色共享同一个 Agent Runtime 实现。
