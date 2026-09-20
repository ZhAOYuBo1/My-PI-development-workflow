# Product

<!-- impeccable:product-schema 1 -->

## Platform

Windows desktop application built with Electron. The interface should feel native to a developer workstation rather than like a web dashboard inside a window.

## Stack

- Electron main and preload processes
- React and TypeScript renderer
- Vite build pipeline
- SQLite for local project and UI state
- Pi coding agent as the source of truth for models, sessions, commands, tools, skills, and usage

## Primary User

A programmer working on ordinary feature development and bug fixing who wants separate role-focused agents without surrendering control to an automatic pipeline.

## Core Job

Keep feature work and bug-fix work organized inside each project, let the programmer manually enter the appropriate long-lived agent, and preserve handoff state through human-readable workflow documents.

## Product Model

- Every project contains two work lanes: 新需求 and 修漏洞.
- A work item is the isolation boundary for workflow state.
- New requirements use Requirement Analysis, Coding, and Review agents.
- Bug fixes use Bug Fix and Review agents.
- The user manually creates and switches agents; CodePIddy does not automatically advance the workflow.
- Agents collaborate through documents inside the work-item directory.
- Only one writing agent may hold the project write lease at a time.

## Product Position

CodePIddy is a Pi-powered workflow client, not a replacement agent runtime. Pi remains authoritative for provider configuration, models, slash commands, sessions, tools, and skills. CodePIddy contributes project organization, workflow boundaries, persistence, permissions, and a polished desktop interaction layer.

## Durable Constraints

- Project documents are shared, but work-item workflow files remain isolated.
- Requirement approval is controlled by the user.
- Read operations are normally allowed; modifying operations follow the configured permission extension.
- Tavily integration is search-only and must not become a general webpage reader.
- The Windows MVP does not require a sandbox, but the architecture should leave room for one.
- The application must remain keyboard-friendly and usable during long agent sessions.

## Success Criteria

- A programmer can reopen a project and continue the correct agent session without reconstructing state.
- Feature and bug workflows remain visually and physically distinguishable.
- Model, command, permission, context, tool, and streaming states are understandable without reading logs.
- The client remains calm and legible during long conversations and dense tool output.
