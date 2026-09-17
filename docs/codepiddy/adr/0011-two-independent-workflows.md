# ADR-0011：项目包含两条完全独立的工作流

- 状态：已接受，Planner 是否保留待再次确认
- 日期：2026-09-15

## 背景

用户创建或打开一个项目后，首页默认提供两个入口卡片：“新需求”和“修漏洞”。它们代表两类独立工作，不是同一条流水线中的不同阶段，也不共享修复任务。

## 决策

1. “新需求”和“修漏洞”是两条完全独立的工作流。
2. 每条线创建自己的 Work Item、Run、Attempt、Artifact 和状态历史。
3. 新需求线审核发现的代码问题，返回新需求线自己的 Coding Agent 修复。
4. 新需求线的问题绝不转交修漏洞线的 Bug Fix Agent。
5. 修漏洞线审核发现的问题，返回修漏洞线自己的 Bug Fix Agent 修复。
6. 两条线可以复用相同的 Review Agent 角色定义、Skill 和输出 schema，但每个 Run 启动独立 Agent 实例。
7. Orchestrator 必须通过 `workflowType` 强制限制状态转换，禁止跨线跳转。

## 项目首页

```text
┌──────────────────────┐  ┌──────────────────────┐
│       新需求          │  │       修漏洞          │
│ 分析、实现、测试审核   │  │ 定位、修复、测试审核   │
└──────────────────────┘  └──────────────────────┘
```

## 新需求线

```text
FEATURE_INPUT
  -> REQUIREMENT_ANALYSIS
  -> REQUIREMENT_APPROVAL
  -> [PLANNING + PLAN_APPROVAL：Planner 待再次确认]
  -> CODING
  -> REVIEW_AND_TEST
      -> approved -> COMPLETED
      -> changes_required -> CODING（本线）
          -> REVIEW_AND_TEST（新 Attempt）
```

## 修漏洞线

```text
BUG_INPUT
  -> BUG_FIX
  -> REVIEW_AND_TEST
      -> approved -> COMPLETED
      -> changes_required -> BUG_FIX（本线）
          -> REVIEW_AND_TEST（新 Attempt）
```

## 状态约束

```typescript
type WorkflowType = "feature" | "bugfix";
```

允许转换：

```text
feature.review_failed -> feature.coding
bugfix.review_failed  -> bugfix.fixing
```

禁止转换：

```text
feature.review_failed -X-> bugfix.fixing
bugfix.review_failed  -X-> feature.coding
```

## 共享与隔离

可以共享：

- Review Agent 角色定义；
- Prompt 与 Skill；
- Review Report schema；
- 测试工具；
- 权限配置模板。

必须隔离：

- Work Item；
- Run；
- Pi session/context；
- Handoff；
- Finding；
- 循环计数；
- 完成状态；
- 代码改动归属。

## 后果

- 产品心智模型清晰；
- 两条线不会污染彼此状态；
- Review Agent 的实现可以复用；
- Orchestrator 必须把 `workflowType` 作为不可变字段；
- 新需求线需要自己的修复回路，但仍由 Coding Agent 承担。
