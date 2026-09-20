# Bundled Agent Skills

These Skill definitions are distributed with CodePIddy and appear in the desktop settings without requiring a separate Skill download.

| Skill | Origin | License |
| --- | --- | --- |
| `grill-with-docs` | CodePIddy | MIT |
| `openspec-*` | OpenSpec 1.13.1 generated Skills (`@fission-ai/openspec`) | MIT |
| `open-code-review` | Alibaba Open Code Review Skill | Apache-2.0 |

Each copied Skill keeps its original frontmatter metadata, compatibility requirements, author and license declaration.

Bundling a Skill definition does not silently install or configure its external CLI or model credentials. OpenSpec Skills require the `openspec` CLI, while Open Code Review requires the `ocr` CLI and a supported model provider.
