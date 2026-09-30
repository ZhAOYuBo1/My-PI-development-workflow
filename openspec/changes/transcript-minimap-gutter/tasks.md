# Tasks

## 1. 样式改造

- [ ] 1.1 `styles.css` `.transcript-minimap`：`position: absolute` → `relative`，新增 `flex: 0 0 40px` 与 `align-self: stretch`，新增 `margin: 20px 0` 替代 `top`/`bottom`，删除 `left`/`width`/`z-index`，保留 `pointer-events: none`
- [ ] 1.2 确认 `.transcript-stage > .transcript` 的 `flex: 1; min-width: 0` 已存在（`styles.css:2031`），无需改动
- [ ] 1.3 确认 `.transcript-minimap-tick` 的 `pointer-events: auto`（`styles.css:2053`）与 `position: absolute` 保持不变
- [ ] 1.4 人工核对：1600px 窗口 + 文件管理器开启时，正文首列文字不再被刻度线横穿

## 2. 防回归断言

- [ ] 2.1 `e2e/workflow.e2e.ts` 的 minimap 用例中补一步「打开文件管理器」，使转录视口进入 < 816px 区间
- [ ] 2.2 新增断言：定位栏右边缘 ≤ 首条 `.message` 左边缘
- [ ] 2.3 保留既有的纵向居中（< 2px）与刻度间距（140px）断言，确认改造后仍成立
- [ ] 2.4 确认「跳转对话」按钮位置断言（`jumpBox.y + height ≤ composerBox.y - 8`）不受横向改造影响

## 3. 验证

- [ ] 3.1 `npm run build:codepiddy` 通过
- [ ] 3.2 `npx playwright test e2e/workflow.e2e.ts --grep "transcript minimap"` 通过
- [ ] 3.3 `npx playwright test` 全量通过
      - **注意**：`workflow.e2e.ts` 的 minimap 用例存在与本 change 无关的间歇性失败（第二个 prompt 丢失，详见 HANDOVER.md）。若该用例失败，先单独重跑确认是否为已知 flake，再判断是否为本 change 的回归
- [ ] 3.4 `openspec validate transcript-minimap-gutter` 通过

## 4. 文档

- [ ] 4.1 README「客户端界面」一节补充：定位栏是转录流的独立左列，不覆盖正文
- [ ] 4.2 重新生成 `docs/images/codepiddy-agent.png`（截图脚本会构建并删除 `dist/renderer`，完成后必须 `npm run build:codepiddy`）
