# Worldsea 世界地图调整报告

- 分支：`work/worldsea`
- 工作目录：`/Users/yuanfei/PieAI/University-wt-worldsea`
- 真实目录：`apps/university/src/content/imported.json`
- 目录规模：53 门课；课时范围 1–41；median 为 12

## 完成的改动

1. `packages/world/src/course/layout.ts`
   - 收紧目录的 golden-angle 圆环布局：X 方向不再铺成宽长条，Z 方向保留更深的层次，因此岛群仍是连续的自然场，而不是行列网格。
   - 把岛间分离距离抽成 `WORLD_ISLAND_SEPARATION_GAP = 1.05`，并把确定性 relaxation 提高到 128 次，让收紧后的 53 个真实轮廓仍不互相穿插。
2. `packages/world/src/grid/course-grid.ts`
   - 只调整 `projection: "world"` 的 footprint：先测量实际生成 outline 的 unit half-extent，再按课时的平方根曲线求 hex size。
   - 目标 half-width 为 `1.1 + sqrt(lessons) * 0.98`，最低 hex size 为 `0.42`；短课不会缩成噪点，长课仍明显更大但不会吞掉邻居。
   - 课程内部视图使用的 `estimateHexSize` 没有改动，world 与 course 继续共用同一套 hex pipeline。
3. `packages/world/src/island/island-look.ts`
   - 把固定的 `world-design` 取景距离从 112 收到 90。它只服务于设计审查截图；运行时自由相机的距离范围没有被改写。
4. `packages/world/src/grid/world-grid.test.ts`
   - 新增基于真实 53 门课的两项回归约束：岛群必须在水平和垂直方向同时占据可读的画面、但不能靠裁切外圈达成；3/19/41 课时的岛屿必须保持长度信号和两端可用性。
   - 保留不重叠、不成规则网格、网格 palette 不漂移等原有约束。

没有修改 `Maps.tsx` 的 `LessonPlacement` 接口，没有复制 renderer，没有给 `packages/ui` 引入 `three`，也没有改课程视图的 estimator。

## Desktop before / after 证据

以下数字取自 capture harness 每个 `requestAnimationFrame` 重置后的 WebGL hook；不是会累计历史帧的 `gl.info` 数字。

| 真实课程 | 课时 | before draw calls | after draw calls | before triangles | after triangles | before 截图 | after 截图 |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| `foundations-before-zero` | 41 | 22 | 22 | 15,424 | 15,424 | `.scratch/worldsea/before-world-design-foundations-desktop.png` | `.scratch/worldsea/after-world-design-foundations-desktop.png` |
| `product-website` | 19 | 22 | 22 | 15,424 | 15,424 | `.scratch/worldsea/before-world-design-product-desktop.png` | `.scratch/worldsea/after-world-design-product-desktop.png` |
| `generated-assets` | 3 | 22 | 22 | 15,424 | 15,424 | `.scratch/worldsea/before-world-design-generated-assets-desktop.png` | `.scratch/worldsea/after-world-design-generated-assets-desktop.png` |

对应的 JSON 证据是：

- `.scratch/worldsea/before-world-foundations-desktop.json` 与 `.scratch/worldsea/after-world-foundations-desktop.json`
- `.scratch/worldsea/before-world-product-desktop.json` 与 `.scratch/worldsea/after-world-product-desktop.json`
- `.scratch/worldsea/before-world-generated-assets-desktop.json` 与 `.scratch/worldsea/after-world-generated-assets-desktop.json`

三组截图都做过目视复核。before 的问题是 53 个岛屿被压成画面中间的一条很薄的横向标本带，天空和海面负空间过多，3/19/41 课时的体量差也不明显。after 中岛群成为主体，水平和垂直边界都仍在画面内；41 课时岛屿在对应样例中成为清晰的主岛，3 课时岛屿仍可点击辨认，没有通过裁掉外圈或让邻岛融合来换取占屏率。

网格本身的几何预算也没有增加：`foundations` / `product` 仍为 1,113 cells、20,034 terrain triangles，`generated-assets` 为 1,111 cells、19,998 terrain triangles；props 分别为 107、108、107。

## Mobile sanity check

用 390×844 viewport 完成了三组 after 截图并目视检查，确认窄屏下主岛与外圈仍可读、没有明显裁切或融合：

- `.scratch/worldsea/after-mobile-world-design-foundations-mobile.png`
- `.scratch/worldsea/after-mobile-world-design-product-mobile.png`
- `.scratch/worldsea/after-mobile-world-design-generated-assets-mobile.png`

这次没有捕获对应的 mobile before，所以不把移动端写成回归预算对照；mobile hook 读数为 24 calls / 16,836 triangles，只作为响应式可见性 sanity check。正式预算结论使用上表同一 desktop harness 的 before/after 对照。

## Scale interval 与理由

比例不是按任务书硬编码，而是从 53 门真实课程的课时分布和生成后的轮廓测出来的：

- 3 课时目标 half-width：约 `2.797`
- 12 课时（目录 median）目标 half-width：约 `4.495`
- 19 课时目标 half-width：约 `5.372`
- 41 课时目标 half-width：约 `7.375`

回归测试把实际目录的 median footprint 作为尺子：最短的 3 课时尾部不得小于 median 的 `0.60×`，最长的 41 课时 outlier 不得超过 `1.75×`；同时要求 19 课时大于 3 课时的 `1.5×`、41 课时大于 3 课时的 `2×`。这组区间的目的分别是：保住最短课程的可点性、限制最长课程对目录场的支配，以及让中长课的学习量差异在第一眼就成立。长课在固定 desktop 取景中还被限制在水平画面 half-width 的 `22%` 以内，避免它变成 frame-filling blob。

## 验证结果

- `pnpm --filter @pieai/university-world test`：48 个测试文件、312 个测试通过。
- `pnpm verify`：通过 typecheck、lint、format、全量测试、边界/画布检查、双模式 build、内容检查和文档治理检查。
- 设计截图使用真实浏览器渲染，且对 desktop before/after 与 mobile after 做了目视检查。

## 未完成或不确定

- 没有 mobile before，因此移动端只能确认当前 after 状态，不能声称移动端的 before/after 性能回归结论。
- 没有覆盖真实手机 GPU、长时间拖拽和真实用户点击研究；当前证据是固定设计取景、真实目录数据和确定性几何测试。
- capture 中 `shadowMap` 仍显示为全局 renderer baseline 的 `true`；本次没有为了地图局部显示去改共享 renderer 或天气管线，因为 desktop 每帧预算已经保持不变。
