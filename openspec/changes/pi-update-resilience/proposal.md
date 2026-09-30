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

> **决策修订（第二轮）**：本 change 最初打算「删 2 个、留 5 个、探针加严」。实测发现
> **探针加严会把「更新 Pi」彻底挡死** —— stock Pi 必然缺那 5 个命令，于是探针 100% 拒绝
> 激活。挡住了静默失效，但把更新本身也挡住了。用户拍板取舍「保留更新」，因此改为
> **把私有补丁清零**。下面是最终交付的范围。

- **删除「循环模型范围」功能**：UI 弹窗、preload 桥、IPC 通道、`AgentManager` 方法、Pi 补丁 `get_scoped_models` / `set_scoped_models` 两个 case、`rpc-types.ts` 的类型声明一并移除。私有命令 7 → 5。
- **删除「设为 X Agent 默认」按钮**及设置页只读的角色默认模型区块。角色默认模型因此不再可设置，所有 Agent 跟随 Pi 当前模型配置。
- **删除剩余 5 个私有命令**（`reload`、`get_auth_providers`、`login_provider`、`logout_provider`、`import_jsonl`），连同 `get_commands` 补丁一起，`modes/rpc/` 整体回退到与上游逐字节一致。私有命令 5 → **0**。
- **删除随之失去对象的机制**：私有命令清单（`pi-private-commands.ts`）、探针的私有能力校验、运行时 UI 降级。清单为空时这些机制没有作用对象。
- **`/reload` 不删功能，改为重启实现**：Pi 以 `--session-dir <agent.sessions> --continue` 启动且每个 Agent 会话目录独立，重启后恢复的正是当前会话。
- **`/login` `/logout` `/import` 从斜杠菜单移除**，手动输入时给出明确的替代路径说明，而不是 `Unknown command`。

不改动：`/reload` 的原地重载语义（不换成重启进程）；主流程（建项目 → 建需求 → 建 Agent → 聊天 → 工具调用）完全不受影响。

## Capabilities

### New Capabilities

- `pi-runtime-capability`：Pi 运行时能力探测、激活准入判定与功能降级规则。
- `desktop-model-picker`：模型选择器的职责边界（只选模型，不配置循环范围）。

### Modified Capabilities

（空——`openspec/specs/` 尚无既有 capability。）

## Impact

- **`packages/coding-agent/src/modes/rpc/` 与上游逐字节一致**：`git diff 9cf21c8 -- packages/coding-agent/src/modes/rpc/` 输出 0 行（起点是 4 文件 215 插入）。
- **唯一实质损失是 OAuth 登录**。Pi 的 `/login` 只在终端 UI 层可执行（`BUILTIN_SLASH_COMMANDS` 仅被 `interactive-mode.ts` 消费），扩展 API 不暴露 `modelRuntime`，只能*注册* OAuth provider 而不能*发起*登录。恢复需向上游提 issue（`tasks.md` 6.1，**未做**）。替代路径：环境变量或手写 `~/.pi/agent/auth.json`。
- `/import` 移除，但 `/resume` 走原生 `switch_session`，**不受影响**。
- `/reload` 保留功能，代价从「原地重载」变成「重启进程」，进行中的流式回复会中断。
- **斜杠菜单不依赖任何补丁**：`loadPiBuiltinCommands` 直接读当前运行那份 Pi 的 `dist/core/slash-commands.js` 并自行过滤，所以 stock Pi 下菜单依然完整。
- `settings-manager.ts` 的重试默认值补丁**保留**（`maxRetries` 3→5 等）：不是协议命令、不参与探针，升级后丢失仅回到上游默认值，属有意调优。
- 不新增依赖，不改 `pi-runtime-updater` 的安装与回滚机制。「拒绝激活即不落盘」这条不变量仍由 `pi-runtime-updater.test.ts` 锁住。
