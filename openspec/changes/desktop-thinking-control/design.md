# Design

## 一、现状（改动的出发点）

输入区工具栏当前是三个元素，`justify-content: space-between` 把发送按钮推到最右：

```tsx
// App.tsx:4092
<div className="composer-toolbar">
  <div className="composer-tools">
    [图片附件按钮]
    <button className="model-seat">{model.name} · {thinkingLevel} ▾</button>   // ← 混在一起
    <ContextGauge />
  </div>
  <button className="send-button" />   // margin-left: auto
</div>
```

模型弹窗里强度是一排独立按钮（`App.tsx:4742`），选中项靠换背景色表示：

```css
.thinking-row button.selected { background: #292928; color: #fff; }
```

## 二、改完是什么样

输入区工具栏变成四个元素，强度控件夹在工具组和发送按钮之间：

```
┌──────────────────────────────────────────────────────────────────┐
│  [📎]  [Claude Sonnet 4.5 ▾]  [◔ 42%]     [ 关闭 │ 低 │ 中 │ 高 │ 极高 ]  [↑]  │
└──────────────────────────────────────────────────────────────────┘
   └──────────── composer-tools ────────────┘  └─ 强度分段条 ─┘  └发送┘
                                                  紧贴发送按钮左侧
```

模型弹窗变成纯粹的模型列表，搜索框之下直接就是供应商分组：

```
┌────────────────────────────────────────┐
│ 选择模型                                 │
│ [ 搜索模型                        ]      │
│ ┌────────────────────────────────────┐ │
│ │ ANTHROPIC                          │ │
│ │  Claude Sonnet 4.5                 │ │
│ │  Claude Opus 4.1                   │ │
│ │ OPENAI                             │ │
│ │  GPT-5.5                           │ │
│ └────────────────────────────────────┘ │
└────────────────────────────────────────┘
```

## 三、强度分段条的形态

### 3.1 结构：相对定位的轨道 + 一个滑动的高亮块 + N 个等宽段

```
┌─────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░ │   ← thumb，绝对定位，transform 滑动
│  关闭    低     中     高     极高    │   ← N 个等宽按钮，自身背景透明
└─────────────────────────────────────┘
```

- **轨道**：`display: flex`，段等宽平分。段本身背景透明、不变色 —— 视觉上唯一的「状态」就是那个滑块。这样切换时是「一个东西移动」，而不是「两个按钮换色」，正好是你要的左右滑动状态条。
- **滑块（thumb）**：绝对定位，`background: #292928`，圆角与轨道一致，宽度 = 一段的宽度，`transform: translateX(段索引 × 段宽)`，`transition: transform 160ms ease`。
- **文字**：选中段转白，未选中段维持 `#6f6f6a`；选中段字重轻微提亮，保证滑块动画进行中文字对比度不会塌。
- **实现选型**：`availableThinkingLevels` 是模型相关的，段数 N 会变，所以**不能**用 `left: calc(index * 100% / N)` 的百分比方案。用 `useLayoutEffect` 量一次段宽存 state，thumb 的 `width` 与 `translateX` 都由它算出；N 变化时重算。

### 3.2 交互

| 操作 | 结果 |
| --- | --- |
| 点击某一段 | 立即调用 `setAgentThinking`，滑块滑到该段 |
| `←` / `→` | 在段之间移动选择并触发切换，滑块跟随 |
| `Home` / `End` | 跳到第一段 / 最后一段 |
| `Esc` | 焦点移出控件，不改变选择 |
| 正在应用（`modelPickerBusy`） | 整条置灰但**保持当前选中态可见**，不要闪回默认档 |

键盘可达性：容器 `role="radiogroup"`，每段 `role="radio"` + `aria-checked`。Tab 进入时落在当前选中段，而不是第一段。

### 3.3 档位文案

Pi 的取值是 `off | minimal | low | medium | high | xhigh | max`（`packages/ai/src/types.ts:83-84`），全英文。参照权限弹窗刚改成中文的先例，强度档位也给中文标签，未知取值回退显示原值：

| Pi 取值 | 显示 | 备注 |
| --- | --- | --- |
| `off` | 关闭 | 不额外消耗推理预算 |
| `minimal` | 极低 | |
| `low` | 低 | 默认建议档 |
| `medium` | 中 | |
| `high` | 高 | |
| `xhigh` | 极高 | |
| `max` | 最高 | |

**待确认**：是否保留英文原值作副标题（例如「高 high」）。倾向不保留 —— 输入区宽度紧张，且 `high` 这类词对目标用户没有额外信息量。

## 四、边界情况

### 4.1 模型不支持思考

`availableThinkingLevels` 为空数组（部分模型如此）→ **整条控件不渲染**，而不是渲染一条只有一档或置灰的死控件。此时模型座位按钮是唯一入口，符合「没有可调项就不占位」。

### 4.2 换模型之后强度失效

从支持到 `xhigh` 的模型切到只支持到 `low` 的模型，原选中值不在新的 `availableThinkingLevels` 里。此时：

- 以刷新后的 `AgentModelSelection.thinkingLevel` 为准渲染控件，**不在渲染层猜测**
- 若该值恰好不在新列表里（Pi 未给默认值），滑块停在无选中态并显示当前原始值 —— 而不是默默落到 `low` 或第一档

这条必须以服务端返回为准。做「就近吸附」会让 UI 显示的档位和真正发给模型的不一致，属于最难查的一类偏差。

### 4.3 窄窗降级

工具栏本来已有三个元素（附件 / 模型座位 / 上下文环），强度最多再加 7 段。分两级：

- **≥ 720px**：完整分段条，带滑动指示器
- **< 720px**：收成紧凑触发器，只显示当前档位（如 `中`）+ chevron，点击展开竖直浮层（复用弹窗那套 listbox 模式）。此时没有滑动效果，改竖向列表高亮

降级阈值要与 `styles.css` 里 composer 相关的既有 `@media` 分组对齐，新增断点并入同一组，不新开一套。

## 五、`/thinking` 的新行为

现在（`App.tsx`）：`/thinking` 不带参数 → `openModelPicker(slot)`，即打开模型弹窗去点那排强度按钮。弹窗移除强度行后这个入口会失效，必须一起改，否则 `/thinking` 会变成「打开模型选择器却什么都改不了」的死命令。

定为**循环**而非弹窗：

- `/thinking` → 在 `availableThinkingLevels` 里循环到下一档，转录流插一条系统提示 `思考强度：中 → 高`
- `/thinking high` → 直接切到该档（行为不变）
- `/thinking bogus` → 沿用现有错误文案 `Pi 当前模型不支持 Thinking Level：bogus`

选循环的理由：不必新增浮层组件、键盘可达（直接打字），且和滑块控件表达同一个心智模型 —— 强度是一个可以连续往上调的量。若更希望显式选择，也可改成弹层，但要新写组件，收益不大。

## 六、样式落点

新增（放在 `.model-seat` 附近，沿用现有中性灰体系）：

```css
.thinking-control { position: relative; display: flex; }                 /* 轨道 */
.thinking-control-thumb { position: absolute; transition: transform 160ms ease; }  /* 滑块 */
.thinking-control-seg { flex: 1; border: 0; background: transparent; }   /* 段 */
.thinking-control-trigger { }                                             /* 窄窗降级触发器 */
```

删除：`.thinking-row` 的三条规则（`styles.css:395-397`）—— 弹窗移除后它们没有任何引用方。

注意 `.thinking-row`（弹窗里的强度行）与转录流里的 `.thinking-block`（思考过程折叠块）是两回事，不要一起删。

`prefers-reduced-motion: reduce` 下把 thumb 的 `transition` 去掉，滑块仍移动但不做缓动。
