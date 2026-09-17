# CodePIddy 领域模型

- 状态：草案
- 创建日期：2026-09-15

## 核心实体

### Project

用户打开的代码仓库。记录路径、Git 状态、技术栈、信任状态和 CodePIddy 配置。


### Lane / 工作分区

项目内固定的工作类别，MVP 只有 `features`（新需求）和 `bugs`（修漏洞）。Lane 类似文件夹，包含多个相互隔离的 Work Item。

### Agent Slot

Work Item 中可创建某类 Agent 的位置，例如 Coding Slot 或 Review Slot。Slot 定义允许的 Role Profile，但不是实际运行会话。

### Role Profile

同一个 Pi Agent Runtime 的角色配置，包含 Prompt、Skill、工具、权限配置、输入 Artifact 选择器和输出契约。

### Work Item

一次有明确目标的研发任务。首版类型：`feature`（新需求）或 `bugfix`（修漏洞）。

### Workflow Definition

某类 Work Item 的阶段、允许转换、角色、重试和审批策略的版本化定义。

### Run

Workflow Definition 在一个 Work Item 上的一次具体执行。Run 有唯一 ID、状态、当前阶段和事件历史。

### Stage

工作流中的确定性步骤，例如需求分析、实现、测试、修复、审查。Stage 可多次 Attempt。

### Attempt

某一 Stage 的一次运行。记录 Agent 配置、模型、Prompt/Skill 版本、输入制品、输出制品、工具调用摘要、耗时、用量和退出原因。


### Implementation Plan

Planner 针对已批准需求生成的版本化技术方案，包含设计决策、影响范围、风险、验证策略和 Task Graph。只有用户批准的版本才能进入实现。

### Plan Task

Implementation Plan 中的最小可调度工作单元。每个 Task 必须包含稳定 ID、目标、依赖、对应需求/验收条件、预期修改范围、执行角色和验证方法。

### Task Graph

由 Plan Task 组成的有向无环图（DAG）。依赖决定执行顺序；只有没有未完成前置依赖的 Task 才能进入调度。

### Agent Role

职责和权限集合，而不是一个永久人格。定义目标、允许工具、读写权限、输出契约和升级条件。

### Agent Instance

Agent Role 在某个 Attempt 中的实际 Pi session/process。


### Storage Domain

Artifact 和运行数据所属的存储域。MVP 包含 `runtime-local` 与 `project-shared`。Session、日志、锁、审计和敏感数据只能属于 `runtime-local`；可共享文档可以属于 `project-shared`。

### Artifact

Agent 交接给下一阶段的持久化制品，例如需求说明、验收条件、实施计划、补丁、测试报告或审查报告。

### Finding

Tester 或 Reviewer 提出的可追踪问题。必须包含严重级别、证据、位置、建议处理阶段和处理状态。


### Project Write Lease

项目级独占写租约。MVP 共享一个源代码工作树，因此任意时刻只有一个 Coding、Bug Fix 或处于测试写入阶段的 Review Agent Instance 可以持有该租约。Lease 具有 holder、heartbeat 和回收审计。

### Approval Gate

等待人工确认的流程节点，例如确认需求范围、批准实施计划或接受最终结果。

### Event

Run 中发生的不可变事实，例如阶段开始、Agent 退出、测试失败、人工批准或状态转换。

## 建议关系

```text
Project 1 --- 2 Lane
Lane 1 --- * WorkItem
WorkItem 1 --- * AgentSlot
AgentSlot 1 --- * AgentInstance
Project 1 --- 0..1 ProjectWriteLease
ProjectWriteLease 1 --- 1 AgentInstance : holder
WorkItem 1 --- * Run
Run 1 --- * Stage
Stage 1 --- * Attempt
Attempt * --- 1 AgentRole
Attempt 1 --- * Artifact
Attempt 1 --- * Finding
Run 1 --- * Event
WorkflowDefinition 1 --- * StageDefinition
WorkItem 1 --- * ImplementationPlan
ImplementationPlan 1 --- * PlanTask
PlanTask * --- * PlanTask : depends_on
```

## 建议运行状态

```text
DRAFT
READY
RUNNING
WAITING_FOR_USER
PAUSED
FAILED
CANCELLED
COMPLETED
```

Stage Attempt 状态：

```text
PENDING
RUNNING
SUCCEEDED
FAILED
REJECTED
CANCELLED
```

## 建议完成语义

`COMPLETED` 不等于“某个 Agent 输出了完成”。只有 Orchestrator 验证以下条件后才能转换：

1. 必需阶段成功；
2. 测试门槛满足；
3. 阻断级 Finding 已关闭；
4. Reviewer 结论通过；
5. 必需人工审批已完成；
6. 工作区和最终 diff 可解释。




