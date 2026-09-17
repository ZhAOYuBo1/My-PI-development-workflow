# ADR-0017：Codex 风格客户端与项目树

- 状态：已接受
- 日期：2026-09-16

## 背景

CodePIddy 是桌面客户端。用户希望沿用 Codex 客户端熟悉的项目与会话布局，但在项目树中显式组织“新需求”和“修漏洞”两种工作方式，以及每个工作项下职责不同的 Agent。

## 决策

1. CodePIddy 使用本地桌面客户端外壳。
2. 左侧侧边栏负责项目、工作类型、Work Item 和 Agent Instance 导航。
3. 中央工作区显示当前 Agent 的对话、工具调用、权限请求、diff、测试和文档结果。
4. 每个项目节点下固定存在“新需求”和“修漏洞”两个目录节点。
5. 固定目录节点不可删除，但可以折叠。
6. 目录下显示多个 Work Item。
7. Work Item 下显示用户已创建的 Agent Instance。
8. 点击 Agent Instance 打开其独立会话。
9. Agent 创建、归档和删除只影响当前 Work Item，不影响另一个目录或工作项。

## 信息层级

```text
Project
  -> Lane（新需求 / 修漏洞）
      -> Work Item
          -> Agent Instance
              -> Conversation / Tools / Artifacts
```

示例：

```text
CodePIddy Project
├─ 新需求
│  ├─ FEAT-001 登录功能
│  │  ├─ 需求分析 Agent
│  │  ├─ Coding Agent
│  │  └─ Review Agent
│  └─ FEAT-002 导出功能
│     ├─ 需求分析 Agent
│     └─ Coding Agent
└─ 修漏洞
   ├─ BUG-001 登录白屏
   │  ├─ Bug Fix Agent
   │  └─ Review Agent
   └─ BUG-002 导出乱码
      └─ Bug Fix Agent
```

## 侧边栏行为

### Project

- 点击：打开项目概览；
- 展开：显示两个固定 Lane；
- 右键/更多菜单：项目设置、打开目录、关闭项目。

### Lane

- “新需求”：创建 Feature Work Item；
- “修漏洞”：创建 Bug Work Item；
- 点击：中央显示该 Lane 的 Work Item 列表；
- 展开：显示最近或全部 Work Item。

### Work Item

- 点击：打开工作项概览和共享项目文档；
- 展开：显示已经创建的 Agent Instance；
- 操作：重命名、归档、查看 `.codepiddy/` 文档、创建允许的 Agent。

### Agent Instance

- 点击：打开 Agent 会话；
- 状态：空闲、运行、等待用户、完成、失败；
- 操作：重命名、停止、归档、打开输出文档。

## Agent 可创建范围

### 新需求 Work Item

```text
Requirement Analysis
Coding
Review
```

### 修漏洞 Work Item

```text
Bug Fix
Review
```

UI 只显示当前工作类型允许创建的 Agent Role。

## 中央工作区

打开 Agent 后显示：

- Agent 名称和所属 Work Item；
- 当前 Role；
- 对话消息；
- Tool Call；
- 权限审批；
- 引用的 `.codepiddy/` 文档；
- Git diff；
- 测试与审核结果；
- 输入框和停止按钮。

## 状态提示

侧边栏可以使用小型状态标记：

```text
● running
● waiting
✓ completed
! failed
```

项目级写锁持有者需要在对应 Agent 行和项目标题区域显示。

## 非目标

- Lane 不是自动流水线；
- 展开下一 Agent 不会自动启动；
- Work Item 不自动创建全部 Agent；
- 选择 Agent 不会自动发送消息，除非用户确认预置 Prompt；
- 不把另一个 Agent 的完整聊天注入当前会话。

## D-018：最终侧边栏层级

已确认采用：

```text
Project
  -> Lane
      -> Work Item
          -> Agent Instance
```

不采用把所有 Agent 直接平铺在 Lane 下，也不把 Agent 只隐藏在中央 Work Item 页面中。Work Item 默认可折叠，展开后可以直接选择 Agent。

## Agent Slot 占位

尚未创建 Agent Instance 的 Slot 仍显示在 Work Item 下：

```text
○ Coding Agent  [创建]
```

创建后替换为可点击的 Agent 行。Slot 的占位状态不是一条空聊天记录。

## D-024 导航补充

Work Item Chevron 和标题是两个独立交互目标：Chevron 控制展开；标题打开 Work Item Overview。Agent 子行打开 Agent 会话。详见 `0022-work-item-overview-navigation.md`。
