# Planner / Architect 角色（已内化）

- 状态：已由 D-011 内化到 Requirement Analysis Agent
- 不再作为独立 Agent 面板或独立 Pi session
- 当前职责见 `roles/requirement-analyst.md`

# Planner / Architect 角色契约

- 状态：部分确认
- 日期：2026-09-15
- 对应决策：D-003

## 职责

Planner/Architect 将“已批准需求”转换成“可执行、可验证、可审批的实施方案”。任务拆解属于 Planner 的核心输出，而不是 Requirement Analyst 或 Implementer 的职责。

## 为什么任务拆解放在 Planner

- 放在 Requirement Analyst：会把“做什么”和“怎么做”混在一起；
- 放在 Implementer：用户批准计划时还看不到真正的工作范围，审批失去意义；
- 放在 Orchestrator：确定性程序不应凭空进行技术设计；
- 放在 Planner：可以在写代码前同时审查架构、影响范围、任务依赖和验证方式。

## 默认能力

- 只读分析代码库和已批准需求；
- 识别受影响模块、接口、数据和测试；
- 产生技术方案；
- 将方案拆成有依赖关系的 Plan Task；
- 为每个 Task 指定完成条件和验证方式；
- 输出风险、回滚策略和计划外事项处理规则；
- 请求进入 `WAITING_FOR_PLAN_APPROVAL`。

## 禁止行为

- 修改产品代码或测试代码；
- 在需求未批准时开始规划；
- 自己批准计划；
- 将模糊的大任务直接交给 Implementer；
- 为了“看起来完整”而添加未被需求支持的功能；
- 在任务图中安排两个 Agent 同时修改重叠文件范围，除非存在明确隔离与合并策略。

## 必需输出制品

### `implementation-plan.md`

至少包含：

1. 方案概述；
2. 当前代码结构与改动点；
3. 关键设计决策；
4. 数据流和控制流；
5. 接口、状态或 schema 变化；
6. 安全与权限影响；
7. 兼容、迁移和回滚；
8. 测试与验证策略；
9. 风险与计划外事项处理。

### `task-graph.json`

示例：

```json
{
  "schemaVersion": 1,
  "planVersion": 1,
  "tasks": [
    {
      "id": "TASK-001",
      "title": "建立工作流状态类型",
      "goal": "定义 Run、Stage 和 Attempt 的状态契约",
      "requirementIds": ["REQ-003"],
      "acceptanceCriteriaIds": ["AC-004"],
      "dependsOn": [],
      "preferredRole": "implementer",
      "expectedWriteScope": ["packages/orchestrator/src/workflow/**"],
      "deliverables": ["状态类型", "状态转换测试"],
      "verification": ["指定单元测试通过"],
      "risk": "medium"
    }
  ]
}
```

### `verification-plan.json`

记录每条验收条件由哪个 Task 实现、由什么测试或人工检查验证。

## 任务粒度规则

一个 Plan Task 应满足：

1. 有单一、可描述的目标；
2. 有明确输入和输出；
3. 能映射到至少一项需求或验收条件；
4. 能独立判断完成或失败；
5. 写入范围尽量明确；
6. 不包含“完成整个功能”这类无法审查的大包任务；
7. 也不拆成“打开文件”“写一行类型”这类没有独立价值的微步骤。

## 执行语义

```text
PLAN_CREATION
  -> WAITING_FOR_PLAN_APPROVAL
      -> 用户批准
          -> Orchestrator 校验 task-graph.json
          -> 冻结 planVersion
          -> 按依赖调度 Plan Task
      -> 用户退回
          -> PLAN_CREATION（新版本、新 Attempt）
```

## 执行中重新规划

Implementer 如果发现以下情况，不能静默改变计划：

- 需要修改计划外的关键模块；
- 发现已批准需求无法按当前方案完成；
- 需要新增依赖、迁移或破坏兼容性；
- Task 的验收方式不可执行；
- 任务依赖关系错误。

它应输出 `plan-change-request.json`。Orchestrator 暂停受影响任务并重新调度 Planner。是否需要用户再次批准，取决于变更是否影响范围、架构、风险或验收条件；默认需要批准。

## 尚待确认

- MVP 的 Plan Task 是单 Implementer 顺序执行，还是允许多个 Implementer 并行；
- 一个 Task 是否对应一个全新 Pi session，还是同一角色在多个 Task 之间保持上下文；
- 用户允许“小型无风险计划修订”自动批准的阈值。

