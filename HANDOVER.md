# 交接文档（HANDOVER）

> 日期：2026-09-30｜分支：`main`｜远端 `origin/main` = `db4b6e2`
> 本地领先远端 **3 个提交**（未 push）：`4051b61`、`e591860`、`4db2049`
> 工作区有**未跟踪**改动：`openspec/changes/transcript-minimap-gutter/`（本次新建，已 validate 通过）

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

## 二、本次会话的 4 个提交

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

## 三、待办（已确认但未做）

### 3.1 修 `powershell` 漏项 —— 建议优先

`permission-settings.ts:50-57` 的工具白名单：

```ts
tools: { read, grep, find, ls, write, edit }   // ← 少了 powershell
```

而 `coding-agent/src/cli/args.ts:440` 里 `powershell` 是 Windows 上的 Pi 内置工具。默认全 allow 时无感，**一旦用户把「其他工具」收紧成每次询问，powershell 就绕过审批**。1 行的事。

### 3.2 撤掉 `PI_SHELL_PATH` 这个 Pi 补丁 —— 保护外壳

**这是「Pi 更新不要破坏外壳」这个诉求下唯一真正要做的事。**

`coding-agent/src/core/settings-manager.ts:997-999`：

```ts
getShellPath(): string | undefined {
	const shellPath = process.env.PI_SHELL_PATH?.trim() || this.settings.shellPath;
```

这个环境变量读取是**我们往 Pi 源码里加的**。用户点「更新 Pi」= 从 npm 装官方原版 = 这段代码不存在 = 外层 `index.ts:940` 拼了命传的 `PI_SHELL_PATH` 静默失效。

但 **Pi 本来就有这个设置项**（`settings-manager.ts:106-122` 的 `Settings.shellPath`，注释写「e.g., for Cygwin users on Windows」，还有 `setShellPath` API）。所以**根本不需要改 Pi** —— 外壳直接往 `~/.pi/agent/settings.json` 写 `shellPath` 即可，效果一样且不可能被更新破坏。

（另一个 Pi 补丁 `rpc-mode.ts:784` 的 `desktopSupportedBuiltins` 同样会丢，但 `pi-builtin-commands.ts:81` 有兜底，实际安全，不用管。）

### 3.3 权限出厂默认值要不要收回来

`e591860` 把 5 个默认值全改成了 `allow`。复查后的判断：**只有 `skills: allow` 是必须的**（`skill-prompt-sanitizer.ts:246` 会把非 allow 的 Skill 从 system prompt 的 `<available_skills>` 整个删掉，等于让模型看不见 Skill）。`bash` / `mcp` / `externalDirectory` 作为出厂默认用 `ask` 是合理的保守设计。

**用户尚未拍板**。若要收回，只改 `permission-settings.ts` 的常量 + `permission-settings.test.ts` 与两个 e2e 的断言。

### 3.4 定位条压字 —— OpenSpec 已写好，未实现

`openspec/changes/transcript-minimap-gutter/`，`openspec validate --strict` 通过。诊断结论：

- `.transcript-minimap` 绝对定位 `left: 12px; width: 28px`（`styles.css:2033-2042`），占 x ∈ [12, 40]
- `.message` 是 `max-width: 760px; margin: 0 auto`（`styles.css:113-116`）
- 转录视口窄于 `760 + 56 = 816px` 时消息列铺满，左边缘固定 x = 28
- **重叠恒为 12px**。典型触发场景：1600px 窗口 + 开文件管理器（转录区约 730px）
- 窄窗（≤760px）定位条 `display: none`、宽窗关面板时消息列居中，所以「时有时无」

成因是之前修「开面板正文被压缩」那次，把 `.transcript` 内边距从百分比改成固定 `28px`，不再随宽度留白。

推荐方案：定位条从绝对定位覆盖层改成 `.transcript` 的同级 flex 列（`flex: 0 0 40px; align-self: stretch`），横向不重叠由布局保证而非数值。详见该 change 的 `design.md`。

---

## 四、已知问题（不是本次引入，别误判为回归）

### 4.1 `workflow.e2e.ts` minimap 用例间歇性失败

**现象**：第二个 prompt 之后流式输出停住。Playwright 页面快照显示第 2 轮用户消息已渲染、状态「Pi 正在处理」、发送按钮 disabled，30 秒内等不到回复。

**不是超时**：fake Pi（`e2e/fixtures/fake-pi-rpc.mjs:47-72`）是同步无条件回复的，第 2 个 `prompt` 命令根本没送到 Pi 进程。方向在 `PiRpcProcess` 那条链上（事件流丢失 / prompt 未写出）。

**不是本次改动引入**：已用**未被本次修改的第一个用例**作为前驱测试复现，同样失败。

**试过但无效的猜测性修法**（已精确回退，`git diff` 里那个循环一字未动）：
- 等发送按钮恢复可见再发下一条
- 把 `toHaveCount` 超时从 8s 放大到 30s

**建议**：单独开一个 issue 排查 `codepiddy-core/src/pi-rpc-process.ts` 的命令写出与事件分发。不要在定位条那个 change 里顺手改。

### 4.2 CI 完全跑不到真实 Pi

- `e2e/helpers/app.ts:37` 用 `CODEPIDDY_PI_CLI` 把真 Pi 换成 `fake-pi-rpc.mjs`
- `.github/workflows/ci.yml` 连 `playwright test` 都不跑，也不跑 `build:codepiddy-runtime`

所以「用户点更新 Pi 导致外壳破坏」这类问题在 CI 里 100% 不可见。

### 4.3 role-guard 和 provider 扩展从未被加载

`packages/codepiddy-role-guard-extension/` 和 `packages/codepiddy-provider-extension/` 参与了 `npm run check` 的 typecheck，但**不在 spawn 参数里**（`main/index.ts:959-966` 只加载 `permission.js` 和 `tavily-tool.js`）。

后果：「Review 不许改生产代码」「需求分析不跑 shell」目前只是 `role-profiles.ts` 里的自然语言，**没有代码级强制**。用户已明确表示这个「目前就这样」，暂不处理。

### 4.4 userData 路径开发态与打包态不一致

- 开发态（`electron .`）：`%APPDATA%\@codepiddy\desktop\`
- 打包态（用 `productName`）：`%APPDATA%\CodePIddy\`

`%APPDATA%\CodePIddy\settings\shell.json` 是早前手工建在**错误路径**的，应用从没读过。开发态真实的 `settings/` 下只有 `permission-defaults.json`。

### 4.5 权限引擎 4 层策略只有 1 层生效

引擎设计了 global / project / agent / projectAgent 四层，CodePIddy 只用 global（`<userData>/permissions/policy/pi-permissions.jsonc`）。ADR-0006:15 承诺的「Role 映射到 per-agent 权限」**没有落地**。

### 4.6 权限扩展 bundle 里 inline 了一份旧 Pi

`build-codepiddy-runtime.mjs:16-35` 用 `bundle: true` 且无 `external`，把本地 Pi 的 `dist/index.js` 模块图（6.37 MB）inline 进 `permission.js`。进程里跑两份 Pi（用户装的新版 + 内联的旧版），各自算 `getAgentDir`。当前靠外层传 `PI_PERMISSION_SYSTEM_POLICY_AGENT_DIR` 覆盖，配置路径没事。

---

## 五、环境备忘

| 项 | 值 |
| --- | --- |
| Node | v24.14.1 |
| 全局 Pi | `@earendil-works/pi-coding-agent@0.85.1` |
| 内置 Pi 版本 | 0.85.1（`packages/coding-agent/package.json:3`） |
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

**当前基线**：core 23 passed / 5 files；desktop 64 passed / 14 files；e2e 15 passed（minimap 用例见 4.1）。

---

## 七、压缩 / 合并前提醒

1. **三个提交未 push**：`4051b61`、`e591860`、`4db2049`。压缩前先决定是否 push，避免丢。
2. **未跟踪目录** `openspec/changes/transcript-minimap-gutter/` 需要 `git add`。
3. `4db2049` 改了 19 个文件、跨 5 个包，压缩成一个提交时 commit message 建议保留「删了什么」和「为什么删死文件」这两段，否则以后没人知道 `.codepiddy/permissions.jsonc` 为什么消失。
4. `e591860` 和 `4db2049` 改的是同一片权限相关代码，若要 squash，注意 `permission-settings.ts` 的默认值和 `permission-settings.test.ts` 的断言必须一致。
