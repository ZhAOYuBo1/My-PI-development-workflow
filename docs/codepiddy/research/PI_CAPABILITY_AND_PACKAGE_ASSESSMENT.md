# Pi 能力与 Package 评估

- 状态：初步调研
- 日期：2026-09-15
- 本地 Pi 版本：`@earendil-works/pi-coding-agent 0.85.1`

## 1. Pi 默认是否实现任务拆解

结论：**没有实现 CodePIddy 所需的任务拆解和持久工作流。**

Pi 核心刻意不内置 MCP、subagent、permission popup、plan mode 和 todo。它提供 Extension、Skill、Package、SDK 与 RPC，让上层产品自行选择工作流。

本地仓库有两个相关示例：

### `examples/extensions/subagent/`

已提供：

- Markdown Agent 定义；
- single、parallel、chain 三种委派模式；
- 每个 subagent 启动独立 Pi 进程和上下文；
- `scout -> planner -> worker` 等 Prompt 示例；
- 使用 `{previous}` 将前一个 Agent 最终文本交给下一个 Agent。

没有提供：

- 结构化、版本化 Task Graph；
- 用户对需求和计划的独立审批；
- 按 Stage/Task/Attempt 持久化；
- 确定性状态转换；
- 测试、修复和审查循环；
- 循环预算和完成门槛；
- CodePIddy UI 所需的统一运行模型。

### `examples/extensions/plan-mode/`

已提供：

- 只读计划模式；
- Bash allowlist；
- 从 `Plan:` 文本中提取编号步骤；
- 用户选择执行、继续规划或细化；
- `[DONE:n]` 进度标记；
- Pi session 内的状态恢复。

没有提供：

- 独立 Planner Agent；
- JSON schema 任务图；
- Requirement/Acceptance Criteria 映射；
- Orchestrator 单写状态；
- Task Attempt、执行证据与跨进程恢复。

因此，这两个示例适合作为 Pi API 使用参考，不能直接充当 CodePIddy 工作流引擎。

## 2. 推荐 Package 候选

### A. `pi-mcp-adapter` — 不作为 MVP 通用依赖，保留为实现选项

用途：连接 MCP server，并通过一个代理工具按需发现 server/tool，减少将所有工具定义一次性塞入上下文的成本。

初步优点：

- 支持项目和全局 MCP 配置；
- server 按需启动；
- 可从其他 Agent 产品导入配置；
- 支持 stdio、远端 endpoint 和共享进程模式；
- 能与 `pi-permission-system` 的 MCP 规则配合；
- 有较大的使用量和较频繁维护。

CodePIddy 建议：

- 不让 UI 直接操作该扩展的内部文件；
- 通过 `McpProviderAdapter` 包装；
- CodePIddy 管理 server allowlist、凭据引用、启停和健康状态；
- MCP 调用仍必须经过 CodePIddy Permission Controller；
- 固定精确版本并审计源码和依赖后再进入产品。

候选安装命令，仅供后续隔离验证：

```text
pi install npm:pi-mcp-adapter
```

### B. `pi-permission-system` — 已选择作为 MVP 权限引擎

用途：对 tool、bash、MCP、Skill 和外部目录访问执行 `allow / deny / ask` 策略，并支持 per-agent override。

初步优点：

- 与我们角色权限设计高度接近；
- 可隐藏被禁止的工具并在运行时再次拦截；
- 支持 bash pattern、MCP target、Skill 和外部目录规则；
- 支持无 UI subagent 将审批转发到主会话；
- 有 JSON schema 和审计日志。

限制：

- 它是第三方 Extension，不是操作系统安全边界；
- Extension 自己与 Pi 进程具有用户权限；
- CodePIddy 的审批 UI、Run 状态和审计仍需由产品统一管理；
- 不能依赖它防御恶意第三方 Extension。

CodePIddy 建议：

- 短期在隔离测试环境验证策略语义；
- 评估 vendor/fork 其中的 policy evaluator；
- 产品级审批由 Orchestrator 负责，Pi Extension 作为执行点的第二道防线；
- 不直接把它当成唯一安全机制。

候选安装命令：

```text
pi install npm:pi-permission-system
```

### C. `pi-lsp-adapter` — 推荐进入技术验证

用途：给 Agent 提供只读 LSP 能力，包括 diagnostics、hover、definition、references 和 workspace symbols。

价值：

- Planner 可以更可靠地识别调用关系；
- Implementer 修改前可以确认类型和引用；
- Tester/Reviewer 可以获取编译器和语言服务器诊断；
- 工具是只读的，适合多个非写入角色；
- 支持 TypeScript、Python、Go、Rust、YAML、JSON、Java 等常见服务器。

风险：

- 首次启动和安装 language server 有额外成本；
- 项目必须明确允许哪些 server；
- 自动安装必须默认关闭或进入审批。

候选安装命令：

```text
pi install npm:pi-lsp-adapter
```

### D. `pi-web-access` — MVP 不采用

用途：Web 搜索、URL 抓取、仓库读取、PDF 和视频内容处理。

适合：

- Requirement Analyst 查询外部产品资料；
- Planner 阅读依赖官方文档；
- Reviewer 核对安全公告或版本说明。

风险：网络访问、外部内容 Prompt Injection、API key、费用和不可复现结果。

建议：默认关闭；由角色 policy、域名 allowlist 和用户审批控制。MVP 也可以先通过受控 MCP/CLI 实现需要的外部查询。

### E. `pi-taskflow` — 强烈建议研究，不建议直接绑定 MVP

它与 CodePIddy 目标高度重叠：

- 声明式 DAG；
- 静态验证；
- retries、budgets、approvals；
- phase isolation；
- resume、replay、trace、recompute；
- effect declaration 和资源提交模型。

但当前公开版本明确为 beta，并且：

- WebUI 仍是规划能力；
- Control Plane 尚未完整交付；
- 不提供完整 OS sandbox；
- host-specific 支持仍可能变化；
- 引入它会让 CodePIddy 的核心数据模型受第三方 beta 设计约束。

建议：

1. 把它当竞品/参考实现；
2. 单独做 Spike，比较其 FlowIR 与我们的 Task Graph；
3. 不直接成为 CodePIddy MVP 的事实源；
4. 如果后续验证成熟，可以实现一个可替换的 `WorkflowEngineAdapter`。

### F. `pi-plan-task`、`pi-tasks` 等近期工作流包 — 仅参考

这些包解决 plan/approve/task tracking 的部分问题，但发布时间短、接口仍在快速变化，也会与 CodePIddy 自己的 Requirement、Plan、Task、Attempt 模型重叠。暂不建议成为基础依赖。

### G. Worktree/Subagent 编排包 — MVP 暂不需要

MVP 已决定只有一个写入型 Implementer 顺序执行。现在安装 worktree 或并行 subagent 编排包会提前引入不必要复杂度。

后续做并行版本时，再评估：

- worktree 创建、回收和冲突检测；
- 每个 Task 独立分支；
- Integration Agent；
- 合并后统一测试。

## 3. 权限与沙箱不能混为一谈

### Permission Gate

回答：“这个动作按政策是否允许？”

例如：

- Requirement Analyst 可以 read，不能 write；
- Planner 不能执行任意 bash；
- Implementer 写入只能在项目 worktree；
- Reviewer 禁止 write/edit；
- MCP server/tool 必须在角色 allowlist。

### Sandbox

回答：“即使代码或 Extension 恶意，它实际上能触及什么？”

Pi 官方明确没有内置 sandbox。Extension 与 Pi 进程默认继承当前用户权限。项目 Trust 也只是决定是否加载项目资源，并不是沙箱。

本地可参考：

- `permission-gate.ts`：危险命令确认示例；
- `protected-paths.ts`：路径写保护示例；
- `tool-override.ts`：替换工具并记录/拦截；
- `sandbox/`：工具执行沙箱示例；
- `gondolin/`：将内置工具路由到 Linux micro-VM；
- 官方 Docker/OpenShell/Docker Sandboxes 方案。

Windows 注意事项：

- 社区 `pi-sandbox` 主要依赖 macOS `sandbox-exec` 或 Linux `bubblewrap`，不能直接作为 Windows 原生方案；
- CodePIddy 的强隔离应优先评估 Docker Desktop/WSL2、远程 sandbox 或专门的 Windows 隔离执行器；
- Permission Extension 只能作为策略执行层，不能替代 OS/VM/container 边界。

## 4. 建议采用矩阵

| 能力 | MVP 建议 | 方式 |
|---|---|---|
| Task Graph / 状态机 | 自研 | CodePIddy Orchestrator |
| Pi Agent 运行 | 复用 | Pi RPC/SDK Adapter |
| MCP | 技术验证后复用/封装 | `pi-mcp-adapter` |
| 角色权限策略 | 自研控制面 + 参考/复用 evaluator | `pi-permission-system` |
| 强隔离 | 单独设计 | Docker/WSL2/远程 sandbox |
| LSP | 技术验证后复用 | `pi-lsp-adapter` |
| Web 查询 | 可选 | `pi-web-access` 或受控 MCP |
| Git checkpoint | 自研 | 参考本地 `git-checkpoint.ts` |
| Worktree 并行 | MVP 不做 | 后续版本 |
| Subagent workflow package | MVP 不依赖 | 参考 Pi 示例与社区实现 |
| UI | 自研 | CodePIddy Desktop UI |

## 5. 第三方 Package 安全准入

任何 Package 在产品中启用前必须：

1. 审查源码、许可证和维护状态；
2. 审查 lifecycle script 与全部直接依赖；
3. 固定精确版本和完整性哈希；
4. 在隔离测试项目运行；
5. 记录它注册的工具、事件、命令和文件访问；
6. 为每个角色配置最小 allowlist；
7. 禁止项目自行静默安装未批准 Package；
8. 支持禁用、回滚和版本迁移；
9. 明确它是“功能扩展”还是“安全边界”，不能混淆；
10. 在 CodePIddy UI 中展示来源、版本和权限。

## 6. 当前推荐验证顺序

```text
1. pi-mcp-adapter
2. pi-permission-system
3. pi-lsp-adapter
4. Docker/WSL2 sandbox 原型
5. pi-taskflow 架构对比 Spike
6. pi-web-access（可选）
```

当前只完成调研，没有安装任何第三方 Package。

## 7. 2026-09-15 决策收敛

- 权限：采用 `pi-permission-system` 的实际配置和判定，CodePIddy 不重复实现 Policy Evaluator。
- Web：不采用 `pi-web-access`，也不暴露通用 Web MCP。
- Search：实现仅含 `web_search` 的 Tavily Search MCP，底层只调用 Tavily Search API。
- Sandbox：Windows MVP 暂缓，保留 `ExecutionEnvironment` 接口。
