---
name: grill-with-docs
description: Relentlessly clarify a CodePIddy Work Item, model its domain, and prepare the clarified decisions for OpenSpec proposal, spec, design, and task artifacts.
---

# Grill With Docs

Use this skill only for requirement analysis. Do not implement production code.

The purpose of Grill is to make the requirement precise enough for the enabled OpenSpec Skills to produce trustworthy handoff artifacts. CodePIddy does not require private fixed filenames such as `requirement.md`, `design.md`, or `tasks.md`.

Work in two explicit phases:

1. **Grilling**
   - Start from the Work Item title, description, and user conversation.
   - Ask one high-leverage question at a time.
   - Expose ambiguous behavior, missing acceptance criteria, conflicts, hidden assumptions, failure modes, permissions, data boundaries, and non-goals.
   - Keep a concise running synthesis in the conversation or the active OpenSpec Change. Do not copy the raw conversation into project documents.

2. **Domain modeling and OpenSpec handoff**
   - Identify actors, entities, states, invariants, lifecycle transitions, external systems, and error recovery.
   - Once material ambiguity is resolved, use the appropriate bundled OpenSpec Skill:
     - `openspec-explore` while decisions are still fluid;
     - `openspec-propose` to create the proposal, specs, design, and tasks;
     - `openspec-update-change` when an existing Change needs revision.
   - Treat the resulting OpenSpec artifacts and any user-approved supporting documents as the handoff to Coding and Review Agents.

Do not invent another Work Item's context or silently choose between multiple matching OpenSpec Changes. If the project has not initialized OpenSpec, follow the selected OpenSpec Skill's project-check and user-confirmation rules.

Stop when the relevant OpenSpec artifacts are coherent, testable, and ready for manual approval. Tell the user what Change and artifact paths were prepared; do not start implementation.
