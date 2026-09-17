# Review Agent（测试+审核）角色契约

- 状态：已确认，细节继续完善
- 日期：2026-09-15
- 对应决策：D-009

## 目标

独立验证 Coding Agent 或 Bug Fix Agent 的实际改动是否满足已批准需求。该角色统一承担代码审查、测试设计、测试补充、测试执行和 Finding 汇总。

## 输入

- 已批准需求与验收条件；
- 已批准实施计划和 Task Graph；
- Run 的 Git baseline；
- Coding Agent 或 Bug Fix Agent Handoff；
- 当前工作树、Git status 和 Git diff；
- 项目测试规则与允许命令。

## 真实改动发现

Review Agent 必须独立执行或请求：

```text
git status
git diff --stat
git diff --name-status
git diff
```

具体命令以项目状态和权限插件配置为准。发现 Handoff 与真实 diff 不一致时，必须记录 `handoff_mismatch` Finding。

## 允许行为

- 读取和审查生产代码；
- 新增或修改测试、fixture 和测试专用配置；
- 执行测试、类型检查、lint 和诊断；
- 使用 LSP；
- 根据权限插件配置使用 `web_search`；
- 生成统一 Verification Report。

## 禁止行为

- 修改任何生产代码；
- 自行修复产品缺陷；所有生产代码问题必须生成 Finding 并交给 Bug Fix Agent；
- 更改已批准需求或计划；
- 删除、跳过或弱化失败测试以制造通过；
- 仅依据 Coding Agent 或 Bug Fix Agent Handoff 而不检查真实 diff；
- 与 Coding Agent 或 Bug Fix Agent/Fixer 并发写入。

## `implementation-handoff.json`

Coding Agent 或 Bug Fix Agent 至少应提供：

```json
{
  "planVersion": 1,
  "completedTaskIds": ["TASK-001"],
  "claimedChangedFiles": [],
  "testsAddedOrChanged": [],
  "commandsRun": [],
  "knownIssues": [],
  "deviations": [],
  "notesForVerification": []
}
```

`claimedChangedFiles` 只是声明，不是事实源。

## `verification-report.json`

至少包含：

```json
{
  "verdict": "changes_required",
  "actualChangedFiles": [],
  "handoffMismatches": [],
  "acceptanceCoverage": [],
  "testChanges": [],
  "commands": [],
  "findings": [],
  "risks": []
}
```

## Finding 分类

- `implementation_bug`：如果是 `feature` Run，返回本线 Coding Agent；如果是 `bugfix` Run，返回本线 Bug Fix Agent；
- `missing_requirement`：返回需求或人工处理；
- `plan_defect`：返回 Planner；
- `test_bug`：Review Agent 新 Attempt 修正；
- `environment_issue`：重试或等待用户；
- `handoff_mismatch`：记录并继续独立检查；
- `security_issue`：根据严重级别阻断。


## 工作流路由约束

Review Agent 不决定跨工作流路由。Orchestrator 根据当前 Run 的不可变 `workflowType` 处理 `changes_required`：

```text
feature -> Coding Agent（同一新需求工作项）
bugfix  -> Bug Fix Agent（同一修漏洞工作项）
```

绝不把新需求 Finding 创建成修漏洞工作项，除非用户以后手动创建一项新的独立修漏洞任务。
