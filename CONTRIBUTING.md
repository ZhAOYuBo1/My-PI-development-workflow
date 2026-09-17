# Contributing to CodePIddy

CodePIddy is under active development. Before opening a large pull request, describe the intended workflow or UI change in an issue or discussion.

## Development setup

```powershell
npm ci
npm run build:codepiddy
npm start --workspace=@codepiddy/desktop
```

## Required checks

Before submitting a change:

```powershell
npm test --workspace=@codepiddy/core
npm test --workspace=@codepiddy/desktop
npm run check
```

For UI changes, verify the real Electron client rather than only a browser mock.

## Architecture rules

- Pi is the source of truth for models, commands, Skills, sessions and tools.
- CodePIddy owns the desktop shell and human-controlled workflow.
- Do not add automatic Agent chaining.
- Keep requirement and bug-fix Work Items isolated.
- Use Main/Preload/Renderer separation and fixed IPC channels.
- Do not expose Node.js directly to the Renderer.
- Never commit API keys, local sessions, databases, permission logs or build artifacts.

The inherited upstream development guidance remains in [`AGENTS.md`](AGENTS.md). Some sections describe upstream Pi packages and may be stricter than the CodePIddy-specific notes above.
