# CodePIddy 交接协议

更新日期：2026-09-20

## 核心原则

CodePIddy 不再规定 `requirement.md`、`implementation.md`、`fix.md`、`review.md` 等私有固定文件。

交接信息来自：

1. 当前 Work Item 的标题、描述和 `work-item.md`；
2. Grill With Docs 澄清出的稳定结论；
3. 当前 Work Item 对应的 OpenSpec Change；
4. OpenSpec 生成或维护的 proposal、spec、design、tasks 及扩展产物；
5. 实际 Git diff、测试和 Review Findings。

这些真实产物共同构成交接，不再由 Host 校验固定文件名和固定 Markdown 标题。

## 新需求工作方式

```text
用户原始需求
  -> Requirement Analysis Agent
       -> grill-with-docs：逐项澄清与领域建模
       -> openspec-explore / propose / update-change
       -> OpenSpec Change artifacts
  -> 用户在客户端批准需求
  -> Coding Agent
       -> openspec-apply-change / sync-specs
       -> 代码、测试、任务状态与 Git diff
  -> Review Agent
       -> open-code-review
       -> 测试、Findings、Verdict
  -> 用户决定继续修正或归档
```

Coding Agent 仍受“用户批准需求”门控制，但批准动作由用户判断，不再检查固定文档结构。

## 修漏洞工作方式

```text
用户 Bug 描述
  -> Bug Fix Agent
       -> openspec-explore / propose / update-change / apply-change
       -> 根因、决策、任务、代码、测试与 Git diff
  -> Review Agent
       -> open-code-review
       -> 测试、Findings、Verdict
  -> 用户决定继续修正或归档
```

Bug Fix 和 Review Agent 可以由用户按需要创建，不依赖固定 `fix.md` 或 `review.md` 解锁。

## OpenSpec Change 选择

Agent 必须通过 Work Item 标题、描述、用户明确给出的 Change 名称和 OpenSpec 命令定位对应 Change。

- 只有一个明确匹配项：继续工作；
- 有多个候选项：让用户确认；
- 没有 OpenSpec 根：遵守 OpenSpec Skill 的项目检查与确认规则；
- 不得读取其他 Work Item 来猜测当前工作的交接内容。

## Skill 默认分配

| Agent | 默认内置 Skill |
| --- | --- |
| Requirement Analysis | grill-with-docs、openspec-explore、openspec-propose、openspec-update-change |
| Coding | openspec-apply-change、openspec-sync-specs |
| Bug Fix | openspec-explore、openspec-propose、openspec-apply-change、openspec-sync-specs |
| Review | open-code-review |

所有默认 Skill 都随 CodePIddy 分发，并可以在设置中按 Agent 类型关闭或重新启用。

## 人工控制

- Agent 不自动串联；
- 用户决定何时批准需求；
- 用户决定何时进入 Coding、Bug Fix 或 Review；
- 用户决定 Review 不通过后回到哪一个 Agent；
- 用户决定何时归档或删除 Work Item。
