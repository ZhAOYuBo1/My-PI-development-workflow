# CodePIddy 决策日志

## D-001：CodePIddy 自行实现 UI

- 日期：2026-09-15
- 状态：已确认
- 决策：CodePIddy 构建独立图形 UI，不修改 Pi TUI 作为产品界面；Pi 作为底层 Agent Runtime。
- 详见：`adr/0001-pi-as-agent-runtime.md`

## D-002：需求分析完成后由用户显式推进

- 日期：2026-09-15
- 状态：已确认，交互方式由 D-011 明确
- 决策：Requirement Analysis Agent 完成需求、计划、任务拆解和交接文档后停止。系统不自动进入编码；用户手动切换并触发 Coding Agent，代表接受当前交接内容。
- 详见：`adr/0003-mandatory-requirement-approval.md`
## D-003：独立 Planner（已由 D-011 取代）

- 日期：2026-09-15
- 状态：已取代
- 原决策：设置独立 Planner Agent 和独立计划审批。
- 当前决策：不设置独立 Planner；实施计划和任务拆解内化到 Requirement Analysis Agent，用户手动进入 Coding Agent。
- 详见：`adr/0004-planner-task-graph-and-plan-approval.md`
## D-004：MVP 每条线只有一个生产代码 Agent

- 日期：2026-09-15
- 状态：已确认，自动调度部分已由 D-011 取代
- 决策：新需求线使用一个 Coding Agent；修漏洞线使用一个 Bug Fix Agent。任务拆解是交接文档，不由 Orchestrator 自动逐项调度。用户触发对应 Agent 后，由该 Agent读取交接并完成当前工作。
- 详见：`adr/0005-sequential-implementer-for-mvp.md`
## D-005：采用 pi-permission-system

- 日期：2026-09-15
- 状态：已确认
- 决策：采用 `pi-permission-system` 作为权限配置和判定引擎，行为完全依据插件配置。CodePIddy 只负责配置 UI、审批交互与审计展示，不重复实现 Policy Evaluator。
- 详见：`adr/0006-configurable-permissions.md`

## D-006：仅提供基于 Tavily Search API 的 Web Search MCP

- 日期：2026-09-15
- 状态：已确认
- 决策：MVP 只提供搜索，不提供 fetch、extract、crawl、map 或通用浏览。实现一个最小 Tavily Search MCP，底层调用 Tavily Search API，并向 Agent 暴露稳定的 `web_search` 工具。
- 详见：`adr/0007-web-mcp-tool-wrapper.md`

## D-007：Windows MVP 暂不启用沙箱但预留执行环境接口

- 日期：2026-09-15
- 状态：已确认
- 决策：MVP 使用本地 Windows 执行环境，不承诺强隔离；Orchestrator 从第一天依赖抽象 ExecutionEnvironment，后续可增加 WSL、Docker 或远程执行后端。
- 详见：`adr/0008-defer-sandbox-with-execution-interface.md`

## D-008：测试审核角色可以补充和修改测试（已由 D-009 吸收）

- 日期：2026-09-15
- 状态：已确认并由 D-009 吸收
- 决策：测试审核角色不只是运行现有测试；它可以新增、补充和修改测试及 fixture，并执行测试、分析失败和生成 Finding。
- 影响：测试写入能力现归属于 Review Agent；所有写入型 Agent 仍严格串行。
- 详见：`adr/0009-tester-can-author-tests.md`

## D-009：合并测试与代码审核为 Review Agent

- 日期：2026-09-15
- 状态：已确认
- 决策：不设置独立 Tester 和 Reviewer，合并为 Review Agent（测试+审核）。Coding Agent 或 Bug Fix Agent 完成后生成结构化交接；Review Agent 独立检查真实 Git diff、补充或修改测试、运行测试并完成代码审核。Review Agent 严格禁止修改生产代码。
- 约束：Review Agent 不能只相信 Coding Agent 或 Bug Fix Agent 的交接清单，必须自行从 baseline/diff 确认全部改动。
- 详见：`adr/0010-combined-verification-agent.md`
## D-010：项目包含两条完全独立的开发流程

- 日期：2026-09-15
- 状态：已确认
- 决策：项目首页默认显示“新需求”和“修漏洞”两个入口卡片，两条流程拥有独立 Work Item、Run、Agent 实例和状态，不允许互相路由问题。
- 新需求线：Requirement Analysis Agent、Coding Agent、Review Agent；审核不通过时返回本线 Coding Agent。
- 修漏洞线：Bug Fix Agent、Review Agent；审核不通过时返回本线 Bug Fix Agent。
- 两条线可以复用 Review Agent 的角色定义和 Prompt，但不是同一个运行实例。
- 详见：`adr/0011-two-independent-workflows.md`
## D-011：人工切换 Agent，Planner 内化到需求分析

- 日期：2026-09-15
- 状态：已确认
- 决策：Agent 不是自动流水线节点，而是用户在工作项中手动切换和触发的独立工作面板。新需求工作项提供 Requirement Analysis、Coding、Review 三种 Agent Slot；修漏洞工作项提供 Bug Fix、Review 两种 Agent Slot。具体 Agent 实例由用户单独创建。
- 规划：不设置独立 Planner Agent。实施计划与任务拆解由 Requirement Analysis Agent 在需求澄清后完成，并写入 Coding Handoff。
- 推进：当前 Agent 完成后停止。用户手动进入下一 Agent并发送/确认预置指令，下一 Agent 读取交接文件开始工作。
- 循环：Review 不通过后也不自动启动修复；用户手动切回当前工作流自己的写代码 Agent。
- 详见：`adr/0012-manual-agent-workspace.md`


## D-012：项目固定两个工作分区，Agent 实例按需单独创建

- 日期：2026-09-15
- 状态：已确认
- 决策：每个项目固定包含“新需求”和“修漏洞”两个隔离分区。分区内可创建多个独立 Work Item；Work Item 中提供对应 Agent Slot，Agent 实例由用户按需单独创建，而不是打开项目时自动全部启动。
- Agent 模型：所有角色使用同一个 Pi Agent Runtime；差异来自 Role Profile、Prompt、Skill、权限和交接契约，不实现不同的 Agent 引擎类。
- 隔离：每个 Work Item 和 Agent Instance 有独立会话、Artifact、日志和状态路径。
- 详见：`adr/0013-project-lanes-and-agent-instances.md`

## D-013：MVP 使用项目级单写锁

- 日期：2026-09-16
- 状态：已确认
- 决策：同一项目可以创建多个新需求和修漏洞 Work Item，也可以同时运行只读 Agent；但任意时刻只能有一个会修改项目文件的 Agent Instance 持有 Project Write Lease。
- 写入角色：Coding Agent、Bug Fix Agent，以及正在新增/修改测试的 Review Agent。
- 非写入活动：需求分析、只读审核、对话、查看 Artifact 和只读代码探索不占用写锁。
- MVP 不为每个 Work Item 创建 Git worktree。
- 详见：`adr/0014-project-single-writer-lock.md`

## D-014：写锁冲突直接阻止，不设置等待队列

- 日期：2026-09-16
- 状态：已确认
- 决策：如果另一个 Agent 已持有项目写锁，新的写入型 Agent 不能启动写入，也不进入等待队列。UI 显示当前写入者；用户结束或暂停当前写入 Agent 后，手动重新触发另一个 Agent。
- 理由：产品交互本身是线性的，多个写入 Agent 同时争用属于少见误操作，不需要引入队列、自动唤醒和调度状态。
- 详见：`adr/0014-project-single-writer-lock.md`

## D-015：采用混合存储（已由 D-016 简化）

- 日期：2026-09-16
- 状态：已由 D-016 简化
- 决策：运行时、会话、日志、内部状态、审计和敏感数据只存放在 CodePIddy 用户数据目录；需求、计划、交接和审核等可共享文档可以选择同步到项目 `.codepiddy/`。
- 事实源：每类数据只能有一个权威来源；项目文档是导出/同步目标还是权威制品必须由 manifest 明确，不能双向静默覆盖。
- 详见：`adr/0015-hybrid-storage.md`

## D-016：项目文档默认共享并作为 Agent 交接事实源

- 日期：2026-09-16
- 状态：已确认
- 决策：`.codepiddy/` 不是可选导出目录，而是 CodePIddy 项目的一部分。需求、设计、编码交接和审核文档直接保存在项目目录，并由不同 Agent 读取和更新。
- 本地数据：只有 Pi session、完整聊天、日志、内部运行状态、权限审计、缓存和凭据留在 CodePIddy 用户数据目录。
- 协作：项目文档可以进入 Git，团队成员打开项目后即可读取同一套工作上下文。
- 原则：Agent 之间通过文档交接，不通过自动传递完整聊天上下文。
- 详见：`adr/0016-project-documents-as-handoff.md`

## D-017：采用 Codex 风格客户端与分层项目树

- 日期：2026-09-16
- 状态：已确认
- 决策：CodePIddy 是本地桌面客户端，整体交互结构参考 Codex。项目管理位于侧边栏项目树；每个项目默认出现“新需求”和“修漏洞”两个固定目录，目录内显示 Work Item，Work Item 内显示归属的 Agent Instance。
- 打开方式：点击 Agent 行，在中央工作区打开该 Agent 的独立对话、工具调用和结果。
- 详见：`adr/0017-codex-like-client-project-tree.md` 与 `UI_INFORMATION_ARCHITECTURE.md`。

## D-018：侧边栏使用 Project → Lane → Work Item → Agent 层级

- 日期：2026-09-16
- 状态：已确认
- 决策：侧边栏中，“新需求”和“修漏洞”目录下先显示 Work Item，再在 Work Item 下展开归属的 Agent Instance。Work Item 默认可折叠；展开后可以直接点击具体 Agent 打开中央会话。
- 理由：保持同一需求或 Bug 的 Agent、共享文档和状态聚合，避免多个工作项的 Agent 混杂。
- 详见：`adr/0017-codex-like-client-project-tree.md`。

## D-019：Work Item 只创建 Agent Slot，Agent Instance 按需创建

- 日期：2026-09-16
- 状态：已确认
- 决策：创建 Work Item 时只生成允许的 Agent Slot 占位，不创建 Pi session。用户点击某个 Slot 的“创建”后，才创建 Agent Instance、独立 session 并加载 Role Profile。
- 顺序：不严格锁死 Agent 创建顺序。前置项目文档缺失时显示警告和缺失清单，由用户决定取消或继续。
- 详见：`adr/0018-lazy-agent-creation.md`。

## D-020：每个 Agent Slot 只有一个当前长期 Agent Instance

- 日期：2026-09-16
- 状态：已确认
- 决策：一个 Work Item 的一个 Agent Slot 只维护一个当前 Agent Instance，不允许同时并列多个同角色 Agent。该实例可以长期对话、恢复、Fork 和压缩上下文。
- 重建：用户需要彻底重新开始时，可以归档当前实例并创建替代实例；历史实例保留在本地记录中，但侧边栏 Slot 只显示当前实例。
- 详见：`adr/0019-single-agent-instance-per-slot.md`。

## D-021：Work Item 是实际文件夹和隔离单元

- 日期：2026-09-16
- 状态：已确认
- 决策：侧边栏中的 `FEAT-001：增加登录功能` 或 `BUG-001：登录白屏` 使用文件夹语义。它在项目 `.codepiddy/` 中对应实际目录，并隔离共享文档、Agent 归属、状态、Handoff、Finding 和审核结果。
- Agent 边界：Work Item 内的 Agent 默认只读取本文件夹交接文档，不自动读取其他 Work Item 文档。
- 详见：`adr/0020-work-item-as-isolation-folder.md`。

## D-022：Work Item 归档完全由用户触发

- 日期：2026-09-16
- 状态：已确认
- 决策：Agent、测试结果和 Review verdict 都不能自动完成、归档或隐藏 Work Item。Work Item 一直保留在活跃列表，直到用户点击类似会话移除的归档按钮。
- 行为：归档只修改状态并从默认侧边栏隐藏；物理目录不移动、不删除，用户可以从归档列表恢复。
- 删除：永久删除是不同的高风险操作，不与侧边栏归档按钮混用。
- 详见：`adr/0021-user-controlled-work-item-archive.md`。

## D-023：归档立即执行并提供限时撤销

- 日期：2026-09-16
- 状态：已确认
- 决策：点击 Work Item 归档按钮后立即归档，不弹确认框；UI 显示限时撤销提示。归档不删除或移动物理文件，因此属于可逆低风险操作。
- 永久删除：仍位于更多菜单中，必须显示明确确认对话框。
- 详见：`adr/0021-user-controlled-work-item-archive.md`。

## D-024：Work Item 文件夹标题打开概览（已由 D-025 极简化）

- 日期：2026-09-16
- 状态：已确认
- 决策：Work Item 行的 Chevron 只负责展开/折叠 Agent；点击文件夹标题在中央区域打开 Work Item 概览；点击子 Agent 行打开该 Agent 的独立会话。
- 当前修正：不再展示项目文档、Review Finding 或 Git 仪表盘；详见 D-025。
- 详见：`adr/0022-work-item-overview-navigation.md`。

## D-025：MVP UI 保持 Codex 式极简，不展示交接文档

- 日期：2026-09-16
- 状态：已确认
- 决策：客户端前端保持 Codex 风格，侧边栏负责 Project → Lane → Work Item → Agent 导航，中央区域主要显示 Agent 对话和工具执行。`.codepiddy/` 中间交接文件不在前端做文档列表、卡片、预览器或编辑器。
- 文件使用：Agent 根据 Role Prompt 直接读取和更新当前 Work Item 文件夹；开发者需要查看时通过 IDE、文件管理器或终端打开。
- Work Item 点击：保留极简空状态/Agent 选择页即可，不构建复杂 Dashboard。
- 详见：`adr/0023-minimal-codex-like-ui.md`。

## D-026：客户端采用事件驱动、Runtime 与 UI 分离的实现

- 日期：2026-09-16
- 状态：已确认，具体桌面框架待实施选型
- 决策：CodePIddy 客户端参考 Codex 与成熟 TUI 的实现原则：Pi Agent Runtime 通过 RPC/Event Stream 与 UI 解耦；UI 使用单向状态更新，渲染侧边栏项目树、中央 Agent Transcript 和底部 Composer。
- UI 范围：不引入项目 Dashboard，重点优化长对话流、流式输出、Tool Call、权限请求、滚动和 Agent 切换。
- 详见：`adr/0024-event-driven-client-architecture.md` 与 `research/UI_TUI_IMPLEMENTATION_PATTERNS.md`。
