# ADR-0006：采用 pi-permission-system 作为权限引擎

- 状态：已接受
- 日期：2026-09-15

## 背景

Pi 默认不内置权限弹窗和产品级权限策略。现有 `pi-permission-system` Package 已提供可配置的 tool、bash、MCP、Skill、外部目录和 per-agent 权限规则。重复实现第二套 Policy Evaluator 会导致配置冲突、审批结果不一致和维护成本增加。

## 决策

1. MVP 采用 `pi-permission-system` 作为权限配置和判定引擎。
2. 权限行为完全以插件配置为准，不在 CodePIddy Orchestrator 中复制规则求值逻辑。
3. CodePIddy UI 提供权限配置编辑、schema 校验、审批交互和审计展示。
4. Agent Role 映射到插件的 per-agent 配置。
5. Orchestrator 记录权限插件返回的请求、允许、拒绝和错误事件，但不改变其判定。
6. 默认配置由产品提供，用户可以修改；默认建议读操作允许、修改类操作询问。
7. 插件升级必须固定版本并验证配置兼容性。

## 集成边界

```text
CodePIddy Settings UI
  -> 编辑 permissions 配置
  -> schema 校验
  -> 写入插件支持的配置位置

Pi Agent
  -> pi-permission-system
      -> allow / deny / ask
      -> CodePIddy 展示 ask 交互
      -> 插件继续或阻止调用

CodePIddy Audit View
  <- 权限请求和结果事件
```

## CodePIddy 不负责

- 重复实现 pattern matcher；
- 覆盖插件的规则优先级；
- 将自己的判断强行替换插件结果；
- 把权限插件描述为操作系统沙箱。

## 默认配置原则

产品可附带建议配置：

- 项目内普通读取默认允许；
- 修改类操作默认询问；
- 各角色可以有不同覆盖规则；
- 高风险命令建议拒绝或询问。

最终行为始终以用户实际配置为准。

## 风险

- 这是第三方 Package，必须审查源码、固定版本并建立兼容测试；
- 插件配置格式变化会影响 CodePIddy 设置 UI；
- 插件是策略执行层，不是强隔离边界。
