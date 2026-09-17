# ADR-0010：合并测试与代码审查为 Review Agent

- 状态：已接受
- 日期：2026-09-15

## 背景

独立 Tester 和 Reviewer 会增加角色、会话和交接次数。产品目标是让 Coding Agent 或 Bug Fix Agent 完成代码后，把改动交给后续 Agent，由该 Agent 同时补充测试、执行测试和审查代码。

## 决策

1. MVP 不设置独立 Tester 和 Reviewer。
2. Coding Agent 或 Bug Fix Agent 完成任务后生成结构化 `implementation-handoff.json` 和说明文档。
3. Review Agent 接收交接制品，但不能把它当成真实改动的唯一来源。
4. Review Agent 必须基于任务 baseline、Git status 和 Git diff 独立发现全部修改。
5. Review Agent 可以新增和修改测试、fixture 和测试专用配置。
6. Review Agent 运行测试并完成代码正确性、安全性、维护性和验收条件审查。
7. 产品代码问题输出为 Finding，交给 Bug Fix Agent；Review Agent 严格禁止自行修复产品代码。
8. Bug Fix Agent 完成后创建新的 Review Attempt，不能从旧结论直接宣布通过。
9. 所有写入型 Agent 严格串行。

## 为什么不能只相信 Coding Agent 或 Bug Fix Agent 自述

Coding Agent 或 Bug Fix Agent 可能：

- 遗漏它修改的文件；
- 忘记记录生成文件或 lockfile；
- 错误描述实际实现；
- 没有意识到命令产生了额外修改；
- 将已存在的脏工作区变化误认为自己的改动。

因此交接说明是导航信息，Git baseline/diff 才是代码改动事实依据。

## 建议流程

```text
IMPLEMENTATION
  -> IMPLEMENTATION_HANDOFF
  -> REVIEW_AND_TEST
      -> 独立发现 diff
      -> 审查实现
      -> 补充/修改测试
      -> 运行测试
      -> 汇总 Finding
      -> approved -> COMPLETED / FINAL_APPROVAL
      -> changes_required -> FIXING
          -> REVIEW_AND_TEST（新 Attempt）
```

## Review Agent 内部顺序

1. 锁定 baseline 与当前 head/worktree；
2. 读取 Coding Agent 或 Bug Fix Agent Handoff；
3. 独立计算真实文件变化；
4. 对照已批准需求、验收条件和任务图；
5. 静态审查代码；
6. 设计并补充测试；
7. 执行测试；
8. 分类失败与审查问题；
9. 生成统一 Review Report。

## 风险和缓解

### 风险：同一 Agent 审查自己新增的测试

缓解：

- 测试变更保留独立 diff；
- 失败后修改测试必须创建新 Attempt 并说明原因；
- 禁止无说明地降低断言、skip 或删除测试；
- 修复后使用新的 Review Attempt 重新检查完整 diff。

### 风险：审查和测试上下文过大

缓解：

- Handoff 使用结构化摘要；
- Task Graph 提供需求映射；
- Review Report 使用固定 schema；
- 超出上下文预算时允许同一角色分多个内部步骤，但对外仍是一个 Review Stage。

## 尚待决定

- Bug Fix Agent 一次处理一个还是一批 Finding；
- 是否在最终交付前启动全新上下文的终审 Attempt。



