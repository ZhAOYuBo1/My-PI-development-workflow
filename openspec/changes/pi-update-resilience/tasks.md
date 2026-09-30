# Tasks

## 0. 前置：回滚 Pi

- [x] 0.1 `active.json` 已不存在（`rollback()` 的 bundled 分支就是 `rm(activeFile)`），`initialize()` 拿到 ENOENT → `selected = null` → 跑内置 0.85.1
- [x] 0.2 无需重启验证：`pi-updates/versions/` 下只剩 `v0.99.1-*`，没有任何记录引用它

## 1. 删除「循环模型范围」

- [x] 1.1 `renderer/App.tsx`：删 `scopedModelPickerAgentId` 状态、`openScopedModelPicker`、`toggleScopedModel`、`moveScopedModel`、`saveScopedModels`、`scopedModelPickerOptions`、`.scoped-model-picker` 弹窗 JSX、「循环模型范围」按钮、`/scoped-models` 斜杠分支、Esc 关闭分支、demo 命令表里那一项
- [x] 1.2 `preload/index.ts`：删 `getAgentScopedModels` / `setAgentScopedModels` 及其 channel 常量
- [x] 1.3 `main/index.ts`：删 `getScopedModels` / `setScopedModels` 方法与两个 IPC handler 与两个 channel
- [x] 1.4 `main/ipc-validation.ts`：删 `parseSetAgentScopedModelsInput`
- [x] 1.5 `packages/codepiddy-shared`：删 `AgentScopedModel` / `SetAgentScopedModelsInput` 与 `CodePIddyClientApi` 上的两个方法
- [x] 1.6 `coding-agent/src/modes/rpc/rpc-mode.ts`：删 `get_scoped_models` / `set_scoped_models` 两个 case，并把 `scoped-models` 从 `get_commands` 的 `desktopSupportedBuiltins` 里去掉
- [x] 1.7 `coding-agent/src/modes/rpc/rpc-types.ts`：删两个 `RpcCommand` 成员、两个 `RpcResponse` 成员、`RpcScopedModel` 接口
- [x] 1.8 `coding-agent/src/modes/rpc/rpc-client.ts`：删两个方法 —— **该文件现已与上游逐字节一致**（`git diff 9cf21c8` 里不再出现）
- [x] 1.9 `styles.css`：删 `.scoped-model-*` / `.scope-check` 规则
- [x] 1.10 `pi-builtin-commands.ts` 的 `DESKTOP_BUILTINS` 与 `e2e/model-and-slash.e2e.ts` 的 fixture 命令表同步去掉 `scoped-models`
- [x] 1.11 `core/pi-rpc-process.ts`：删两个方法与 `rpcRequestTimeoutMs` 里的 `set_scoped_models` 分支
- [x] 1.12 `tsgo --noEmit` 全仓干净（无悬空引用）

## 2. 删除「设为 X Agent 默认」

- [x] 2.1 `renderer/App.tsx`：删「设为…Agent 默认」按钮、`saveRoleModelDefault`、`clearRoleModelDefault`、`roleModelDefaults` state
- [x] 2.2 `renderer/App.tsx`：删设置页角色默认模型区块，`openSettings()` 少取一个字段
- [x] 2.3 **决定：彻底移除，不保留读取兼容。** 依据是 spec 写的「新建 Agent 跟随 Pi 当前模型配置」—— 只要启动路径还读 `role-model-defaults.json`，存量配置就仍然生效，功能就没删掉。所以连读带写一起删：
      - `settings-store.ts`：删 `roleDefaultsPath` 字段、四个方法、`isAgentRole`（随之无引用）
      - `main/index.ts`：删启动路径的 `getRoleModelDefault` 调用与那段「应用角色默认模型 + 失败广播 `agent_configuration_warning`」的整块逻辑
      - 三个 IPC channel、preload 桥、shared 的 `RoleModelDefault` / `RoleModelDefaults` 与 `CodePIddyClientApi` 三个方法
      - 磁盘上已有的 `role-model-defaults.json` 不删，只是不再被读
- [x] 2.4 `styles.css`：删 `.role-defaults` / `.role-default-list` / `.role-default-row` 规则与 700px 媒体查询里那两条
- [x] 2.5 确认 `main/index.ts` 启动路径不再出现 `roleModelDefault`

## 3. ⛔ 私有命令清单 + 探针加严 —— 已作废（第二轮全部删除）

> **本组整体作废。** 探针加严后 stock Pi 必然被拒，「更新 Pi」100% 失败。第一轮把
> 「不能静默失效」当成了不可动摇的前提，忽略了「不能更新」更不可接受。
> `pi-private-commands.ts` 及其测试已删除，`probePiUpdate` 回到只验 4 项原生命令。
> 下面保留原文以记录这段弯路。

- [x] 3.1 新建 `main/pi-private-commands.ts`，登记剩余 5 个命令，各带 `feature` 与 `probeSafe`
- [x] 3.2 `pi-rpc-process.ts` 增 `supportsCommand()`：只吞 `Unknown command: <type>`，其余（超时、进程死、别的报错）照常抛出
- [x] 3.3 `probePiUpdate` 在现有四项之后追加 `findMissingPiCapabilities()`
- [x] 3.4 拒绝激活时抛 `describeIncompatiblePi()`，含版本号与缺失项列表
- [x] 3.5 `installLatest()` 补测试：探针拒绝时不改动已有 `active.json`、清掉 staging、下次启动仍用旧版本

**探针只用 2 个哨兵，不是 5 个逐个探。** `login_provider` / `logout_provider` / `import_jsonl` 有副作用（OAuth、清凭据、导入会话），探针跑的是用户真实的 Pi，绝不能试。5 个 case 在同一个 vendored 文件的同一个 switch 里，所以哨兵（`reload` + `get_auth_providers`）全通即补丁齐全，有一个不通即整批缺失 —— 不可探测的 3 个也因此被覆盖。测试锁住这条：`a partial patch set is treated as fully unpatched`。

**另外发现一处 handoff 没记的私有补丁。** `get_commands` 本身也是被改过的：stock Pi 返回 `const commands: RpcSlashCommand[] = []`（只有扩展与 Skill），我们改成读 `BUILTIN_SLASH_COMMANDS`。而 `pi-builtin-commands.ts` 会直接读那份 Pi 的 `slash-commands.js`，所以 stock Pi 下 `/login` `/logout` `/import` `/reload` **照常出现在斜杠菜单里**，点下去才报 `Unknown command`。只探私有命令挡不住这个：菜单可见性要单独校验 `get_commands` 的返回。已加进清单的 `PI_BUILTIN_REQUIREMENTS`，它同时是「必须列出哪些内置命令」和「降级时摘掉哪些菜单项」的唯一依据。

## 4. ⛔ UI 降级 —— 已作废（无对象可降级）

> 私有命令清零后不存在「命令缺失」这种状态，`unavailablePiCommands()` /
> `unavailablePiCommandsCache` / `describeUnavailableBuiltin()` 全部删除。
> 改为在 `DESKTOP_BUILTINS` 层面直接不提供这些入口（见 7.4）。

- [x] 4.1 `AgentManager.getCommands()` 在两个来源合并**之后**过滤：缺能力的入口不进菜单。必须放在合并之后 —— 提前过滤会被 `mergePiCommands` 的兜底分支加回来
- [x] 4.2 手动输入不可用命令时，`describeUnavailableBuiltin()` 给出「当前运行的 Pi x.y.z 不支持 /login，该功能需要 Pi 的 get_auth_providers 命令。请在设置里回滚到内置 Pi 版本。」，不再泄漏 `Unknown command` 原文
- [x] 4.3 探测结果按「Pi 二进制 + 版本号」缓存（`unavailablePiCommandsCache`），能力是那份安装的属性而非会话的属性，而探测要占两个 RPC 往返

## 5. 验证

- [x] 5.1 `tsgo --noEmit` 全仓干净
- [x] 5.2 `npm run build:codepiddy` 通过
- [x] 5.3 单测：core 23 passed / 5 files；desktop 81 passed / 16 files（本轮 +11：`supportsCommand` 1、清单与探针 10、拒绝激活不动 `active.json` 1，减去删掉的 scoped 2 个）
- [x] 5.4 补丁面确认下降：`git diff 9cf21c8 --stat -- packages/coding-agent/src` 从 **4 文件 215 插入** 降到 **3 文件 151 插入**，`rpc-client.ts` 完全退出 diff。RPC 协议层单独看是 208 → 150 行，私有命令 7 → 5
- [x] 5.5 人工核对改用产物级检查：本次构建的 `index-*.js` / `index-*.css` 里搜不到「循环模型范围」「角色默认模型」「scoped-model」「role-default」
      （`dist/renderer/assets/` 里有 5 组旧哈希文件是历史遗留，别被它们误导）
- [ ] 5.6 人工核对：在 0.85.1 下 `/reload`、`/login`、`/import` 仍正常 —— **需要人点，本轮未做**
- [x] 5.7 e2e 16 passed / 1 failed，失败项即 HANDOVER 四.1 的既有 flake

## 6. 文档

- [ ] 6.1 向上游提 issue：`login_provider` / `logout_provider` / `get_auth_providers` / `import_jsonl` 在 headless/RPC 模式缺失 —— **需要人提，本轮未做**
- [x] 6.2 更新 `HANDOVER.md`
- [x] 6.3 README 无需改：`packages/codepiddy-desktop/README.md` 从未描述过模型选择器或角色默认模型

## 7. 私有补丁清零（第二轮，用户拍板「保留更新」）

### 7.1 Pi 源码回退

- [x] 7.1.1 `git checkout 9cf21c8 -- packages/coding-agent/src/modes/rpc/rpc-mode.ts rpc-types.ts` —— 连带回退 5 个私有命令**与** `get_commands` 补丁（第 6 处）
- [x] 7.1.2 验证：`git diff 9cf21c8 -- packages/coding-agent/src/modes/rpc/` 输出 **0 行**
- [x] 7.1.3 决定：`settings-manager.ts` 的重试默认值补丁**保留**（非协议命令、不参与探针，属有意调优）

### 7.2 外壳侧删除

- [x] 7.2.1 `codepiddy-core/src/pi-rpc-process.ts`：删 `importSession` / `getAuthProviders` / `loginProvider` / `logoutProvider` / `reload` / `supportsCommand`，以及 `rpcRequestTimeoutMs` 里的 `reload` 分支
- [x] 7.2.2 删除 `codepiddy-desktop/src/main/pi-private-commands.ts` 与 `test/pi-private-commands.test.ts`
- [x] 7.2.3 `main/index.ts`：删清单 import、探针里的 `findMissingPiCapabilities` 调用、`unavailablePiCommands()` + `unavailablePiCommandsCache`、`describeUnavailableBuiltin` 守卫
- [x] 7.2.4 顺手修掉 `main/index.ts` 缓存 key 里的一个字面量 NUL 字节（原本让整个文件被 git / ripgrep 当二进制）

### 7.3 功能处置

- [x] 7.3.1 `/reload` 改为调用既有 `AgentManager.reconnect()` —— 每个 Agent 的 `sessions/` 目录独立（`agent-registry.ts:125`）+ `--continue`，重启后恢复的正是当前会话
- [x] 7.3.2 `/login` `/logout` 合并为一个分支，返回明确的替代路径说明（环境变量 / `~/.pi/agent/auth.json`），不再是 `Unknown command`
- [x] 7.3.3 `/import` 分支删除，`/resume` 保留（走原生 `switch_session`）

### 7.4 菜单

- [x] 7.4.1 `pi-builtin-commands.ts` 的 `DESKTOP_BUILTINS` 删掉 `import` / `login` / `logout`，保留 `reload`
- [x] 7.4.2 `e2e/model-and-slash.e2e.ts` 的 fixture 命令表同步
- [x] 7.4.3 确认 `loadPiBuiltinCommands` 读文件不碰源码 —— 这是清零后菜单仍完整的前提

### 7.5 测试

- [x] 7.5.1 `codepiddy-core/test/pi-rpc-process.test.ts`：删 `supportsCommand` 用例，`importSession` 从 resume 用例中移除
- [x] 7.5.2 `test/pi-runtime-updater.test.ts`：「拒绝激活不动 `active.json`」这条不变量**保留**，措辞从「协议不兼容」改为通用校验失败
- [x] 7.5.3 core 单测 22 passed / 5 files；desktop 单测 71 passed / 15 files
- [x] 7.5.4 e2e 16 passed / 1 failed，失败项为 `workflow.e2e.ts` minimap 用例 —— HANDOVER 4.1 记录的既有 flake（同一行 86，已用 stash 验证与本改动无关）
- [x] 7.5.5 `tsgo --noEmit` 干净；`npm run build`（e2e 前置）通过

### 7.6 文档

- [x] 7.6.1 `HANDOVER.md` 三.5 重写为「补丁清零」，四.4 与文末注意事项同步
- [x] 7.6.2 `proposal.md` / `design.md` / `spec.md` 记录决策反转与理由
- [ ] 7.6.3 人工核对：`/reload` 重启后确实恢复当前会话 —— **需要人点，本轮未做**
