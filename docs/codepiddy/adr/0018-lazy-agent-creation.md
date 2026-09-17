# ADR-0018：按需创建 Agent Instance

- 状态：已接受，实例数量由 D-020 明确
- 日期：2026-09-16

## 背景

Work Item 定义了允许使用哪些职责的 Agent，但并非每个 Work Item 都会立即使用所有 Agent。如果创建 Work Item 时自动创建全部 Pi session，会产生无用会话和不必要状态，也不符合用户手动选择 Agent 的产品原则。

## 决策

1. Work Item 创建时只创建 Agent Slot 元数据。
2. Slot 在侧边栏中以占位行显示。
3. Slot 不包含 Pi session，也不启动进程。
4. 用户点击“创建”后才生成 Agent Instance。
5. 创建 Agent Instance 时加载 Role Profile、权限配置和默认启动 Prompt。
6. Agent Instance 创建后仍不自动执行；用户确认或发送 Prompt 后才开始工作。
7. Agent 创建顺序不做硬性锁定。
8. 前置文档缺失时显示警告，但允许用户决定是否继续。

## 新需求 Work Item 初始状态

```text
▼ FEAT-001：登录功能
  ○ 需求分析 Agent       [创建]
  ○ Coding Agent         [创建]
  ○ Review Agent         [创建]
```

创建需求分析 Agent 后：

```text
▼ FEAT-001：登录功能
  ● 需求分析 Agent
  ○ Coding Agent         [创建]
  ○ Review Agent         [创建]
```

## 修漏洞 Work Item 初始状态

```text
▼ BUG-001：登录白屏
  ○ Bug Fix Agent        [创建]
  ○ Review Agent         [创建]
```

## 创建过程

```text
用户点击创建
  -> 创建 Agent Instance ID
  -> 创建本地 session 目录
  -> 加载 Role Profile
  -> 解析当前 Work Item 文档
  -> 检查建议的前置文档
  -> 显示缺失文档警告（如有）
  -> 生成默认 kickoff prompt
  -> 打开中央 Agent 工作区
  -> 等待用户触发
```

## 前置文档提示

### Coding Agent

建议检查：

```text
requirement.md
design.md
tasks.md
```

缺失时：

```text
当前工作项缺少建议的编码交接文档：
- design.md
- tasks.md

仍然创建 Coding Agent？
```

### Review Agent（新需求）

建议检查：

```text
requirement.md
design.md
implementation.md
```

### Review Agent（修漏洞）

建议检查：

```text
bug.md
fix.md
```

提示不是权限门槛，也不会替用户决定。

## 不采用

- Work Item 创建时自动创建全部 Agent；
- 自动启动 Agent；
- 因缺少前置文档而永久禁用 Slot；
- 自动发送 kickoff prompt；
- 自动从一个 Agent 切换到另一个 Agent。

## D-020 数量补充

Slot 创建第一个 Agent Instance 后，“创建”操作消失。后续点击恢复同一个长期实例；只有执行“归档并重新创建”后才生成替代实例。
