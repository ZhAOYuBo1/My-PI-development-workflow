# ADR-0023：MVP UI 保持 Codex 式极简

- 状态：已接受
- 日期：2026-09-16

## 背景

CodePIddy 的核心差异是项目树中增加“新需求”“修漏洞”、Work Item 和职责 Agent，而不是构建复杂的项目管理 Dashboard。交接文档主要供 Agent 和开发者通过文件系统使用，没有必要在客户端中重复实现文档管理器。

## 决策

1. 客户端整体保持 Codex 风格的侧边栏 + Agent 对话工作区。
2. 侧边栏增加 CodePIddy 特有的层级：Project → Lane → Work Item → Agent。
3. 中央区域主要显示当前 Agent 的对话、工具调用、权限请求和必要执行结果。
4. MVP 不在前端展示 `.codepiddy/` 文档列表。
5. MVP 不提供 Markdown 文档预览器或编辑器。
6. MVP 不提供 Work Item Git diff Dashboard。
7. MVP 不提供 Finding 仪表盘、流程图、进度图或 Agent 卡片 Dashboard。
8. Agent 通过 Role Prompt 和明确的 Work Item 路径读取、更新交接文件。
9. 开发者通过 IDE、文件管理器或终端查看项目文档。
10. UI 可以提供“打开 Work Item 文件夹”操作，但不自行渲染其中的文档。

## 应用布局

```text
┌───────────────────────┬──────────────────────────────────────────┐
│ Project Tree          │ Agent Conversation                       │
│                       │                                          │
│ Project               │ User / Assistant Messages                │
│ ├─ 新需求              │ Tool Calls                               │
│ │  └─ FEAT-001         │ Permission Prompts                       │
│ │     ├─ 需求分析      │ Streaming Output                         │
│ │     ├─ Coding        │                                          │
│ │     └─ Review        │ Prompt Input                             │
│ └─ 修漏洞              │                                          │
│    └─ BUG-001          │                                          │
│       ├─ Bug Fix       │                                          │
│       └─ Review        │                                          │
└───────────────────────┴──────────────────────────────────────────┘
```

## Work Item 点击

此前确认文件夹标题可以打开 Work Item 页面。MVP 将其简化为极简空状态：

```text
FEAT-001：增加登录功能

选择一个 Agent 开始或继续工作：
- 需求分析 Agent
- Coding Agent
- Review Agent

[打开 Work Item 文件夹]
[归档]
```

不显示：

- `requirement.md` 内容；
- `design.md` 卡片；
- Git diff 摘要；
- Review Finding 列表；
- 写锁 Dashboard；
- 流程状态图。

## Agent 与文档

创建或打开 Agent 时，Host 向 Agent Prompt 提供：

- 当前项目根目录；
- 当前 Work Item 目录；
- 该 Role 应读取的文件名；
- 该 Role 应更新的文件名。

例如 Coding Agent：

```text
当前 Work Item 目录：.codepiddy/requirements/FEAT-001/
请读取 requirement.md、design.md 和 tasks.md。
完成代码后更新 implementation.md。
```

这是 Agent 的内部工作协议，不需要在客户端渲染文档内容。

## 保留的 UI 能力

- 项目树；
- 创建/归档 Work Item；
- 创建/打开 Agent；
- Agent 对话；
- Tool Call；
- 权限审批；
- 停止 Agent；
- 打开项目或 Work Item 文件夹；
- 基本状态点；
- 项目写锁冲突提示。

## 后果

- MVP UI 范围显著缩小；
- 更接近用户熟悉的 Codex 客户端；
- 项目文档仍然完整共享，但不重复构建文档工具；
- Agent Prompt 和文件路径注入成为关键实现；
- 未来如确有需要，可单独增加轻量文件打开能力，而不影响当前模型。
