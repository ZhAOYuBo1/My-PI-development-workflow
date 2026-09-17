# ADR-0016：项目文档作为 Agent 交接事实源

- 状态：已接受
- 日期：2026-09-16

## 背景

CodePIddy 的核心不是自动流水线，而是两种工作方式下的多 Agent 人工协作。用户手动选择当前 Agent；不同 Agent 之间必须知道前一个 Agent 做了什么，因此需要共享、可读、可版本控制的项目文档。

## 决策

1. CodePIddy 项目默认创建 `.codepiddy/`。
2. `.codepiddy/` 中的文档是 Agent 交接的事实源，不是可选导出副本。
3. 新需求和修漏洞分别使用独立目录。
4. 用户手动启动 Agent 时，系统告诉它需要读取哪些前置文档。
5. Agent 完成当前工作后，更新自己负责的文档并停止。
6. 下一个 Agent 不接收上一个 Agent 的完整聊天上下文，只读取共享文档和必要代码 diff。
7. 项目文档设计为可进入 Git，支持团队协作。
8. Session、完整聊天、日志、运行状态、权限审计、缓存和凭据不写入 `.codepiddy/`。

## 项目结构

```text
<project>/
  .codepiddy/
    project.md
    requirements/
      FEAT-001/
        requirement.md
        design.md
        tasks.md
        implementation.md
        review.md
    bugs/
      BUG-001/
        bug.md
        fix.md
        review.md
```

这两个目录对应两种工作方式：

```text
requirements/ = 新需求
bugs/         = 修漏洞
```

## 新需求文档交接

### Requirement Analysis Agent

读取：

- 用户输入；
- 项目说明；
- 相关代码和已有文档。

输出：

```text
requirement.md
设计目标、范围、非目标、验收条件

design.md
设计方案、影响范围和关键决策

tasks.md
给 Coding Agent 的任务拆解和注意事项
```

### Coding Agent

启动时读取：

```text
requirement.md
design.md
tasks.md
```

完成后更新：

```text
implementation.md
实现了什么、修改了哪些位置、运行了哪些检查、已知问题
```

### Review Agent

启动时读取：

```text
requirement.md
design.md
tasks.md
implementation.md
实际 Git diff
```

可以新增或修改测试，完成后更新：

```text
review.md
测试结果、代码审核、发现的问题和是否通过
```

如果不通过，用户手动切回 Coding Agent。Coding Agent 读取 `review.md` 后继续修改，并更新 `implementation.md`。

## 修漏洞文档交接

### Bug Fix Agent

读取：

```text
bug.md
上一次 review.md（如有）
```

完成后更新：

```text
fix.md
根因、修复内容、修改位置、验证结果和剩余风险
```

### Review Agent

读取：

```text
bug.md
fix.md
实际 Git diff
```

补充测试并更新：

```text
review.md
回归测试、代码审核和发现的问题
```

不通过时，用户手动切回 Bug Fix Agent。

## 本地运行数据

以下内容仍保存在 `%LOCALAPPDATA%\CodePIddy\`：

- Agent session；
- 完整对话；
- 工具调用日志；
- 运行状态；
- Project Write Lease；
- 权限审计；
- Token 与成本；
- Tavily API Key；
- Provider 凭据；
- 缓存和内部索引。

本地运行数据通过 `projectId` 和 `workItemId` 关联到项目文档，但不复制进项目仓库。

## Git

`.codepiddy/` 的目标就是协作，因此允许并建议进入 Git。CodePIddy 可以展示 Git 状态，但仍不自动 commit 或 push。

## 后果

- 交接模型简单明确；
- 团队成员可以直接阅读历史决策；
- Agent 之间不需要共享完整会话；
- 文档格式必须稳定且容易被人类编辑；
- Agent Prompt 必须明确负责读取和更新哪些文件；
- 项目文档必须避免写入凭据和原始敏感日志。
