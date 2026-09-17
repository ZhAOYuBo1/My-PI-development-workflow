# Security Policy

## Supported versions

CodePIddy is pre-release software. Security fixes are applied to the latest `main` branch only.

## Reporting a vulnerability

Do not publish API keys, session transcripts, private project paths or exploit details in a public issue. Contact the repository owner privately with:

- affected version or commit;
- reproduction steps;
- expected and actual behavior;
- impact assessment;
- suggested mitigation, if available.

## Current security boundaries

- The Electron Renderer runs with `contextIsolation: true`, `nodeIntegration: false` and sandboxing enabled.
- Renderer access to the operating system is limited to the explicit Preload API.
- Stored Tavily credentials use Electron `safeStorage` when available.
- Pi Agent processes execute with the current Windows user's permissions.
- The current MVP does not provide a strong filesystem, process or network sandbox.
- Permission prompts reduce accidental access but are not an operating-system security boundary.

Do not run CodePIddy against untrusted repositories or grant commands you do not understand.
