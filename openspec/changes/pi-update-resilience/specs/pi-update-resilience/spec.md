# Spec Delta

## Purpose

规定 CodePIddy 与 Pi 之间的能力边界：外壳不得依赖超出 stock Pi 的私有协议而不做校验；「更新 Pi」SHALL 在激活前判定兼容性，SHALL NOT 静默激活一个外壳功能缺失的运行时。

## ADDED Requirements

### Requirement: 私有协议命令的依赖必须被显式登记

外壳与 Pi 之间的自定义 RPC 命令 SHALL 集中登记在单一清单中，供更新探针与 UI 降级共同使用。清单 SHALL NOT 包含只读性无法保证的探测命令（如会改变会话状态的 `import_jsonl`）。

#### Scenario: 清单与实现一致

- **WHEN** 审查私有命令清单
- **THEN** 每一项都能在 `packages/coding-agent/src/modes/rpc/rpc-mode.ts` 找到对应 `case`，且该命令在 stock Pi 中不存在

### Requirement: 更新前判定运行时兼容性

`probePiUpdate` SHALL 在现有握手与原生命令校验之外，探测清单中的私有命令。任一私有命令返回 `Unknown command` 时，SHALL 拒绝激活该版本、SHALL 保留原版本，并 SHALL 报告缺失的命令名与版本号。

#### Scenario: stock Pi 被拒绝激活

- **WHEN** 用户在 stock Pi 0.99.1 上执行更新
- **THEN** 更新失败，提示「缺少外壳依赖的命令：reload、import_jsonl、login_provider、logout_provider、get_auth_providers」，`active.json` 保持指向原版本

#### Scenario: 兼容版本正常激活

- **WHEN** 目标 Pi 支持清单中的全部私有命令
- **THEN** 探针通过，版本按现有流程激活并可在下次启动生效

#### Scenario: 区分不兼容与安装损坏

- **WHEN** 探针因 Pi 进程无法启动而失败
- **THEN** 按现有「安装损坏」错误路径处理，SHALL NOT 报告为命令不兼容

### Requirement: 功能不可用时降级而非报错

外壳 SHALL 在渲染功能入口前按实际可用能力判定。不可用的功能 SHALL 置灰并说明原因，SHALL NOT 呈现为可点击后在调用时才抛出 `Unknown command`。

#### Scenario: 私有命令缺失时入口置灰

- **WHEN** 当前运行的 Pi 不支持 `login_provider`
- **THEN** 斜杠菜单中 `/login` `/logout` 置灰，悬停说明「当前 Pi 版本不支持该命令」

#### Scenario: 兼容运行时入口正常

- **WHEN** 当前运行的 Pi 支持全部私有命令
- **THEN** 全部入口可用，行为与现状一致

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

- **SHALL NOT** 把 `reload` 替换为「重启 Pi 进程」。`session.reload()` 原地重载不打断会话；重启会让用户敲 `/reload` 时丢失当前回复，收益不抵代价。保留补丁 + 降级提示。
- **SHALL NOT** 把「循环模型范围」改用 `--models` 启动参数实现。删除零代价，改用启动参数需付出「改范围必须重启 Agent」的代价。
- **SHALL NOT** 在本 change 内为 `login_provider` / `logout_provider` / `get_auth_providers` / `import_jsonl` 寻找替代实现。这 4 个确认无原生通路（Pi 的 `/login` `/import` 仅终端 UI 可执行，扩展 API 不暴露 `modelRuntime`），需向上游提 issue 解决。
