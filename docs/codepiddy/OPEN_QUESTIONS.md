# CodePIddy 待确认问题

- 状态：开放
- 创建日期：2026-09-15

## P0：不回答就无法冻结 MVP

1. CodePIddy 首版是仅 Windows 桌面应用，还是从第一天就要求 Windows/macOS/Linux？
2. [已解决：D-012] 每个项目固定有“新需求”和“修漏洞”两个类似文件夹的分区；分区内创建独立 Work Item 和 Agent Instance。
3. [已解决：D-010] “修漏洞”是独立入口，处理该入口下用户提交的明确 Bug；新需求线产生的问题留在新需求线，由 Coding Agent 修复。
4. [已解决：D-002] 新需求必须在需求分析和需求文档生成后等待用户确认；未批准不得继续。
5. [已由 D-011 修正] 不设置独立 Planner；规划和任务拆解由 Requirement Analysis Agent 在后半段生成，通过文件交给用户手动触发的 Coding Agent。
6. [已解决：D-008、D-009] 不再设置独立 Tester；由 Verification Agent 补充/修改测试、运行测试并完成代码审查。
7. [已解决：D-009、D-010] Review Agent 合并测试与审核，可以修改测试，但严格禁止修改生产代码。
8. [部分解决：D-009、D-010] Review Agent 统一产出 Finding；feature Run 返回本线 Coding Agent，bugfix Run 返回本线 Bug Fix Agent。Finding 的批处理策略仍待确认。
9. 每个循环最多允许几次？达到上限后是失败终止还是请求人工介入？
10. 完成后 CodePIddy 只展示 diff，还是可以自动 commit、创建分支、创建 PR 或合并？

## P1：决定架构与安全性

11. [已解决：D-013] MVP 不使用 worktree；多个 Work Item 可以存在，但项目级 Project Write Lease 保证任意时刻只有一个写入型 Agent。
12. [部分解决：D-013] 同一项目允许多个 Work Item 和只读 Agent 同时存在/运行；写入由项目级单写锁串行。资源限额仍待实现设计。
13. [已解决：D-015] 采用混合存储：运行时与敏感数据放用户数据目录；可共享文档可选同步到项目 `.codepiddy/`。
14. 交接是否必须“文件是事实源”？建议不可变事件 `events.jsonl` 是事实源，`run.json` 只是可重建快照。
15. 谁能修改状态文件？建议只有 Orchestrator，Agent 只能写自己声明的 Artifact 目录。
16. [已解决：D-005、D-007] 权限采用 `pi-permission-system` 并完全依照插件配置；Windows MVP 暂不启用强沙箱但预留执行环境接口。
17. 首版支持哪些模型/provider？是否允许每个角色选择不同模型、思考等级和费用上限？
18. 用户是否需要实时看到每个 Agent 的完整思考过程，还是只显示消息、工具调用和阶段摘要？
19. 是否需要一键暂停/终止整个 Run，以及单独重试某个 Stage？
20. 任务在应用崩溃或电脑重启后恢复时，正在运行的命令应如何标记和处理？

## P2：角色与提示词质量

21. Requirement Analyst 使用 grill Skill 时，什么时候停止追问？必须产出哪些字段才算完成？
22. “需求分析”和“用户确认”之间是否允许多轮会话，还是 Agent 自行补全缺失信息？
23. Implementer 与 Tester 的测试职责如何划分？当前建议 Implementer 编写与实现耦合的基础单元测试，Tester 独立补充验收、回归、边界和对抗性测试。
24. Tester 的测试策略由项目已有命令自动发现，还是要求用户配置？
25. Verification Agent 的审查范围是仅本次 diff，还是还要检查受影响调用链、安全和性能？
26. Fixer 每次只修一个 Finding，还是一次处理一组同根因 Finding？
27. Prompt/Skill 更新后，旧 Run 是否继续使用启动时锁定的版本？建议锁定以保证可复现。
28. Agent 之间传递完整历史、压缩摘要，还是严格的结构化 Artifact？建议以结构化 Artifact 为主，必要时附引用。

## 当前默认提议

如无相反决定，MVP 暂按以下假设设计：

- Windows 优先，但技术栈不封死跨平台；
- 两张任务入口卡片，不是两个并行执行面板；
- Bugfix 首版只处理用户已报告的问题；
- 需求分析和实施计划后都必须有人工审批门；
- Reviewer 默认只读；Tester 可以修改测试文件；
- 单项目同一时间只允许一个写入型 Run，且实现任务由一个 Implementer 顺序执行；
- Orchestrator 是状态唯一写入者；
- Agent 通过结构化 Markdown/JSON 制品交接；
- 测试/修复/审查循环默认最多 3 次，超限转人工；
- 默认不自动合并，只展示结果并允许用户选择 commit。




## 新增开放问题

29. [已解决：D-005] 修改审批粒度和行为以 `pi-permission-system` 的实际配置为准，CodePIddy 不另设独立规则。
30. [部分解决：D-006] Web 后端固定为 Tavily Search API，并实现最小 Search MCP；API Key 存储位置和 MCP 进程生命周期仍需在实现设计中确定。
31. Web 工具是否只允许 Requirement Analyst/Planner/Verification Agent，还是 Implementer 也可使用？


32. [已解决：D-010] Review Agent 严格禁止修改生产代码；只可修改测试、fixture 和测试专用配置；生产代码问题交给 Bug Fix Agent。
33. Verification Agent 第一次运行失败后修改测试时，如何区分“修正错误测试”和“为了通过而弱化断言”？当前建议保留每次 Attempt、理由和 diff，并在最终新 Attempt 中重新检查。

34. 每条线的写代码 Agent 是一次处理 Review Report 中所有阻断 Finding，还是每修一个 Finding 就重新启动一次 Review Attempt？

35. [已解决：D-011] Planner 内化到 Requirement Analysis Agent，不再是独立 Agent。


36. Coding Agent 是一次读取全部 `task-breakdown.json` 并完成整个需求，还是用户按拆解任务逐项触发 Coding Agent？

37. [已解决：D-020] 每个 Agent Slot 只有一个当前长期 Agent Instance；可归档并替换，但不允许多个同角色实例并列显示。

38. [已解决：D-014] Project Write Lease 被占用时直接阻止并显示当前持有者；不建立等待队列、不自动重试，用户释放锁后手动再次触发。


39. [已解决：D-016] `.codepiddy/` 默认创建，项目协作文档必须共享并作为 Agent 交接事实源；session、日志和凭据仍只保存在本地。




40. [已解决：D-023] 归档点击后立即执行并提供限时“撤销”；不弹确认框。永久删除始终单独确认。

