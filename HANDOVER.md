# 交接文档（HANDOVER）

> 日期：2026-09-30｜分支：`main`｜远端 `origin/main` = `db4b6e2`
> 本地领先远端 **9 个提交**（未 push）：`4051b61`、`e591860`、`4db2049`、`2d5336d`、`0d3f25b`、`5a9014f`、`647cf1b`、`5315fd4`、`357bece`、`bda227b`
> ✅ **上一轮 16 个未提交文件已按 5 个 commit 落地**（见「二」）
> 🔶 **工作区有 `pi-update-resilience` 的实现未提交**（见「三.5」），typecheck / build / 单测 / e2e 均已跑过
> ✅ **Pi 已回滚到内置 0.85.1**（`active.json` 已删除），验证环境的干扰已排除

---

## 一、怎么把应用跑起来

```powershell
cd E:\My-PI-development-workflow-main
npm run build:codepiddy                          # 必须先 build
npm start --workspace=@codepiddy/desktop
```

两个常见踩坑：

- `npm start`（不带 workspace）→ 根目录没有 `start` 脚本，报 `Missing script: "start"`
- `npm run build:codepiddy --workspace=@codepiddy/desktop` → **错**。`build:codepiddy` 是根目录脚本，不在 desktop 包里。它本身的作用就是依次构建 shared → core → tavily-search-mcp → desktop，加了 `--workspace` 反而找不到

**跑截图脚本后必须重新 build。** `capture-screenshots.mts` 会重建并删除 `packages/codepiddy-desktop/dist/renderer`，不补 build 的话 Electron 窗口一片空白。

---

## 二、已落地的提交

### 上一轮遗留的 16 个未提交文件（已拆成 5 个 commit）

`0d3f25b` 之后的那批改动本轮按「三.1–三.4」拆开落地，每一项都做过「回退实现后对应测试必须失败」的反向验证。

| commit | 内容 | 文件 |
| --- | --- | --- |
| `5a9014f` | powershell 归入 bash 权限类别 | 2 |
| `647cf1b` | 撤掉 `PI_SHELL_PATH` 私有补丁 | 4 |
| `5315fd4` | 修 `npm_config_*` 泄漏导致 Pi 更新报「退出码 1」 | 2（1 新） |
| `357bece` | 转录定位条不再压正文 | 5（含 3 个 openspec 文档） |
| `bda227b` | 代码块默认换行 + 真折叠 | 4（1 新 e2e） |

`git diff 0d3f25b..bda227b --stat` = 16 文件 536 插入 / 72 删除，与拆分前的工作区逐字节一致。

`styles.css` 被 `357bece` 和 `bda227b` 同时改，所以拆的时候按 hunk 切：定位条那一个 hunk 归前者，代码块其余全部归后者。`git apply --cached --recount` 单 hunk patch，非交互。

### 之前那一轮（本节内容未变，仅补 `0d3f25b`）

`0d3f25b docs: plan the Pi patch reduction and refresh handover` —— 写了 `pi-update-resilience` 的 proposal / design / spec / tasks，并删掉只测 `PI_SHELL_PATH` 补丁的 `packages/coding-agent/test/settings-shell-path.test.ts`。

### `4db2049` refactor: drop the requirement approval gate between agents

删除「需求分析 → Coding」这一跳的审批门控。**这是本轮最大的一次改动**，涉及 19 个文件。

| 层 | 删除内容 |
| --- | --- |
| 数据模型 | `AgentSlotSummary.blockedReason`、`WorkItemSummary.requirementApprovedAt` |
| core | `createAgentSlots` 的门控、`approveRequirement()`、manifest 解析/序列化 |
| 角色提示词 | 「完成后停止，等待用户在客户端批准需求」→「停止并汇报，不自行推进到实现阶段，不自动创建其他 Agent」 |
| IPC | `codepiddy:work-item:approve-requirement` 通道、preload 桥、`parseApproveRequirementInput` |
| UI | 「批准需求」按钮、「需求已批准」徽章、`.approval-badge` 样式 |

顺带删掉死文件 `.codepiddy/permissions.jsonc` 的写入（引擎只读 `<cwd>/.pi/agent/pi-permissions.jsonc`，那份从来没人加载）。

文档：ADR-0003 标记被取代，新增 `docs/codepiddy/adr/0026-user-controlled-agent-creation.md`。

**注意 `role-profiles.ts` 的迁移 hash**：`PREVIOUS_DEFAULT_PROFILE_HASHES` 从 `Record<AgentRole, string>` 改成了 `Record<AgentRole, string[]>`，并把本次改动前的 requirement-analysis profile 哈希 `a44baff3...` 加了进去。**下次改任何角色 profile 都要把当前哈希追加进去**，否则已有项目不会被覆盖更新。

### `e591860` fix: default every permission category to allow

只改了 `permission-settings.ts` 里 5 个出厂默认值（`bash`/`mcp`/`skills`/`otherTools`/`externalDirectory`：`ask` → `allow`）。

**权限引擎本体一行没动**（`packages/codepiddy-permission-extension/` 25 文件 6040 行完整保留）。第二个 commit 只改了它 README 里一句不实的文档描述。

顺带修了一个隐藏 flaky：`permission-settings.test.ts` 依赖权限引擎按 `mtimeMs` 缓存（`permission-manager.ts:582`），同一毫秒内两次写策略文件会命中旧缓存。加了 `utimesSync` 显式推进 mtime。

### `4051b61` feat: add an entry that opens the bundled skill directory

设置页新增「打开内置 Skill 文件夹」按钮，指向 `packages/codepiddy-agent-skills/`（打包后是 `resources/runtime/skills`）。原来的「打开项目 Skill 文件夹」保留 —— 那个是用户放自有 Skill 的地方，测试 `project-service.test.ts` 断言它被创建且为空。

### `db4b6e2` chore: track the icon source pack and the handover notes

把之前未跟踪的 `codepiddy-icons/`（32 个设计源 SVG）和 `HANDOVER.md` 入库。

---

## 三、本轮改动与待办

### 3.0 ✅ Pi 已回滚到内置 0.85.1

`active.json` 已不存在 —— `rollback()` 的 bundled 分支就是 `rm(this.activeFile)`，
`pi-updates/versions/` 下只剩一个没人引用的 `v0.99.1-5d8b3dd1-*`。
`initialize()` 拿到 ENOENT → `selected = null` → 跑 `packages/coding-agent/src/cli.ts`。

**验证环境的干扰已排除。** `pi-updates/versions/v0.99.1-*` 那个目录是死数据，
`loadHistory()` 会因为它不是合法回退目标而跳过，不会被误选。

### 3.1 ✅ powershell 归入 bash 类别 —— 已修，且原结论是错的（`5a9014f`）

> ⚠️ **本节上一版结论有误，已实测推翻。** 原文说「powershell 会绕过审批」——
> 实际相反：它不绕过，只是**归错了类**。真 bug 更严重。

`powershell` 不在引擎的 `BUILT_IN_TOOL_PERMISSION_NAMES`（`permission-manager.ts:49`），
所以 `checkPermission` 落到 1028/1037 兜底，走 `defaultPolicy.tools` = `otherTools`。实测：

```
[bash deny, otherTools allow]   powershell=allow(default)   ← 真 bug：命令执行拒绝却管不住
[bash allow, otherTools deny]   powershell=deny (default)   ← 归错类
```

用户把「命令执行」拉到拒绝，Pi 的 PowerShell 工具照样能跑任意命令。设置页那行写的是
「命令执行 / Bash」，用户合理预期它管住所有 shell。

**修法**（`permission-settings.ts`）：`tools` 映射加 `powershell: defaults.bash`。改完：

```
[bash deny, otherTools allow]   powershell=deny (tool)      bash=deny
[bash ask,  otherTools allow]   powershell=ask  (tool)      bash=ask
[bash allow, otherTools deny]   powershell=allow(tool)      bash=allow
```

已加测试 `powershell follows the bash category, not otherTools` 锁住三种组合。
**没动** `packages/codepiddy-permission-extension/`：引擎的
`BUILT_IN_TOOL_PERMISSION_NAMES` 同样缺 `powershell`，但 `tools` 里有精确条目后已走
`source=tool`，效果一样，不值得为此改引擎。

### 3.2 ✅ 撤掉 `PI_SHELL_PATH` 私有补丁 —— 已修

`coding-agent/src/core/settings-manager.ts` 的 `getShellPath()` 曾读 `process.env.PI_SHELL_PATH`，
那是**我们往 Pi 源码里加的**。用户点「更新 Pi」= 从 npm 装官方原版 = 这段代码不存在 =
外层继续传一个没人读的环境变量，且毫无察觉。

而 Pi 本来就有 `Settings.shellPath`（同文件 `setShellPath` API，注释写「e.g. for Cygwin
users on Windows」）。所以不需要改 Pi。

**改法**：`AppSettingsStore.setShellPath()` 现在把值写进 Pi 自己的
`PI_CODING_AGENT_DIR/settings.json`（缺省 `~/.pi/agent`，合并写、不覆盖用户其他设置），
spawn 侧不再传 `PI_SHELL_PATH`。`getShellPath()` 现已与上游逐字节一致，只留一段说明
「不要在这里加环境变量旁路」的注释。

副作用：`packages/coding-agent/test/settings-shell-path.test.ts` 整个删除——它只为测这个
补丁而存在。desktop 侧补了 4 个测试（写入 / 保留其他设置 / 清除 / 隔离 agent dir）。
**测试里必须设 `PI_CODING_AGENT_DIR` 到临时目录**，否则会污染用户真实的 `~/.pi/agent/settings.json`。

### 3.3 ✅ Pi 更新报「退出码 1」—— 已修（不是网络问题）

**症状**：客户端点更新 Pi 报 `Pi 安装失败（退出码 1），请检查 npm 网络与配置`。

**根因：父进程 npm 的环境变量泄漏进子 npm。** 应用由 `npm start` 启动，npm 会把项目
`.npmrc` 的设置转成 `npm_config_*` 注入子进程；`runNpmInstall` 原来用
`env: { ...process.env }` 原样传给子 npm，于是两条策略生效：

| 来源 | 配置 | 后果 |
| --- | --- | --- |
| 仓库 `.npmrc` | `min-release-age=2` | 拒绝安装发布不满 2 天的版本 |
| 用户 `~/.npmrc` | `registry=npmmirror` | 从镜像装，但版本是从 npmjs 查的 |

updater 先向 `registry.npmjs.org` 查最新版（当时 0.99.1，当天发布），再让子 npm 装这个
固定版本 → `ETARGET: No matching version found ... with a date before 2026/9/28`。

**放大问题**：`child.stdout.resume()` 把 npm 输出整个丢掉，所以只报「请检查网络与配置」，
跟真实原因毫无关系。

**修法**（`pi-runtime-updater.ts`）：
- 显式 `--registry=https://registry.npmjs.org`，与查版本同源
- 显式 `--min-release-age=0`（Pi 自身自更新 `config.ts` 也是这么做的）
- 新增 `buildInstallEnv()`：剥掉所有 `npm_config_*` / `npm_*` 环境变量
- 保留 stderr 但只提取 `npm error code XXX`（不含凭据）带进报错

**验证**：`test/pi-npm-install.test.ts` 3 个测试锁住上述行为；`git stash` 回退 updater 后
这 3 个测试 3/3 失败，修复后 3/3 通过。另用真实 npm + 真实 registry 跑通完整安装。

### 3.4 ✅ 定位条压字 + 代码块三件套 —— 已修

**定位条**（OpenSpec `transcript-minimap-gutter`）：`.transcript-minimap` 绝对定位
`left:12px; width:28px`（占 x ∈ [12,40]），`.message` 是 `max-width:760px; margin:0 auto`。
转录视口窄于 `760+56=816px` 时消息列铺满、左边缘固定 x=28，**恒定重叠 12px**。
1600px 窗口 + 开文件看板即触发。改成 `.transcript` 的同级 flex 列（`flex: 0 0 40px;
align-self: stretch; margin: 20px 0`），横向不重叠由布局保证。保留 `pointer-events: none`。

`boundingBox` 实测：旧 CSS overlap=12px，新 CSS overlap=0px（正文列窄 40px，可把 `flex`
收到 32px）。

> 早期文档写「窄窗 ≤760px 隐藏定位栏」，实为 **980px**（`styles.css`），已更正。

**代码块**（新增 `e2e/code-block.e2e.ts`）：
- 「折叠」原本只是把滚动框 420px→150px 且 `overflow` 仍为 `auto`，**内容一行没截断**，视觉上等于坏掉。改为真折叠：`overflow: hidden` + 底部渐隐遮罩 + 「展开全部代码」按钮
- 默认改为换行（`useState(true)`）——桌面端代码列窄，不换行几乎每块都有横向滚动条
- 工具栏原本 `font-size: 9px` + 给 UI 按钮套 monospace，违反 DESIGN.md「monospace 只留给
  代码/路径/命令」。改为 11px 无衬线，开启态用 muted green；只有语言标签保留等宽
- 删除死 CSS `.message-code-language`（全仓库只有它自己引用，组件实际用 `.message-code-toolbar > span`）
- 按钮文案由 `自动换行`/`不换行` 改为固定 `换行` + active 态高亮（原来切换时标签变长度，导致工具栏宽度跳动）

### 3.5 ✅ Pi 私有补丁已清零 —— 「更新 Pi」恢复可用

`openspec/changes/pi-update-resilience/`。代码在工作区（见「六」）。

**结论：`packages/coding-agent/src/modes/rpc/` 与上游逐字节一致，私有命令 7 → 0。**
`git diff 9cf21c8 -- packages/coding-agent/src/modes/rpc/` 输出 0 行。

| 动作 | 状态 |
| --- | --- |
| 删「循环模型范围」+ `get/set_scoped_models` | ✅ 零行为效果，删除无代价 |
| 删「设为 X Agent 默认」+ 设置页角色默认模型区块 | ✅ 彻底移除，不保留读取兼容 |
| 删剩余 5 个私有命令 | ✅ 用户拍板：取舍「保留更新」 |
| 删 `get_commands` 补丁（第 6 处） | ✅ 随 RPC 层整体回退 |
| 删私有命令清单 / 探针钩子 / UI 降级 | ✅ 清单已空，整套机制无对象可探 |

**为什么必须走到清零。** 上一轮把探针加严到「缺私有命令就拒绝激活」，结果 stock Pi
必然缺 —— 于是「更新 Pi」按钮**永远失败**。探针挡住了静默失效，但把更新本身也挡住了。
取舍只能是二选一：要么保留 5 个命令并且不能更新，要么删掉它们并且能更新。用户选了后者。

**删除的 5 个命令与实际损失**（`design.md` 第七节有「无原生替代」的证据）：

| 命令 | 原入口 | 删除后 |
| --- | --- | --- |
| `get_auth_providers` / `login_provider` / `logout_provider` | `/login` `/logout` | **OAuth 登录没了**。改用环境变量或手写 `~/.pi/agent/auth.json` |
| `import_jsonl` | `/import` | 导入外部 jsonl 没了。`/resume` 走原生 `switch_session`，**不受影响** |
| `reload` | `/reload` | 改为重启 Pi 进程实现，**功能保留**（见下） |

**`/login` 的替代路径不存在，这是本次唯一实质损失。** Pi 的扩展 API 只能*注册*
OAuth provider，不能*发起*登录（`ExtensionContextActions` 无对应动作，`/login` 仅
终端 UI 层可执行）。手动输入 `/login` 会得到明确说明，不再是 `Unknown command`。
若要恢复，只能向上游提 issue（`tasks.md` 6.1，**本轮未做**）。

**`/reload` 用重启实现，不是删掉。** Pi 以 `--session-dir <agent.sessions> --continue`
启动，`agent-registry.ts:125` 给每个 Agent 建独立 `sessions/` 目录，所以重启后
`--continue` 恢复的正是当前会话。代价是进行中的流式回复会中断 —— 原地重载没有了，
但功能本身保住了。

**斜杠菜单不依赖任何补丁。** `loadPiBuiltinCommands` 直接读当前运行那份 Pi 的
`dist/core/slash-commands.js` 并自己过滤 `DESKTOP_BUILTINS`，不碰 Pi 源码。所以
stock Pi 下菜单依然是全的，`DESKTOP_BUILTINS` 里删掉的 `import` / `login` / `logout`
不会露出「点了报错」的入口。

**`settings-manager.ts` 的重试默认值补丁保留**（`maxRetries` 3→5 等）。它不是协议
命令，不参与探针，升级后丢失也只是回到上游默认值，不影响功能 —— 属于有意调优，
按「删除前先问」保留。

### 3.6 权限出厂默认值要不要收回来（待用户拍板）

`e591860` 把 5 个默认值全改成了 `allow`。复查判断：**只有 `skills: allow` 是必须的**
（`skill-prompt-sanitizer.ts:246` 会把非 allow 的 Skill 从 system prompt 的
`<available_skills>` 整个删掉，等于让模型看不见 Skill）。`bash` / `mcp` /
`externalDirectory` 用 `ask` 更合理。**用户尚未拍板。**

---

## 四、已知问题（不是本次引入，别误判为回归）

### 4.1 `workflow.e2e.ts` minimap 用例间歇性失败

**现象**：第 2 个 prompt 之后流式输出停住，`toHaveCount` 拿不到第 N 条回复（失败行常在 86 或 146，都在 prompt 循环里）。

**不是超时**：fake Pi（`e2e/fixtures/fake-pi-rpc.mjs:47-72`）是同步无条件回复的，prompt 根本没送到 Pi 进程。方向在 `PiRpcProcess` 那条链上（事件流丢失 / prompt 未写出）。

**不是本次改动引入（已用 `git stash` 严格验证）**：把 `styles.css` + `workflow.e2e.ts` 一起 stash、重新 build 后跑基线，**5/5 全部失败在同一行 86**。

**副作用**：这个 flake 会**先于**新加的重叠断言失败，所以「minimap 用例是否通过」不能用来判断 3.4 的修法对错。已另写独立探针（只发 2 轮，绕开 8 轮循环）对比两种 CSS 验证，探针已删除。

**试过但无效的猜测性修法**（已精确回退）：
- 等发送按钮恢复可见再发下一条
- 把 `toHaveCount` 超时从 8s 放大到 30s

**建议**：单独开 issue 排查 `codepiddy-core/src/pi-rpc-process.ts` 的命令写出与事件分发。**修好之前，任何依赖多轮 prompt 的 e2e 断言都不可信。**

### 4.2 CI 完全跑不到真实 Pi

- `e2e/helpers/app.ts:37` 用 `CODEPIDDY_PI_CLI` 把真 Pi 换成 `fake-pi-rpc.mjs`
- `.github/workflows/ci.yml` 连 `playwright test` 都不跑，也不跑 `build:codepiddy-runtime`

所以「用户点更新 Pi 导致外壳破坏」这类问题在 CI 里 100% 不可见。

### 4.3 stock Pi 0.99.1 下 4 个功能失效（历史事实，Pi 已回滚）

**这不是待推测的风险，是已发生并已实测确认过的事实。** 当时的证据：

1. `active.json` = `{"version":"0.99.1","installId":"v0.99.1-5d8b3dd1-..."}`
2. 进程命令行确认外壳在跑它：
   `node ...\pi-updates\versions\v0.99.1-*\dist\bundle\cli.js --mode rpc`
3. 直接对那份 Pi 发命令（探针，已删）：
   ```
   OK    get_state (原生)              正常
   OK    get_commands (原生)           正常
   FAIL  get_scoped_models             Unknown command
   FAIL  get_auth_providers            Unknown command
   FAIL  import_jsonl                  Unknown command
   ```

**失效清单**（用户已独立确认 `/reload` 失效）：

| 功能 | 入口 | 当时状态 | 现在 |
| --- | --- | --- | --- |
| 选择模型（一级弹窗） | 模型选择器 | ✅ 全原生命令，正常 | ✅ 不变 |
| 循环模型范围（二级） | 一级弹窗内按钮 | ❌ | **已删除**（见「三.5」） |
| 设为 X Agent 默认 | 一级弹窗内按钮 | ✅ | **已删除**（见「三.5」） |
| `/reload` | 斜杠命令 | ❌ 用户已确认 | 探针拦截 + 菜单摘除 |
| `/import` | 斜杠命令（**无独立按钮**，`importSession` 只在 `index.ts` 一处被调用） | ❌ | 探针拦截 + 菜单摘除 |
| `/login` `/logout` | 斜杠命令 + provider id | ❌ | 探针拦截 + 菜单摘除 |

**主流程完全不受影响**：建项目 → 建需求 → 建 Agent → 聊天 → 工具调用，一条都不碰这 4 个功能。
这就是为什么「更新完看着没失效」。

**三个容易误判的点**：

- 「选择模型」弹窗当时是**两级**的。一级用 `getState` / `getAvailableModels` /
  `getAvailableThinkingLevels`（全原生），二级「循环模型范围」才踩 `get_scoped_models`。
  只测一级会误判为「没坏」。二级现已删除。
- 探针放行的原因：`probePiUpdate` 原来只验 4 个原生命令，stock Pi
  必然通过；回滚只在启动失败时触发，而握手永远正常。**已修**，见「三.5」。
- **`get_commands` 也不一样。** stock Pi 返回 `[]`，而桌面端另外直接读那份 Pi 的
  `slash-commands.js` 重建菜单 —— 所以菜单**照常显示** `/login`，点了才报错。
  这是第三类私有补丁，之前的分析漏了。**已修**，见「三.5」。

**处置已完成，见「三.5」。** Pi 已按「三.0」回滚。

### 4.4 两种扩展 Pi 的机制寿命完全不同

| 机制 | 做法 | 升级后 |
| --- | --- | --- |
| 扩展注入 | 外壳传 JS 文件，Pi 自己 `load`（`--extension`） | ✅ 活 |
| 改源码 | 编辑 Pi 的 `.ts`，加 `case` | ❌ 死 |

`permission.js`、`tavily-tool.js` 走前者；RPC 协议补丁走后者 —— 原来 7 个私有命令，
**现为 0 个**（`pi-update-resilience` 已把整个 `modes/rpc/` 回退到与上游逐字节一致）。
**以后要扩展 Pi，优先用扩展注入。** `settings-manager.ts` 的 `PI_SHELL_PATH` 也已按这个
思路改成写 Pi 原生 `settings.json`，`getShellPath()` 现与上游逐字节一致。

**第三类补丁不是「新命令」而是「改已有命令」。** `get_commands` 在 stock Pi 里返回
`[]`（只有扩展与 Skill），我们的版本改成读 `BUILTIN_SLASH_COMMANDS`。
这类改动在 `git diff` 里看起来只是几行 `map`/`filter`，但它决定了**斜杠菜单里有什么**，
而 `pi-builtin-commands.ts` 还会绕开 `get_commands` 直接读那份 Pi 的
`slash-commands.js` 重建一次菜单 —— 两条通路必须一起看，只查一条会得出错误结论。

剩余 5 个私有补丁确认无原生替代（证据见 `pi-update-resilience/design.md` 第七节）：
`BUILTIN_SLASH_COMMANDS` 只被 `interactive-mode.ts` 消费，`rpc-mode.ts:808` 只用于列举；
扩展 API 的 `ProviderConfig.oauth` 注释写明「OAuth provider for /login support」，
即扩展只能*注册* OAuth provider 不能*发起*登录；`ExtensionContextActions` 只有只读的
`getScopedModels`，无 setter。

### 4.5 role-guard 和 provider 扩展从未被加载

`packages/codepiddy-role-guard-extension/` 和 `packages/codepiddy-provider-extension/` 参与了 `npm run check` 的 typecheck，但**不在 spawn 参数里**（`main/index.ts:959-966` 只加载 `permission.js` 和 `tavily-tool.js`）。

后果：「Review 不许改生产代码」「需求分析不跑 shell」目前只是 `role-profiles.ts` 里的自然语言，**没有代码级强制**。用户已明确表示这个「目前就这样」，暂不处理。

### 4.6 userData 路径开发态与打包态不一致

- 开发态（`electron .`）：`%APPDATA%\@codepiddy\desktop\`
- 打包态（用 `productName`）：`%APPDATA%\CodePIddy\`

`%APPDATA%\CodePIddy\settings\shell.json` 是早前手工建在**错误路径**的，应用从没读过。开发态真实的 `settings/` 下只有 `permission-defaults.json`。

### 4.7 权限引擎 4 层策略只有 1 层生效

引擎设计了 global / project / agent / projectAgent 四层，CodePIddy 只用 global（`<userData>/permissions/policy/pi-permissions.jsonc`）。ADR-0006:15 承诺的「Role 映射到 per-agent 权限」**没有落地**。

### 4.8 权限扩展 bundle 里 inline 了一份旧 Pi

`build-codepiddy-runtime.mjs:16-35` 用 `bundle: true` 且无 `external`，把本地 Pi 的 `dist/index.js` 模块图（6.37 MB）inline 进 `permission.js`。进程里跑两份 Pi（用户装的新版 + 内联的旧版），各自算 `getAgentDir`。当前靠外层传 `PI_PERMISSION_SYSTEM_POLICY_AGENT_DIR` 覆盖，配置路径没事。

---

## 五、环境备忘

| 项 | 值 |
| --- | --- |
| Node | v24.14.1 |
| 全局 Pi | `@earendil-works/pi-coding-agent@0.85.1` |
| 内置 Pi 版本 | 0.85.1（`packages/coding-agent/package.json:3`） |
| 当前实际运行的 Pi | **内置 0.85.1**（`active.json` 已删，0.99.1 已回滚） |
| Git Bash | `D:\git\Git\bin\bash.exe`（非标准路径，这正是 Shell 设置存在的原因） |
| Electron | `node_modules/electron/dist/electron.exe` 已装 |
| `gh` CLI | **未安装**，无法本地查 Actions 状态 |
| 截图命令 | `node --import tsx packages/codepiddy-desktop/scripts/capture-screenshots.mts` |

启动 GUI 的坑：**不要给 `Start-Process` 加 `-RedirectStandardOutput`**。句柄会挂在 shell 上，Electron 不关就不写 EOF，工具调用会一直卡到超时。正确写法：

```powershell
Start-Process npm.cmd -ArgumentList "start","--workspace=@codepiddy/desktop" `
  -WorkingDirectory "E:\My-PI-development-workflow-main"
```

---

## 六、常用命令

```powershell
# 构建
npm run build:codepiddy                    # 四个包，desktop 前置依赖
npm run build:codepiddy-runtime            # 打包态运行时（含 skills、npm、jiti）

# 类型检查
npm run typecheck --workspace=@codepiddy/shared
npm run typecheck --workspace=@codepiddy/core
npm run typecheck --workspace=@codepiddy/desktop

# 单测（必须指定包，不要用 --root ..，会跑到全仓 e2e）
cd packages/codepiddy-core    && node "$(git rev-parse --show-toplevel)/node_modules/vitest/dist/cli.js" --run
cd packages/codepiddy-desktop && node "$(git rev-parse --show-toplevel)/node_modules/vitest/dist/cli.js" --run

# e2e（先 build）
cd packages/codepiddy-desktop && npx playwright test e2e/workflow.e2e.ts --reporter=list

# OpenSpec
npx openspec validate <change-name> --strict
```

**当前基线**（本轮实现后）：core **23** passed / 5 files；desktop **81** passed / 16 files；
e2e **16** passed / 1 failed（失败项即 4.1 的既有 flake，`--repeat-each=3` 三次都挂在
`workflow.e2e.ts:86` 或 `:146`，每次恰好少一条回复，轮次随机 —— 竞态而非确定性断裂，
且 `pi-rpc-process.ts` 的 `prompt()` / `send()` / `handleLine()` 本轮一字未动）。

`npx tsgo --noEmit` 全仓干净。`biome check` 的诊断集与 HEAD **完全一致**
（12 条，全部来自 `desktop-work-panel` 那轮的 `WorkPanel.tsx` / `StreamStats.tsx` /
`ToolCallCard.tsx` / `work-panel.test.ts` / `workspace-fs.test.ts`，
本轮**没新增任何一条**）。注意 `npm run check` 会跑 `biome check --write`，
它会顺手改写这些历史遗留文件 —— 想确认自己有没有引入新问题，用 `git worktree add --detach`
拉一份 HEAD 出来对比诊断列表，别在主工作区跑 `--write`。

**三个 OpenSpec change 全部 `validate --strict` 通过**：
`desktop-work-panel`、`transcript-minimap-gutter`、`pi-update-resilience`。

---

## 七、压缩 / 合并前提醒

1. **十个提交未 push**：`4051b61`、`e591860`、`4db2049`、`2d5336d`、`0d3f25b`、`5a9014f`、`647cf1b`、`5315fd4`、`357bece`、`bda227b`。压缩前先决定是否 push，避免丢。
2. **工作区有 `pi-update-resilience` 的实现未提交**（16 个文件）。建议拆成 3 个 commit：
   - `refactor: drop the scoped model configuration`（任务组 1，10 文件）
   - `refactor: drop the role default model setting`（任务组 2，8 文件）
   - `fix: refuse to activate a Pi without the private protocol`（任务组 3+4，6 文件 + 2 新测试）
   验证都已做过：typecheck / build / 单测 / e2e / `openspec validate --strict`，
   探针逻辑做过「把哨兵探针改成永远返回可用 → 3 个测试失败」的反向验证。
3. `4db2049` 改了 19 个文件、跨 5 个包，压缩成一个提交时 commit message 建议保留「删了什么」和「为什么删死文件」这两段，否则以后没人知道 `.codepiddy/permissions.jsonc` 为什么消失。
4. `e591860`、`4db2049`、`5a9014f` 都改了同一片权限相关代码。若要 squash，注意 `permission-settings.ts` 的默认值、`tools.powershell` 映射与 `permission-settings.test.ts` 的断言必须一致。
5. **Pi 私有补丁已清零，但代价是丢了 OAuth 登录。** 「更新 Pi」恢复可用，代价是 `/login` `/logout` `/import` 已移除（`/reload` 改走重启保住）。恢复 OAuth 登录只能向上游提 issue（`tasks.md` 6.1，**本轮未做**）。
6. **改 Pi 源码前先想清楚**：优先用扩展注入（`--extension`）或 Pi 原生配置，不要再编辑 `packages/coding-agent/src`。见「四.4」。
7. **别再往 `modes/rpc/` 加 `case`。** 私有命令清单与探针机制已随补丁一起删除 —— 现在「外壳私有协议」为空，这是刻意的：清单机制只在还有私有命令时才有意义，而它唯一的用途（挡住不兼容版本）恰恰会把「更新 Pi」挡死。以后要扩展 Pi，走 `--extension` 或 Pi 原生配置（见「四.4」）。若将来不得不重新引入私有命令，探针要一并重建，否则又会回到「点更新 → 静默失效」。
8. **人工核对还欠两项**（`tasks.md` 5.6 / 6.1）：手动验 `/reload` 重启后能恢复当前会话；向上游提 issue（`login_provider` / `logout_provider` / `get_auth_providers` / `import_jsonl` 在 headless/RPC 模式缺失）。
