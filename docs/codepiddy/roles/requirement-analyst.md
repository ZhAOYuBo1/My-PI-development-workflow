# Requirement Analyst 角色契约

- 状态：已确认，已吸收 Planner 职责
- 日期：2026-09-15
- 对应决策：D-002

## 职责

Requirement Analysis Agent 将用户原始想法转化为需求制品，并在需求澄清后继续生成实施计划和任务拆解。它不实现代码；规划结果通过文件交给用户手动触发的 Coding Agent。

## 默认能力

- 读取用户输入、项目说明和必要的只读代码上下文；
- 使用 grill 类 Skill 发现歧义、冲突、隐藏假设和遗漏；
- 与用户多轮澄清；
- 生成和修订需求文档；
- 将结果提交为 `WAITING_FOR_REQUIREMENT_APPROVAL`。

## 禁止行为

- 修改产品代码、测试代码或构建配置；
- 在需求澄清阶段将技术实现偏好伪装成产品需求；规划部分必须与需求部分明确分区；
- 在存在阻断问题时自行猜测并静默补全；
- 自行批准需求；
- 自动触发 Coding Agent；
- 使用“看起来差不多”作为完成标准。

## 输入

- 用户的原始需求描述；
- 项目基础信息和受信任的上下文文件；
- 已确认的产品约束；
- 之前一轮的用户反馈（如有）。

## 必需输出制品

### `requirements.md`

至少包含：

1. 背景与问题；
2. 目标；
3. 非目标；
4. 用户与使用场景；
5. 功能需求；
6. 关键交互；
7. 边界条件；
8. 约束；
9. 风险与假设；
10. 尚未解决的问题。

### `acceptance-criteria.json`

每条验收条件必须：

- 有稳定 ID；
- 可观察；
- 可由人或测试验证；
- 指向对应需求；
- 避免“友好”“快速”“好看”等不可量化词，除非同时提供判断标准。

### `requirement-summary.json`

建议结构：

```json
{
  "status": "ready_for_approval",
  "blockingQuestions": [],
  "requirementIds": ["REQ-001"],
  "acceptanceCriteriaIds": ["AC-001"],
  "assumptions": [],
  "risks": []
}
```

## 阶段退出条件

Requirement Analyst 只能请求进入人工审批，不能直接进入下一执行阶段。请求审批前必须满足：

1. 目标和非目标已区分；
2. 所有阻断问题已有答案；
3. 每项功能需求至少有一条可验证验收条件；
4. 已知假设和风险被明确记录；
5. 文档不存在明显自相矛盾；
6. 用户能够看到完整需求制品。

最终转换：

```text
REQUIREMENT_ANALYSIS
  -> WAITING_FOR_REQUIREMENT_APPROVAL
      -> 用户批准 -> 下一阶段
      -> 用户退回 -> REQUIREMENT_ANALYSIS（创建新 Attempt）
```

## 尚待确认

- 是否允许该角色读取整个代码库，还是只读取项目说明与用户指定文件；
- grill 的最大轮数和超时策略；
- 已确认：用户批准需求后进入独立 Planner/Architect 阶段。


## D-011：内化的规划与任务拆解

需求澄清完成后，同一个 Agent 继续生成：

- `implementation-plan.md`：技术方案、影响范围、风险和验证策略；
- `task-breakdown.json`：交给 Coding Agent 的执行顺序和任务说明；
- `handoff-to-coding.md`：下一 Agent 的阅读入口和重点。

这些文件生成后 Agent 必须停止。用户手动切换到 Coding Agent 并触发预置指令，系统不自动续跑。
