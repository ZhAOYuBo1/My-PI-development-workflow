# ADR-0005：MVP 使用单个写入型 Implementer 顺序执行

- 状态：已接受，已由 D-008、D-011、D-013 修正
- 日期：2026-09-15

## 背景

Task Graph 可以暴露可并行任务，但多个 Agent 同时修改同一工作树会产生覆盖、冲突、失败归因不清和测试结果不稳定。使用独立 worktree 又会引入分支协调、合并和集成测试复杂度。

## 决策

1. MVP 同一 Run 在任何时刻只运行一个写入型 Agent。实现阶段使用一个 Implementer；后续 Tester 和 Fixer 可在各自阶段顺序获得写入能力。
2. Orchestrator 按已批准 Task Graph 的依赖顺序选择下一个可执行 Task。
3. 当前写入型 Agent 完成并提交 Attempt 后，才允许启动下一个写入型 Agent 或任务。
4. Requirement Analyst、Planner、Tester 和 Reviewer 仍是独立 Agent，但 MVP 不以并行作为目标。
5. 后续版本只有在实现 worktree 隔离、写入范围冲突检测和 Integration 阶段后，才允许多个 Implementer 并行。

## 后果

正面：执行可预测，Git 状态清晰，失败容易定位，MVP 实现复杂度较低。

负面：大型任务耗时更长，暂时不能利用任务图中的并行性。


## D-013 修正

MVP 的约束不是“项目中只能存在一个任务”，而是“整个项目任意时刻只能有一个写入型 Agent Instance”。多个 Work Item 和多个只读 Agent 可以同时存在和运行。详见 `0014-project-single-writer-lock.md`。
