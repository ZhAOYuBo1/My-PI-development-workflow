# CodePIddy 产品简述

- 状态：草案；D-001 至 D-026 已确认，其余内容等待确认
- 创建日期：2026-09-15
- 基础项目：Pi Agent Harness (`earendil-works/pi`)

## 1. 产品意图

CodePIddy 是构建在 Pi Agent Harness 之上的本地 AI 软件研发工作台。它不是简单地给 Pi TUI 换皮，而是增加：

1. 图形化项目入口与任务工作区；
2. 明确、可观察、可恢复的软件开发流程；
3. 多个职责隔离的专业 Agent；
4. Agent 之间基于持久化文件制品的交接；
5. 人类可查看、干预、批准和重试的工作流；
6. 通过 Prompt、Skill、Extension 持续增强每个角色。

## 2. 首版任务入口

用户打开一个代码项目后，项目内固定存在两个隔离的工作分区：“新需求”和“修漏洞”。每个分区可以创建多个 Work Item 文件夹；每个 Work Item 是文档、Agent、状态和 Finding 的隔离单元，内部 Agent 实例由用户单独创建。

### 新需求

用户进入“新需求”分区后，可以创建新需求工作项。每个工作项提供三种 Agent Slot，实例按需单独创建：

```text
需求分析 Agent | Coding Agent | Review Agent（测试+审核）
```

它们不自动连续执行。用户手动切换并触发下一 Agent，Agent 通过文件交接。

```text
用户在需求分析 Agent 中描述需求
  -> 需求分析 Agent 使用 grill 澄清需求
  -> 同一 Agent 在后半段完成实施计划和任务拆解
  -> 生成需求、计划和 Coding Handoff 文件
  -> 停止，不自动启动 Coding Agent

用户手动切换到 Coding Agent
  -> 使用默认指令“读取交接文档并编写代码”
  -> Coding Agent 实现并生成 Review Handoff
  -> 停止，不自动启动 Review Agent

用户手动切换到 Review Agent
  -> 独立检查 diff
  -> 补充/修改测试
  -> 运行测试并审核
      -> 通过：用户结束工作项
      -> 不通过：生成 Finding

用户手动切回本线 Coding Agent
  -> 读取 Review Report 并修复
  -> 用户再次手动触发 Review Agent
```

角色：

- Requirement Analysis Agent：需求澄清、需求文档、验收条件、实施计划和任务拆解；不修改代码。
- Coding Agent：读取需求分析交接文件，实现新需求和修复本线 Review Finding。
- Review Agent：测试+审核；可以修改测试，不能修改生产代码。
### 修漏洞

用户进入“修漏洞”分区后，可以创建 Bug 工作项。每个工作项提供两种 Agent Slot，实例按需单独创建：

```text
Bug Fix Agent | Review Agent（测试+审核）
```

同样由用户手动切换和触发：

```text
用户在 Bug Fix Agent 中提交 Bug
  -> Bug Fix Agent 定位并修复
  -> 生成 Review Handoff
  -> 停止

用户手动切换到 Review Agent
  -> 补充/修改回归测试
  -> 运行测试并审核
      -> 通过：用户结束工作项
      -> 不通过：生成 Finding

用户手动切回本线 Bug Fix Agent
  -> 读取 Review Report 并继续修复
  -> 用户再次手动触发 Review Agent
```

两条工作流完全隔离，只复用 Review Agent 的角色定义，不共享运行实例和状态。

## 2.1 客户端项目树

CodePIddy 是类似 Codex 的本地桌面客户端。客户端左侧为项目树，中央为当前 Agent 的对话、工具调用和结果区域。

用户打开项目后，项目节点默认包含两个固定目录：

```text
Project
├─ 新需求
└─ 修漏洞
```

目录内部按 Work Item 分组，再显示属于该工作项的 Agent Instance：

```text
Project
├─ 新需求
│  └─ FEAT-001：增加登录
│     ├─ 需求分析 Agent
│     ├─ Coding Agent
│     └─ Review Agent
└─ 修漏洞
   └─ BUG-001：登录白屏
      ├─ Bug Fix Agent
      └─ Review Agent
```

点击 Agent 行后，中央区域打开该 Agent 独立会话。两个固定目录本身不是 Agent，也不是聊天记录，而是工作类型分组。MVP 中央区域保持 Codex 风格的 Agent 对话界面，不提供 `.codepiddy/` 文档浏览器、文档卡片、Git 仪表盘或 Finding 仪表盘；交接文件由 Agent 在项目目录中直接读取和更新。

## 3. 核心产品原则（提议）

1. **流程由用户手动推进**：Agent 实例由用户按需创建；完成当前工作后停止并生成交接文件；只有用户创建、切换并触发下一 Agent，系统不自动串联执行。
2. **所有步骤可观察**：UI 显示当前阶段、Agent、输入、输出、工具调用、用量、失败原因与等待事项；Work Item 是否从活跃列表移除完全由用户控制。
3. **切换即显式推进**：需求分析完成后不弹出自动续跑询问；用户手动进入并触发 Coding Agent，代表接受当前需求、计划和任务拆解作为编码输入。
4. **交接基于结构化制品**：不是把上一 Agent 的全部聊天原样塞给下一 Agent。
5. **可中断和恢复**：应用或 Agent 崩溃后，可以从最后一个已提交阶段恢复。
6. **写权限按职责隔离**：Requirement Analysis Agent 默认只读；Coding Agent/Bug Fix Agent 可修改生产代码；Review Agent 只能修改测试和审核制品，严格禁止修改生产代码。
7. **循环必须有上限**：每个回路有最大重试次数、升级到人工的条件和明确退出原因。
8. **Git 是安全边界的一部分**：每个任务应有分支或 worktree、检查点和可回滚能力。
9. **Prompt/Skill 可版本化**：每次运行记录所用角色定义、Prompt、Skill、模型和版本。

## 4. MVP 建议边界

首版只做：

- 本地桌面应用；
- 打开已有 Git 项目；
- 项目首页默认显示“新需求”和“修漏洞”两个入口卡片；两条流程完全隔离；
- 同一项目可以创建并保留多个 Work Item，但正常交互按用户手动切换保持线性；整个项目任意时刻只有一个写入型 Agent，冲突时直接阻止，不提供等待队列；
- 新需求线由 Coding Agent 实现和修复本线问题；修漏洞线由 Bug Fix Agent 修复本线问题；两条线使用相同的 Review Agent 角色定义，但运行实例和状态相互隔离；
- 所有 Agent 使用同一个 Pi Agent Runtime，通过 Role Profile 区分 Prompt、Skill、权限与交接契约；Work Item 创建时只显示 Agent Slot，占位不创建 session；用户点击“创建”后生成该 Slot 唯一的长期 Agent Instance，同一 Slot 不并列创建多个同角色 Agent；
- UI 重点展示 Agent 对话、流式工具执行、权限请求和必要结果；项目交接文档不在前端展示，开发者直接通过项目文件夹查看；
- 人工可以暂停、继续、重试、跳过或终止；
- 项目协作文档固定保存在项目 `.codepiddy/` 并作为 Agent 交接事实源；只有 session、日志、运行状态、审计和密钥保存在 CodePIddy 用户数据目录；
- 模型/provider 沿用 Pi 的能力；
- 权限由 `pi-permission-system` 的可配置策略决定；CodePIddy 提供配置和审批 UI，不重复实现 Policy Evaluator；
- Web 只提供 `web_search`；由最小 Tavily Search MCP 调用 Tavily Search API，不提供 fetch、extract、crawl 或 map；
- Windows MVP 使用本地执行环境，不提供强沙箱，但保留执行环境适配接口。

首版暂不做：

- 云端团队协作；
- 自动创建 PR 或合并到主分支；
- 无人监管地持续运行无限循环；
- 多个 Agent 同时修改同一个工作树；
- 依赖 Pi 的实验性远程 server/client 协议。

## 5. 成功标准（待量化）

- 用户能在 UI 中打开项目并提交一项新需求或缺陷。
- 任务经历预设阶段，每个阶段都有明确状态和制品。
- 失败后可定位到具体 Agent、命令和阶段。
- 退出应用再打开后能够恢复任务。
- 用户可以在合并前看到最终 diff、测试证据和审查结论。
- 工作流不会因为 Agent 自说“完成”而绕过测试或审查。

## 6. 上游能力依据

- [Pi SDK](https://pi.dev/docs/latest/sdk)：支持嵌入自定义桌面/Web UI、自动化流水线与自定义工具。
- [Pi RPC](https://pi.dev/docs/latest/rpc)：支持通过 JSONL stdin/stdout 以 headless 方式嵌入自定义 UI。
- [Pi Extensions](https://pi.dev/docs/latest/extensions)：支持工具、事件、命令、UI 交互和持久状态扩展。
- [Pi Skills](https://pi.dev/docs/latest/skills)：支持按需加载并版本化专业工作流。
- [Pi subagent example](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions/subagent)：演示隔离上下文、链式和并行 Agent。

































