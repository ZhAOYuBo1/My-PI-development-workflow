# Proposal

## Why

对话区左侧的「对话快速定位」导航条（`.transcript-minimap`）压在消息正文上，刻度短线和消息文字重叠，视觉上像是文字被划了一道，直接影响长时间读对话的体验。

根因是一次布局修复的副作用。`.transcript` 原本用百分比内边距给两侧留白，宽度越窄留白越大，恰好把左侧位置空了出来；后来为了让开启文件管理器后的正文列不被压缩，把内边距改成了固定 `28px`（`styles.css:100-107`），留白不再随宽度变化，而定位条一直是以 `left: 12px; width: 28px` 绝对定位在 `.transcript-stage` 上（`styles.css:2033-2042`），于是两者占用了同一段横向空间。

重叠的触发条件很具体：消息列是 `max-width: 760px; margin: 0 auto`（`styles.css:113-116`）。当转录视口窄于 `760 + 56 = 816px` 时，消息列不再居中留白而是铺满，正文左边缘固定在 `x = 28px`；定位条右边缘在 `x = 40px`。**重叠宽度恒为 12px。**

这正是「打开文件管理器 + 1600px 窗口」的典型状态（转录区约 700–800px），也是最常见的用法。反过来，窄窗（`max-width: 760px`）时定位条 `display: none`，窗口够宽且关闭文件管理器时消息列居中留白，两种情况都不重叠——所以现象看起来「时有时无」，此前一直没被当成 bug 处理。

## What Changes

- 把「对话快速定位」从**绝对定位覆盖层**改为**转录流的一列**：`.transcript-stage` 保持 flex 布局，定位条成为 `.transcript` 的同级 flex 项，自身 `position: relative` 供刻度定位。
- 定位条占据固定宽度的左侧栏（40px），`.transcript` 不再需要为它额外内边距；正文列的可用宽度相应减少，但居中逻辑和 `max-width: 760px` 不变。
- 预览浮层（`.transcript-minimap-preview`，`left: calc(100% + 8px)`）位置不变，仍从定位条右侧展开，不受影响。
- 保留 `max-width: 760px` 下隐藏定位条的既有行为；此时该列一并收起，正文恢复占满宽度。

不改动：定位条的刻度排布算法（`App.tsx:1115-1161`）、可见轮数窗口（`maximumVisibleTurns = 20`）、点击跳转逻辑、`aria-label` 与 tooltip 语义。

## Capabilities

### New Capabilities

（空——本次是修复既有行为，不引入新能力。）

### Modified Capabilities

- `desktop-stream-stats` 之外的既有布局约束：转录流的横向空间分配。本次以新 capability 记录，避免把布局修复混进统计口径的 spec。

### New Capability

- `desktop-transcript-gutter`：转录流左侧定位栏的空间分配规则，以及定位条与正文列不得重叠的硬约束。

## Impact

- 仅影响 `packages/codepiddy-desktop/src/renderer/styles.css`：`styles.css:2030-2042` 的 `.transcript-stage` / `.transcript-minimap` 定位方式，以及 `styles.css:100-107` 的 `.transcript` 内边距。
- `App.tsx` 的 `TranscriptMinimap` 组件结构不变（仍是 `<nav>` + `<button>`），不改 TSX。
- 需要同步更新的 e2e 断言：`e2e/workflow.e2e.ts` 中 minimap 用例断言了刻度纵向间距与居中（`Math.abs(ticksCenter - minimapCenter)).toBeLessThan(2)`、`Math.round(lastTickBox.y - firstTickBox.y)).toBe(140)`），改为 flex 列后横向几何会变，纵向断言应仍成立；需实跑确认。
- 已知遗留：`workflow.e2e.ts` 的 minimap 用例本身存在与本次改动无关的间歇性失败（第二个 prompt 丢失导致流式输出停住），详见 HANDOVER.md。修复本问题时不应把那个 flake 误判为本次回归。
