# Spec Delta

## Purpose

让用户在模型生成过程中实时看到输出速率与已耗时，并在回复结束时得到一组可确认的最终统计，从而对“快慢、长短、是否卡住”有明确感知。

## ADDED Requirements

### Requirement: 流式速率与耗时实时显示

Assistant 消息处于 `streaming` 状态时，系统 SHALL 在其下方显示实时速率（`⚡ xx.x tok/s`）与已耗时（秒），至少每 500ms 更新一次；速率口径为本条回复已输出 token 数除以从首个 delta 起的耗时。同一会话 SHALL 只在最新一条 assistant 消息下方显示统计行，历史消息不再重复显示。

#### Scenario: 长回复显示递增的速率耗时

- **WHEN** 模型持续输出超过 2 秒
- **THEN** 回复下方可见类似 `⚡ 25.0 tok/s · 3.2s` 的实时读数，且随输出推进而更新

### Requirement: 结束时定格终值统计

Assistant 消息转为 `complete` 时，系统 SHALL 将速率区定格为终值（`⚡ 25.0 tok/s · 150 tok / 6.0s`）并保留在消息下方；token 数优先采用 provider 上报的 usage，无 usage 时 SHALL 按字符估算并标注“约”。

#### Scenario: 回复结束保留统计行

- **WHEN** 一条流式回复正常结束
- **THEN** 其下方保留一行终值统计，刷新或重进会话后依然可见

#### Scenario: 无 usage 时用估算并标注

- **WHEN** provider 未上报 usage 且回复共输出约 400 字符
- **THEN** 终值显示约 100 tok 并带有“约”字样，而非空白或零
