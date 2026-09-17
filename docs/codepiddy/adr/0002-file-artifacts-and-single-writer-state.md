# ADR-0002：文件制品交接，Orchestrator 单写状态

- 状态：提议
- 日期：2026-09-15

## 背景

产品要求 Agent 通过文件传递状态。若多个 Agent 都能直接覆盖同一个状态文件，会出现并发覆盖、部分写入、伪造完成状态和无法恢复的问题。

## 决策

1. Agent 通过文件交接“制品”，但不能直接决定 Run 状态。
2. 只有 Orchestrator 可以写入状态快照和事件日志。
3. `events.jsonl` 记录不可变事件并作为事实源；`run.json` 是可从事件重建的查询快照。
4. 每个 Attempt 只能写自己的输出目录，提交后不可覆盖；重试创建新的 Attempt 目录。
5. 状态文件使用 schema version、原子替换和文件锁。
6. Agent 输出必须通过 schema/contract 校验后才能成为下一阶段输入。

## 建议目录（概念结构，位置待定）

```text
codepiddy-data/
  projects/<project-id>/
    work-items/<work-item-id>/
      request.md
      runs/<run-id>/
        run.json
        events.jsonl
        stages/<stage-id>/
          attempts/<attempt-id>/
            input-manifest.json
            output-manifest.json
            artifacts/
              analysis.md
              plan.md
              test-report.json
              review.md
            logs/
```

## 理由

- 文件保持透明、可审查和易于被 Agent 使用；
- 单写者避免 Agent 并发修改状态；
- 不可变事件支持崩溃恢复、审计和 UI 时间线；
- Attempt 不覆盖历史，便于比较修复前后结果。

## 后果

- 需要定义 schema、验证器和迁移策略；
- 文件数量会增加，需要清理与归档策略；
- 大型日志和流式事件后续可能需要 SQLite 索引，但不改变文件制品模型。
