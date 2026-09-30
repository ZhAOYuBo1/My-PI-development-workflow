# Tasks

> **设计变更（实现期）**：原先的「宽屏整条横条 + 窄屏降级紧凑触发器」两套形态被
> 取消。最终形态是**始终只有一个紧凑触发器**，点开才弹滑块 —— 参考
> `dsh-reasoning-effort` 的 Codex 风格实现。这样窄窗不需要额外降级路径。
> 下面把因此作废的条目标了出来，其余按实际完成情况勾选。

## 0. 前置确认

- [x] 0.1 档位文案不保留英文副标题（输入区宽度紧张，`high` 对目标用户无额外信息量）
- [x] 0.2 窄窗降级阈值 —— 作废。改为「始终紧凑触发器 + 点击弹滑块」后不需要断点

## 1. 模型弹窗瘦身

- [x] 1.1 删除模型弹窗内的 `.thinking-row` 整块
- [x] 1.2 删除 `.thinking-row` 相关规则（含 `.model-picker > .thinking-row` 变体）
- [x] 1.3 确认无残留引用；确认未误删转录流的 `.thinking-block`
- [x] 1.4 产物级核对：构建后的 js 与 css 中 `thinking-row` 均为 0 次

## 2. 模型座位按钮

- [x] 2.1 `model-seat` 只渲染 `model.name`
- [x] 2.2 按钮宽度不因少了后缀而抖动

## 3. 分段控件 → 拖动滑块

- [x] 3.1 新建 `components/ThinkingControl.tsx`
- [x] 3.2 触发器紧贴发送按钮：与发送按钮包进 `.composer-actions`（原靠 `.send-button` 的
      `margin-left: auto` 顶右，会把控件挤到工具组末尾而非贴着发送按钮）
- [x] 3.3 thumb 跟随指针连续移动，`onPointerUp` 才吸附并提交（拖动过程只改视觉）
- [x] 3.4 thumb 纯白 + 描边；填充区到 thumb 为止，越往右越深
- [x] 3.5 `role="slider"` + `aria-valuemin/max/now/valuetext`；`touch-action: none`
- [x] 3.6 键盘 `←` `→` `Home` `End` 可调，`Esc` 关闭并把焦点还给触发器
- [x] 3.7 提交中置灰但保持当前选中态可见
- [x] 3.8 `levels.length === 0` 时整个控件返回 null
- [x] 3.9 补充：`levels.length < 2` 时不画滑块，改为提示「该模型只提供一个档位」

## 4. 接入工具栏

- [x] 4.1 在 `.composer-toolbar` 右端插入，控件与发送按钮同组右对齐
- [x] 4.2 接 `chooseThinking`，复用现有 `setAgentThinking`，未新增 IPC
- [x] 4.3 ~~窄窗改渲染紧凑触发器~~ —— 作废，见 0.2

## 5. 档位文案

- [x] 5.1 `off|minimal|low|medium|high|xhigh|max` → 中文标签映射表
- [x] 5.2 未命中映射时回退显示原始值
- [x] 5.3 单测覆盖全量命中、未知值回退
- [x] 5.4 映射表拆到独立的 `thinking-levels.ts`：根 tsconfig 排除 renderer 目录且不带
      `--jsx`，测试无法从 `test/` import `.tsx`（照 `tool-failure-utils.ts` 的既有做法）

## 6. 斜杠命令

- [x] 6.1 `/thinking` 无参数改为循环到下一档，不再打开模型弹窗
- [x] 6.2 循环时往转录流插系统提示「思考强度：中 → 高」
- [ ] 6.3 `/thinking <level>` 与非法取值的补测试 —— **未做**

## 7. 换模型后的档位失效

- [x] 7.1 控件严格按 `AgentModelSelection.thinkingLevel` 渲染，不做就近吸附
- [x] 7.2 当前档位不在 `availableThinkingLevels` 中时：无选中态 + 文字说明
- [ ] 7.3 测试锁住「UI 显示的档位 == 实际发给模型的档位」 —— **未做**，需 mock IPC

## 8. 验证

- [x] 8.1 `npm run typecheck --workspace=@codpiddy/desktop`（含 renderer 配置）
- [x] 8.2 `npm run build:codepiddy` 通过
- [x] 8.3 desktop 单测 17 files / 80 tests 全过
- [x] 8.4 产物级核对：`thinking-row` 在 js 与 css 中均为 0 次
- [x] 8.5 手工核对：拖动手感、吸附、松手提交 —— **用户已确认**
- [x] 8.6 手工核对：布局位置、配色与输入区协调 —— **用户已确认**
- [x] 8.7 `openspec validate desktop-thinking-control --strict` 通过

## 遗留

- 6.3 与 7.3 两条测试未补。7.3 价值更高：它防的是「换模型后 UI 显示的档位与真正发给
  模型的不一致」这类最难查的偏差。
- 样式由用户在实现期自行调整，本 change 的设计文档描述的是最初的整条横条形态，
  与最终实现不一致，需要同步。
