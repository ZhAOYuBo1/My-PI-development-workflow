# @codepiddy/permission-extension

Private CodePIddy compatibility fork of `pi-permission-system` 0.8.0.

Upstream:

- Repository: `https://github.com/MasuRii/pi-permission-system`
- License: MIT
- Upstream release: `0.8.0` (2026-07-03)

## CodePIddy compatibility changes

- Compiled against Pi `0.85.1` real types instead of the upstream legacy type shims;
- Moved `TUI` type import to `@earendil-works/pi-tui`;
- Adapted `getApiProvider` to `@earendil-works/pi-ai/compat`;
- Added the current `resources_discover` event type locally because Pi does not re-export it from the package root;
- Replaced dynamic imports with top-level imports;
- Uses CodePIddy local runtime directories for extension settings, logs, and global policy.

The project-local policy file is never read: CodePIddy exposes a single global
policy under `<userData>/permissions/policy/`, driven by the settings page. The
`project` and `projectAgent` layers of the upstream engine stay unused.

The original upstream license is preserved in `LICENSE` and the original README is preserved in `README.upstream.md`.
