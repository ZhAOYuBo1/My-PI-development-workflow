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
