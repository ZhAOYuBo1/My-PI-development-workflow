# Tasks

## 1. 样式改造

- [x] 1.1 `styles.css` `.transcript-minimap`：`position: absolute` → `relative`，新增 `flex: 0 0 40px` 与 `align-self: stretch`，新增 `margin: 20px 0` 替代 `top`/`bottom`，删除 `left`/`width`/`z-index`，保留 `pointer-events: none`
- [x] 1.2 确认 `.transcript-stage > .transcript` 的 `flex: 1; min-width: 0` 已存在（`styles.css:2031`），无需改动
- [x] 1.3 确认 `.transcript-minimap-tick` 的 `pointer-events: auto`（`styles.css:2053`）与 `position: absolute` 保持不变
- [x] 1.4 人工核对：1600px 窗口 + 文件管理器开启时，正文首列文字不再被刻度线横穿

## 2. 防回归断言

- [x] 2.1 `e2e/workflow.e2e.ts` 的 minimap 用例中补一步「打开文件管理器」，使转录视口进入 < 816px 区间
- [x] 2.2 新增断言：定位栏右边缘 ≤ 首条 `.message` 左边缘
- [x] 2.3 保留既有的纵向居中（< 2px）与刻度间距（140px）断言，确认改造后仍成立
- [x] 2.4 确认「跳转对话」按钮位置断言（`jumpBox.y + height ≤ composerBox.y - 8`）不受横向改造影响

  > 实测：该用例存在既有间歇性失败（第 2 轮 prompt 丢失，见 HANDOVER.md 四.1），
  > 会先于新断言失败。已用独立探针在两种 CSS 下对比验证：
  > 旧 CSS overlap=12px（断言失败）、新 CSS overlap=0px（断言通过，6/6 稳定）。

## 3. 验证

- [x] 3.1 `npm run build:codepiddy` 通过
- [ ] 3.2 `npx playwright test e2e/workflow.e2e.ts --grep "transcript minimap"` 通过
      - **被既有 flake 阻塞**：该用例第 2 轮 prompt 丢失导致第 4/12 轮等回复超时。
        已用 `git stash` 对比基线：未含本次改动的版本同样 5/5 失败于同一行（86），
        确认与本 change 无关。新断言本身已用独立探针验证通过（见 2.x 备注）
- [ ] 3.3 `npx playwright test` 全量通过（当前 7 passed / 1 failed，失败项即上述 flake）
- [x] 3.4 `openspec validate transcript-minimap-gutter --strict` 通过

## 4. 文档

- [ ] 4.1 README「客户端界面」一节补充：定位栏是转录流的独立左列，不覆盖正文
- [ ] 4.2 重新生成 `docs/images/codepiddy-agent.png`（截图脚本会构建并删除 `dist/renderer`，完成后必须 `npm run build:codepiddy`）
