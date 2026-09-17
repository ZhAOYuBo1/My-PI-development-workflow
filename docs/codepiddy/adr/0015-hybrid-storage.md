# ADR-0015：采用混合存储模型

- 状态：已接受，项目文档可选部分已由 ADR-0016 取代
- 日期：2026-09-16

## 背景

CodePIddy 需要保存大量 Agent session、日志、事件、权限审计和内部状态。这些内容可能体积大、包含本地路径或敏感信息，不适合进入用户代码仓库。同时，需求、实施计划、测试审核报告等文档有共享、审查和版本控制价值。

## 决策

1. 使用 CodePIddy 用户数据目录保存所有运行时和内部数据。
2. 项目可以选择启用 `.codepiddy/`，用于保存适合共享的文档。
3. API Key、Provider 凭据、完整聊天记录、原始工具输出和权限审计永远不写入项目 `.codepiddy/`。
4. 每类数据必须声明唯一事实源。
5. 项目文档同步必须经过 schema 校验和敏感内容过滤。
6. 用户可以选择 `.codepiddy/` 是否加入 Git；CodePIddy 不应静默提交文件。

## Windows 用户数据目录

建议运行时根目录：

```text
%LOCALAPPDATA%\CodePIddy\
```

逻辑结构：

```text
%LOCALAPPDATA%\CodePIddy\
  settings/
    app-settings.json
  projects/
    <project-id>/
      project-state.json
      lanes/
        features/
          <work-item-id>/
            state.json
            events.jsonl
            artifacts/
            agents/
              <agent-instance-id>/
                session.jsonl
                state.json
                logs/
                outputs/
        bugs/
          <work-item-id>/
      write-lease.json
      audit/
      caches/
  logs/
```

若后续需要跨设备漫游少量用户设置，可以再评估 `%APPDATA%`；MVP 的大型运行数据使用 `%LOCALAPPDATA%`。

## 项目目录

启用项目文档后：

```text
<repo>/
  .codepiddy/
    manifest.json
    features/
      FEAT-001/
        requirements.md
        acceptance-criteria.json
        implementation-plan.md
        task-breakdown.json
        handoff-to-coding.md
        implementation-report.md
        review-report.md
    bugs/
      BUG-001/
        bug-description.md
        bug-fix-report.md
        review-report.md
```

## 数据分类

### 只允许用户数据目录

- Pi session JSONL；
- 完整聊天历史；
- 原始 tool call/result；
- Agent stdout/stderr；
- Project Write Lease；
- 运行状态和 heartbeat；
- 权限审批和审计日志；
- Token、成本和遥测；
- Tavily API Key 和其他凭据；
- 缓存、索引和临时文件；
- 未经过滤的模型输出。

### 可以同步到项目 `.codepiddy/`

- 需求文档；
- 验收条件；
- 实施计划；
- 任务拆解；
- 人工可读 Handoff；
- 实现摘要；
- Bug 描述与根因摘要；
- 测试审核报告；
- 用户明确选择共享的决策文档。

### 默认不应同步

- 绝对本地路径；
- 环境变量；
- API Key 或 Authorization Header；
- 完整 shell 输出；
- 用户主目录信息；
- 未清理的 Prompt；
- 模型隐藏元数据；
- 大型二进制或缓存。

## 事实源规则

建议：

```text
运行状态事实源     = 用户数据目录
Agent session 事实源 = 用户数据目录
权限审计事实源     = 用户数据目录
可共享文档事实源   = 由 manifest 的 storageMode 决定
```

`manifest.json` 示例：

```json
{
  "schemaVersion": 1,
  "projectId": "01K...",
  "storageMode": "hybrid",
  "sharedDocumentsEnabled": true,
  "sharedDocumentsAuthority": "project",
  "featuresPath": "features",
  "bugsPath": "bugs"
}
```

当 `sharedDocumentsAuthority` 为 `project` 时，项目文件是共享文档的事实源；用户数据目录只保存索引和缓存。当其为 `local` 时，`.codepiddy/` 是显式导出结果，不得反向静默覆盖本地文档。

## 项目识别

- 每个项目使用稳定 UUID；
- 启用 `.codepiddy/` 时 UUID 写入 `manifest.json`；
- 未启用时 UUID 存储在本地项目注册表，并关联 canonical path；
- 项目移动或重命名后，由用户确认重新关联；
- 不能仅使用绝对路径 hash 作为永久项目身份。

## Git 行为

CodePIddy 可以提示：

```text
是否将 .codepiddy/ 纳入 Git？
```

选择：

- 跟踪共享文档；
- 保留本地但加入 `.gitignore`；
- 暂不决定。

CodePIddy 不自动 commit，也不在未确认时修改 `.gitignore`。

## 安全要求

同步前执行：

1. schema 校验；
2. secret pattern 扫描；
3. 绝对路径清理；
4. 大小限制；
5. 二进制拒绝；
6. 用户可预览 diff；
7. 原子写入。

## 后果

- 运行数据不会污染代码仓库；
- 用户可以选择共享产品文档；
- 需要实现同步、冲突和 schema migration；
- 必须明确 shared document 的权威来源；
- UI 需要展示文档当前位于本地还是项目目录。

## ADR-0016 修正

项目 `.codepiddy/` 不再是可选同步目标。对于 CodePIddy 项目，它默认存在并直接保存协作文档。需求、设计、交接和审核文档以项目文件为事实源；用户数据目录只保存不可共享的运行数据。
