# ADR-0026：移除需求批准门控，Agent 创建完全由用户控制

- 状态：已接受
- 日期：2026-09-30
- 取代：ADR-0003（需求分析后必须人工批准）

## 背景

ADR-0003 引入了一道硬门控：Coding Agent 的角色槽位在 `requirementApprovedAt` 为空时带 `blockedReason`，主进程拒绝创建，UI 显示「等待用户批准」。设计意图是防止需求分析跑偏后直接进入实现。

实际使用中这道门变成了纯粹的操作负担：

1. 它是整个编排里唯一的前置门控，却不表达任何安全或一致性约束 —— 交接本来就靠共享工作树和 OpenSpec 文档，Agent 读到什么就用什么，不需要 Host 校验；
2. 它给需求加了一道与内容无关的确认动作。用户想看代码时必须先点一次「批准需求」，而这个动作不校验任何东西，`approveRequirement` 只写一个时间戳；
3. 角色档案已经在提示词层禁止 Agent 自动串联（`role-profiles.ts`），创建权本来就在用户手上，门控是重复的。

同时确认了另一件事：授权层（`codepiddy-permission-extension`）与流程编排完全无关。它对 `workItem` / `lane` / `requirementApprovedAt` 零引用，拿到的只是一个不透明的 `agentName` 查表键。所以删掉门控不会牵连权限逻辑。

## 决策

移除 `requirementApprovedAt` 及其全部配套，角色槽位不再有任何前置条件：

- 删除 `createAgentSlots` 里的 `blockedReason` 赋值和 `AgentSlotSummary.blockedReason` 字段；
- 删除 `approveRequirement`、`ApproveRequirementInput`、IPC 通道、preload 桥和输入校验；
- 删除「批准需求」按钮、「需求已批准」徽章和对应的渲染逻辑；
- 角色档案改为「产物就绪后停止并汇报，不自行推进到实现阶段，不自动创建其他 Agent」。

保留不变的部分：

- 用户手动点击「创建 Agent」仍是唯一的创建入口，Agent 依然懒创建（ADR-0018）；
- Agent 不自动串联，也不互相请求批准；
- 工具调用审批保留在设置里，作为独立的配置中心。

## 后果

正面：

- 需求线少一次点击，Coding / Bug Fix / Review 随时可创建；
- 数据模型少一个字段，`work-item.json` 不再写入无意义的时间戳；
- 角色槽位的语义变干净：只回答「有哪些 Agent 可创建」。

负面与取舍：

- 失去了「需求分析产出被人工确认过」这个记录。用户在需求分析跑偏时可以直接创建 Coding Agent；
- `requirementApprovedAt` 从已有项目的 `work-item.json` 中消失。解析器不拒绝未知字段，旧文件可以直接继续用，不需要迁移。

## 遗留

角色边界目前只存在于提示词层。「Review 不许改生产代码」「需求分析不跑 shell」都由 `role-profiles.ts` 的自然语言约束，`codepiddy-role-guard-extension` 写好了但没有接线。移除门控后，唯一的流程级保护只剩下用户的显式操作，因此角色边界的代码化是后续独立议题。
