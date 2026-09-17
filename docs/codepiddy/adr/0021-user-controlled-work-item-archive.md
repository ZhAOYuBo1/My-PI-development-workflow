# ADR-0021：Work Item 归档完全由用户控制

- 状态：已接受
- 日期：2026-09-16

## 背景

Agent 只能执行工作并提供结果，不能替用户决定一个需求或 Bug 是否结束。Review Agent 的 `approved` 结论可能仍需用户进一步检查、提交代码或继续讨论。因此 Work Item 不应因 Agent 输出自动消失。

用户希望体验类似 Codex 会话管理：在项目树的 Work Item 行提供一个移除按钮，由人决定何时从活跃列表隐藏。

## 决策

1. Work Item 生命周期由用户控制。
2. Agent 不能自动把 Work Item 标记为完成、归档或删除。
3. Review Agent 的 `approved` 只更新审核文档和状态提示，不触发归档。
4. Work Item 默认一直显示在所属 Lane 下。
5. 用户点击归档按钮后，状态变为 `archived`。
6. 归档后物理目录保持原位。
7. 归档 Work Item 从默认活跃列表隐藏，但可以在“已归档”中查看和恢复。
8. 永久删除是独立操作，必须与归档明确区分。

## 状态语义

建议只使用简单的人控生命周期：

```text
active
archived
```

Agent 运行状态和 Review 结果另外显示，不直接改变生命周期：

```text
Work Item lifecycle: active
Review verdict: approved
Agent status: completed
```

此时 Work Item 仍然在活跃列表，直到用户归档。

## UI

### 活跃行

```text
▼ FEAT-001：增加登录功能       ✓审核通过   [归档]
```

按钮可以使用与 Codex 会话移除相似的图标，但 tooltip 必须显示：

```text
归档工作项
```

不要显示“永久删除”，避免用户误解。

### 归档后

```text
新需求
├─ FEAT-003：权限管理
└─ 已归档 2
```

展开：

```text
已归档
├─ FEAT-001：增加登录功能      [恢复]
└─ FEAT-002：导出功能          [恢复]
```

## 文件行为

归档只更新：

```yaml
status: archived
archivedAt: 2026-09-16T15:30:00+08:00
```

以下保持不变：

- `.codepiddy/requirements/FEAT-001/` 路径；
- 项目文档；
- Git 历史；
- 本地 Agent session；
- Artifact 引用。

恢复时：

```yaml
status: active
archivedAt: null
```

## Agent 边界

Agent 可以在 `review.md` 中写：

```text
verdict: approved
```

但不能：

- 调用归档动作；
- 修改 Work Item lifecycle；
- 从侧边栏隐藏 Work Item；
- 永久删除文档。

## 永久删除

永久删除不放在主要归档按钮上，只能位于 Work Item 的更多菜单：

```text
更多
├─ 重命名
├─ 打开文件夹
├─ 归档
└─ 永久删除…
```

永久删除必须说明将影响：

- 项目 `.codepiddy/` 文档；
- 本地 Agent session；
- 日志和关联状态。

具体删除与保留策略可以在后续生命周期设计中确认。

## D-023：归档交互

普通归档不弹确认框：

```text
用户点击归档
  -> 立即将 status 更新为 archived
  -> 从活跃列表隐藏
  -> 显示 Toast：“FEAT-001 已归档” [撤销]
```

撤销窗口建议为 5–10 秒。用户点击撤销后恢复 `active` 状态和原来的侧边栏位置。

如果 Toast 消失，用户仍然可以从“已归档”列表恢复。

永久删除不提供这种快速操作，必须：

1. 打开更多菜单；
2. 选择“永久删除…”；
3. 显示受影响的项目文档和本地 session；
4. 用户明确确认。
