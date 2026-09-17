# ADR-0020：Work Item 是实际隔离文件夹

- 状态：已接受
- 日期：2026-09-16

## 背景

侧边栏中的需求或 Bug 不只是一个聊天标题。它需要归组属于同一项工作的多个 Agent，并防止多个需求、Bug 的设计文档、交接和审核结果互相混杂。

## 决策

1. 每个 Work Item 在 UI 中使用文件夹语义和文件夹图标。
2. Work Item 可以展开和折叠。
3. Work Item 在项目 `.codepiddy/` 中对应实际目录。
4. 目录是项目协作文档的隔离边界。
5. 本地 Agent session 通过 `projectId + workItemId + role` 归属于该目录。
6. Agent 默认只读取当前 Work Item 的共享文档。
7. Finding、Review、任务状态和循环记录不能跨 Work Item 混用。
8. 项目源代码仍为共享工作树，由 Project Write Lease 防止并发修改。

## 物理目录

### 新需求

```text
.codepiddy/
  requirements/
    FEAT-001/
      work-item.md
      requirement.md
      design.md
      tasks.md
      implementation.md
      review.md
```

### 修漏洞

```text
.codepiddy/
  bugs/
    BUG-001/
      work-item.md
      bug.md
      fix.md
      review.md
```

## UI 显示

目录名使用稳定 ID，显示名称来自 `work-item.md`：

```text
▼ FEAT-001：增加登录功能
  ● 需求分析 Agent
  ○ Coding Agent       [创建]
  ○ Review Agent       [创建]
```

建议不要因用户修改标题而修改物理目录 ID。用户把标题改为“增加账号登录和注册”后：

```text
物理目录仍为：FEAT-001/
UI 显示变为：FEAT-001：增加账号登录和注册
```

这样本地 session、Git 历史和文件引用保持稳定。

## `work-item.md`

建议：

```markdown
---
id: FEAT-001
type: feature
title: 增加登录功能
status: active
createdAt: 2026-09-16T10:00:00+08:00
---

用户提交的初始描述。
```

Bug 使用：

```markdown
---
id: BUG-001
type: bugfix
title: 登录后白屏
status: active
createdAt: 2026-09-16T10:00:00+08:00
---
```

## 隔离规则

### 文档

当前 Work Item 的 Agent 默认只得到：

- 当前目录路径；
- 当前目录下允许角色读取的文档；
- 项目代码路径；
- 用户显式引用的其他文件。

### Agent

```text
FEAT-001/Coding Agent
```

不能自动读取：

```text
FEAT-002/
BUG-001/
```

除非用户显式添加引用。

### 状态

以下数据按 Work Item 独立：

- Agent Slot；
- 当前 Agent Instance；
- Handoff；
- Finding；
- Review 结果；
- 完成状态；
- 最近活动时间。

## 创建过程

```text
用户点击 Lane 的 +
  -> 输入标题和初始描述
  -> 分配稳定 ID
  -> 创建 Work Item 文件夹
  -> 创建 work-item.md
  -> 创建允许的 Agent Slot 元数据
  -> 在侧边栏显示文件夹
  -> 不自动创建 Agent Instance
```

## 删除与重命名

- 重命名默认只修改 `work-item.md` 标题；
- 删除属于破坏性操作，需要确认；
- 有 Agent session 或文档的 Work Item 建议优先归档而不是删除；
- 删除项目文件夹时，本地 session 的处理方式需由生命周期设计决定。

## D-022 生命周期补充

Work Item 不由 Agent 自动完成或归档。Review 通过后仍留在活跃列表，直到用户点击归档按钮。归档只修改 `work-item.md` 状态，物理目录不移动。详见 `0021-user-controlled-work-item-archive.md`。
