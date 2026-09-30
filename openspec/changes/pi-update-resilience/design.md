# Design

## 一、私有补丁的全貌

`packages/coding-agent/` 是 Pi 源码的 vendored 副本（`package.json` 的 `name` 就是 `@earendil-works/pi-coding-agent`），进了我们的 git。开发模式下外壳直接跑它：

```ts
// main/index.ts:896
path.join(repositoryRoot, "packages", "coding-agent", "src", "cli.ts")
```

`git diff 9cf21c8..HEAD -- packages/coding-agent/src` 显示 4 个文件被改：

| 文件 | 行数 | 性质 |
| --- | --- | --- |
| `modes/rpc/rpc-mode.ts` | +136 | 协议层，承重 |
| `modes/rpc/rpc-types.ts` | +58 | 协议层，承重 |
| `modes/rpc/rpc-client.ts` | +14 | 协议层 |
| `core/settings-manager.ts` | +13 | 重试默认值（另一件事） |

**存在两种扩展 Pi 的机制，寿命完全不同：**

| 机制 | 做法 | 升级后 |
| --- | --- | --- |
| 扩展注入 | 外壳传 JS 文件，Pi 自己 `load`（`--extension`） | ✅ 活 |
| 改源码 | 编辑 Pi 的 `.ts`，加 `case` | ❌ 死 |

`permission.js`、`tavily-tool.js` 走的是前者；这 7 个 RPC 命令走的是后者。`PI_SHELL_PATH` 原本也是后者，已在本次会话改为写 Pi 原生 `settings.json`（走前者思路），`getShellPath()` 现已与上游逐字节一致。

## 二、为什么探针放行了

```ts
// main/index.ts:341-345
await rpc.start();                    // 握手
const commands = await rpc.getCommands();
if (commands.length === 0) throw ...  // 非空即可
await rpc.getMessages();
await rpc.getAvailableModels();
```

四项全是 stock Pi 就有的命令 → 探针 100% 放行 → `writeActive()` 落盘 → 下次启动 `initialize()` 读 `active.json`，`launched = selected`，外壳改用新 Pi。

回滚只在 `fallbackAfterStartupFailure()` 触发，而握手永远正常，所以**回滚也不会发生**。

实测证据（`active.json` 已确认 0.99.1 激活，进程命令行确认外壳在跑 `pi-updates/versions/v0.99.1-*/dist/bundle/cli.js`）：

```
FAIL  get_scoped_models    Unknown command
FAIL  get_auth_providers   Unknown command
FAIL  import_jsonl         Unknown command
```

## 三、爆炸半径实测

用户更新 Pi 后「看起来没失效」，因为主流程一条都不碰这 4 个功能。逐个核对：

| 功能 | 入口 | 用到的命令 | 状态 |
| --- | --- | --- | --- |
| 选择模型（一级弹窗） | 模型选择器 | `getState` / `getAvailableModels` / `getAvailableThinkingLevels` | ✅ **全原生，正常** |
| 循环模型范围（二级） | 一级弹窗内按钮 | `get_scoped_models` | ❌ |
| `/reload` | 斜杠命令 | `reload` | ❌ 用户已确认 |
| `/import` | 斜杠命令 | `import_jsonl` | ❌ |
| `/login` `/logout` | 斜杠命令 + id | `get_auth_providers` / `login_provider` / `logout_provider` | ❌ |

「选择模型」正常容易造成误判：它是**两级弹窗**，一级用原生命令，二级才踩私有命令。截图里那个「选择模型」弹窗底部的「循环模型范围」按钮才是二级入口。

`/import` 不是菜单项 —— `importSession` 全仓库只有 `main/index.ts:770` 一处调用，挂在斜杠命令上，没有独立按钮，所以「找不到」是正常的。

## 四、删除 scoped models 的论证

`scopedModels` 在 Pi 内部的全部消费点：

```
agent-session.ts:1028  setScopedModels()          ← setter
agent-session.ts:1701  _addPersistedDefaultToNonEmptyScope()
agent-session.ts:1724  cycleModel() → _cycleScopedModel()   ← Ctrl+P
agent-session.ts:2647  getScopedModels（扩展 API，只读）
model-resolver.ts:664  启动时取 scopedModels[0] 作默认模型   ← 只由 --models 驱动
```

CodePIddy 侧：

```
grep cycle_model codepiddy-core codepiddy-desktop  →  空
```

外壳没有循环模型的动作。所以运行时 `set_scoped_models` 的唯一实际效果是 `agent-session.ts:1701` 那个「切模型时把新模型追加进范围」的副作用 —— 而外壳也不循环。

**结论：删掉零代价。** 这与「用 `--models` 替换」有本质区别 —— 后者要付出「改范围必须重启 Agent」的代价（本 change 明确不做）。

删除范围（避免留下悬空引用）：

- `renderer/App.tsx`：`scopedModelPickerAgentId` 状态、`openScopedModelPicker`、`toggleScopedModel`、`saveScopedModels`、`useAllModels`、整个 `.scoped-model-picker` 弹窗 JSX
- `preload/index.ts`：`getAgentScopedModels` / `setAgentScopedModels`
- `main/index.ts`：`getScopedModels` / `setScopedModels` 方法 + 两个 IPC handler
- `main/ipc-validation.ts`：`parseSetAgentScopedModelsInput`
- `shared`：`AgentScopedModel` / `SetAgentScopedModelsInput` 类型
- `coding-agent`：`rpc-mode.ts` 两个 case、`rpc-types.ts` 命令与响应类型、`rpc-client.ts` 两个方法
- `styles.css`：`.scoped-model-*` 规则

## 五、探针加严是个陷阱（已放弃）

第一轮方案：在 `probePiUpdate` 现有四项之后，追加对私有命令的探测，任一 `Unknown command` 即拒绝激活。

**它确实挡住了静默失效，但把「更新 Pi」也挡死了。** stock Pi 必然缺全部 5 个私有命令，
所以探针 100% 拒绝 —— 用户点更新只会看到「缺少外壳依赖的命令：reload、import_jsonl、
login_provider、logout_provider、get_auth_providers」，永远换不了新版本。

这暴露了一个前提错误：**我们默认了「私有命令必须保住」**。但真正的取舍是二选一：

| | 保留 5 个命令 | 删掉 5 个命令 |
| --- | --- | --- |
| 更新 Pi | ❌ 永远失败 | ✅ 正常 |
| `/reload` | ✅ 原地重载 | ⚠️ 重启（功能在） |
| `/login` | ✅ OAuth | ❌ 只能手改 auth.json |

用户选了「保留更新」。理由：一个不能更新核心的客户端是比少个 OAuth 登录更大的负债 ——
补丁每次上游改版都可能悄悄失效，而 OAuth 登录有可用的手工替代路径。

## 六、清零后哪些机制一并消失

私有命令清零后，下列机制**失去作用对象**，全部删除而非留空壳：

- `pi-private-commands.ts`（清单、哨兵、`PI_BUILTIN_REQUIREMENTS`）与配套测试
- `PiRpcProcess.supportsCommand()` —— 只为探针存在
- 探针里的 `findMissingPiCapabilities()` 调用与 `describeIncompatiblePi()`
- 运行时降级：`unavailablePiCommands()`、`unavailablePiCommandsCache`、`describeUnavailableBuiltin()`

探针回到只验原生命令的 4 项。**「拒绝激活即不落盘」这条不变量仍然重要**（探针也可能因
安装损坏而失败），所以 `pi-runtime-updater.test.ts` 里那条用例保留，只把措辞从
「协议不兼容」改成通用的校验失败信息。

## 七、`/reload` 怎么保住

唯一有外壳侧替代实现的命令。Pi 的启动参数是
`--session-dir <agent.sessions> --continue`（`main/index.ts:909-911`），而
`agent-registry.ts:125` 给每个 Agent 建**独立**的 `sessions/` 目录 —— 所以重启后
`--continue` 恢复的正是当前这个 Agent 的会话，不会串。

因此 `/reload` 改为调用既有的 `AgentManager.reconnect()`：重启 Pi 进程即重新加载
Extensions / Skills / Prompts / Context，会话由 `--continue` 恢复。

**代价**：进行中的流式回复会中断（原地重载时不会）。相比「功能消失」，这个代价可接受。

## 八、菜单可见性不依赖补丁

这是能放心清零的关键前提。`loadPiBuiltinCommands` 直接读**当前运行那份** Pi 的
`dist/core/slash-commands.js`，自己过滤 `DESKTOP_BUILTINS` —— 全程不碰 Pi 源码。

所以即使 `get_commands` 回退成 stock 的「只返回扩展与 Skill」，斜杠菜单依然是全的。
把 `import` / `login` / `logout` 从 `DESKTOP_BUILTINS` 删掉，菜单就不会露出
「点了报错」的入口。手动输入这三条时，`invokeBuiltinCommand` 返回明确的替代路径说明
（环境变量 / `~/.pi/agent/auth.json`），而不是 `Unknown command`。

上游缺口的证据（用于 `tasks.md` 6.1 的 issue）：`BUILTIN_SLASH_COMMANDS` 只被
`interactive-mode.ts` 消费（执行），`rpc-mode.ts` 只用于列举；扩展 API 的
`ProviderConfig.oauth` 注释写明「OAuth provider for /login support」，即扩展只能
*注册* OAuth provider，不能*发起*登录。
