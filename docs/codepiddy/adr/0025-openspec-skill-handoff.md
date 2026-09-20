# ADR-0025: OpenSpec 与 Grill 产物作为动态交接协议

- 状态：Accepted
- 日期：2026-09-20

## 背景

早期 CodePIddy 使用固定的 `requirement.md`、`design.md`、`tasks.md`、`implementation.md`、`fix.md` 和 `review.md` 作为 Agent 交接协议，并通过 Host 校验固定标题。

这套方式会重复 OpenSpec 已经提供的 proposal、spec、design、tasks 等产物，也限制了 Skill 演进和不同项目的文档组织方式。

## 决策

1. Requirement Analysis Agent 默认同时使用 Grill With Docs 与 OpenSpec Skills；
2. Grill 负责澄清需求和领域建模，OpenSpec 负责生成和维护正式变更产物；
3. OpenSpec Change、真实 Git diff、测试和 Skill 生成的其他文档共同构成交接；
4. Host 不再要求固定交接文件名和固定 Markdown 标题；
5. 新需求仍保留人工批准门，但批准由用户判断；
6. Review Agent 默认启用 bundled `open-code-review` Skill；
7. 固定 Skills 随应用分发，并在设置中按 Agent 类型启用或停用；
8. 项目自定义 Skills 放在 `.codepiddy/.pi/skills`，客户端提供打开入口。

## 后果

- Workflow 与 OpenSpec 原生模型一致；
- 用户可以自由扩展文档结构；
- CodePIddy 不再通过固定文件判断 Review 是否可以创建；
- Agent 必须可靠定位当前 Work Item 对应的 OpenSpec Change；
- 如果存在多个候选 Change，必须请求用户确认。
