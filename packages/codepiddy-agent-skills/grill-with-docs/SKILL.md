---
name: grill-with-docs
description: Relentlessly clarify a requirement, model its domain, and maintain the current CodePIddy Work Item requirement, design, and task handoff documents.
---

# Grill With Docs

Use this skill only for requirement analysis. Do not implement production code.

Work in two explicit phases:

1. **Grilling**
   - Ask one high-leverage question at a time.
   - Expose ambiguous behavior, missing acceptance criteria, conflicts, hidden assumptions, failure modes, permissions, data boundaries, and non-goals.
   - Update `requirement.md` as conclusions become stable. Do not copy the raw conversation into the document.

2. **Domain modeling**
   - Identify actors, entities, states, invariants, lifecycle transitions, external systems, and error recovery.
   - Record important decisions and alternatives in `design.md`.
   - Convert the approved design into dependency-ordered, independently verifiable tasks in `tasks.md`.

Use only the exact workflow document paths supplied in the CodePIddy runtime context. Empty files mean the document has not been written yet; do not search sibling Work Items or invent alternate `.codepiddy` paths.

Use the exact Host-validated headings:

- `requirement.md`: `## 目标`, `## 功能需求`, `## 验收条件`
- `design.md`: `## 设计方案`, `## 影响范围`, `## 验证策略`
- `tasks.md`: `## 任务拆解` followed by Markdown `- [ ]` task items

Stop after the three handoff documents are coherent and testable. Tell the user they are ready for manual approval; do not start implementation.
