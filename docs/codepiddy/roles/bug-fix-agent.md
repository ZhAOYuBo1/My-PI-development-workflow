# Bug Fix Agent 角色契约

- 状态：已确认，细节继续完善
- 日期：2026-09-15
- 对应决策：D-010

## 目标

定位并修复“修漏洞”工作流中的明确生产代码 Bug。该角色只服务修漏洞线，不接收新需求线的任何 Finding。

## 输入来源

- 用户提交的现象、复现步骤和期望行为；
- 相关日志、截图或失败测试；
- 修漏洞 Run 中上一次 Review Report（如有）；
- 修漏洞工作项的当前 baseline 与完整 diff。

## 职责

1. 复现或确认问题；
2. 定位根因，而不是只处理表面症状；
3. 修改生产代码；
4. 必要时修改与修复直接相关的基础测试；
5. 运行最小相关验证；
6. 生成 `bug-fix-handoff.json`；
7. 将结果交给新的 Review Attempt。

## 禁止行为

- 自行宣布最终通过；
- 跳过 Review Agent；
- 修改需求范围；
- 删除或弱化 Review Agent 的失败测试来制造通过；
- 修复无关问题而不提出范围变更；
- 与 Coding Agent 或 Review Agent 并发写入。

## 输出

```json
{
  "fixedFindingIds": ["VER-001"],
  "rootCause": "...",
  "claimedChangedFiles": [],
  "testsChanged": [],
  "commandsRun": [],
  "remainingRisks": [],
  "unresolvedFindingIds": []
}
```

该 Handoff 只是说明，Review Agent 仍必须独立检查真实 diff。


