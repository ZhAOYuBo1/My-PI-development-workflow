# ADR-0004：Planner 产出任务图，计划批准后才能调度

- 状态：已由 ADR-0012 取代
- 日期：2026-09-15

## 背景

需求文档回答“要做什么”，但不能直接作为代码执行清单。CodePIddy 需要确定技术方案、任务边界、依赖和验证方式，同时确保 Implementer 不在执行阶段自行扩展范围。

## 决策

1. 需求批准后启动独立 Planner/Architect。
2. Planner 同时产出实施方案、任务图和验证计划。
3. 任务拆解是 Planner 阶段的一部分，不单独设置一个 LLM 角色。
4. Planner 不修改代码，也不能批准自己的计划。
5. 用户必须批准完整计划版本。
6. 只有计划批准后，Orchestrator 才将 Task Graph 实例化并调度。
7. Implementer 可以维护 Task 内部临时 checklist，但不能改变已批准范围、依赖和验收映射。
8. 发现计划错误或计划外工作时，必须提出 Plan Change Request，并根据影响重新规划和审批。

## 理由

- 用户在代码修改前能看到真实工作范围；
- 技术设计与实现职责分离；
- Task Graph 可以由确定性 Orchestrator 校验和调度；
- 测试和审查可以追踪到需求、验收条件与具体 Task；
- 避免 Implementer 边做边扩大范围。

## 后果

- 新需求流程包含两个强制人工审批点；
- 需要定义任务图 schema 和计划版本；
- 执行中发现意外情况时可能回到 Planner；
- UI 需要展示方案、任务依赖、写入范围、风险和计划版本 diff。

## 取代说明

不再设置独立 Planner Agent，也不由 Orchestrator 自动调度 Task Graph。规划和任务拆解内化到 Requirement Analysis Agent 的后半段，作为文件交给用户手动触发的 Coding Agent。详见 `0012-manual-agent-workspace.md`。
