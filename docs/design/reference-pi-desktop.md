# 参考项目拆解：PI-Desktop

参考仓库：`https://github.com/vastsa/PI-Desktop`（本地只读克隆 `E:\mypi-refs\PI-Desktop`，v0.16.0）
用途：**只参考设计语言与 UI 处理手法**，不参考它的功能范围、插件体系、Rust 后端架构。

## 1. 它是怎么组织的

- `apps/desktop/src/styles/` 下按表面拆成 30+ 个 CSS 分片，入口 `globals.css` 只做 `@import` 排序，注释明确写「import order IS the cascade」。
- `tokens.css` 是唯一的设计变量来源，并且有 `scripts/check-style-tokens.mjs` 强制「组件 CSS 不许出现裸 px 的 font-size / radius」。
- 图标统一用 `lucide-react`（单一图标库，不混用）。
- 主题用 `:root[data-theme="dark"]` / `[data-theme="light"]` 双套变量，暗色是默认，浅色是覆盖层。

我们对齐的是它的**浅色那套**（下面数值全部取自 `tokens.css` 的 `data-theme="light"` 段）。

## 2. 配色：中性灰阶 + 墨色强调

它的强调色不是蓝、不是紫，而是**墨色本身**（`--ds-accent: #1a1c1f`），彩色只留给状态。

| 角色 | 浅色值 |
| --- | --- |
| 主背景 | `#ffffff` |
| 次级背景 | `#f9f9f9` |
| 三级背景 / 侧栏 | `#f3f3f3` |
| 内嵌底 | `#ededed` |
| 正文 | `#1a1c1f` |
| 次级文字 | `color-mix(in oklab, #1a1c1f 74%, transparent)` |
| 弱化文字 | `#5d5d5d` |
| 极弱文字 | `#afafaf` |
| 边框（默认/细微/强调） | 墨色 8% / 5% / 12% 透明 |
| 成功 | `#00a240` |
| 警告 | `#e25507` |
| 错误 | `#e02e2a` |
| 紫 | `#7c3aed` |

要点：**灰色不是终点，是层级**。同一个界面里同时存在 `#ffffff` / `#f9f9f9` / `#f3f3f3` / `#ededed` 四层底色，靠这四层拉开空间，而不是靠边框和阴影堆砌。

## 3. 层次：用「色调分层」代替描边

它的注释写得很直白（D297）：卡片是 soft tile，输入框是 filled well，边框只留给浮层。

- `--ds-tile`: 墨色 3.5% —— 平铺的卡片
- `--ds-tile-hover`: 6%
- `--ds-tile-deep`: 8%
- `--ds-raised`: `#ffffff` + `0 1px 2px rgba(0,0,0,.1), 0 0 0 .5px rgba(0,0,0,.04)` —— 需要「浮起来」的块
- 浮层才用真边框 + 大阴影：`0 0 0 .5px 墨色10%, 0 8px 32px rgba(0,0,0,.1), 0 2px 8px rgba(0,0,0,.06)`

还有一条重要手法：**半像素描边**（`0 0 0 0.5px`）。在高 DPI 屏上比 1px 边框精致得多。

## 4. 排版：一套字体、紧凑梯级

- 字体只有一套系统 sans：`-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`；等宽只给代码/路径。
- 字号梯级（含半档）：10.5 / 11 / 11.5 / 12 / 12.5 / 13 / 13.5 / 14 / 15 / 16 / 18 / 20 / 28。
- 字重：400 / 500 / 520 / 560 / 600 —— 用 520、560 这种非整数权重做「比 medium 重一点」，避免频繁跳到 600。
- 行高 token 化：1 / 1.15 / 1.2 / 1.25 / 1.3 / 1.35 / 1.4 / 1.45 / 1.5 / 1.55 / 1.6。
- **产品界面不用流体字号**（没有 clamp 大标题），尺寸固定乘一个全局 `--font-scale`。

## 5. 圆角与密度

- 圆角梯级：4 / 6 / 8 / 10 / 12 / 14 / 16 / 18 / 20 / 24 / full / round，两像素一档，相邻层级肉眼可辨。
- 控件尺寸有统一 token：`--ds-control-size: 28px`、`--ds-toolbar-height: 46px`、输入框高度由字号和行高推导（`calc(18px + var(--text-base) * var(--leading-body))`），所以按钮和输入框永远不会差几个像素。

## 6. 动效

- 时长：150 / 200 / 300ms 三档。
- 缓动：`cubic-bezier(0.22, 1, 0.36, 1)`（ease-out）为主，配 `cubic-bezier(0.2, 0, 0, 1)`。
- 按压反馈是 `transform: scale(0.98)`，不是改颜色。
- 动效只表达状态，不做入场编排。

## 7. 值得直接学的细节

1. `color-mix(in oklab, 墨色 N%, transparent)` 生成整条灰阶，hover / active / 选中态自动协调，不用手写十几个 hex。
2. 侧栏用 `#f3f3f3`、正文区用 `#ffffff`，一深一浅就把「导航」和「内容」分开了。
3. 状态点（运行中 / 完成 / 失败）是小圆点 + 半透明底，不是大色块。
4. 过程摘要做成 chip：`Processed for 6s · 4 steps`，和我们现在的「N 条过程」是同一类信息，但它的字重、留白、图标更克制。
5. 模型名、上下文占用等元信息用等宽小字 + 低对比度，不抢正文。

## 8. 不要照搬的

- 它的暗色默认：我们明确要浅色。
- 它的插件市场、Rust host、多平台打包：与我们的范围无关。
- 它 441 个 tsx 的体量：我们保持现有组件划分，只做视觉与质感升级。

## 9. 工作面板功能拆解

参考项目把右侧区域做成一个可扩展 work panel，而不是单一文件列表：

- `FilesTab`：目录树、文件名搜索、全宽文件预览、Markdown、代码高亮、返回树和系统打开。
- `ReviewTab`：汇总 `+ / −`，把每次文件变更做成可展开卡片，展开后显示 hunk 和行级 diff。
- `WorkPanel`：顶部标签页负责切换资源，支持关闭、重排、最大化；浏览器和子任务也作为独立视图存在。

CodePIddy 不复制插件体系。当前落地的是三个 host-owned 视图：

1. `文件`：沿用现有 `listWorkspaceDir / readWorkspaceFile / searchProjectFiles`，改成树与全宽预览切换。
2. `更改`：只看最新一轮对话中的 `edit / write` tool 事件，按文件分组，纵向堆叠为默认折叠的可展开卡片，展开后原地显示完整 diff，新增绿底、删除红底；变更历史按项目 + 工作项 + Agent 角色 + 轮次持久化，重启或更新 Pi 核心后仍可查看。
3. `终端`：面板内嵌项目根目录的 PowerShell 会话，通过最小 IPC 转发输入输出；输出可选择复制，工作目录随 `cd` 更新。这不沿用参考项目的插件视图模型。

这样能先把“文件面板不是静态树，而是工作区”这个信息架构建立起来，同时保持业务边界不变。

### 它的 diff 证据是怎么产生的

参考项目的 ReviewTab 不解析 tool 文本，也不看当前 Git 工作区。`host-core` 在 Write / Edit 执行前抓取旧文件字节，执行后生成一份 message-owned 的结构化证据，挂在 tool result 的 `details.review` 上：

```ts
type ReviewChange = {
  version: 1;
  snapshotId: string;
  path: string;
  operation: "write" | "edit" | "delete";
  status: "added" | "modified" | "deleted";
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
};
```

渲染层只展示这份证据，并从消息持久化里恢复；它不重新计算 diff，所以重启后和运行中的结果一致。二进制、超大文件和失败的调用不产生 hunks。

CodePIddy 按同一思路实现，但用的是 Pi 自带的扩展点，不改 Pi core：

- `@codepiddy/review-extension` 在 `tool_call`（执行前）解析 write / edit 的路径并读取旧内容：文件不存在记为“新文件”，二进制或超过 64KB 则跳过。
- 在 `tool_result`（执行后）读取新内容，用 `diff.createTwoFilesPatch` 生成 unified patch，写回 `details.patch` / `details.diff` / `details.review`。
- 桌面端优先展示 `details.patch`；拿不到 patch 时才把 write 的正文整块按新增展示。`panelDiffLines` 只在出现 `@@` hunk 头或 `---/+++` 文件头时按 diff 解析，绝不靠“行首是 + / -”猜测。
