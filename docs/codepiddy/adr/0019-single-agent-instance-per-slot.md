# ADR-0019：每个 Agent Slot 只有一个当前长期实例

- 状态：已接受
- 日期：2026-09-16

## 背景

如果同一个 Work Item 的同一个角色允许创建多个并列 Agent，会产生结果归属、Handoff 冲突、写锁争用和 UI 层级膨胀。当前产品强调人工、线性协作，不需要多个同角色 Agent 竞争处理同一工作。

## 决策

1. 每个 Agent Slot 最多有一个当前 Agent Instance。
2. 当前实例是长期会话，可以持续对话和恢复。
3. 用户可以使用 Pi session 的 Fork、tree 和 compaction 能力管理上下文。
4. 侧边栏不显示 `Coding Agent 1/2/3` 这样的并列实例。
5. 用户可以归档当前实例并创建替代实例。
6. 归档实例保留在本地历史中，但不再是 Slot 的当前实例。
7. 新实例仍读取项目 `.codepiddy/` 中的共享文档，因此不会因为更换 session 丢失工作上下文。

## 数据模型

```typescript
interface AgentSlot {
  id: string;
  workItemId: string;
  roleProfileId: RoleProfile["id"];
  currentInstanceId?: string;
  archivedInstanceIds: string[];
}
```

约束：

```text
currentInstanceId = 0 或 1 个
```

## UI

### 尚未创建

```text
○ Coding Agent   [创建]
```

### 已创建

```text
● Coding Agent
```

### 已归档，可重新创建

```text
○ Coding Agent   [重新创建]
```

历史入口可以在 Agent 菜单中提供：

```text
查看已归档实例
```

但不会在主项目树中增加一层并列 Agent。

## 继续工作

用户再次打开已有 Agent 时恢复当前 session，而不是创建新 session：

```text
点击 Agent
  -> 加载 currentInstanceId
  -> 恢复 session
  -> 打开中央会话
```

## 重新开始

```text
Agent 菜单
  -> 归档并重新创建
  -> 确认
  -> 旧实例归档
  -> 创建新 currentInstanceId
  -> 读取当前项目文档
```

项目文档保持不变，除非用户明确选择清理或恢复文档。
