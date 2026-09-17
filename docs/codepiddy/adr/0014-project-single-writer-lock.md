# ADR-0014：MVP 使用项目级单写锁

- 状态：已接受
- 日期：2026-09-16

## 背景

项目中可以同时存在多个新需求和修漏洞 Work Item。它们的会话、Handoff 和 Artifact 已经按文件夹隔离，但 MVP 不为每个 Work Item 创建独立 Git worktree，因此所有 Agent 最终仍操作同一个项目源代码目录。

如果多个 Agent 同时写入，会出现文件覆盖、Git diff 归属不清、测试结果相互影响和交接基线失效。

## 决策

1. 每个 Project 只有一个 `ProjectWriteLease`。
2. 任意时刻只有一个 Agent Instance 可以持有该 Lease。
3. Coding Agent 修改代码前必须取得 Lease。
4. Bug Fix Agent 修改代码前必须取得 Lease。
5. Review Agent 在只读审核阶段不需要 Lease；第一次准备新增或修改测试前必须取得 Lease。
6. Requirement Analysis Agent 不修改项目文件，因此不取得 Lease。
7. 多个只读 Agent 可以同时运行。
8. 多个 Work Item 可以同时存在、编辑描述、分析和查看结果。
9. MVP 不创建独立 worktree，也不自动合并分支。
10. 权限插件仍决定具体工具调用是否允许；Write Lease 只解决项目内并发写入，不替代权限审批。

## 写锁范围

Lease 覆盖会影响项目状态的操作：

- `write`、`edit`；
- 新建、删除、移动或重命名项目文件；
- 修改测试和 fixture；
- 格式化造成文件变化；
- 修改 lockfile；
- 安装依赖；
- `git add`、`git commit`、`git checkout` 等改变工作区或索引的操作；
- 其他被工具声明为 mutating 的操作。

普通读取、搜索、LSP 查询、`git status`、`git diff` 和查看 Artifact 不占用 Lease。

## 建议数据结构

```typescript
interface ProjectWriteLease {
  projectId: string;
  holderAgentInstanceId: string;
  workItemId: string;
  roleProfileId: "coding" | "bug-fix" | "review";
  acquiredAt: string;
  heartbeatAt: string;
  reason: string;
}
```

## 生命周期

```text
Agent 请求执行修改操作
  -> 检查 ProjectWriteLease
      -> 空闲：获取 Lease
      -> 当前 Agent 已持有：继续
      -> 其他 Agent 持有：直接阻止并显示持有者；不排队、不自动重试

Agent 完成、暂停、终止或崩溃
  -> 释放或回收 Lease
```

## 崩溃恢复

- Lease 必须有 heartbeat；
- 应用重启后不能仅凭旧文件认定 Agent 仍存活；
- 发现 stale Lease 时，检查对应进程和 session；
- 用户确认或确定进程不存在后回收；
- 回收动作写入审计事件；
- 不得在另一个 Agent 仍可能写入时强制窃取 Lease。

## UI 表现

项目标题区域持续显示：

```text
当前写入者：FEAT-001 / Coding Agent / CODE-001
```

其他写入型 Agent 显示：

```text
项目正在被另一个 Agent 修改
```

只读操作保持可用。

## 与权限插件的关系

```text
Project Write Lease：是否允许这个 Agent 此刻成为唯一写入者
pi-permission-system：这一次具体工具调用按配置是否 allow/ask/deny
```

两个条件都满足才能修改：

```text
holdsWriteLease && permissionDecision === "allow"
```

或者在插件返回 `ask` 并由用户批准后执行。

## 后果

- 不需要在 MVP 处理 worktree、合并和冲突；
- 多个 Work Item 的文档与只读工作仍可并行；
- 长时间运行的写 Agent 会阻塞其他写任务；
- UI 需要展示锁持有者并处理等待、取消和 stale lease；
- 后续采用 worktree 后，可以把 Project Write Lease 下放为 Worktree Write Lease。

## D-014：冲突处理

写锁冲突采用最简单的防御性行为：

```text
新的写入型 Agent 请求开始
  -> Write Lease 已占用
  -> 阻止启动写入阶段
  -> 显示当前持有者
  -> 不创建等待任务
  -> 不在锁释放后自动启动
```

用户需要：

1. 返回当前写入 Agent；
2. 等待其完成，或手动暂停/终止；
3. 确认写锁释放；
4. 再次手动触发目标 Agent。

该锁不是任务调度机制，只是共享工作树的并发保护。正常产品路径保持线性，因此锁冲突应是低频异常状态。
