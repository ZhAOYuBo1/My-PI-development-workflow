# ADR-0009：Verification Agent 可以新增和修改测试

- 状态：已接受，已由 D-009 合并到 Verification Agent
- 日期：2026-09-15

## 背景

如果 Verification Agent 只能运行已有命令，它只是 Test Runner，无法独立根据需求发现遗漏、补充边界条件或构建回归测试。Verification Agent 要成为有价值的专业 Agent，需要能够产出测试代码。

## 决策

1. Verification Agent 可以新增、补充和修改测试文件。
2. Verification Agent 可以创建或修改测试 fixture 和测试专用配置。
3. Verification Agent 根据已批准需求、验收条件、实施计划和当前 diff 设计测试。
4. Verification Agent 可以运行测试、分析失败并生成结构化 Finding。
5. Verification Agent 的写入阶段不能与 Implementer 或 Fixer 并发。
6. `pi-permission-system` 的实际配置仍是最终权限依据；CodePIddy 提供建议的 Verification Agent per-agent 配置模板。
7. 测试文件每次修改都保留 Attempt、理由和 diff，不能覆盖历史。
8. Reviewer 同时审查产品代码和 Verification Agent 新增或修改的测试。

## 推荐职责划分

### Implementer

- 编写实现所需的基础单元测试；
- 确保单个 Plan Task 的最小验证通过；
- 不以自己的测试通过替代独立 Verification Agent 阶段。

### Verification Agent

- 从验收条件独立推导测试；
- 补充回归、边界、错误路径、集成和对抗性测试；
- 检查 Implementer 测试是否只覆盖快乐路径；
- 运行完整适用测试集；
- 将失败分类为产品缺陷、测试缺陷、环境问题或不稳定测试。

## 防止 Verification Agent 弱化测试

Verification Agent 在首次失败后修改测试时，必须记录：

- 修改前后的 test diff；
- 修改原因；
- 失败证据；
- 分类：`test_bug`、`requirement_clarification`、`environment_issue` 或其他；
- 修改是否降低断言强度；
- 对应验收条件是否仍被验证。

Reviewer 必须审查这些变更。不能通过删除测试、跳过测试或放宽断言来隐藏产品缺陷。

## 建议流程

```text
IMPLEMENTATION_COMPLETE
  -> TEST_DESIGN
      -> Verification Agent 补充测试
  -> TEST_EXECUTION
      -> passed -> REVIEW
      -> product_failure -> Finding -> FIXER -> TEST_EXECUTION
      -> test_failure -> Verification Agent 新 Attempt 修正测试 -> TEST_EXECUTION
      -> environment_failure -> WAITING_FOR_USER / RETRY
```

## 尚待决定

- Verification Agent 是否绝对禁止修改生产代码；
- Verification Agent 是否允许修改共享构建配置；
- 哪些路径属于测试专用写入范围。

