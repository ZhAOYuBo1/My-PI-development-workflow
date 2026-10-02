# CodePIddy 客户端 UI 改版：任务记录

> **这个文件是唯一的进度真相。** 上下文被压缩或换新会话后，按下面「如何续接」走一遍再动手。

## 如何续接（压缩后先读这里）

1. 读 [PRODUCT.md](../../PRODUCT.md)（定位、边界、反参考）→ [DESIGN.md](../../DESIGN.md)（配色、字体、层次、组件规则）→ [reference-pi-desktop.md](./reference-pi-desktop.md)（参考项目拆解）。
2. 翻到本文件底部「进度日志」，读最后一条，确认上一批做到哪、验证到什么程度。
3. 恢复环境：
   - 依赖已装过，需要时 `npm install --ignore-scripts`
   - 构建 `npm run build:codepiddy`
   - 静态检查 `npm run check`，renderer 类型检查 `npm run typecheck --workspace=@codepiddy/desktop`
   - 视觉验证：在 `packages/codepiddy-desktop` 下跑 `npx vite --host 127.0.0.1 --port 5173`，浏览器打开 `http://127.0.0.1:5173/?demo=1`（必须带 `?demo=1` 才有演示数据）
   - 截图：Playwright + 已安装的 chromium（`npx playwright install chromium` 装过一次即可）
   - 真实客户端：`Start-Process node_modules\electron\dist\electron.exe -ArgumentList "." -WorkingDirectory packages\codepiddy-desktop`
4. 改完必须跑 `npm run check` + `npm run build:codepiddy`，需要时截图比对。

截图和 `node_modules` 一样在 `.artifacts/` 里，**已被 gitignore**，只在当前机器上存在，重新克隆后需要重跑一遍才能复现。

### 恢复提示词（压缩后直接发这一段）

```text
继续 CodePIddy 客户端 UI 改版。先读 docs/design/redesign-plan.md（尤其「如何续接」和「进度日志」最后一条），
再读 PRODUCT.md 和 DESIGN.md，然后从「待办清单」第 1 项开始做。

仓库在 E:\mypi，依赖已装好。改完必须跑：
  npm run check
  npm run typecheck --workspace=@codepiddy/desktop
  npm run build:codepiddy

要看效果：cd packages/codepiddy-desktop && npx vite --host 127.0.0.1 --port 5173，
浏览器开 http://127.0.0.1:5173/?demo=1（必须带 ?demo=1），用 Playwright 截图自查。
真实客户端：先 build，再 Start-Process node_modules\electron\dist\electron.exe -ArgumentList "." -WorkingDirectory packages\codepiddy-desktop。
```

**四个容易踩的坑**

- `npm run check` 内部会跑 `biome check --write`，它会重排格式，diff 变大是正常的，不是改错了。
- renderer 的类型检查**不在**根 `tsgo` 范围内，必须单独跑 `npm run typecheck --workspace=@codepiddy/desktop`。
- demo 模式没有 IPC，文件树只会显示「目录读取失败」；要看文件面板必须开真实项目。
- 本文件所在的工作区里还有约 900 个已 staged 的删除，来自更早那次「清理测试与非代码文件」，与 UI 改版无关，不要误以为是本次改动。

## 目标

把 CodePIddy 桌面客户端从「一眼 AI 生成」改成**克制、有层次、浅色的专业桌面工具**，设计语言参考 PI-Desktop（见 [reference-pi-desktop.md](./reference-pi-desktop.md)）。

## 范围

- 只改 `packages/codepiddy-desktop/src/renderer/`（样式、图标、组件呈现）。
- 不改业务逻辑、IPC、core、coding-agent。
- 不引入 Tailwind 或第二套框架，沿用现有 Vite + React + 单个 `styles.css` 的组织方式，必要时拆成多个 CSS 分片。

## 当前状态（2026-10-02 批次 7 之后）

- `styles.css` 3466 行，顶部是完整的 `--cp-*` 令牌层；全文件只剩 62 处硬编码 hex，基本就是令牌定义本身。
- 图标全部走 `lucide-react@1.48.0`，renderer 里手写 `<svg>` 已清零。
- 外壳：边到边分区，没有圆角外框、没有描边、没有浮动卡片；层次靠四层底色（`#ffffff` / `#f8f8f9` / `#f2f2f4` / `#e8e8eb`）和材质，而不是靠框。
- 侧栏毛玻璃：Windows 用系统材质 `backgroundMaterial: "acrylic"`（build ≥ 22621）+ 45% tint + 上下 sheen；浏览器 demo 用渐变兜底。实现细节见批次 7。
- 配色分工：中性 chrome 打底 + 蓝色强调 `#2563eb`（只用于交互与选中）+ 三色语义（成功/警告/错误，淡底 + 同色文字，实心只给圆点与角标）。
- 字号：基线 13px，侧栏行 13px，内容区标题 14px，正文 14px，元信息 11-11.5px。
- 结构：`.transcript` 与输入框同属新的 `.conversation-column`，两者同宽（760px）同轴。
- 输入区：最小 46px，随内容自动增高，超过 240px 转内部滚动。

### 本轮改动清单（相对 HEAD，全部未提交）

新增：`PRODUCT.md`、`DESIGN.md`、`docs/design/`、`packages/codepiddy-desktop/src/renderer/components/app-icon.tsx`

修改：`styles.css`、`App.tsx`、`components/WorkPanel.tsx`、`components/tool-icons.tsx`、`components/turn-group.ts`、`src/main/index.ts`、`packages/codepiddy-desktop/package.json`（新增 lucide）、根 `package.json`、`package-lock.json`、`README.md`、`.github/workflows/ci.yml`、`openspec/.../desktop-tool-collapse/spec.md`

### 改版前的基线（历史记录，仅作对照）

- `styles.css` 2206 行；只有 9 个 `--cp-glass-*` 变量，其余是 261 个不同的裸 hex 值。
- 主色调「白色玻璃 + 灰绿」，层次靠玻璃拟态。
- 图标两套来源，线宽与视觉重量不统一。

## 阶段与清单

### 阶段 0：上下文与文档（进行中）

- [x] 拆解参考项目设计语言 → `reference-pi-desktop.md`
- [x] 建立本任务记录文件
- [x] 写 `PRODUCT.md`（2026-10-02：用户确认用户=普通开发者、个性=克制/精密/可信/简约、反参考=AI 味、无硬性无障碍要求按 AA 执行）
- [x] 写 `DESIGN.md`（2026-10-02：token 体系、配色、字体、圆角、动效全部落盘）
- [x] 确认视觉方向（2026-10-02：北极星=精密仪器台；中性底+强调蓝 `#2563eb`；色调分层；紧凑精密）

### 阶段 1：设计令牌

- [x] 建立灰阶 / 语义色 / 圆角 / 字号 / 行高 / 字重 / 动效时长 token（2026-10-02：`styles.css` 顶部 `--cp-*` 全量建立）
- [x] 9 个 `--cp-glass-*` 重映射为中性色调别名（去掉绿色调、内高光、模糊），引用点逐个迁移中
- [x] 把剩下的裸 hex 收敛到 token（2026-10-02 批次 5：501 处 → 59 处，261 个不同值 → 19 个）

### 阶段 2：图标系统

- [x] 选定统一图标源（2026-10-02：`lucide-react@1.48.0`，与应用依赖精确锁定）
- [x] 统一线宽 / 尺寸 / 视觉重量（24 网格、2px 描边、圆角端点，去掉手写的实心点缀）
- [x] 替换 `App.tsx` 内手写 path（33 个应用图标抽到 `components/app-icon.tsx`）
- [x] 替换工具卡图标（`components/tool-icons.tsx` 改为 lucide 映射）
- [x] 替换文件面板的手写 SVG 与 `›` 文本折叠符（`WorkPanel.tsx`）
- [x] 删除已无人引用的 `src/renderer/assets/icons/`（17 个 SVG，设计源保留在 `codepiddy-icons/`）
- [x] 恢复图标源文件（2026-10-02：`codepiddy-icons/` 32 个 SVG 已从 git 历史取回）

### 阶段 3：层次与质感

- [x] 侧栏 / 内容区底色分开（2026-10-02：侧栏 `#f2f2f4`、内容 `#ffffff`，选中项白底抬起）
- [x] 浮层去掉玻璃拟态（2026-10-02：modal / 菜单 / 卡片 / 输入区改实色 + 半像素描边 + 单层阴影）
- [x] 半像素描边铺到剩余组件（2026-10-02 批次 5：取色统一时一并完成）

### 阶段 4：组件逐个过

- [x] 会话列表 / 项目树（2026-10-02 批次 1+4：侧栏 rail 底色、选中行白底抬起、状态色走语义色）
- [x] 输入区与工具栏（2026-10-02：实色面板，控件无边框，发送键改强调色，停止键改中性底 + 红图标）
- [x] 消息气泡与工具卡（2026-10-02：气泡/代码块/终端/diff 改色调分层，正文 16px→14px）
- [~] 右侧文件面板（配色已改，真实文件树未验证——demo 缺 IPC）
- [x] 设置页（2026-10-02：标题 24px→16px，卡片标题→14px，正文 12.5px，权限行压到 54px）
- [ ] 空态 / 错误态 / 加载态

### 阶段 5：验收

- [x] `npm run check` 通过（2026-10-02）
- [x] `npm run build:codepiddy` 通过（2026-10-02）
- [x] 截图对比（2026-10-02：`.artifacts/ui-*.png`、`conv-*.png`，含 900px 窄窗）
- [ ] 用户确认

## 进度日志

### 2026-10-02 批次 1：令牌层 + 外壳 + 会话区

改了 `packages/codepiddy-desktop/src/renderer/styles.css` 和 `src/main/index.ts`（后者同步窗口底色与标题栏 overlay 到 `#f2f2f4`）。

落地内容：

- 新增 `--cp-*` 令牌层（墨色阶、四层底色、描边、强调色、状态色、圆角、控件尺寸、两层阴影、动效）。
- 9 个 `--cp-glass-*` 改为中性色调别名，一次性去掉全站绿色调与内高光。
- 侧栏 `#f2f2f4` 与内容区 `#ffffff` 分离；选中行改白底 + 微投影（从侧栏抬起）。
- 按钮统一 28px/8px 圆角，取消悬停位移；主按钮改强调蓝。
- 输入框统一内嵌底 + 聚焦强调环，占位符统一 `#6e7075`。
- 浮层（modal / 各类菜单 / 设置卡 / 助手选择卡）去玻璃，改实色 + 单层浮起阴影。
- 输入区改实色面板；控件无边框；发送键强调色；停止键中性底 + 红图标。
- 消息气泡、代码块、终端、diff、thinking 块改色调分层；正文 16px → 14px。

验证：`npm run check` 通过，`npm run build:codepiddy` 通过，Electron 已用新构建重启。

待办：`DESIGN.md` 配套的 `.impeccable/design.json` sidecar 还没写（live 面板会回退到通用样式）。

### 2026-10-02 批次 2：图标系统 + 排版梯级 + 设置页

改了 `components/app-icon.tsx`（新）、`components/tool-icons.tsx`、`components/WorkPanel.tsx`、`App.tsx`、`styles.css`、`package.json`（新增 `lucide-react`）。

- 33 个应用图标 + 17 个工具图标全部换成 lucide，删除手写 path 表（App.tsx 少 288 行）。
- 文件面板的手写文件夹/文件 SVG 和 `›` 文本折叠符一并换掉，全仓已无手写 `<svg>`。
- JS bundle 从 342.23 kB 降到 339.80 kB（lucide 按需 tree-shake）。
- 排版收口：设置页标题 24px→16px、卡片标题→14px、正文→12.5px、元信息→11px；权限行从 62px→54px。
- 设置卡从「白底 + 浮起阴影」改成「白底 + 半像素描边」：它是随内容排布的分区，不是浮层。
- 右侧文件面板改安静内嵌底色，选中行白底抬起、图标转强调色。

验证：`npm run check`、`npm run typecheck --workspace=@codepiddy/desktop`、`npm run build:codepiddy` 全部通过；
截图 `.artifacts/ui-icons-v1.png`、`.artifacts/ui-settings-v2.png`。

已知未验证：文件树的行样式需要真实项目才能看到，demo 模式下 IPC 缺失，只显示「目录读取失败」。

### 2026-10-02 批次 3：输入框居中修复 + 强调色改蓝

用户反馈：输入框偏左；不喜欢绿色，偏好蓝色；希望小细节上有更显眼的强调色。

- **输入框偏左是批次 1 引入的回归。** 原规则是 `width: min(840px, calc(100% - 38px)); margin: 0 auto`，被我在迁移层覆盖成 `margin: 0 18px`，于是居中的 `auto` 没了、直接贴左边。
- 顺带修掉一个结构问题：`.transcript-stage` 是「转录 + 文件面板」的横向 flex，输入框是它的兄弟节点，所以在文件面板打开时输入框的轴心跟随整个 pane，而消息列的轴心跟随转录列——两者天然错位。现在把 `.transcript` 和输入框一起放进新的 `.conversation-column`（flex column），文件面板留在它右边，输入框和消息列同宽（760px）同轴。
- 实测：`.turn-group` 与 `.composer` 都是 left=318 / width=760 / center=698，完全对齐。
- 强调色从青绿 `#0f766e` 换成蓝 `#2563eb`（白底 5.2:1，配白字 5.2:1），悬停 `#1d4ed8`，浅底 `rgb(37 99 235 / 10%)`，聚焦环 26%。
- `DESIGN.md` 的 Colors 一节和 `The Ink-Not-Blue Rule` 同步改写为 `The Blue-Is-Action Rule`（蓝色只用于可交互与选中，不做装饰）。

验证：`npm run check`、desktop typecheck、`npm run build:codepiddy` 全绿；截图 `.artifacts/ui-composer-fix.png`。

### 2026-10-02 批次 4：语义色体系 + 字号基线

用户指出不要把界面做成全蓝，要按参考项目的**色彩分工**来，只是换成浅色。读参考项目后确认它的规则是：

1. 中性 chrome 承担绝大部分面积（四层底色 + 墨色阶）；
2. 一个强调色只负责交互与选中——参考里是墨色，我们按用户偏好用蓝 `#2563eb`；
3. 语义色只有三个（成功/警告/错误），统一用「`color-mix(色 14%, transparent)` 淡底 + 同色文字」的小徽章形式；
4. 实心语义色只给极小面积：圆点、未读角标；
5. 紫色只留给一种特殊语义（参考里是 planning 模式的图标脉冲）。

按这套改的内容（`styles.css` 迁移层）：

- 新增 vivid 变体令牌（`--cp-success-vivid` / `--cp-warning-vivid` / `--cp-danger-vivid`），只用于圆点与图标；文字一律用深色值保证对比度。
- 消息状态徽章、工具卡状态、活动指示（compaction/retry/waiting/reconnecting）、diff、系统消息、工具恢复提示、Pi 运行时警告/确认、权限错误、错误引导全部改成「淡底 + 同色文字」。
- 会话树当前项改用强调蓝淡底；会话摘要的高亮徽章改用琥珀。
- 未读角标、流式占位点、Pi 响应点用强调蓝实心（面积最小）。
- 字号基线：`body` 定为 13px。之前根字号是浏览器默认 16px，凡是没写 `font-size` 的（侧栏行、内容区标题）都跟着变 16px。实测侧栏行 16px→13px，内容区标题→14px，正文 14px，基线 13px。

验证：`npm run check`、`npm run build:codepiddy` 全绿；截图 `.artifacts/ui-semantic-v1.png`、`.artifacts/ui-type-v1.png`、`.artifacts/ui-narrow-900.png`。
窄窗（900px）实测消息列与输入框同为 578px、中心 583，对齐成立。

### 2026-10-02 批次 5：旧色值全量收敛到令牌

先按明度和彩度给 `styles.css` 里的 261 个不同色值分桶，再分两步机械替换（脚本跑完即删）：

1. **中性色按明度归令牌**：`lum ≤ 0.06 → --cp-ink`、`≤ 0.16 → --cp-ink-secondary`、`≤ 0.30 → --cp-ink-muted`、`≤ 0.55 → --cp-ink-faint`、`≤ 0.78 → --cp-surface-inset`、其余 `--cp-surface-secondary`。跳过 `--cp-*` 令牌定义行本身。替换 333 处。
2. **有彩度的按语义族归位**：旧绿系（文字/淡底/描边三组）分别归到 `--cp-accent` / `--cp-accent-soft` / `--cp-accent-ring`；旧红系归 `--cp-danger`，淡底归 `color-mix(--cp-danger 10%)`；旧琥珀系归 `--cp-warning`，淡底归 `color-mix(--cp-warning 12%)`。替换 107 处。
3. 旧绿调的阴影/悬停 `rgb()` 字面量（`rgb(118 126 118 / x%)` 一类共 27 处）统一转成 `rgb(23 24 26 / x%)`。

结果：

| 指标 | 改前 | 改后 |
| --- | --- | --- |
| 硬编码 hex 出现次数 | 501 | 59 |
| 不同 hex 值 | 261 | 19 |

剩下的 59 处基本就是 `:root` 里的令牌定义本身，加上 3 处强调色引用。

验证：`npm run check`、`npm run build:codepiddy` 全绿；截图 `.artifacts/conv-1-agent.png`、`conv-2-settings.png` 确认替换没有破坏界面。

遗留：`rgb(255 255 255 / N%)` 这类白色叠加还有约 100 处，是玻璃拟态时代的残留，目前大多已被迁移层覆盖成死代码。彻底删掉需要把被覆盖的旧规则整条移除，属于后续的结构清理，不影响当前观感。

### 2026-10-02 批次 6：拆掉圆角外框 + 侧栏毛玻璃 + 输入框自适应高度

用户插进来的三条反馈：每个区域都套着一个圆角框；左右两侧应该用同色系异化出层次、左侧要毛玻璃；输入框太矮、而且是固定高度，输入多行后上面的字看不见。

**圆角框的来源**：`styles.css` 里有一层玻璃布局（约 1645-1760 行）——`.app-shell` 带 `gap: 10px; padding: 10px` 和一层放射渐变底，`.sidebar` 与 `.main-pane` 各自是「1px 描边 + 16px 圆角 + 投影 + backdrop-filter」的卡片，`.sidebar-footer` 还补了 `border-radius: 0 0 16px 16px`。所以每个区域都浮成一个圆角卡片。

改法（迁移层）：

- `.app-shell` 去掉 padding 和 gap，改边到边；背景换成一层 200° 的冷灰渐变。
- `.sidebar` 去描边、去圆角、去投影，改成 `color-mix(rail 74%, transparent)` + `backdrop-filter: blur(26px) saturate(1.4)`——毛玻璃；`.app-shell` 那层渐变就是它能被感知到的底色。
- `.main-pane`、`.content-header` 全部改不透明底、无边框、无圆角。
- `.sidebar-footer` 对齐到 0。
- 设置卡、助手卡从「白底 + 半像素描边」改成纯色调分区，进一步减少框。
- `DESIGN.md` 新增 **The No-Frame Rule**，并把原来的 No-Glass 禁令改为 **Material-Not-Decoration Rule**（毛玻璃只允许出现在左侧导航一处，作为材质分区手段）。
- Windows overlay 的让位从 `padding-top: 42px` 改为 `34px`，与 34px 的标题栏对齐。

**输入框自适应**：`App.tsx` 新增 `composerInputRef` 和一段 `useLayoutEffect`——先把 `height` 归零再读 `scrollHeight`，最低 46px（约两行），超过 240px 转内部滚动；草稿为空时复位。

踩到一个坑：`.composer textarea` 基础规则里有 `flex: 1`，在 column flex 容器里解析成 `flex-basis: 0%`，会**直接盖掉内联的 height**，表现是内联样式写着 137px、实际渲染 46px、文字被裁掉。必须给 `.composer textarea` 加 `flex: none`。

实测：空草稿 46px；输入 5 行后 textarea 117px、输入区整体 165px，五行全部可见。

验证：`npm run check`、desktop typecheck、`npm run build:codepiddy` 全绿；实测外壳 `padding: 0 / gap: 0`、侧栏 `left: 0 / radius: 0 / backdrop-filter: blur(26px) saturate(1.4)`。
截图 `.artifacts/frame-1-agent.png`、`frame-2-grown.png`、`frame-3-final.png`。

### 2026-10-02 批次 7：侧栏毛玻璃改成真正的系统材质

用户反馈批次 6 的毛玻璃"没有透明、没有模糊"。原因是根因判断错了：`backdrop-filter` 只能模糊它**背后**的东西，而侧栏背后只有一层平滑渐变——模糊平滑渐变等于没模糊，所以视觉上完全看不出来。

读了参考项目后确认：**它的毛玻璃是 macOS 原生材质**（`apps/desktop/electron/main/bootstrap/window.ts:185` 的 `vibrancy: "sidebar"`），CSS 只在 `:root[data-platform="darwin"]` 下叠一层 tint + sheen（`chrome.css:433-445`）。**Windows/Linux 下参考项目用的是不透明底色，根本没有玻璃**。所以这不是 CSS 能补出来的，必须用系统材质。

实现（Windows 11 22H2+ 的 `backgroundMaterial: "acrylic"`）：

- `src/main/index.ts` 新增 `supportsWindowsBackgroundMaterial()`，按 `process.getSystemVersion()` 的 build 号判断（≥ 22621），不满足就完全走原来的不透明路径，不会把老系统搞黑。
- 支持时：`backgroundColor: "#00000000"` + `backgroundMaterial: "acrylic"`。
- `styles.css`：`.app-shell.windows-overlay` 和 `:root:has(.app-shell.windows-overlay)` 都要设成 `background: transparent`——**任何一层不透明底色都会把系统材质整个盖住**，这是最容易漏的一步。
- 侧栏按参考项目的配方重写：`background-color: color-mix(in oklab, var(--cp-surface-rail) 45%, transparent)`（参考是 55%，按用户要求再透一档）+ 上下两道 sheen（顶部白色 45% 渐隐到 220px、底部白色 30% 渐隐到 160px）+ `backdrop-filter: blur(30px) saturate(1.6)`。
- 浏览器 demo 没有 `windows-overlay` 类，保留渐变兜底，不受影响。

环境：本机 `CurrentBuild 26200`（满足 ≥22621），系统"透明效果"开关为开。

验证：用户确认毛玻璃效果正常。`npm run check`、desktop typecheck、`npm run build:codepiddy` 全绿。

注意：`CopyFromScreen` 这类 GDI 截屏抓不到 DWM 合成的材质，用截屏验证这个效果不可靠，只能靠肉眼。

## 待办清单（按优先级，下一批从这里挑）

1. **间距节奏**：参考项目用 4/6/8/12/16/24 的固定梯级；我们还有 7px / 9px / 11px / 13px 这类随手值，需要归一成梯级。
2. **空态 / 错误态 / 加载态**：目前只换了配色，形态没设计过（`.empty-state`、`.transcript-placeholder`、`.work-panel-empty`、`.provider-empty`）。
3. **会话树弹窗**：`.session-tree-modal` 系列还没按新体系过一遍。
4. **文件面板真实验证**：需要在 Electron 里打开真实项目看文件树行、预览、拖拽调宽。
5. **结构清理**：`styles.css` 里约 100 处 `rgb(255 255 255 / N%)` 白色叠加是被迁移层覆盖的死代码，要整条删除旧规则而不是继续叠加覆盖。
6. **`.impeccable/design.json` sidecar**：`DESIGN.md` 的配套产物，还没写。
7. **用户验收**：改版整体效果还没让你确认过。

## 未提交状态

本轮所有改动都在工作区，**没有 commit**。锁文件（`package-lock.json`）有改动，提交时 pre-commit 会拦，需要 `PI_ALLOW_LOCKFILE_CHANGE=1`。

## 决策记录

| 日期 | 决策 | 理由 |
| --- | --- | --- |
| 2026-10-02 | 只参考 PI-Desktop 的设计语言，不参考其架构与功能 | 用户明确要求 |
| 2026-10-02 | 目标主题为浅色 | 用户明确倾向 |
| 2026-10-02 | 引入 `lucide-react` 统一图标；恢复 `codepiddy-icons/` 作为设计源 | 用户同意 |
| 2026-10-02 | 只做客户端美化，不改业务逻辑 | 用户明确边界 |
| 2026-10-02 | 北极星「精密仪器台」，色调分层，紧凑精密 | 用户选定 1A/3A/4A |
| 2026-10-02 | 强调色从青绿 `#0f766e` 改为蓝 `#2563eb` | 用户明确表示不喜欢绿色、偏好蓝色 |
| 2026-10-02 | 跳过 AI 生成的效果图环节 | 当前运行环境没有原生图像生成能力，`DESIGN.md` 即为视觉契约 |

## 待用户确认

- 暂无
