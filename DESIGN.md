---
name: CodePIddy Desktop
description: 一个安静、精密、浅色的桌面编码工作台
colors:
  ink: "#17181a"
  ink-secondary: "#4a4c50"
  ink-muted: "#6e7075"
  ink-faint: "#a0a2a8"
  surface-content: "#ffffff"
  surface-secondary: "#f8f8f9"
  surface-rail: "#f2f2f4"
  surface-inset: "#e8e8eb"
  border-subtle: "#17181a0f"
  border-default: "#17181a1a"
  border-strong: "#17181a29"
  accent: "#2563eb"
  accent-hover: "#1d4ed8"
  accent-soft: "#2563eb1a"
  success: "#15803d"
  warning: "#b45309"
  error: "#b91c1c"
  violet: "#7c3aed"
typography:
  title:
    fontFamily: '"Monaspace Argon", "Maple Mono NF CN", -apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, system-ui, sans-serif'
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0em"
  body:
    fontFamily: '"Monaspace Argon", "Maple Mono NF CN", -apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, system-ui, sans-serif'
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
  label:
    fontFamily: '"Monaspace Argon", "Maple Mono NF CN", -apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, system-ui, sans-serif'
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "0em"
  mono:
    fontFamily: '"Monaspace Argon", "Maple Mono NF CN", ui-monospace, SFMono-Regular, Cascadia Mono, Consolas, Liberation Mono, monospace'
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.55
rounded:
  xs: "6px"
  sm: "8px"
  md: "10px"
  lg: "12px"
  xl: "18px"
  2xl: "24px"
  full: "9999px"
spacing:
  micro: "2px"
  xxs: "4px"
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
  3xl: "40px"
  4xl: "48px"
  5xl: "64px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface-content}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "28px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
    textColor: "{colors.surface-content}"
    rounded: "{rounded.md}"
    height: "28px"
  button-secondary:
    backgroundColor: "{colors.surface-inset}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "28px"
  button-ghost:
    backgroundColor: "{colors.surface-content}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.md}"
    height: "28px"
  field:
    backgroundColor: "{colors.surface-inset}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "30px"
  tile:
    backgroundColor: "{colors.surface-secondary}"
    rounded: "{rounded.lg}"
    padding: "12px"
  chip:
    backgroundColor: "{colors.surface-inset}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
---

# Design System: CodePIddy Desktop

## 1. Overview

**Creative North Star: "精密仪器台"**

这不是一个展示型界面，是一台放在桌面上的测量仪器。操作者长时间盯着它，读的是状态、数值和过程。所以它必须中性、稳定、对齐严格：底色分成清晰的几层，文字对比足够但不过分锐利，彩色只出现在真正承载信息的地方——运行中的绿点、失败的红色边框、特殊状态的紫色标记。

它明确拒绝"AI 味重的界面"：玻璃拟态堆叠、渐变文字、紫色渐变、没有意义的超大圆角卡片网格、用 emoji 当图标、每张卡片都长一样。这些手法在展示页上也许还行，在需要连续使用几小时的工具里只会增加噪音。参考对象是 PI-Desktop 的浅色主题：中性灰阶、墨色强调、色调分层、克制的状态色。

差异化的地方在"密度与秩序"：信息密度接近专业开发工具，但每条信息的层级用字号、字重和灰色深浅区分，而不是用框线。整个界面看起来应该是被一个严格的栅格和一套色阶管理出来的，而不是被组件库默认值拼出来的。

**Key Characteristics:**

- 浅色、中性、低饱和；彩色只表达状态与分类。
- 四层底色（内容 / 次级 / 侧栏 / 内嵌）承担主要层次，描边只出现在浮层。
- 单一无衬线字体家族，紧凑梯级，非整数字重。
- 控件尺寸统一，28px 基准，不出现差 2px 的控件。
- 动效只表达状态变化，150-240ms，尊重 `prefers-reduced-motion`。

## 2. Colors

一套中性灰阶承托整个界面，一个蓝色强调色负责选中与主操作，四个语义色负责状态。

### Primary

- **强调蓝（#2563eb）**：唯一的主操作色。用于主按钮底色、当前选中项、聚焦环、活动状态图标。它出现的总面积在任何一屏都不应超过 10%。白底上 5.2:1，配白字同样 5.2:1，正文与按钮都过 AA。
- **强调蓝-悬停（#1d4ed8）**：主按钮悬停/按下态。
- **强调蓝-浅（#2563eb1a）**：选中行、聚焦环外圈、轻量强调底色。

### Secondary

- **状态紫（#7c3aed）**：只用于 Agent 相关的特殊标记（如"多 Agent 协作""特殊能力"），不用于按钮。它的稀有性是它有意义的原因。

### Tertiary

- **成功绿（#15803d）**：任务完成、工具执行成功、连接正常。
- **警告琥珀（#b45309）**：等待确认、降级、需要注意但不阻塞。
- **错误红（#b91c1c）**：失败、校验不通过、危险操作。

三个状态色都以"小面积"出现：状态点、图标、1px 边框或 8% 底色，不整块铺。需要文字时用上述深色值；需要指示点时可以用更亮的同色系（`#22c55e` / `#f59e0b` / `#ef4444`）。

### Neutral

- **主墨（#17181a）**：正文、标题、主要图标的默认色。不用纯黑，纯黑在浅色界面上太硬。
- **次墨（#4a4c50）**：次级文字、说明、非激活标签。
- **弱墨（#6e7075）**：占位符、时间戳、元信息。**占位符必须用这一档而不是更浅的，4.5:1 是底线。**
- **淡墨（#a0a2a8）**：仅用于禁用态和纯装饰性分隔，永远不承载需要阅读的信息。
- **内容底（#ffffff）**：会话、编辑器、主内容区。
- **次级底（#f8f8f9）**：浮起的卡片、会话列表行。
- **侧栏底（#f2f2f4）**：左侧项目/会话导航。
- **内嵌底（#e8e8eb）**：输入框、搜索框、代码块、凹陷区域。
- **描边（#17181a0f / 1a / 29）**：默认 / 强调 / 强分隔，全部是墨色透明度，不是灰色 hex。

### Named Rules

**The Color-Is-Information Rule.** 彩色只允许出现在状态、分类和当前选中上。任何纯装饰性的彩色都必须删除。判断方法：把这块颜色换成灰色，如果信息没有丢失，那它就不该是彩色的。

**The Blue-Is-Action Rule.** 蓝色只出现在可交互或当前选中的地方：主按钮、选中行、聚焦环、活动状态。它不做纯装饰填色，也不出现在静态内容上。

**The Ten Percent Rule.** 强调色在一屏内的覆盖面积不超过 10%。它的稀有性是它有效的原因。

## 3. Typography

**Body Font:** `"Monaspace Argon", "Maple Mono NF CN", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif`
**Mono Font:** 同一组合。Monaspace Argon 负责拉丁字符与符号，Maple Mono NF CN 负责中文和中文标点。

**Character:** 这是一套两层等宽字体系统，不是传统 sans 正文。Monaspace 提供编码工具的骨架，Maple 保持中文在紧凑行高下的稳定字形。只带 Regular 400 和 SemiBold 600 两个 WOFF2 字重，避免把未使用的字重打进客户端。

### Hierarchy

- **Title（600, 16px, 1.3）**：页面级标题、空态标题、设置分组标题。全界面最大字号，不出现 20px 以上的标题。
- **Subtitle（560, 14px, 1.35）**：区块标题、会话标题、卡片标题。
- **Body（400, 13px, 1.5）**：正文与消息内容。正文列宽限制在 65-75ch，超出由容器约束。
- **Label（500, 12px, 1.35）**：按钮、标签、表头、状态文字。不做大写字母间距处理（中文界面无意义）。
- **Meta（400, 11.5px, 1.35）**：时间戳、模型名、token 数、路径等元信息。用弱墨色，等宽字体。
- **Mono（400, 12.5px, 1.55）**：代码块、终端输出、diff。

### Named Rules

**The Two-Layer Font Rule.** UI 固定使用 `Monaspace Argon -> Maple Mono NF CN`。前者有字形时优先走前者，中文和前者没有的象形字符由后者接住。不要再引入第三种 UI 字体。

**The Fixed Scale Rule.** 产品界面不使用 `clamp()` 流体字号。字号是固定的梯级，由全局 `--font-scale` 统一缩放。

**The Mono-Is-Code Rule.** 等宽字体只用于代码、路径、命令、数值。按钮文案、标签、标题一律用 sans——给 UI 文字套 monospace 是最容易暴露"AI 生成感"的细节之一。

## 4. Elevation

这套系统以**色调分层**为主、阴影为辅。平面元素靠底色深浅分层，不使用投影；只有真正浮在内容之上的层（下拉、弹窗、工具提示、悬浮面板）才使用阴影和描边。

具体做法：内容区 `#ffffff`，往里嵌入一层用 `#f2f2f4`，再嵌一层用 `#e8e8eb`。层级越"深"（越靠近背景）越浅或越灰，需要"抬起"的元素反而是纯白加极轻投影。

### Shadow Vocabulary

- **raised（`0 1px 2px rgba(23,24,26,.06), 0 0 0 .5px rgba(23,24,26,.05)`）**：悬停抬起、激活的控件、可选中的卡片。
- **float（`0 1px 2px rgba(23,24,26,.06), 0 8px 28px rgba(23,24,26,.12), 0 0 0 .5px rgba(23,24,26,.08)`）**：下拉菜单、弹窗、命令面板。
- **composer（`0 1px 2px rgba(23,24,26,.05), 0 4px 16px rgba(23,24,26,.06)`）**：底部输入区，比 float 更轻，因为它常驻不消失。

### Named Rules

**The Tonal-First Rule.** 先用底色分层，再考虑阴影。如果一个区块能用更深的底色表达从属关系，就不许给它加投影。

**The Half-Pixel Rule.** 必须画线的地方用 `0 0 0 0.5px` 的描边而不是 1px `border`。高 DPI 屏幕上 1px 边框会显得笨重。

**The Material-Not-Decoration Rule.** 禁止装饰性的玻璃拟态。唯一例外是**左侧导航栏**：它允许用毛玻璃材质，因为这层模糊承担"和内容区做材质区分"的功能。其余区域的模糊只允许出现在真实的浮层遮罩上。

侧栏毛玻璃的实现方式：**模糊来自操作系统的窗口材质，不是 CSS**。Windows 上主进程设置 `backgroundMaterial: "acrylic"`（需 Windows 11 22H2+，build ≥ 22621，不满足则回退不透明），渲染层只叠一层 tint + 上下两道 sheen——和参考项目在 macOS 上用 `vibrancy: "sidebar"` 的分工完全一致。tint 取 `color-mix(in oklab, #f2f2f4 45%, transparent)`。

**必须记住的一条**：要让系统材质透上来，从窗口到侧栏之间的每一层都不能有不透明底色——`:root`、`body`、`.app-shell` 都要在 Electron(Windows) 下设为 `transparent`。漏掉任何一层，材质会被整个盖住，表现为"侧栏是块实心灰"。

**The No-Frame Rule.** 区域之间不加圆角外框。外壳是边到边的分区（左侧 rail、右侧内容、更右侧的 dock），靠底色和材质分层，不靠描边、圆角和投影把每一块包成卡片。描边只出现在浮层和输入控件上。

## 5. Spacing

间距使用固定的语义梯级：`2 / 4 / 6 / 8 / 12 / 16 / 24 / 32 / 40 / 48 / 64px`。其中 `2px` 只允许用于图标、描边和光学对齐，不作为常规布局间距。

相关控件用 `4-8px` 的紧凑间距归组，同一区块内的信息用 `8-12px` 分隔，不同区块之间用 `16-24px`，页面级留白用 `32-64px`。兄弟元素优先用 `gap`，不要用 margin 拼间距。

**The Space-Ladder Rule.** 组件 CSS 中不得出现梯级之外的裸 px 间距。所有 `gap`、`margin`、`padding`、`inset` 和定位偏移都必须引用 `--cp-space-*` 令牌。

## 6. Components

### Radius Scale

圆角梯级为 `6 / 8 / 10 / 12 / 18 / 24px`，全圆使用 `9999px`。相较上一版整体上调一档：小控件不再像方形，卡片与浮层保持比参考项目再克制一档，输入区使用 `18px`。

发送、停止、附件和纯图标按钮统一使用全圆；普通按钮、输入框和列表行使用 `10px`，卡片使用 `12px`，浮层使用 `18px`。

**The Shape-Means-Control Rule.** 同一个控件不能随 `disabled / enabled` 状态切换圆角。发送与停止按钮形态完全相同，只改底色、图标和可点击状态。

### Buttons

- **Shape:** 8px 圆角（`--radius-md`），高度统一 28px，内边距 0 12px。
- **Primary:** 蓝底 `#2563eb` + 白字，用于每个视图唯一的主操作。
- **Hover / Focus:** 悬停变 `#1d4ed8`；聚焦显示 2px `#2563eb` 26% 透明外环；按下 `scale(0.98)`。
- **Secondary:** `#e8e8eb` 底 + 主墨字，用于并列的次级操作。
- **Ghost:** 透明底 + 次墨字，悬停出现 `#17181a0a` 底色，用于图标按钮和工具栏。
- **Danger:** 错误红作为文字与描边，仅在确认类操作使用实心红底。

### Chips

- **Style:** `#e8e8eb` 底、次墨字、全圆角、高 20-22px、字号 11.5px。
- **State:** 选中态换成 `#2563eb1a` 底 + 强调蓝字，不使用实心填充；状态点用 6px 圆点。

### Cards / Containers

- **Corner Style:** 10px（`--radius-lg`）。
- **Background:** 平铺卡片用 `#f8f8f9`；需要抬起时用 `#ffffff` + raised 投影。
- **Shadow Strategy:** 见 Elevation。默认无阴影。
- **Border:** 平铺卡片无边框；浮层用 0.5px 墨色 8% 描边。
- **Internal Padding:** 12px 为基准，紧凑区域 8px。

### Inputs / Fields

- **Style:** `#e8e8eb` 底色填充、无边框、8px 圆角、高度 30px、内边距 0 10px。
- **Focus:** 底色转白 + 2px 强调蓝 26% 外环。
- **Placeholder:** 必须使用 `#6e7075`（弱墨），保证 4.5:1。
- **Disabled:** 文字转淡墨，底色不变，光标 default。

### Composer（签名组件）

底部输入区是整个客户端使用频次最高的控件。最小高度 46px（约两行），**随内容自动增高**，超过 240px 后转为内部滚动。自动增高由 `App.tsx` 的 `useLayoutEffect` 实现：先把 `height` 归零再读 `scrollHeight`，否则高度只会增不会减。注意 `.composer textarea` 必须是 `flex: none`——基础规则里的 `flex: 1` 会解析成 `flex-basis: 0%`，在 column flex 容器里会直接盖掉 `height`，导致输入框永远长不高。

### Navigation

- **Style:** 左侧栏底色 `#f2f2f4`，与内容区分离但不加右边框。选中项用 `#ffffff` 底 + raised 投影，形成"从侧栏抬起"的效果。
- **Typography:** 会话标题 13px/500，元信息 11.5px/400 弱墨色。
- **States:** 悬停 `#17181a0a`，选中纯白抬起，未读用强调色圆点而不是加粗整行。

### Tool Card（签名组件）

Agent 工具调用的卡片是整个客户端最有辨识度的元素。它有三种形态：运行中展开显示实时输出（左侧状态点呼吸、等宽输出区用内嵌底）、完成后折叠为单行摘要（图标 + 工具名 + 状态 + 耗时）、失败时保留错误红描边并默认展开。摘要行的信息密度要高，但行高不超过 32px。

## 7. Do's and Don'ts

### Do:

- **Do** 用四层底色（`#ffffff` / `#f8f8f9` / `#f2f2f4` / `#e8e8eb`）表达层级，先分层再考虑阴影。
- **Do** 把控件统一到 28px 高度、8px 圆角、0-12px 内边距这三条基线上。
- **Do** 用 `#17181a` 墨色的透明度生成描边和悬停底色，而不是手写独立灰值。
- **Do** 让彩色只出现在状态点、选中态、状态文字和必要的分类标记上。
- **Do** 给每个交互元素补齐 default / hover / focus-visible / active / disabled 五种状态。
- **Do** 用半像素描边（`0 0 0 0.5px`）画必须存在的线条。
- **Do** 用等宽字体只标注代码、路径、命令和数值。

### Don't:

- **Don't** 做成"AI 味重的界面"：禁止玻璃拟态堆叠、渐变文字、紫色渐变、无意义的超大圆角卡片网格、用 emoji 当图标、每张卡片都长得一样。
- **Don't** 用 1px `border` 给平铺卡片画框；那是 2014 年的做法，会让界面立刻显得廉价。
- **Don't** 用蓝色作为品牌强调色；蓝色留给链接和系统选中语义。
- **Don't** 用 `clamp()` 做流体字号，产品界面不需要。
- **Don't** 给按钮、标签、标题套等宽字体。
- **Don't** 用纯黑 `#000` 作为正文色。
- **Don't** 让占位符或元信息浅于 `#6e7075`——那是可读性事故的常见来源。
- **Don't** 为装饰添加动效。动效只表达状态变化，且必须提供 `prefers-reduced-motion` 降级。
