# Tasks

## 0. 前置：回滚 Pi

当前 `active.json` 指向 stock Pi 0.99.1，4 个功能已失效（见 proposal）。在动代码前先回滚到 0.85.1，避免验证期间踩坑。

- [ ] 0.1 界面设置页点「回滚」，或直接改 `%APPDATA%\@codepiddy\desktop\pi-updates\active.json` 指向 bundled
- [ ] 0.2 重启应用，确认进程命令行回到 `packages\coding-agent\src\cli.ts`（dev 态）

## 1. 删除「循环模型范围」

- [ ] 1.1 `renderer/App.tsx`：删 `scopedModelPickerAgentId` 状态、`openScopedModelPicker`、`toggleScopedModel`、`saveScopedModels`、`useAllModels`、`.scoped-model-picker` 弹窗 JSX、「循环模型范围」按钮
- [ ] 1.2 `preload/index.ts`：删 `getAgentScopedModels` / `setAgentScopedModels` 及其 channel 常量
- [ ] 1.3 `main/index.ts`：删 `getScopedModels` / `setScopedModels` 方法与两个 IPC handler
- [ ] 1.4 `main/ipc-validation.ts`：删 `parseSetAgentScopedModelsInput`
- [ ] 1.5 `packages/codepiddy-shared`：删 `AgentScopedModel` / `SetAgentScopedModelsInput`
- [ ] 1.6 `coding-agent/src/modes/rpc/rpc-mode.ts`：删 `get_scoped_models` / `set_scoped_models` 两个 case
- [ ] 1.7 `coding-agent/src/modes/rpc/rpc-types.ts`：删对应 `RpcCommand` 与 `RpcResponse` 成员
- [ ] 1.8 `coding-agent/src/modes/rpc/rpc-client.ts`：删两个方法
- [ ] 1.9 `styles.css`：删 `.scoped-model-*` 规则
- [ ] 1.10 `npm run typecheck` 三个包全干净（确认无悬空引用）

## 2. 删除「设为 X Agent 默认」

- [ ] 2.1 `renderer/App.tsx`：删「设为…Agent 默认」按钮、`saveRoleModelDefault`
- [ ] 2.2 `renderer/App.tsx`：删设置页角色默认模型区块（`role-default-list` 及 `clearRoleModelDefault` 调用点）
- [ ] 2.3 决定 `clearRoleModelDefault` / `setRoleModelDefault` IPC 与 `role-model-defaults.json` 的去留：
      - 若彻底移除功能 → 删 `settings-store.ts` 的四个方法、preload 桥、IPC、`main/index.ts` 的 `getRoleModelDefault` 调用、shared 类型
      - 若保留读取兼容（已有存量配置） → 保留读取，停止写入
- [ ] 2.4 `styles.css`：删 `.role-default-*` 规则
- [ ] 2.5 确认 `main/index.ts` 启动路径不再读 `getRoleModelDefault`

## 3. 私有命令清单 + 探针加严

- [ ] 3.1 新建单一常量清单（如 `main/pi-private-commands.ts`），登记剩余 5 个：`reload`、`get_auth_providers`、`login_provider`、`logout_provider`、`import_jsonl`，并标注每项是否可安全探测
- [ ] 3.2 `pi-rpc-process.ts` 增一个「探测用」方法：发命令并把 `Unknown command` 识别为「不支持」而非异常
      - 注意：`import_jsonl` 有副作用（会真的导入会话），**不得用于探测**。清单里标 `probeSafe: false`
- [ ] 3.3 `probePiUpdate` 在现有四项之后追加探测：`probeSafe: true` 的命令逐个发，收到 `Unknown command` 即中止
- [ ] 3.4 拒绝激活时抛出可读错误：包含版本号与缺失命令名列表，例如
      `Pi 0.99.1 缺少外壳依赖的命令：reload、import_jsonl。该版本部分功能不可用，已保留原版本 0.85.1。`
- [ ] 3.5 确认 `installLatest()` 的 catch 分支会清理 staging 并保留 `active.json` 不变（现有逻辑已覆盖，补测试断言）

## 4. UI 降级

- [ ] 4.1 `pi-builtin-commands.ts` 的 `DESKTOP_BUILTINS` 增「不可探测时默认降级」的标记：探测未通过的 `/login` `/logout` `/import` `/reload` 不进斜杠菜单
- [ ] 4.2 若用户手动输入了不可用命令，返回明确原因而非 `Unknown command` 原文
      （现状是 `index.ts:865` 抛「当前桌面客户端不支持 Pi 内置命令：/xxx」，需扩展为区分「客户端不支持」与「当前 Pi 版本不支持」）

## 5. 验证

- [ ] 5.1 `npm run typecheck` shared / core / desktop
- [ ] 5.2 `npm run build:codepiddy`
- [ ] 5.3 desktop 单测全通过（新增：探针拒绝激活、清单一致性、降级过滤）
- [ ] 5.4 `git diff 9cf21c8..HEAD --stat -- packages/coding-agent/src` 确认补丁行数下降
- [ ] 5.5 人工核对：模型选择器只剩一级，无「循环模型范围」与「设为默认」；设置页无角色默认模型区块
- [ ] 5.6 人工核对：在 0.85.1 下 `/reload`、`/login`、`/import` 仍正常

## 6. 文档

- [ ] 6.1 向上游提 issue：headless/RPC 模式缺少 `login_provider` / `logout_provider` / `get_auth_providers` / `import_jsonl`，附本文档 design.md 第七节的证据
- [ ] 6.2 更新 `HANDOVER.md`：剩余 5 个私有命令的处置结论与上游 issue 链接
- [ ] 6.3 README 若有「循环模型范围」相关描述需同步删除
