# CodePIddy 客户端 UI 改版：任务记录

> **这个文件是唯一的进度真相。** 上下文被压缩或换新会话后，按下面「如何续接」走一遍再动手。

## 如何续接（压缩后先读这里）

1. 读 [PRODUCT.md](../../PRODUCT.md)（定位、边界、反参考）→ [DESIGN.md](../../DESIGN.md)（配色、字体、层次、组件规则）→ [reference-pi-desktop.md](./reference-pi-desktop.md)（主参考项目拆解）→ [reference-dsh-effort-dial.md](./reference-dsh-effort-dial.md)（思考强度波场拆解）。
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
继续 CodePIddy 客户端 UI 改版。先读 docs/design/redesign-plan.md（尤其「如何续接」「当前状态」「进度日志」最后三条和「待办清单」），
再读 PRODUCT.md、DESIGN.md，然后从「待办清单」第 1 项「会话树弹窗 .session-tree-modal」开始做。
字体、圆角、输入区叠层、app icon、空态/错误态/加载态、运行反馈、用户选定闪电和思考强度波场都已验收并提交，不要重做。
当前 HEAD 是 4e4341c；工作树只有根目录未跟踪的用户原始文件 `闪电.svg`，不要删除或提交它。

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
- `.artifacts/` 是 gitignored，截图和中间产物只在本机存在；字体和 app icon 的生成流程已经写入本文件。

## 目标

把 CodePIddy 桌面客户端从「一眼 AI 生成」改成**克制、有层次、浅色的专业桌面工具**，设计语言参考 PI-Desktop（见 [reference-pi-desktop.md](./reference-pi-desktop.md)）。

## 范围

- 只改 `packages/codepiddy-desktop/src/renderer/`（样式、图标、组件呈现）。
- 不改业务逻辑、IPC、core、coding-agent。
- 不引入 Tailwind 或第二套框架，沿用现有 Vite + React + 单个 `styles.css` 的组织方式，必要时拆成多个 CSS 分片。

## 当前状态（2026-10-02 批次 17 之后）

- `styles.css` 3812 行，顶部是完整的 `--cp-*` 令牌层；全文件只剩少量硬编码色值，基本就是令牌定义本身。
- 间距令牌已建立：`--cp-space-micro` 到 `--cp-space-5xl`（2/4/6/8/12/16/24/32/40/48/64px）；组件间距声明已全部改用令牌。
- 字体：`Monaspace Argon` 负责拉丁/符号，`Maple Mono NF CN` 负责中文；只随包保留 Regular 400 和 SemiBold 600 两档 WOFF2。
- app icon：正式源是透明 SVG，PNG/ICO 由 `packages/codepiddy-desktop/scripts/render-icon.mjs` 从 SVG 生成；旧的彩色和图片底模已清理。
- 常规图标全部走 `lucide-react@1.48.0`；统计行的闪电是唯一自定义矢量例外，源文件为 `codepiddy-icons/lightning.svg`。
- 外壳：边到边分区，没有圆角外框、没有描边、没有浮动卡片；层次靠四层底色（`#ffffff` / `#f8f8f9` / `#f2f2f4` / `#e8e8eb`）和材质，而不是靠框。
- 侧栏毛玻璃：Windows 用系统材质 `backgroundMaterial: "acrylic"`（build ≥ 22621）+ 45% tint + 上下 sheen；浏览器 demo 用渐变兜底。实现细节见批次 7。
- 配色分工：中性 chrome 打底 + 蓝色强调 `#2563eb`（只用于交互与选中）+ 三色语义（成功/警告/错误，淡底 + 同色文字，实心只给圆点与角标）。
- 字号：基线 13px，侧栏行 13px，内容区标题 14px，正文 14px，元信息 11-11.5px。
- 结构：`.transcript` 与输入框同属新的 `.conversation-column`，两者同宽（760px）同轴。
- 输入区：最小 46px，随内容自动增高，超过 240px 转内部滚动。
- 状态组件：空态、文件错误/不可预览、目录树与文件预览加载态、Provider 空态、全局错误横幅、流式等待态已统一到 `state-mark` / 状态说明体系。
- 运行状态：Agent 运行中反馈已从输入区移到转录流末尾，使用三点错峰缩放动画，不再用浮起胶囊或转圈。
- 流式统计：`⚡` 字体字符已移除，改为 12×12 内联 SVG，避免字体缺字时出现豆腐块。
- 思考强度：滑块改为轻量 canvas 波场，低档慢而疏、高档快而密，最高档有短促落点扫光；拖拽加入轻微磁吸。

### 本轮改动清单

- 已提交：`45c39bc feat(desktop): refresh client UI and remove stale test/docs`
- 已提交：`edcde8e feat(desktop): refine spacing typography and composer overlays`
- 已提交：`247abae fix(desktop): replace app icon with transparent vector assets`
- 已提交：`78ca5c0 feat(desktop): refine state feedback and effort dial`
- 已提交：`25a6023 docs(desktop): record effort dial acceptance`
- 已提交：`c34c20a feat(desktop): use selected lightning asset`
- 已提交：`4e4341c docs(desktop): record lightning asset acceptance`

批次 1-17 的 UI 调整均已提交；详细过程见下方进度日志。

### 下一步

从「待办清单」第 1 项开始：统一 `.session-tree-modal`。先检查 `App.tsx` 里的 `.session-tree-heading`、`.session-summary`、`.session-tree-list`、`.session-node`、`.session-node-rail`、`.session-node-copy`、`.session-node-meta`、`.session-tree-empty`，再对照 `DESIGN.md` 的浮层、导航、状态色和 spacing 规则逐项收敛。完成后必须截图检查节点缩进、当前节点、空态和窄窗。

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
- [x] 建立间距梯级并把 `gap / margin / padding / inset / 定位偏移` 全部改为 `--cp-space-*`（2026-10-02 批次 8）

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
- [x] 空态 / 错误态 / 加载态（2026-10-02 批次 12：统一状态标识、说明文字、错误横幅与骨架加载）

### 阶段 5：验收

- [x] `npm run check` 通过（2026-10-02 批次 8 复跑）
- [x] `npm run typecheck --workspace=@codepiddy/desktop` 通过（2026-10-02 批次 8）
- [x] `npm run build:codepiddy` 通过（2026-10-02 批次 8 复跑）
- [x] 截图对比（2026-10-02：`.artifacts/ui-*.png`、`conv-*.png`、`spacing-*.png`，含 900px 窄窗）
- [~] 用户持续确认中（批次 1-17 已逐项验收）

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

### 2026-10-02 批次 8：间距节奏收敛

改了 `packages/codepiddy-desktop/src/renderer/styles.css` 和 `DESIGN.md`。

问题不是缺少间距，而是同一组件有两套几何值：例如 `.composer` 先写 `18px / 13px / 15px`，末尾迁移层再覆盖成 `56px / 12px / 10px`；`.sidebar`、`.settings-page`、`.settings-card` 也有同类历史叠加。直接改几个随手值只会继续叠补丁，所以先建立间距令牌，再做全文件收敛。

落地内容：

- 新增 `--cp-space-micro` 到 `--cp-space-5xl`：`2 / 4 / 6 / 8 / 12 / 16 / 24 / 32 / 40 / 48 / 64px`。`2px` 只用于光学微调，不作为常规布局间距。
- 用 codemod 替换全部间距声明：`gap / row-gap / column-gap / margin / padding / inset / top / right / bottom / left` 共替换 507 处裸 px 值。
- 归一规则：`7/9 -> 8`、`10/11/13/14 -> 12`、`15/18 -> 16`、`20/22/28 -> 24`、`31/34 -> 32`、`42 -> 40`、`52 -> 48`、`58 -> 64`；负值改成 `calc(-1 * var(--cp-space-*))`。
- `DESIGN.md` 新增 Spacing 一节和 **The Space-Ladder Rule**：组件 CSS 不得出现梯级之外的裸 px 间距。

扫描结果：间距声明里已无梯级外裸值；唯一命中的 `760px` 是消息列内容宽度，不是间距。impeccable 的 `detect.mjs --scope layout` 返回空集。

视觉验证：

- 1440x900：无横向溢出；侧栏 266px、内容头 56px、输入区 638px 宽并保持同轴。
- 输入 5 行后：输入区从 96px 增至 167px，自动增高没有回归。
- 900x700：无横向溢出；文件面板隐藏；输入区宽 578px、中心与转录列一致。
- 设置页和 grown composer 截图正常。

验证：`npm run check`、`npm run typecheck --workspace=@codepiddy/desktop`、`npm run build:codepiddy` 全绿。截图：`.artifacts/spacing-desktop.png`、`.artifacts/spacing-composer-grown.png`、`.artifacts/spacing-settings.png`、`.artifacts/spacing-narrow.png`。

### 2026-10-02 批次 9：修复「跳到最新消息」遮挡输入区

用户反馈：`跳到最新消息` 落到会话列底部，和输入区重合，盖住了右侧的思考强度控件。

根因：按钮是 `.conversation-column` 的直接子元素，但定位祖先实际是 `.transcript-stage`。`bottom: 12px` 因此按整个会话列计算，而输入区也在该列内，按钮自然落进输入区。

改法：

- `App.tsx` 新增 `.composer-shell`，把按钮和 `.composer` 包在同一容器。
- `.composer-shell` 设为 `position: relative`，按钮改成相对输入区定位。
- `.jump-to-latest` 用 `bottom: calc(100% + var(--cp-space-md))` 固定在输入区上方 12px；输入区随内容增高时按钮自动上移。
- 按钮右边缘与输入区对齐。

验证：默认输入区时按钮底边 780、输入区顶边 792；输入 5 行后按钮底边 709、输入区顶边 720；均保持约 12px 间距且不重叠。`npm run check`、desktop typecheck、`npm run build:codepiddy` 全绿。截图：`.artifacts/jump-fix-default.png`、`.artifacts/jump-fix-grown.png`。

### 2026-10-02 批次 10：字体配对 + 圆角统一

用户反馈：发送按钮在空输入和可发送状态之间会从圆形变成圆角方形；整体圆角偏方；当前系统字体不好看。素材目录是 `E:\mypi\maple` 和 `E:\mypi\monaspace`。

字体结论：

- `MonaspaceArgon` 只有 2,460 个字符，不含中文，适合作为拉丁/符号层。
- `MapleMono-NF-CN` 有 33,091 个字符，包含中文、中文标点和扩展字符，适合作为 CJK 层。
- 接入 `Monaspace Argon -> Maple Mono NF CN -> 系统回退`。只保留 Regular 400 和 SemiBold 600 两档，转成 WOFF2 后分别约 199 KB / 201 KB，以及 6.25 MB / 6.41 MB。
- 字体和 OFL 许可放在 `src/renderer/assets/fonts/`。原始 `maple/`、`monaspace/` 暂时保留，等用户检查确认后再删除未用文件。

圆角结论：

- 新梯级为 `6 / 8 / 10 / 12 / 18 / 24px / full`，所有组件硬编码圆角收敛到令牌。
- 发送、停止按钮统一为 `28px` 全圆；不再随 disabled/enabled 改变形状。
- 输入区圆角 18px，卡片 12px，小控件 6-10px。

浏览器验证：`document.fonts` 中 Monaspace 和 Maple 均为 `loaded`；发送与停止按钮的尺寸都是 28x28、圆角都是 9999px。`npm run check`、desktop typecheck、`npm run build:codepiddy` 全绿。截图：`.artifacts/font-radius-agent.png`、`.artifacts/font-radius-settings.png`。

### 2026-10-02 批次 11：app icon 透明矢量化

用户反馈：当前黑白 app icon 是图片直接放进 SVG 的，白色底板被烘进 PNG，出现明显的白色方块分层。

处理：

- 从黑白原图提取连通区域，保留主体外轮廓和中间的透明孔位，重新生成真正透明的 SVG path。
- 正式 SVG 使用 `#17181a` 作为图形色，不包含背景 rect，也不包含 base64 图片。
- `render-icon.mjs` 改为用 Playwright 渲染 SVG，生成 `1024/512/256/128/64/48/32/16` PNG，并直接写出多尺寸 ICO；不再依赖 Electron 的 nativeImage。
- `public/codepiddy-icon.png` 换成 256px 透明版本。
- 删除旧的彩色 v1/v2/v3、`codepiddy-icon-original.png` 和 `codepiddy-icon-generated-backup.png`。
- 空态里的 `.empty-mark.app-icon-mark` 去掉灰色底托、圆角和阴影，避免图标再被框成一块。

验证：新 SVG 通过 `svg_cli.py validate`；PNG 和 ICO 角落像素均为 `alpha=0`；没有白底方块。`npm run check`、desktop typecheck、`npm run build:codepiddy` 全绿。截图：`.artifacts/icon-appearance.png`、`.artifacts/codepiddy-icon-transparent-preview.png`。

### 2026-10-02 批次 12：空态 / 错误态 / 加载态

改了 `App.tsx`、`SlashCommandMenu.tsx`、`WorkPanel.tsx`、`styles.css`，并在 `DESIGN.md` 新增 Empty / Error / Loading States 规则。

落地内容：

- 新增统一 `state-mark`：40px 方形、12px 圆角、无外边框，用内底色和图标色区分中性、会话与错误状态。原有透明 app icon 不套底托。
- 项目未选择工作项、Agent Slot 未创建、会话无消息、设置页未发现 Skill 都增加对应状态标识和说明；会话空态使用蓝色轻底，表示下一步是输入。
- 文件树加载改为可被读屏识别的 `output` 状态行；目录空/错误分别使用中性点与错误红点。
- 文件预览加载改为四行骨架，不再显示一行“加载中”；文件读取失败与过大/二进制不可预览使用状态标识、标题和恢复说明。
- 全局错误横幅从实心红改为红色 9% 淡底 + 20% 半像素内描边 + 警告图标，正文保持可读性，错误色只落在图标、标题和关闭按钮附近。
- 常驻流式等待点补上“正在生成”说明；斜杠命令加载态补状态点与 `aria-live`。
- 所有新增状态动效都有 `prefers-reduced-motion` 降级。

视觉验证：

- 1440x900 无项目首页、项目无选中工作项、Agent 未创建空态。
- 1440x900 设置页 Skill 空态和文件管理器目录读取失败态。
- 900x700 窄窗无横向溢出。
- 截图：`.artifacts/state-before.png`、`state-empty-after.png`、`state-welcome.png`、`state-transcript-no-agent.png`、`state-provider-empty.png`、`state-narrow.png`。

验证：`npm run check`、`npm run typecheck --workspace=@codepiddy/desktop`、`npm run build:codepiddy` 全绿。

### 2026-10-02 批次 13：运行反馈移到转录流末尾

用户反馈：参考项目的回复运行状态直接贴在回复后面并有轻量动效；CodePIddy 当前是在输入区上方凸出一块，里面放转圈，视觉突兀。

读参考实现后确认差异：

- PI-Desktop 把 `WorkingIndicator` / `RunActivityIndicator` 放在转录内容的尾部 `transcript-runtime-status` 中，不在输入区。
- 它的动效是三个 4px 圆点，每个延迟 120ms，做 `scale(.8) → scale(1)` 和透明度变化；外层是普通状态文本行，不是胶囊、卡片或 spinner。

落地内容：

- `agent-activity` 从 `.composer-shell` 移到 `.transcript` 末尾，新增 `.transcript-runtime-status` 状态行。
- 删除旧 `.activity-spinner` 和旋转 keyframes，改为 `.activity-dots` 三点错峰缩放动画。
- 状态行与消息正文同宽、同轴，普通运行使用次墨色；压缩、重试、等待、重连仍保留各自的语义色。
- 排队数文案从 `queued` 改成“N 条排队”。
- 流式回复里的占位点复用同一套动画，两个运行状态不再像两套组件。
- demo 的 Coding Agent 增加运行中状态数据，方便后续视觉检查一直能看到该组件。
- `DESIGN.md` 新增 Running Indicator 规则。

验证：DOM 检查确认 `.agent-activity` 的 `insideTranscript=true`、`insideComposer=false`；截图 `.artifacts/activity-tail.png`、`activity-tail-frame-2.png` 显示两帧圆点动画不同，状态行位于回复末尾且与输入区分离。

### 2026-10-02 批次 14：流式统计闪电矢量化

用户反馈：token 速率前的 `⚡` 在当前字体中显示不出来，需要自己绘制。

处理：

- 用 `svg-precision-skill` 生成 12×12 实心闪电路径，输出设计源 `codepiddy-icons/lightning.svg`，并通过 `svg_cli.py validate`。此自绘版本已在批次 17 被用户选定素材替换。
- `stream-stats.ts` 只返回数值文本，不再拼接 `⚡`。
- `StreamStats.tsx` 新增内联 `StreamStatsGlyph`，使用 `currentColor` 和 `aria-hidden`；视觉图标与数值文本分离，读屏只读数值。
- 统计行改为右对齐 flex，闪电与文字间隔 4px；图标颜色使用次墨色，保证小尺寸下可见。
- demo 的 Coding Agent 补了终值统计，方便持续检查该组件。

验证：浏览器实测统计文本为 `25.0 tok/s · 150 tok / 6.0s`，闪电在 DOM 中为独立 SVG，实际尺寸 12×12，颜色 `rgb(74, 76, 80)`；截图 `.artifacts/lightning-ui.png`、`lightning-stats-crop.png`。

### 2026-10-02 批次 15：思考强度波场

用户要求参考 `https://github.com/WONGIII/dsh-effort-dial` 的思考强度滑块，但保持 CodePIddy 的浅色、克制风格。本地只读克隆在 `E:\mypi-refs\dsh-effort-dial`，审查版本 `39620be1a819f247078b83bfb88052a8f8d7d7fc`。拆解结论见 `docs/design/reference-dsh-effort-dial.md`，参考仓库验收后可删除。

落地内容：

- 新增 `ThinkingDialField.tsx`：弹层打开时 canvas 持续绘制从滑块向左行进的非对称波锋，并叠加少量流星。
- 场强随档位提高而增加；普通档位保持蓝灰色低强度，最高档混入少量紫色并触发一次约 1.9 秒的落点扫光。
- 轨道从 6px 提高到 14px，保持 16px 圆形滑块；蓝色填充只做场的底色，亮纹、颗粒和扫光由 canvas 负责。
- 拖拽改为连续位置状态，并加入 `magnetize`：经过档位时轻微拖住，离开后释放，`onChange` 仍只在落点提交。
- `prefers-reduced-motion` 下只绘制静态场；页面隐藏时停止 RAF。

验证：

- canvas 在 196×14 CSS 像素下正常绘制，非空 alpha 采样为 2253 个像素点。
- 中档为低亮蓝色纹理；最高档出现清晰的像素波场和落点光晕。
- 交互实测将档位拖到最右后成功提交为“极高”。
- `npm run check`、renderer 类型检查、`npm run build:codepiddy` 全绿。
- 截图：`.artifacts/thinking-dial-medium.png`、`thinking-dial-medium-track.png`、`thinking-dial-top.png`、`thinking-dial-top-track.png`。

### 2026-10-02 批次 16：思考强度轨道加大一档

用户反馈：滑块效果可以，但轨道太矮，不够圆润，需要适当加大。

- 轨道高度从 14px 调到 18px，滑块直径从 16px 调到 20px。
- 滑块继续只比轨道高出 2px，保持“落在轨道上”的关系，不变成一颗大球。
- 滑块位置、填充宽度和刻度锚点共用 `--thinking-thumb` / `--thinking-inset`，避免尺寸调整后不同轴。

用户已验收，轨道尺寸保留 18px / 20px。

### 2026-10-02 批次 17：替换用户选定闪电

用户提供根目录 `闪电.svg`，要求替换批次 14 的自绘闪电。

- `codepiddy-icons/lightning.svg` 已替换为用户的黄黑闪电源文件，保留原始 1024 viewBox、五条路径和配色。
- `StreamStatsGlyph` 同步改为内联同一组路径，缩放到 12×12px；统计文本仍保持纯数值。
- 浏览器实测闪电在 12px 下轮廓清晰，未出现糊边或缺字。

用户已验收，闪电替换随 `c34c20a feat(desktop): use selected lightning asset` 提交。

## 待办清单（按优先级，下一批从这里挑）

1. **会话树弹窗**：`.session-tree-modal` 系列还没按新体系过一遍。
2. **文件面板真实验证**：需要在 Electron 里打开真实项目看文件树行、预览、拖拽调宽。
3. **结构清理**：`styles.css` 里约 100 处 `rgb(255 255 255 / N%)` 白色叠加是被迁移层覆盖的死代码，要整条删除旧规则而不是继续叠加覆盖。
4. **`.impeccable/design.json` sidecar**：`DESIGN.md` 的配套产物，还没写。

## 未提交状态

批次 12-17 已提交，工作树只剩用户放在根目录的原始 `闪电.svg` 未跟踪文件；不要删除或提交它。参考仓库 `E:\mypi-refs\dsh-effort-dial` 已删除。后续如再改锁文件仍需 `PI_ALLOW_LOCKFILE_CHANGE=1`。

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
| 2026-10-02 | UI 字体采用 `Monaspace Argon + Maple Mono NF CN` | 用户要求英文和中文分别优化，且两份字体均适合作为技术工具字体 |
| 2026-10-02 | app icon 使用透明黑白矢量，不再保留图片底模 | 用户确认原图白色背景造成分层 |

## 待用户确认

- 暂无
