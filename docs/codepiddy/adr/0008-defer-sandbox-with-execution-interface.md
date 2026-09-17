# ADR-0008：Windows MVP 延后沙箱并预留执行环境接口

- 状态：已接受
- 日期：2026-09-15

## 背景

CodePIddy MVP 运行在 Windows。当前阶段优先验证 UI、工作流和 Agent 角色，不立即投入 Docker/WSL/VM 沙箱集成。但如果 Orchestrator 直接依赖本机进程和文件系统，后续增加隔离环境会造成大规模改造。

## 决策

1. MVP 提供 `LocalExecutionEnvironment`，在当前 Windows 用户权限下运行 Pi 和命令。
2. UI 必须明确标识本地模式不是沙箱。
3. 所有 Agent 进程、命令、文件访问和取消通过 `ExecutionEnvironment` 抽象进入，不允许工作流层直接启动进程。
4. 预留 WSL、Docker 和 Remote Sandbox 后端，但 MVP 不实现。
5. 权限策略仍然启用，但文档和 UI 不把 Permission Gate 描述为强隔离。

## 建议接口

```typescript
interface ExecutionEnvironment {
  readonly kind: "local" | "wsl" | "docker" | "remote";
  startAgent(input: StartAgentInput): Promise<AgentProcess>;
  runCommand(input: RunCommandInput): Promise<CommandResult>;
  readFile(input: ReadFileInput): Promise<FileContent>;
  writeFile(input: WriteFileInput): Promise<void>;
  terminate(runId: string): Promise<void>;
  getCapabilities(): ExecutionCapabilities;
}
```

## MVP UI 提示

```text
本地执行模式：Agent 以当前 Windows 用户权限运行。本模式提供操作审批，但不提供操作系统级隔离。
```

## 后果

- MVP 更快，但不适合不可信仓库或完全无人监管任务；
- 权限控制只能降低误操作，不能阻止恶意本地代码；
- 后续增加隔离环境时，工作流和 UI 可以保持稳定。
