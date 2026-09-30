# Spec Delta

## Purpose

规定转录流左侧「对话快速定位」栏与正文列的横向空间分配，并确立「两者不得重叠」这一硬约束。当前定位条以绝对定位覆盖在转录流之上，在转录视口窄于 816px（典型场景：1600px 窗口 + 开启文件管理器）时压住消息首列 12px。

## ADDED Requirements

### Requirement: 定位栏独占左侧列，不覆盖正文

「对话快速定位」SHALL 作为 `.transcript-stage` 的同级 flex 项占据固定宽度的左侧列，SHALL NOT 以绝对定位覆盖在转录流之上。定位栏右边缘 SHALL NOT 越过正文列左边缘，在任意窗口宽度与文件管理器开关状态下均不得与消息文字重叠。

#### Scenario: 开启文件管理器后不压字

- **WHEN** 窗口 1600px、文件管理器开启（转录视口约 730px）、会话超过 1 轮
- **THEN** 定位栏右边缘 ≤ 首条消息左边缘，消息首列文字完整可见，无刻度线横穿

#### Scenario: 关闭文件管理器后居中不变

- **WHEN** 窗口 1600px、文件管理器关闭（转录视口约 1300px）
- **THEN** 正文列仍以 `max-width: 760px` 居中，左右留白对称，定位栏位于留白内

#### Scenario: 窄窗隐藏定位栏

- **WHEN** 窗口宽度 ≤ 760px
- **THEN** 定位栏 `display: none` 且不占据布局宽度，正文列恢复占满转录区

### Requirement: 刻度纵向几何保持不变

改为 flex 列后，定位栏 SHALL 通过 `align-self: stretch`（或等效方式）撑满转录区高度，并保留上下各 20px 留白。刻度 SHALL 继续相对定位栏垂直居中排列，可见轮数窗口 SHALL 保持 20 轮。

#### Scenario: 刻度居中与间距

- **WHEN** 转录流包含 8 轮对话
- **THEN** 定位栏可见 8 个刻度，首尾刻度中点与定位栏中点垂直偏差 < 2px，首尾刻度纵向间距为 140px

### Requirement: 覆盖层点击穿透语义不变

定位栏 SHALL 保留 `pointer-events: none`，仅刻度按钮恢复 `pointer-events: auto`。落在定位栏 40px 区域内的点击 SHALL NOT 被定位栏拦截。

#### Scenario: 悬停刻度浮层

- **WHEN** 鼠标悬停第 3 个刻度
- **THEN** 预览浮层自定位栏右侧展开，显示轮次、用户消息与回复摘要；移开后浮层消失

#### Scenario: 点击刻度跳转

- **WHEN** 用户点击第 1 个刻度
- **THEN** 转录流滚动到该轮起始位置，`scrollTop` 变小

## 实现约束

- 修改范围限定在 `packages/codepiddy-desktop/src/renderer/styles.css`；`App.tsx` 的 `TranscriptMinimap` 组件结构与刻度排布算法（`top: calc(50% + offset * 20px)`）不变。
- 定位栏宽度取 40px，与原 `left: 12px` + `width: 28px` 的右边缘一致；`.transcript` 的 `padding: 28px 28px` 不变。
- `z-index` 可移除（不再是覆盖层）；保留不违反本 spec。
- 必须新增 e2e 断言「定位栏右边缘 ≤ 正文左边缘」，且该断言需在**文件管理器开启**（转录视口 < 816px）的状态下执行，否则在宽视口下平凡通过、无法防回归。
