# Agent 文档交接协议

- 状态：草案，核心原则已确认
- 日期：2026-09-16

## 核心原则

1. 人决定现在与哪个 Agent 工作；
2. Agent 只处理当前工作职责；
3. 前一步结果写入项目文档；
4. 后一步 Agent 读取项目文档；
5. 不自动转发完整聊天历史；
6. Agent 完成后停止，等待用户手动选择下一步；
7. 新需求必须经过用户批准门才能创建 Coding Agent；
8. Review Agent 只有在 implementation.md 或 fix.md 就绪后才能创建。

## 新需求

```text
Requirement Analysis Agent
  -> requirement.md
  -> design.md
  -> tasks.md

User Approval Gate
  -> 用户在客户端批准需求
  -> Host 校验三个交接文档存在、内容充足并包含规定章节

Coding Agent
  <- requirement.md + design.md + tasks.md
  -> implementation.md

Review Agent
  <- 上述文档 + implementation.md + Git diff
  -> review.md
```

## 修漏洞

```text
Bug Fix Agent
  <- 用户原始标题与描述（第一次处理）
  <- 上一次 review.md（修正轮次，可选）
  -> fix.md

Review Agent
  <- fix.md + Git diff
  -> review.md
```

## 文档责任

| 文档 | 主要写入 Agent | 其他 Agent |
|---|---|---|
| `requirement.md` | Requirement Analysis | 只读 |
| `design.md` | Requirement Analysis | 只读 |
| `tasks.md` | Requirement Analysis | 只读 |
| `implementation.md` | Coding | Review 只读 |
| `fix.md` | Bug Fix | Review 只读 |
| `review.md` | Review | Coding/Bug Fix 只读 |

用户可以编辑所有文档。Agent 在覆盖用户修改前必须先读取最新版本。

## 结构化解锁规则

### Requirement Approval

- `requirement.md`：`## 目标`、`## 功能需求`、`## 验收条件`；
- `design.md`：`## 设计方案`、`## 影响范围`、`## 验证策略`；
- `tasks.md`：`## 任务拆解`，且至少包含一个 `- [ ]` 任务项。

### Feature Review

- `implementation.md`：`## 实现摘要`、`## 修改文件`、`## 测试结果`、`## 审查重点`。

### Bug Review

- `fix.md`：`## 根因`、`## 修改文件`、`## 验证结果`、`## 审查重点`。

仅有文件或标题但内容明显过短，仍视为未完成。Host 会在客户端阻止下游 Agent，并列出缺失文件、章节或内容长度问题。

## 最小文档规则

- Markdown 优先；
- 保持人类可读；
- 引用文件路径和必要代码位置；
- 不粘贴大量完整日志；
- 不记录密钥；
- 不把聊天记录当文档；
- 每次更新保留明确的当前结论和待处理问题。

## Work Item 边界

交接文档必须位于当前 Work Item 文件夹。Agent 不通过全局文件名猜测输入，而由 UI/Host 明确传入当前 Work Item 目录。跨 Work Item 引用必须由用户显式添加。
