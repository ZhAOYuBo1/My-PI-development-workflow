# CodePIddy 术语表

- **Artifact / 制品**：一个阶段输出、供人类或后续 Agent 消费的版本化文件。
- **Attempt / 尝试**：某个阶段的一次实际执行；失败重试会创建新 Attempt，而不是覆盖旧记录。
- **Finding / 发现项**：测试或审查发现的具体问题，具有证据、严重级别和处理状态。
- **Handoff / 交接**：一个 Agent 通过约定格式的 Artifact 将上下文传给下一 Agent。
- **Orchestrator / 编排器**：唯一有权推进状态机、启动 Agent、处理重试和汇总事件的确定性程序。
- **Project / 项目**：用户打开的本地代码仓库。
- **Run / 运行**：一项 Work Item 按某个 Workflow Definition 执行的实例。
- **Stage / 阶段**：工作流中有明确输入、输出和完成条件的一步。
- **Work Item / 工作项**：一项新需求或缺陷修复任务。
- **Workflow Definition / 工作流定义**：描述阶段、转换、角色、权限和门槛的版本化配置。
- **Agent Role / Agent 角色**：职责、提示词、Skill、工具和权限的定义。
- **Agent Instance / Agent 实例**：角色在某次 Attempt 中启动的 Pi 会话或进程。
- **Approval Gate / 审批门**：必须等待人类确认才能继续的状态。
- **Loop Budget / 循环预算**：允许测试/修复/审查回路执行的最大次数、时间或费用。
- **Source of Truth / 事实源**：发生冲突时具有最终权威的数据记录。
- **Lane / 工作分区**：项目内固定的“新需求”或“修漏洞”分类，类似文件夹。
- **Agent Slot / Agent 位置**：某个 Work Item 下用于创建特定角色 Agent 的位置。
- **Role Profile / 角色配置**：作用于统一 Pi Agent Runtime 的 Prompt、Skill、权限和输入输出契约。
- **Project Write Lease / 项目写租约**：保证共享工作树任意时刻只有一个 Agent Instance 修改项目文件的独占租约。

- **Runtime Store / 运行时存储**：位于 CodePIddy 用户数据目录，保存 session、状态、日志、审计、锁和内部数据。
- **Shared Document Store / 共享文档存储**：项目内可选 `.codepiddy/`，保存适合进入 Git 的需求、计划和审核文档。
- **Storage Authority / 存储权威源**：某类数据发生冲突时具有最终解释权的唯一存储位置。
