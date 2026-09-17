# ADR-0013：项目双分区、工作项与独立 Agent 实例

- 状态：已接受，创建方式由 D-019 明确；单 Slot 单实例由 D-020 明确；代码并发由 D-013 明确
- 日期：2026-09-15

## 背景

新需求和修漏洞是程序员日常的两类工作。产品不需要把它们实现成不同 Agent 引擎，而应在项目内提供两个类似文件夹的固定分区。用户可以在分区内创建多个独立工作项，并按需创建承担不同工作的 Agent 实例。

## 决策

1. 每个项目固定包含两个 Lane：`features`（新需求）和 `bugs`（修漏洞）。
2. 每个 Lane 可以创建多个 Work Item。
3. 新需求 Work Item 提供 Requirement Analysis、Coding、Review 三种 Agent Slot。
4. 修漏洞 Work Item 提供 Bug Fix、Review 两种 Agent Slot。
5. Agent Instance 不在项目打开时自动创建，由用户在对应 Slot 中单独创建。
6. 所有 Agent Instance 使用同一个 Pi Agent Runtime 和统一宿主代码。
7. 角色差异通过 Role Profile 表达：system prompt、Skill、工具、权限插件配置、输入文件和输出契约。
8. 每个 Work Item 与 Agent Instance 必须文件和会话隔离。

## UI 层级

```text
Project
├─ 新需求
│  ├─ FEAT-001：实现登录
│  │  ├─ Requirement Analysis Agent Slot
│  │  ├─ Coding Agent Slot
│  │  └─ Review Agent Slot
│  └─ FEAT-002：增加导出
└─ 修漏洞
   ├─ BUG-001：登录后白屏
   │  ├─ Bug Fix Agent Slot
   │  └─ Review Agent Slot
   └─ BUG-002：导出乱码
```

Slot 是角色位置；Instance 是用户实际创建的 Pi 会话。

## 建议磁盘结构

数据采用 D-015 定义的混合存储；以下首先描述用户数据目录中的运行时逻辑结构：

```text
<project-data>/
  features/
    FEAT-001/
      work-item.json
      artifacts/
      agents/
        requirement-analysis/
          instances/
            RA-001/
              session.jsonl
              state.json
              outputs/
        coding/
          instances/
            CODE-001/
              session.jsonl
              state.json
              outputs/
        review/
          instances/
            REV-001/
              session.jsonl
              state.json
              outputs/
  bugs/
    BUG-001/
      work-item.json
      artifacts/
      agents/
        bug-fix/
          instances/
            FIX-001/
        review/
          instances/
            REV-001/
```

## 统一 Agent Runtime

```typescript
interface RoleProfile {
  id: "requirement-analysis" | "coding" | "bug-fix" | "review";
  systemPrompt: string;
  skills: string[];
  inputArtifacts: ArtifactSelector[];
  outputContract: OutputContract;
  permissionProfile?: string;
  defaultKickoffPrompt: string;
}

interface AgentInstance {
  id: string;
  workItemId: string;
  roleProfileId: RoleProfile["id"];
  sessionId: string;
  status: "idle" | "running" | "waiting" | "completed" | "failed";
}
```

Role Profile 只是配置，不是不同 Agent 实现：

```text
统一 PiAgentHost + 不同 RoleProfile = 不同工作职责
```

## 隔离要求

### Work Item 隔离

- 不读取其他 Work Item 的 Handoff，除非用户显式引用；
- Finding、循环次数和完成状态不共享；
- 新需求与修漏洞不能跨 Lane 自动路由。

### Agent Instance 隔离

- 独立 Pi session/context；
- 独立日志和输出目录；
- 明确的输入 Artifact manifest；
- 权限插件按当前实例角色加载配置；
- 输出只能提交到当前 Work Item。

### 代码工作区

MVP 共享同一个项目工作树，并记录每个 Work Item 的 Git baseline 和变更归属。项目使用 D-013 定义的 Project Write Lease；任意时刻只有一个 Agent Instance 可以修改项目文件。

## Agent 创建

用户点击 Slot 中的“创建 Agent”后：

1. 创建 Agent Instance ID；
2. 创建独立 session；
3. 解析 Role Profile；
4. 选择当前 Work Item 的输入 Artifact；
5. 生成默认 kickoff prompt；
6. 显示给用户；
7. 用户触发后开始运行。

## 后果

- UI 层级与文件夹心智模型一致；
- 多个需求和多个 Bug 可以独立保存；
- 所有角色复用同一 Agent Host，减少实现重复；
- 必须明确 Work Item 与 Agent Instance 的层级，防止多个任务的交接文件混杂；
- 后续需要决定一个 Slot 是否允许创建多个并列实例。


## D-015 存储补充

Agent session、实例状态和日志只保存在用户数据目录。项目 `.codepiddy/` 只在用户启用时保存经过过滤的共享 Artifact。详见 `0015-hybrid-storage.md`。

## D-019 创建补充

Work Item 创建时只产生 Slot 元数据。Agent Instance 和 Pi session 只有在用户点击“创建”后生成。缺少前置文档只提示，不锁死顺序。详见 `0018-lazy-agent-creation.md`。

## D-020 实例数量补充

每个 Slot 只有一个 current Agent Instance。需要重建时归档旧实例并替换，不在侧边栏并列展示多个同角色 Agent。详见 `0019-single-agent-instance-per-slot.md`。

## D-021 Work Item 文件夹补充

Work Item 不是纯数据库行或聊天标题，而是项目 `.codepiddy/requirements/<id>/` 或 `.codepiddy/bugs/<id>/` 的实际目录，也是文档、Agent 归属和状态的隔离边界。详见 `0020-work-item-as-isolation-folder.md`。
