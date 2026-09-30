# Spec Delta

## Purpose

规定 CodePIddy 与 Pi 之间的能力边界：外壳 SHALL NOT 修改 Pi 源码来获得 stock Pi 没有的
能力。「更新 Pi」SHALL 保持可用，这是外壳唯一不能牺牲的属性。

> 本节曾要求「登记私有命令 + 探针加严 + UI 降级」。实测证明该方案会让「更新 Pi」100% 失败
> （stock Pi 必然缺全部私有命令），因此改为要求**私有命令为空**。见 `design.md` 第五节。

## ADDED Requirements

### Requirement: 外壳不得依赖 Pi 私有协议

外壳 SHALL NOT 通过编辑 `packages/coding-agent/src/`（Pi 的 vendored 副本）来获得功能。
`packages/coding-agent/src/modes/rpc/` SHALL 与上游基线逐字节一致。扩展 Pi SHALL 走
`--extension` 注入或 Pi 原生配置。

#### Scenario: 补丁面为零

- **WHEN** 审查 `git diff` 中 `packages/coding-agent/src/modes/rpc/` 的改动
- **THEN** 输出为空，即无任何私有 RPC 命令

#### Scenario: 更新不被私有能力挡死

- **WHEN** 用户对 stock Pi 执行「更新 Pi」
- **THEN** 探针只校验握手与原生命令，SHALL 通过并正常激活，SHALL NOT 因缺少私有命令而拒绝

### Requirement: 拒绝激活时不得改动已激活版本

`probePiUpdate` 失败时 SHALL 保留原版本，SHALL NOT 写入 `active.json`，SHALL 清理 staging 目录。此不变量与失败原因无关。

#### Scenario: 探针失败不污染 active.json

- **WHEN** 探针抛出校验失败
- **THEN** 更新失败，`active.json` 保持指向原版本，staging 目录被清空，下次启动仍用原版本

### Requirement: 失去的能力不得静默消失

因删除私有命令而移除的功能 SHALL NOT 继续出现在斜杠菜单中。用户手动输入这些命令名时，SHALL 得到说明替代路径的明确提示，SHALL NOT 抛出 `Unknown command`。

#### Scenario: 菜单不露出失效入口

- **WHEN** 用户打开斜杠菜单
- **THEN** `/login` `/logout` `/import` 不出现（`DESKTOP_BUILTINS` 已移除），`/reload` 正常出现

#### Scenario: 手动输入已移除的命令

- **WHEN** 用户手动输入 `/login`
- **THEN** 返回说明「改用环境变量或 `~/.pi/agent/auth.json`」的消息，SHALL NOT 出现 `Unknown command`

### Requirement: 斜杠菜单不依赖 Pi 源码补丁

内置斜杠命令 SHALL 由外壳直接读取当前运行那份 Pi 的 `dist/core/slash-commands.js` 并自行过滤，SHALL NOT 依赖对 `get_commands` 的修改。

#### Scenario: stock Pi 下菜单完整

- **WHEN** 当前运行的是 stock Pi（`get_commands` 只返回扩展与 Skill）
- **THEN** 斜杠菜单仍列出全部 `DESKTOP_BUILTINS`，因为清单来自文件读取而非 RPC 响应

## REMOVED Requirements

### Requirement: 循环模型范围配置

**REMOVED**：「循环模型范围」配置能力整体移除，包括模型选择器二级弹窗、preload 桥、IPC 通道、类型声明，以及 Pi 补丁中的 `get_scoped_models` / `set_scoped_models` 命令。

**理由**：`scopedModels` 在 Pi 内部只影响 `cycleModel()`（Ctrl+P 循环）与启动默认模型（仅由 `--models` 驱动）。外壳从不发送 `cycle_model`，无循环按钮亦无循环快捷键，故该配置在 CodePIddy 中无行为效果，删除不损失任何能力。

#### Scenario: 模型选择器只负责选模型

- **WHEN** 用户打开模型选择器
- **THEN** 仅可选择当前 Agent 使用的模型与思考级别，SHALL NOT 出现「循环模型范围」入口

#### Scenario: 私有命令清单减少两项

- **WHEN** 审查私有命令清单
- **THEN** `get_scoped_models` 与 `set_scoped_models` 已不在清单中，且 Pi 补丁中不再有对应 `case`

### Requirement: 角色默认模型设置

**REMOVED**：模型选择器中的「设为 X Agent 默认」按钮，及设置页中只读的角色默认模型列表区块一并移除。角色默认模型不再可设置，新建 Agent 跟随 Pi 当前模型配置。

**理由**：该按钮是角色默认模型的唯一设置入口（设置页仅支持显示与清除），用户判定为非必要功能。删除不影响 Pi 升级抗性——它是纯外壳能力，不依赖私有协议。

#### Scenario: 模型选择器不再提供角色默认入口

- **WHEN** 用户在模型选择器中选定模型
- **THEN** 仅对当前 Agent 生效，SHALL NOT 出现「设为…Agent 默认」

#### Scenario: 设置页不再显示角色默认模型

- **WHEN** 用户打开设置页
- **THEN** SHALL NOT 出现角色默认模型区块

## 明确不做的事

- **SHALL NOT** 把「循环模型范围」改用 `--models` 启动参数实现。删除零代价，改用启动参数需付出「改范围必须重启 Agent」的代价。
- **（已反转）** 原写「SHALL NOT 把 `reload` 替换为重启」。私有补丁清零后已改为重启实现 —— 每个 Agent 的 `sessions/` 目录独立，`--continue` 保证恢复的正是当前会话，功能得以保留，代价仅是进行中的流式回复会中断。
- **SHALL NOT** 在本 change 内为 `login_provider` / `logout_provider` / `get_auth_providers` / `import_jsonl` 寻找替代实现。这 4 个确认无原生通路（Pi 的 `/login` `/import` 仅终端 UI 可执行，扩展 API 不暴露 `modelRuntime`），需向上游提 issue 解决。**这是本次唯一实质功能损失，用户已知悉并接受。**
- **SHALL NOT** 回退 `settings-manager.ts` 的重试默认值补丁。它不是协议命令、不参与探针，升级后丢失仅回到上游默认值。
