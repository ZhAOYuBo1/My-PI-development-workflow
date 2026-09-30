# Design

## 现状几何

以 1600px 窗口、文件管理器开启为例：

```
窗口 1600
├── 侧边栏 ~300
├── 转录区 ~730          ← .transcript-stage
│   ├── .transcript-minimap   x ∈ [12, 40]     绝对定位，z-index 30
│   └── .transcript           padding 28px
│       └── .message          max-width 760，铺满 → 左边缘 x = 28
└── 文件管理器 ~570
```

`x = 28` 到 `x = 40` 之间是 12px 的重叠带。正文字号 14px、行高 1.65，12px 足以让首列字符被刻度线横穿。下方「实测数据」一节用 `boundingBox` 确认了这个 12px。

重叠是否发生只取决于一件事：转录视口宽度是否小于 `760 + 56 = 816px`。

| 转录视口宽度 | 消息列 | 消息左边缘 | 是否重叠 |
| --- | --- | --- | --- |
| 1100px | 760px 居中 | 198px | 否 |
| 900px | 760px 居中 | 98px | 否 |
| 816px | 760px 居中 | 56px | 否（临界） |
| 730px | 730px 铺满 | 28px | **是** |
| 700px | 700px 铺满 | 28px | **是** |

## 方案对比

### 方案 A：给 `.transcript-stage` 加左内边距

```css
.transcript-stage { padding-left: 52px; }
.transcript-minimap { left: 12px; }   /* 不变 */
```

改动最小（一行），定位条继续绝对定位。缺点是这段留白**无条件存在**——窄窗下定位条 `display: none`，52px 留白就白占了，正文列白白窄一截。而且它没有消除「覆盖层」这个结构性问题：只要有人调整 `left` 或 `width`，重叠会再次出现，只是不易察觉。

### 方案 B：定位条改为 flex 列（推荐）

```css
.transcript-stage { display: flex; }              /* 已有 */
.transcript-stage > .transcript { flex: 1; min-width: 0; }  /* 已有 */
.transcript-minimap {
  position: relative;   /* 原 absolute */
  flex: 0 0 40px;
  align-self: stretch;
  /* 删除 top / bottom / left / width / pointer-events: none / z-index */
}
.transcript-minimap-tick { position: absolute; top: calc(50% + Npx); }  /* 不变 */
```

定位条成为 `.transcript` 的兄弟节点、各占一列，横向不可能重叠——这是结构性保证，不依赖具体数值。

刻度用的 `top: calc(50% + ${offset * 20}px)`（`App.tsx:1147`）依赖百分比高度，所以定位条必须有一个确定高度。`align-self: stretch` 让它撑满 `.transcript-stage` 的高度（stage 本身是 `flex: 1` 的定高区域），等价于原来的 `top: 20px; bottom: 20px`。为保留上下 20px 留白，可改用 `margin: 20px 0` 而非 `top/bottom`。

`pointer-events: none` 原意是让定位条空白区不拦截点击（只有刻度按钮可点）。改成 flex 列后它是独立元素，默认就会拦截落在它那 40px 上的点击——但那 40px 原本被 `.transcript` 的文字覆盖，点击是有意义的（选中文本）。所以 `pointer-events: none` 必须保留，只让 `.transcript-minimap-tick` 恢复 `pointer-events: auto`（这条已有，`styles.css:2053`）。

`z-index: 30` 可以去掉：不再是覆盖层后不存在层叠冲突。保留也无害。

### 方案 C：把定位条挪到右侧

不可行。预览浮层用 `left: calc(100% + 8px)` 向右展开（`styles.css:2085`），挪到右侧后浮层会撞上文件管理器或滚动条，需要连带翻转浮层方向和锚点。改动面反而更大。

## 决策

**采用方案 B。** 理由：

1. 横向不重叠由 flex 布局保证，不依赖 `left`/`width` 的具体数值，后续调整刻度尺寸不会重新引入重叠；
2. 定位条与转录流的层级关系从「覆盖」变成「并列」，和它在产品语义上的地位一致——它是一个导航栏，不是浮层；
3. 顺带修掉一个隐患：现在正文文字压在定位条下面，鼠标悬停时 `::after` 变宽到 22px（`styles.css:2072`）会盖住更多文字；flex 列下这条 40px 是专属的。

## 宽度取值

`flex: 0 0 40px` 的依据：原 `left: 12px` + `width: 28px` = 右边缘 40px，加上消息列原有的 28px 内边距，共 68px 的左侧占用。改用 flex 列后定位条自己占 40px，`.transcript` 的 `padding: 28px 28px` 保持不变，于是正文左边缘从 `28` 变成 `40 + 28 = 68`——**与原设计意图一致**（原本就是想让正文从 68px 开始，只是没实现）。

左侧总占用因此不增反减：原来重叠时正文实际从 28px 开始（占用了定位条的空间），改后从 68px 开始，中间 12px 的重叠带被消除，正文可用宽度在窄视口下反而**增加** 0px（68-28=40 是从定位条那 40px 里挪出来的），在宽视口下居中位置不变。

## 实测数据（Electron 1320px 窗口，文件管理器开启）

改造前后用同一探针测量（`boundingBox` 实测，非推算）：

| | 转录宽度 | 定位栏 x 区间 | 正文左边缘 | 重叠 |
| --- | --- | --- | --- | --- |
| 改造前（absolute） | 530.7 | [310.7, 338.7] | 326.7 | **12px** |
| 改造后（flex 列） | 490.7 | [298.7, 338.7] | 366.7 | **0px** |

改造后定位栏右边缘仍是 338.7（`left:12 + width:28` 的右边界不变，符合预期），但正文左边缘从 326.7 推到 366.7，中间多出 28px 间隙。

注意转录宽度从 530.7 降到 490.7 —— 这 40px 正是定位栏从「覆盖」变成「独占」后占掉的。它换来的是重叠消除，代价是正文列窄 40px；若嫌窄可把 `flex: 0 0 40px` 收到 32px 左右（仍大于 28px 刻度宽度即可）。

## 响应式

现有 `@media (max-width: 980px) { .transcript-minimap { display: none } }`（`styles.css:2211`）保持不变。`display: none` 的 flex 项不参与宽度分配，正文自动恢复占满，无需额外处理。

> 交接文档与本文件早期版本都写成 760px，实为 980px，已按源码更正。

## 测试策略

`e2e/workflow.e2e.ts` 的 minimap 用例已覆盖关键几何，直接复用：

- 纵向居中：刻度首尾中点与定位条中点偏差 < 2px —— flex stretch 后应仍成立；
- 刻度纵向间距：8 轮窗口下首尾间距 = 140px —— 纯纵向计算，不受影响；
- 点击跳转后 `scrollTop` 变小。

**新增断言（本次必须加）**：定位条右边缘 ≤ `.transcript` 内容左边缘。这是防回归的核心断言，直接对应用户报告的现象。

```ts
const minimapBox = await minimap.boundingBox();
const messageBox = await page.locator(".message").first().boundingBox();
expect(minimapBox!.x + minimapBox!.width).toBeLessThanOrEqual(messageBox!.x);
```

需在「转录视口 < 816px」的场景下断言才有意义——即**打开文件管理器**的状态。现有 minimap 用例没开文件管理器，需要补一步开关，否则断言会在宽视口下平凡通过。
