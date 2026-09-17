# ADR-0022：Work Item 概览与树形导航交互

- 状态：已接受，概览内容已由 ADR-0023 极简化
- 日期：2026-09-16

## 背景

Work Item 是文件夹和隔离单元，不只是 Agent 的父级。用户需要一个统一位置查看该需求或 Bug 的文档、Agent、审核结果和当前状态。因此展开/折叠与打开 Work Item 内容不能使用同一个点击行为。

## 决策

1. Work Item 行包含独立 Chevron 和标题点击区域。
2. 点击 Chevron 只切换展开/折叠，不改变中央页面。
3. 点击 Work Item 文件夹图标或标题，中央区域打开 Work Item Overview。
4. 点击 Agent 子行，中央区域打开该 Agent 的会话。
5. Work Item Overview 不是聊天页面，不绑定某个 Agent session。
6. 从 Agent 会话返回 Work Item Overview 时，不关闭或重建 Agent。

## 交互示例

```text
[▼] [文件夹] FEAT-001：增加登录功能
             ├─ 需求分析 Agent
             ├─ Coding Agent
             └─ Review Agent
```

点击区域：

```text
▼                    -> 折叠为 ▶
文件夹/标题            -> 打开 FEAT-001 概览
Coding Agent          -> 打开 Coding 会话
```

## Work Item Overview 内容

至少包含：

- Work Item ID、标题和初始描述；
- 所属 Lane；
- `work-item.md` 状态；
- 项目共享文档列表；
- Agent Slot/Instance 状态；
- 最近活动；
- Review verdict 与未解决 Finding；
- 当前 Work Item 相关 Git diff 摘要；
- Project Write Lease 是否由本 Work Item 持有；
- 重命名、打开文件夹和归档操作。

## 导航状态

客户端应分别保存：

```typescript
interface SidebarState {
  expandedProjectIds: string[];
  expandedLaneIds: string[];
  expandedWorkItemIds: string[];
  selectedNode:
    | { type: "project"; projectId: string }
    | { type: "lane"; projectId: string; lane: "features" | "bugs" }
    | { type: "work-item"; workItemId: string }
    | { type: "agent"; agentInstanceId: string };
}
```

展开状态和选中状态必须分开。用户可以展开一个 Work Item，同时继续查看另一个 Agent 会话。

## 键盘与可访问性

- 左/右方向键折叠或展开；
- Enter 打开选中节点；
- 文件夹标题具有独立焦点语义；
- Chevron 具有 `aria-expanded`；
- Agent 状态不能只依赖颜色表达。

## ADR-0023 修正

Work Item Overview 不再展示项目文档、Git diff、Finding 或流程 Dashboard。MVP 只显示标题、可用 Agent、打开文件夹和归档等最小操作。详见 `0023-minimal-codex-like-ui.md`。
