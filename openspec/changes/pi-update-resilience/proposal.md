# Proposal

## Why

CodePIddy 的「更新 Pi」按钮从 npm 安装 **stock Pi**（`@earendil-works/pi-coding-agent@latest`）替换掉自带的运行时。但 `packages/coding-agent/` 是 Pi 源码的 vendored 副本，我们为它加了 **7 个私有 RPC 命令**。npm 原版没有这些命令，于是升级后必然失效。

失效是**无声的**：`probePiUpdate`（`main/index.ts:341-345`）只验 `get_state` / `get_commands` / `get_messages` / `get_available_models` —— 全是原版就有的命令，探针必然放行，回滚只在启动失败时触发而握手永远正常。用户点完更新得不到任何提示，半年后点开某个功能才发现。

已实测确认（对着已安装的 0.99.1 直接发命令）：

```
OK    get_state (原生)              正常
OK    get_commands (原生)           正常
FAIL  get_scoped_models             Unknown command
FAIL  get_auth_providers           Unknown command
FAIL  import_jsonl                 Unknown command
```

## 已确认的失效清单

| 私有命令 | 界面入口 | 无原生替代？ |
| --- | --- | --- |
| `get/set_scoped_models` | 选择模型 → 循环模型范围 | ✅ 有（`--models`），但见下 |
| `reload` | `/reload` | ⚠️ 仅能靠重启进程替换 |
| `get_auth_providers` / `login_provider` / `logout_provider` | `/login` `/logout` | ❌ 无 |
| `import_jsonl` | `/import` | ❌ 无 |

## 关键发现：其中 2 个命令对应的功能根本没在用

**`scopedModels` 在整个 Pi 里只影响两处**：

1. `cycleModel()` —— 终端里 Ctrl+P 循环切模型的范围与顺序（`agent-session.ts:1717`）
2. `model-resolver.ts:664` —— 启动时选第一个作默认模型，**只由 `--models` 启动参数驱动**

而 CodePIddy **从不发 `cycle_model`**（`grep cycle_model codepiddy-core codepiddy-desktop` 为空）—— 外壳只有「点选式」模型弹窗，没有循环按钮也没有循环快捷键。

所以「循环模型范围」在 CodePIddy 里**唯一可见效果是弹窗标题右边从「全部模型」变成「N 个模型」**，配置不产生任何行为。删除它不需要 `--models` 替代、不需要热改能力、不需要重启，**零代价**。

## What Changes

- **删除「循环模型范围」功能**：UI 弹窗、preload 桥、IPC 通道、`AgentManager` 方法、Pi 补丁 `get_scoped_models` / `set_scoped_models` 两个 case、`rpc-types.ts` 的类型声明一并移除。私有命令从 7 减到 5。
- **删除「设为 X Agent 默认」按钮**及设置页只读的角色默认模型区块。角色默认模型因此不再可设置，所有 Agent 跟随 Pi 当前模型配置。
- **探针加严**：`probePiUpdate` 额外探测外壳依赖的私有命令；stock Pi 返回 `Unknown command` 时**拒绝激活**并明确报告缺失项，而不是装上再静默失效。
- **激活后退化**：运行时若某私有命令不可用，相关 UI 入口（`/login` `/logout` `/import` `/reload`）置灰并说明原因，从「点了报未知命令」变为「不可用且有解释」。

不改动：`/reload` 的原地重载语义（不换成重启进程）；主流程（建项目 → 建需求 → 建 Agent → 聊天 → 工具调用）完全不受影响。

## Capabilities

### New Capabilities

- `pi-runtime-capability`：Pi 运行时能力探测、激活准入判定与功能降级规则。
- `desktop-model-picker`：模型选择器的职责边界（只选模型，不配置循环范围）。

### Modified Capabilities

（空——`openspec/specs/` 尚无既有 capability。）

## Impact

- 删除后 `packages/coding-agent/src/modes/rpc/` 的私有补丁从 215 行降到约 130 行，`settings-manager.ts` 已在上一个提交恢复成与上游逐字节一致。
- **仍然保留 5 个私有命令**（`reload` + 认证 3 个 + `import_jsonl`）。这 5 个确认无原生替代：Pi 的 `/login` `/import` 只在终端 UI 层执行（`BUILTIN_SLASH_COMMANDS` 仅被 `interactive-mode.ts` 消费，`rpc-mode.ts:808` 只用于列举），扩展 API 不暴露 `modelRuntime`，只有只读的 `ctx.getScopedModels()`。这部分需向上游提 issue，不在本 change 解决。
- 不新增依赖，不改协议格式，不改 `pi-runtime-updater` 的安装与回滚机制。
