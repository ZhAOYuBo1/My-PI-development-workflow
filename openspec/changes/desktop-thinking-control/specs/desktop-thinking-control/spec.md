# Spec Delta

## Purpose

规定思考强度在桌面端的入口位置与交互形态：模型弹窗只负责选模型，强度成为输入区常驻的
分段控件，带一个随选择左右滑动的高亮块。

## ADDED Requirements

### Requirement: 模型弹窗只负责选择模型

模型选择弹窗 SHALL NOT 呈现思考强度控件。搜索框之下 SHALL 直接是按供应商分组的模型列表。

#### Scenario: 打开模型弹窗只看到模型

- **WHEN** 用户打开模型选择弹窗
- **THEN** 弹窗内只有搜索框和模型列表，不出现任何思考强度选项

#### Scenario: 移除了模型弹窗里的强度行

- **WHEN** 审查 `styles.css`
- **THEN** 不存在 `.thinking-row` 相关规则，且全仓库无任何引用方

### Requirement: 思考强度是输入区常驻分段控件

思考强度 SHALL 渲染为输入区工具栏内的一个横向分段控件，位于发送按钮左侧、与发送按钮右对齐。
控件 SHALL 包含与当前模型 `availableThinkingLevels` 一一对应的等宽段。

#### Scenario: 控件位置在发送按钮旁

- **WHEN** 用户查看任一 Agent 的输入区
- **THEN** 工具栏从左到右依次为附件按钮、模型座位按钮、上下文环、思考强度分段条、发送按钮

#### Scenario: 模型座位按钮只显示模型名

- **WHEN** 思考强度为 `high` 且模型为 `Claude Sonnet 4.5`
- **THEN** 模型座位按钮只显示 `Claude Sonnet 4.5`，SHALL NOT 附带 `· high`

### Requirement: 选中态以滑动指示器表达

分段控件 SHALL 使用单个绝对定位的高亮块表示选中态，高亮块 SHALL 通过 `transform: translateX`
在段之间移动并带过渡动画。各段自身 SHALL NOT 用独立背景色表示选中。

#### Scenario: 切换档位时高亮块滑动而非按钮变色

- **WHEN** 用户从「中」切到「高」
- **THEN** 高亮块从「中」段下方平移到「高」段下方，过程中有约 160ms 的位移动画，未选中段颜色不变

#### Scenario: 减少动效偏好下不做缓动

- **WHEN** 系统开启 `prefers-reduced-motion: reduce`
- **THEN** 高亮块直接跳到目标位置，不做过渡动画

#### Scenario: 段数随模型变化时重新测量

- **WHEN** 切换模型导致 `availableThinkingLevels` 数量从 7 变为 4
- **THEN** 高亮块宽度与位移按新的段宽重新计算，SHALL NOT 沿用旧尺寸

### Requirement: 控件具备完整键盘可达性

分段控件 SHALL 声明为 `radiogroup`，每段 SHALL 声明为 `radio` 并带 `aria-checked`。
方向键 SHALL 在段之间移动选择，`Home` / `End` SHALL 跳到首末段，`Esc` SHALL 移出焦点而不改变选择。

#### Scenario: Tab 进入落在当前选中段

- **WHEN** 用户用 Tab 键聚焦到思考强度控件
- **THEN** 焦点落在当前选中的那一段，而不是第一段

#### Scenario: 方向键切换并即时生效

- **WHEN** 焦点在控件内且用户按下 `→`
- **THEN** 选择移动到下一段、高亮块跟随、设置被实际提交

### Requirement: 档位显示为中文标签

控件 SHALL 以中文显示每个档位。取值与 Pi 的 `off | minimal | low | medium | high | xhigh | max`
一一对应：关闭 / 极低 / 低 / 中 / 高 / 极高 / 最高。未在映射表内的取值 SHALL 回退显示原始值。

#### Scenario: 常见档位显示中文

- **WHEN** 当前模型支持 `off` 与 `high`
- **THEN** 控件上分别显示「关闭」与「高」

#### Scenario: 未知取值回退

- **WHEN** Pi 返回了映射表之外的档位值
- **THEN** 该段显示原始值，SHALL NOT 显示空白或 undefined

### Requirement: 空态与失效态的处理

当 `availableThinkingLevels` 为空时控件 SHALL NOT 渲染。控件 SHALL 始终以
`AgentModelSelection.thinkingLevel` 为准渲染，SHALL NOT 在渲染层对失效档位做就近吸附。

#### Scenario: 模型不支持思考时控件消失

- **WHEN** 当前模型的 `availableThinkingLevels` 为空数组
- **THEN** 输入区不渲染思考强度控件，模型座位按钮是唯一相关入口

#### Scenario: 换模型后档位失效不做猜测

- **WHEN** 用户从支持到 `xhigh` 的模型切到只支持到 `low` 的模型
- **THEN** 控件显示服务端返回的 `thinkingLevel`；若该值不在新的可选列表中，滑块停在无选中态并显示该原始值，SHALL NOT 自动落到 `low` 或第一档

### Requirement: 应用过程中保持可见的当前态

提交档位变更期间控件 SHALL 置灰，SHALL 保持当前选中态可见，SHALL NOT 回退到未选中或默认档。

#### Scenario: 切换过程中不闪回默认档

- **WHEN** 用户切换档位且设置尚未返回
- **THEN** 控件呈禁用态但高亮块仍停在用户刚选的那一段

### Requirement: 窄窗降级为紧凑触发器

输入区宽度低于阈值时，控件 SHALL 降级为只显示当前档位与展开箭头的紧凑触发器，
点击后以竖直浮层提供全部档位。降级阈值 SHALL 与既有 composer 响应式断点对齐。

#### Scenario: 窄窗下改用浮层

- **WHEN** 输入区宽度低于降级阈值
- **THEN** 工具栏上只显示当前档位文字与 chevron；点击展开竖直列表，选中项高亮，SHALL NOT 展示横向滑动条

### Requirement: 斜杠命令与控件行为一致

`/thinking <level>` SHALL 继续直接切换到指定档位。不带参数的 `/thinking` SHALL 在当前
档位基础上循环到下一档，SHALL NOT 再打开模型选择弹窗。未知取值 SHALL 沿用既有错误提示。

#### Scenario: 带参数直接切换

- **WHEN** 用户输入 `/thinking high`
- **THEN** 思考强度切到 `high`，控件高亮块随之移动

#### Scenario: 不带参数循环到下一档

- **WHEN** 用户输入 `/thinking`
- **THEN** 思考强度循环到下一档，转录流插入一条系统提示说明从哪档切到哪档

#### Scenario: 非法取值

- **WHEN** 用户输入 `/thinking bogus`
- **THEN** 沿用既有错误文案「Pi 当前模型不支持 Thinking Level：bogus」

## 明确不做的事

- **SHALL NOT** 改动任何后端契约。`setAgentThinking`、`AgentModelSelection`、`availableThinkingLevels` 已存在且已在本 change 之前被 `chooseThinking` 使用，本次只换调用入口。
- **SHALL NOT** 为思考强度做全局/按 Agent 持久化的新默认值。当前语义是「跟随 Agent 自身的模型选择」，改默认值是另一件事。
- **SHALL NOT** 顺手删除转录流里的 `.thinking-block`（模型思考过程的折叠块）。它和 `.thinking-row` 只是名字相近，语义无关。
- **SHALL NOT** 把强度控件放进设置页。强度是会话内的逐条微调，不是全局偏好。
