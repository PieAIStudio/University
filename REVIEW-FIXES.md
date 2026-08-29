# Review flow 修复记录

## 缺陷 1：recap 卡的评分帮助

- 普通课程卡继续使用原来的 `review-rating` 帮助：保留「这不是判对错」，并说明可以查看参考答案。
- 「讲一遍」recap 卡沿用卡片已经有的 `card.kind` 分流，改用新的 `review-rating-recap` 帮助：保留「这不是判对错」，但不再提参考答案。
- 没有重构评分组件，也没有给 recap 卡添加作者答案或 AI 判定。回归测试同时断言普通卡保留参考答案提示、recap 卡不包含该提示。

## 缺陷 2：评分按钮没有说明后果

调查结论属于“信息已经能算出，只是没有展示”。进度文档保存了完整的 `CardProgress.fsrs`；核心调度器已有纯函数 `review(card, rating, at)` 和同一组 `RATING` 映射，所以渲染时可以从现有卡片状态分别计算四个下一次间隔。新增的 `ReviewCardPort.preview()` 只读取快照并调用这套既有调度代码，不调用 `gradeCard`，不会写进度或改变评分提交路径；端口测试也用 FSRS 结果逐项对照并断言快照不变。

按钮展示人类可读的相对间隔，例如「重来 · 1 分钟」「简单 · 2 天」，没有展示日期：初学者先理解“多久会回来”更直接，也能避免把相对间隔变成受时区影响的日历字符串；短文案在 390×844 下仍能放进按钮。

## 有意没有改动的内容

- 没有修改 FSRS 参数、评分含义、下一次到期的写入逻辑或任何新的调度行为。
- 没有新增 HTTP 调度接口；共享 delivery/authoring 端仍使用同一个 scheduler port。没有状态的旧 HTTP fallback 继续显示短标签，因为它没有安全的 FSRS 状态可供预览。
- 没有修改 `apps/local/studies/` 或任何课程内容，也没有运行 `pnpm content`。

## 浏览器截图

四张截图均在真实 delivery 浏览器的 `/review` 复习页、答案揭示后截取，并逐张目视检查：

- 普通课程卡，桌面：[`.scratch/review-fixes-qa/ordinary-desktop.png`](.scratch/review-fixes-qa/ordinary-desktop.png)
- 普通课程卡，390×844：[`.scratch/review-fixes-qa/ordinary-mobile.png`](.scratch/review-fixes-qa/ordinary-mobile.png)
- 「讲一遍」recap 卡，桌面：[`.scratch/review-fixes-qa/recap-desktop.png`](.scratch/review-fixes-qa/recap-desktop.png)
- 「讲一遍」recap 卡，390×844：[`.scratch/review-fixes-qa/recap-mobile.png`](.scratch/review-fixes-qa/recap-mobile.png)

两张手机截图的 `document.documentElement.scrollWidth` 与 `innerWidth` 都是 390，没有横向溢出；recap 截图没有参考答案区域，普通卡截图保留参考答案区域。

## 验证

- 相关 UI、scheduler、间隔格式化和 analytics 测试通过。
- `pnpm verify` 全部通过。
