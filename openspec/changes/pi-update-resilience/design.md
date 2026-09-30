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

## 五、探针怎么加严

在 `probePiUpdate` 现有四项之后，追加对**外壳实际依赖的私有命令**的探测。任一返回 `Unknown command` 即判定不兼容。

设计要点：

- **只探测，不修复。** 探测失败的处理是拒绝激活 + 报错，不尝试运行时降级到别的通路（认证与导入本来就没有替代通路）。
- **探测命令要选副作用最小的。** `get_scoped_models` / `get_auth_providers` 是只读的；`import_jsonl` 会真的导入会话，**不能用于探测**，改用 `reload`（幂等）或只探测前两个 + 依赖 `rpc-types` 的存在性。推荐顺序：优先只读命令，失败即中止。
- **区分「命令不存在」与「Pi 启动失败」。** 前者是版本不兼容（可提示、可回滚），后者是安装损坏（现有错误路径已覆盖）。
- **错误信息要具体。** 直接把缺失的命令名列表给用户，例如「Pi 0.99.1 缺少外壳依赖的命令：reload、import_jsonl、login_provider。该版本的部分功能不可用，已保留原版本。」

先例：`e956516 fix: restore Pi slash commands and stabilize picker scrolling` 当年就是用外壳侧动态读实际安装 Pi 的能力表 + 兜底解决的，不改 Pi 源码。

## 六、激活后的降级

探针是安装时的一次性检查，挡不住「命令存在但语义变了」这类情况。因此 UI 侧仍需降级：

- 斜杠菜单渲染时按实际可用能力过滤 `DESKTOP_BUILTINS`（`pi-builtin-commands.ts` 已经在动态读安装版本的能力表，沿用该机制）
- 不可用的命令置灰并给出原因，而不是点击后才抛 `Unknown command`

## 七、剩下的 5 个命令怎么办

| 命令 | 结论 |
| --- | --- |
| `reload` | 保留。换重启进程会让用户敲 `/reload` 丢当前回复，收益不抵代价 |
| `get_auth_providers` / `login_provider` / `logout_provider` | 保留 + 向上游提 issue |
| `import_jsonl` | 保留 + 向上游提 issue |

上游缺口的证据：`BUILTIN_SLASH_COMMANDS` 只被 `interactive-mode.ts` 消费（执行），`rpc-mode.ts:808` 只用于列举；扩展 API 的 `ProviderConfig.oauth` 注释写明「OAuth provider for /login support」，即扩展只能*注册* OAuth provider，不能*发起*登录；`ExtensionContextActions` 只有只读的 `getScopedModels`，无 setter。
