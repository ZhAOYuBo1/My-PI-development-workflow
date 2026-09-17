# CodePIddy 权限集成

- 状态：已确认
- 日期：2026-09-15
- 权限引擎：`pi-permission-system`

## 原则

CodePIddy 不实现第二套权限规则引擎。工具是否允许、拒绝或询问，完全由 `pi-permission-system` 当前配置决定。

## CodePIddy 职责

1. 提供权限配置 UI；
2. 根据插件 schema 验证配置；
3. 管理全局和项目配置入口；
4. 将 Agent Role 映射到 per-agent 规则；
5. 显示插件发出的审批请求；
6. 将用户选择返回给权限插件；
7. 展示审计日志和权限错误；
8. 在插件版本升级时执行配置兼容检查。

## 权限插件职责

1. 解析配置；
2. 计算 allow/deny/ask；
3. 匹配 tool、bash、MCP、Skill 和目录规则；
4. 应用 per-agent override；
5. 阻止被拒绝的调用；
6. 发起需要用户参与的审批。

## 建议默认配置

- 普通读取允许；
- 修改类操作询问；
- Requirement Analyst 和 Planner 默认禁止写入；
- Review Agent 推荐允许测试路径、fixture 和测试 Artifact 路径写入；
- Coding Agent、Review Agent 和 Bug Fix Agent 的实际写入能力由用户配置决定；
- `web_search` 的默认规则由产品模板提供，用户可修改。

## 非目标

- CodePIddy 不覆盖插件判定；
- CodePIddy 不保证权限插件构成安全沙箱；
- CodePIddy 不把 UI 中的角色描述当成实际权限，实际权限以插件配置为准。




