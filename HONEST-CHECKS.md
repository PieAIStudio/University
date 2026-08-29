# Honest checks

日期：2026-08-29；分支：`work/honest-checks`

本次工作没有改动 `apps/local/studies/`，也没有运行 `pnpm content`。

## Task 1：lesson-links

修改前，`pnpm check:lesson-links` 使用默认的 `apps/local/studies/`。在这个
worktree 里该目录没有 study manifest，脚本打印 `SKIP` 并以退出码 `0` 结束。
因此验证流水线得到的是“通过”，实际却没有解析任何课程。

现在 `package.json` 的检查命令明确指向已签入的
`apps/local/fixtures/lesson-links/`。这个 fixture 只有合成的 resolver-fixture
数据，不是学习内容；它包含两个 unit、两个 lesson，以及一个跨 unit 的裸
`[[lesson:target-lesson]]` 链接和一个带 section 的完整路径链接。验证实际解析
到 2 个 lesson link，并报告没有 dangling link 和 ambiguous duplicate id。

脚本本身不再把“无源可扫”当成跳过：study root 不存在，或 root 下没有
`study.json` 时，均打印 `ERROR` 并返回退出码 `2`。我选择了统一 fail-closed，
没有保留可选 root 的 `SKIP`：对 AI、CI 或其他只看退出码的调用方而言，`SKIP`
仍然等价于 green，调用方没有可靠方式知道它是否有意允许空源。真实作者内容
仍使用脚本原有的 root 配置；本次只把仓库验证接到了非空 fixture。

### duplicate-id guard 的真实覆盖范围

`check-lesson-links.mjs` 在一次 `scanStudy()` 内以
`${courseId}/${lessonId}` 建立 duplicate owner。它因此确实能发现同一 study、
同一 course 中跨不同 unit 复用 lesson id 的情况，这正是
`packages/core/src/progress/contract.ts` 所警告的 `unitId` 被 storage key
省略后会造成的碰撞。

它不是全局 lesson-id guard：不同 course 的相同 lesson id 不会被判为 ambiguous；
`repeatedIdsAcrossCourses()` 只是提示信息，而且不同 study 也分别扫描。这个
范围与 resolver 的规则一致：裸 id 在 course 内解析，跨 course 需要完整路径。
所以原来的 guard 不是“覆盖了所有重复 id”，而是覆盖了关键的
同 course / 跨 unit 窄范围；此前因无 source，它连这一范围也没有实际执行。

## Task 2：island-look

修改前，judge 在真实 Chrome 和真实 WebGL 像素上计算每项 `pass`，打印
`PASS`/`RED`，但从不断言；README 也明确说 RED 不会失败。因此画面回归仍以
退出码 `0` 结束。

我先在未改动的 scene 上运行了完整固定压力矩阵：4 个 DEV shot × 桌面/手机，
共 8 组，基线记录在 `e2e/J.island-look.spec.ts` 的 per-shot/per-viewport
ratchet 中，数值就是 judge 输出的当前值（保留其现有精度）。既有
`ISLAND_LOOK_CONTRACT` 阈值没有改变。现在每组打印表格后都会断言：有下限的
指标不能低于当天值，有上限的指标不能高于当天值，区间指标不能更靠近区间
边界；因此当天已经 RED 的指标仍然是 RED-today，不会被当成合格，也不会因
历史问题让这次改动失败。没有 ratchet baseline 或方向的情况会直接报错，
不会静默跳过。

该 judge 仍不加入 `pnpm verify`，因为它需要真实浏览器。改动后的完整
`pnpm e2e:island-look` 已通过（8/8，约 8.8 分钟）。`world-design` 两组
仍打印原有的 freeze-drift warning；它不是本次新增的失败条件。

下面的 GREEN/RED 是原有 look contract 在 2026-08-29 基线上的状态，不是把
ratchet 结果重新命名成 PASS。未列入红绿表的 `threshold: null` 行仍作为诊断
值写入 judge 输出，不参与质量阈值判断。

| shot / viewport | GREEN today | RED today |
| --- | --- | --- |
| `course-design / desktop` | `sceneLinearRange`, `landMedianLightness`, `landLightnessRise`, `grassHueCount`, `grassHueSpread`, `accentArea`, `keyToFillRatio`, `propsPerLessonNode`, `rimPropShare`, `landCoverage`, `nodeOcclusionShare` | `landP95Lightness`, `backgroundLightnessSpread`, `grassLightnessSpread`, `grassLightnessP95`, `lightnessP2`, `lightnessP98`, `lightnessStdDev`, `domLabelContrastMin` |
| `course-near / desktop` | `sceneLinearRange`, `landLightnessRise`, `grassLightnessSpread`, `lightnessP2`, `grassHueCount`, `grassHueSpread`, `keyToFillRatio`, `propsPerLessonNode`, `rimPropShare`, `landCoverage`, `nodeOcclusionShare` | `landMedianLightness`, `landP95Lightness`, `backgroundLightnessSpread`, `grassLightnessP95`, `lightnessP98`, `lightnessStdDev`, `accentArea`, `domLabelContrastMin` |
| `course-far / desktop` | `sceneLinearRange`, `landMedianLightness`, `landLightnessRise`, `backgroundLightnessSpread`, `grassLightnessSpread`, `lightnessP98`, `grassHueCount`, `grassHueSpread`, `keyToFillRatio`, `propsPerLessonNode`, `rimPropShare`, `landCoverage`, `nodeOcclusionShare` | `landP95Lightness`, `grassLightnessP95`, `lightnessP2`, `lightnessStdDev`, `accentArea`, `domLabelContrastMin` |
| `world-design / desktop` | `landLightnessRise`, `backgroundLightnessSpread`, `grassLightnessSpread`, `grassLightnessP95`, `lightnessP98`, `grassHueCount`, `grassHueSpread`, `keyToFillRatio`, `domLabelContrastMin`, `worldPropsPerIsland` | `sceneLinearRange`, `landMedianLightness`, `landP95Lightness`, `lightnessP2`, `lightnessStdDev`, `accentArea` |
| `course-design / mobile` | `grassHueCount`, `grassHueSpread`, `accentArea`, `keyToFillRatio`, `propsPerLessonNode`, `rimPropShare`, `landCoverage`, `nodeOcclusionShare` | `sceneLinearRange`, `landMedianLightness`, `landP95Lightness`, `landLightnessRise`, `backgroundLightnessSpread`, `grassLightnessSpread`, `grassLightnessP95`, `lightnessP2`, `lightnessP98`, `lightnessStdDev`, `domLabelContrastMin` |
| `course-near / mobile` | `sceneLinearRange`, `landLightnessRise`, `grassLightnessSpread`, `lightnessP2`, `grassHueCount`, `grassHueSpread`, `accentArea`, `keyToFillRatio`, `propsPerLessonNode`, `rimPropShare`, `landCoverage`, `nodeOcclusionShare` | `landMedianLightness`, `landP95Lightness`, `backgroundLightnessSpread`, `grassLightnessP95`, `lightnessP98`, `lightnessStdDev`, `domLabelContrastMin` |
| `course-far / mobile` | `sceneLinearRange`, `landLightnessRise`, `grassLightnessSpread`, `grassHueCount`, `grassHueSpread`, `accentArea`, `keyToFillRatio`, `propsPerLessonNode`, `rimPropShare`, `landCoverage`, `nodeOcclusionShare` | `landMedianLightness`, `landP95Lightness`, `backgroundLightnessSpread`, `grassLightnessP95`, `lightnessP2`, `lightnessP98`, `lightnessStdDev`, `domLabelContrastMin` |
| `world-design / mobile` | `landP95Lightness`, `grassHueCount`, `grassHueSpread`, `keyToFillRatio`, `domLabelContrastMin`, `worldPropsPerIsland` | `sceneLinearRange`, `landMedianLightness`, `landLightnessRise`, `backgroundLightnessSpread`, `grassLightnessSpread`, `grassLightnessP95`, `lightnessP2`, `lightnessP98`, `lightnessStdDev`, `accentArea` |

## Verification

- `pnpm check:lesson-links`：通过，真实扫描 fixture。
- `pnpm --filter @pieai/university-local exec vitest run -c vitest.config.ts scripts/check-lesson-links.test.ts`：2/2 通过。
- `pnpm e2e:island-look`：8/8 通过 ratchet。
- `pnpm verify`：通过。

本 worktree 使用了已有的 generated delivery content 的忽略 symlink 以满足构建
前置条件；没有生成或修改课程内容。
