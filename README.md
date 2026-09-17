<p align="center">
  <img src="packages/codepiddy-desktop/public/codepiddy-icon.png" alt="CodePIddy" width="112" />
</p>

<h1 align="center">CodePIddy</h1>

<p align="center">A workflow-oriented Windows coding agent desktop client powered by Pi.</p>

<p align="center">
  <img alt="Windows" src="https://img.shields.io/badge/platform-Windows-2563eb?style=flat-square" />
  <img alt="Electron" src="https://img.shields.io/badge/client-Electron-334155?style=flat-square" />
  <img alt="Pi runtime" src="https://img.shields.io/badge/runtime-Pi-111827?style=flat-square" />
  <img alt="License" src="https://img.shields.io/badge/license-MIT-16a34a?style=flat-square" />
  <img alt="Status" src="https://img.shields.io/badge/status-active%20development-f59e0b?style=flat-square" />
</p>

<p align="center">
  <img src="docs/images/codepiddy-overview.png" alt="CodePIddy project workflow" width="920" />
</p>

<table>
  <tr>
    <td width="50%"><img src="docs/images/codepiddy-agent.png" alt="CodePIddy agent conversation" /></td>
    <td width="50%"><img src="docs/images/codepiddy-settings.png" alt="CodePIddy per-role skill settings" /></td>
  </tr>
  <tr>
    <td align="center"><strong>Pi conversation, tools and context</strong></td>
    <td align="center"><strong>Per-role Skill management</strong></td>
  </tr>
</table>

> [!WARNING]
> CodePIddy is under active development. The current repository is suitable for development and testing, not unattended production use.

## What it is

CodePIddy adds a desktop workflow layer on top of the Pi agent runtime. It is not a TUI skin and it does not automatically chain agents. The user creates and controls long-lived agents inside isolated Work Items.

Each opened project has two work lanes:

```text
New requirement: Requirement Analysis -> Coding -> Review
Bug fix:        Bug Fix -> Review
```

Agents hand work to the next role through files inside the current Work Item. The user decides when to create, switch, retry, reset, review, archive, or delete an item.

## Current capabilities

- Electron desktop client for Windows
- Recent-project persistence with SQLite
- Isolated requirement and bug-fix Work Items
- One long-lived Pi session per Agent Slot
- Pi RPC streaming, tool cards, thinking blocks, interruption, retry and context usage
- Dynamic Pi slash commands and model selection
- Session tree, fork, clone, reset and compaction
- Configurable permission approval UI
- Project-level single-writer lease
- Tavily search-only MCP integration
- Per-role Skill assignment
- Requirement approval and document handoff gates

## Workflow boundaries

### Requirement Analysis Agent

Starts from the title and description supplied by the user. It has no prerequisite handoff documents and creates:

```text
requirement.md
design.md
tasks.md
```

### Coding Agent

Reads the approved requirement handoff, implements the change, and creates:

```text
implementation.md
```

### Bug Fix Agent

Starts from the user-provided bug description, reproduces and fixes the problem, and creates:

```text
fix.md
```

### Review Agent

Reads the implementation or fix handoff, independently inspects the real code changes, adds or updates tests, and creates:

```text
review.md
```

## Development status

As of September 17, 2026:

- Workflow MVP: approximately 85%
- Desktop interaction completeness: approximately 75%
- Production-release readiness: approximately 60%

Major remaining work includes RPC soak testing and recovery, structured handoff validation, Electron E2E tests, runtime IPC validation, transcript virtualization, draft persistence, code signing, auto-update and crash diagnostics.

See [`docs/codepiddy/MVP_SPEC.md`](docs/codepiddy/MVP_SPEC.md) and [`docs/codepiddy/DECISIONS.md`](docs/codepiddy/DECISIONS.md) for product decisions and implementation boundaries.

## Requirements

- Windows 10 or Windows 11
- Node.js 22.19 or newer
- npm
- At least one Pi-supported model/provider configuration

Pi provider and model configuration is read from its native files:

```text
~/.pi/agent/models.json
~/.pi/agent/settings.json
```

## Run locally

```powershell
npm ci
npm run build:codepiddy
npm start --workspace=@codepiddy/desktop
```

Run the CodePIddy checks:

```powershell
npm test --workspace=@codepiddy/core
npm test --workspace=@codepiddy/desktop
npm run check
```

Prepare a local Windows installer only when a release build is required:

```powershell
npm run prepare:codepiddy-package
npm run package:win --workspace=@codepiddy/desktop
```

Build output is written under `.artifacts/` and is not committed.

## Repository layout

```text
packages/codepiddy-desktop/              Electron Main, Preload and React Renderer
packages/codepiddy-core/                 Work Items, Agent registry, Pi RPC process and write lease
packages/codepiddy-shared/               Shared IPC and workflow types
packages/codepiddy-agent-skills/         Bundled per-role Skills
packages/codepiddy-permission-extension/ Permission-system integration
packages/codepiddy-tavily-search-mcp/    Tavily MCP server
packages/codepiddy-tavily-tool-extension Pi tool wrapper for search-only web access
docs/codepiddy/                          Product decisions, architecture and workflow documentation
```

## Security notes

- Electron uses context isolation, a sandboxed renderer and disabled Node integration.
- Secrets saved by CodePIddy use Electron `safeStorage` when available.
- The current Windows MVP does not provide a strong execution sandbox.
- Agent processes run with the operating-system permissions of the current user.
- Review permission policy before allowing commands or filesystem writes.

See [`SECURITY.md`](SECURITY.md).

## Upstream Pi

CodePIddy is derived from the open-source Pi Agent Harness. Pi remains the model, tool, session, Skill and slash-command runtime; CodePIddy supplies the desktop workflow and project-management layer.

- Upstream project: `earendil-works/pi`
- Original upstream README: [`docs/upstream/PI_README.md`](docs/upstream/PI_README.md)
- Upstream GitHub automation is preserved in the baseline commit but removed from the active CodePIddy tree.

## License

This repository retains the upstream MIT license. See [`LICENSE`](LICENSE).
