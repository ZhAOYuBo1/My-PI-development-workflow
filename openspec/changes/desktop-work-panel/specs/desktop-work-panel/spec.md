# Spec Delta

## Purpose

让桌面端在对话时间线之外拥有一块常驻的右侧文件管理器，实时浏览 Agent 所在工作区的文件树并预览常见格式的文件，关键产物不再被聊天流淹没（对标 PI-Desktop 文件管理器：文件树 + 多格式预览，只借鉴交互模式）。

## ADDED Requirements

### Requirement: 文件树浏览与搜索

系统 SHALL 在右侧看板展示工作区根目录的文件树：目录懒加载展开/折叠、文件显示名称与大小、提供文件名搜索框（复用既有 `searchProjectFiles`）。点击文件 SHALL 在看板内打开预览。

#### Scenario: 展开目录并打开文件

- **WHEN** 用户展开 `src` 目录并点击 `app.ts`
- **THEN** 看板内显示 `app.ts` 的带行号文本预览，且文件名与大小可见

#### Scenario: 按文件名搜索

- **WHEN** 用户在看板搜索框输入 `hand`
- **THEN** 列表过滤出 `HANDOVER.md` 等匹配文件，点击可直接预览

### Requirement: 多格式文件预览

看板 SHALL 按文件类型选择预览方式：`md/markdown` 渲染为富文本；代码与文本文件显示带行号的原文；常见图片格式（png/jpg/gif/webp/svg）显示图片；二进制或超大文件（文本超 512KB、图片超 8MB）显示空态说明而非乱码。

#### Scenario: 预览 markdown 与代码

- **WHEN** 用户打开 `README.md` 与 `app.ts`
- **THEN** 前者渲染为富文本（含代码块），后者为带行号的原文

#### Scenario: 二进制文件不乱码

- **WHEN** 用户打开 `app.exe`
- **THEN** 看板显示"二进制文件无法预览"类空态提示

### Requirement: 工具产物自动打开与跟随锁定

Agent 成功执行 `write`/`edit`/`read` 时，系统 SHALL 自动在看板打开对应文件（跟随模式）；用户手动切换文件后自动打开 SHALL 暂停，直到用户点"跟随最新"恢复。

#### Scenario: 写入文件后看板自动打开

- **WHEN** Agent 成功执行 `write` 写入 `notes.md`
- **THEN** 右侧看板自动打开 `notes.md` 的预览

#### Scenario: 手动锁定后不再被打断

- **WHEN** 用户手动打开历史某文件后又有新工具完成
- **THEN** 看板保持当前文件，直到用户重新启用跟随

### Requirement: 看板可开关、可调宽且有空态

系统 SHALL 提供看板显隐开关（默认显示，图标按钮，状态持久化），隐藏时对话区占满宽度；看板宽度 SHALL 支持左右拖拽（280–640px，持久化）；当工作区不可用或尚无文件时，看板 SHALL 显示空态说明而非空白；窄窗（≤1100px）自动隐藏看板。

#### Scenario: 拖拽调宽后保持

- **WHEN** 用户把看板从 400px 拖到 520px 后刷新
- **THEN** 看板仍为 520px 宽

#### Scenario: 空会话展示空态

- **WHEN** 新建会话且 Agent 尚未调用任何工具
- **THEN** 看板显示"暂无可预览内容"等空态提示
