# CodePIddy UI 信息架构

- 状态：MVP 极简结构已确认
- 日期：2026-09-16

## 应用结构

CodePIddy 保持 Codex 风格：

```text
左侧：项目与 Agent 导航
中央：当前 Agent 对话
底部：Prompt 输入
```

## 侧边栏

```text
Project
├─ 新需求
│  └─ FEAT-001
│     ├─ 需求分析 Agent
│     ├─ Coding Agent
│     └─ Review Agent
└─ 修漏洞
   └─ BUG-001
      ├─ Bug Fix Agent
      └─ Review Agent
```

## 点击行为

- Chevron：展开/折叠；
- Project：项目极简页面；
- Lane：Work Item 列表；
- Work Item：Agent 选择空状态；
- Agent：对话工作区。

## Work Item 空状态

只显示：

- ID 和标题；
- Agent Slot/Instance 行；
- 打开 Work Item 文件夹；
- 重命名；
- 归档。

不显示项目交接文件内容。

## Agent 工作区

显示：

- 对话消息；
- 流式模型输出；
- Tool Call；
- 权限请求；
- 基本运行状态；
- Prompt 输入；
- 停止按钮。

## 项目文档

`.codepiddy/` 文档由 Agent 在文件系统中读取和更新。开发者通过 IDE、文件管理器或终端查看。客户端不实现文档管理器。
