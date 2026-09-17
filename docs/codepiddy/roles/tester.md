# Tester 角色（已合并）

- 状态：已由 D-009 合并到 Verification Agent
- 当前契约：见 `roles/verifier.md`

# Tester 角色契约

- 状态：部分确认
- 日期：2026-09-15
- 对应决策：D-008

## 目标

Tester 从已批准需求和验收条件出发，独立验证实现是否正确，并通过新增或改进测试发现 Implementer 没有覆盖的问题。

## 输入

- 已批准的 `requirements.md`；
- 已批准的 `acceptance-criteria.json`；
- 已批准的实施计划和 `task-graph.json`；
- Implementer 的代码 diff 与报告；
- 项目现有测试约定和测试命令。

## 允许行为

- 读取项目代码和测试；
- 新增和修改测试文件；
- 新增和修改测试 fixture；
- 修改测试专用配置（具体边界待确认）；
- 执行测试、lint、类型检查和相关诊断；
- 生成测试报告和 Finding；
- 修正能够证明是错误的测试代码。

## 禁止行为（当前建议）

- 修改生产代码；
- 为了让测试通过而删除测试；
- 无说明地降低断言强度；
- 使用 skip、only、ignore 隐藏失败；
- 修改已批准需求或验收条件；
- 自行修复产品缺陷；
- 与其他写入型 Agent 并发执行。

## 必需输出

### `test-plan.json`

将验收条件映射到测试类型、目标文件和预期结果。

### `test-changes.diff`

记录 Tester 添加或修改的测试代码。

### `test-report.json`

建议包含：

```json
{
  "verdict": "failed",
  "acceptanceCoverage": [
    {
      "acceptanceCriteriaId": "AC-001",
      "tests": ["workflow.test.ts > blocks implementation before approval"],
      "status": "passed"
    }
  ],
  "commands": [],
  "findings": [],
  "testChanges": [],
  "flakyTests": []
}
```

## 失败分类

- `product_failure`：实现不符合需求，交给 Fixer；
- `test_failure`：测试本身错误，Tester 创建新 Attempt 修正；
- `environment_failure`：依赖、系统或工具问题；
- `flaky_failure`：结果不稳定，需要重复验证或人工处理；
- `requirement_ambiguity`：验收条件无法明确判断，返回人工或需求阶段。

## 权限

最终由 `pi-permission-system` 配置决定。CodePIddy 推荐模板允许测试路径和 Artifact 路径写入，但不代表硬编码权限。

