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
- Changed project policy location from `.pi/agent/pi-permissions.jsonc` to `.codepiddy/permissions.jsonc`;
- Uses CodePIddy local runtime directories for extension settings, logs, and global policy.

The original upstream license is preserved in `LICENSE` and the original README is preserved in `README.upstream.md`.
