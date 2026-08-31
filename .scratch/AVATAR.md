# Avatar 交付报告

日期：2026-08-31
分支：`work/avatar`
任务台账：`4dff6b1c1f6e`

## 结果

头像现在是世界中的玩家位置，而不是左栏装饰：

1. 星球 / 所有课程：兔子站在既有云海的一个既有 puff 上；未选中时跟随原有云海漂移，选中系列后云和兔子一起飞到该系列正上方。
2. 岛群：初始仍在云上漂移；点课程后云载兔子飞到对应岛，落点打开课程卡，进入课程不等待动画结束。
3. 岛内：初始落在当前进度的 lesson 格子，而不是强行第一格；点 lesson 后兔子用既有 hop 弧线跳到该格。完成 lesson 再回到课程岛，位置仍是刚完成的格子，位置本身编码进度。

## 复用与新增

复用的既有部件：

- `packages/world/src/avatar/hop.ts` 的 `hopPose`、`HOP_DURATION_MS` 和现有“从当前坐标改向、不回退”语义。
- `packages/world/src/avatar/PlayerMarker.tsx` 的真实 SwimmerAvatarKit 兔子；没有再写呼吸、眨眼、注视或第二套 avatar 动画。
- `packages/world/src/Maps.tsx` 的 `LearnerMarker` 帧循环与 `CourseScene` / `WorldScene`；原来的 compact 八面体分支已替换为同一个 `PlayerMarker`。
- `packages/world/src/sky/cloud-sea.tsx` 的既有布局、漂移、几何、材质与两个 instanced batches。

真正新增的内容很小：

- `cloud-carrier-contract.ts` 只有载体脚部偏移 `1.55` 和目标类型。
- `CuteCloudSea` 把最后一个已有 puff 作为 carrier slot：每帧只重写这 6 个已有上 lobes 加 1 个已有 underbelly 的矩阵，使用共享 `Object3D` scratch；不创建新的 mesh、geometry、material、batch、render pass 或插值器。
- App 状态把选中的 course / lesson 目标传到三层；`FAST_TRAVEL_UPPER_BOUND_MS = 540` 是在既有 `420ms` hop 上新增的可判定预算常量。
- 新增 headed Chrome e2e、云布局单测、hop 预算单测和开发期 motion receipt；没有新增生产状态机。

设计 artifact `a1621950-247a-4e15-b3f8-dc573528714b` 在本 worktree 和可用本地 artifact 数据中没有可读副本；本次实现按任务书和当前 V5 规则落地，没有假称读取到不可用内容。

## “非常快”的判定

`HOP_DURATION_MS` 保持 `420ms` 不变；本任务把上界定义为：

```text
FAST_TRAVEL_UPPER_BOUND_MS = 420ms + 120ms = 540ms
```

`120ms` 是约 8 个 60Hz 可见帧的调度余量。它仍短于用户阅读课程卡标题和 CTA 的时间，因此云 / 兔子飞行可以和课程卡阅读重叠；进入课程也不等待 hop。`e2e/G.avatar.spec.ts` 用真实可见 headed Chrome 的 `performance.now()` 等待 motion sequence 进入并退出 `inFlight`，并对星球、岛群、岛内三次真实鼠标点击分别执行 `<=540ms` 断言。第二条 e2e 守住完成第一节后回岛位置不变。

测试同时保留了从按下前到落地的诊断值；它包含首次 WebGL 编译、页面布局和点击流程，不作为动画预算：星球 `1116.6ms`、岛群 `610.8ms`、岛内 `544.5ms`。真正的动画 receipt 从真实点击结束后开始，断言的是 `hop` 的落点，不把首次加载成本误报成动画速度。

## 开销测量

测量条件：Apple Silicon 本机、headed Chrome、viewport `1440×900`；帧时间在可见浏览器页内用 `requestAnimationFrame` 采 60 个样本，截图没有复用这次运行。`canvasDataUrlLength > 1000` 且 `visibilityState = visible` 用来确认确实画到了真实画布。

| 范围 | 改前 renderer（calls / triangles） | 改后 renderer（calls / triangles） | 解释 |
| --- | ---: | ---: | --- |
| 星球（旧截图基线 → e2e） | `9 / 26,690` | `29 / 42,110` | 现在实际显示 mandated 的 `PlayerMarker`；不是新增 cloud pass。 |
| 岛群 | `33 / 62,241` | `33 / 62,241` | 完全不增。 |
| 岛内（同一 1280×633 视觉采样） | `16 / 15,657` | `41 / 22,521` | compact beacon 被真实 `PlayerMarker` 替换；增量是头像本体，不是额外 cloud batch / pass。 |
| cloud sea（桌面） | `2` instanced batches；9 puffs = 54 upper + 9 underbelly | 同上 | 只移动已有 carrier slot；draw batches 增量 `0`。 |

整场景的星球 / 岛内数字上升，是任务明确要求把“无头像 / compact 八面体”换成真正的 `PlayerMarker`，这里把增量如实量出；云载体本身没有新增 draw call 或 pass，岛群整场景 renderer 也保持 `33 / 62,241`。没有改 `island-geometry.ts` 或 `labels/`。

真实可见 headed e2e 的帧时间与画布证据：

| 层 | 60 帧 median / p95 / max | canvas | 画布证据 |
| --- | ---: | ---: | ---: |
| 星球 | `16.6 / 18.4 / 18.5ms` | `300×150`, data URL `2118` | visible |
| 岛群 | `16.7 / 17.8 / 18.1ms` | `1440×900`, data URL `921,186` | visible |
| 岛内 | `16.7 / 18.4 / 18.6ms` | `1440×900`, data URL `553,126` | visible |

这些帧时间没有隐藏标签页节流；三层都低于 60Hz 的 `16.67ms` 平均预算附近，p95 仍约 `18ms`，没有出现持续性掉帧。

## 三层视觉证据

截图来自另一轮独立的可见浏览器视觉 pass，与上面的帧时间采样分开：

- [星球：Buzz 选中后云载兔子到系列上方](./evidence-avatar/screenshot-1788188054099.png)
- [岛群：课程卡打开，云和兔子在对应岛上方](./evidence-avatar/screenshot-1788188075924.png)
- [岛内：真实兔子位于 lesson 格子，已无八面体 beacon](./evidence-avatar/screenshot-1788188092717.png)

## 验证与约束

- `pnpm verify`：完整链路通过；应用 `49` 个测试文件 / `217` 个测试，world `49` 个测试文件 / `323` 个测试，typecheck、lint、format、边界、构建、shelf、content revisions、experience ledger、docs check 均通过。由于本 worktree 的预存 `apps/local/studies` symlink 形状缺少 `turing-pact/study.json`，freshness 检查使用一次性的空、已标记 `/tmp` source root，并正常以“没有 initialized studies”退出；`package.json` 已恢复，未提交绕过配置，也没有改 studies。
- headed Chrome：`e2e/G.avatar.spec.ts` 两个测试均通过；真实点击、三层落点、lesson 完成后位置保持、可见 `rAF` 帧数据和 console clean 均受守护。
- `node scripts/experience-ledger.mjs check`：`29 findings — 24 fixed, 5 open`；`4dff6b1c1f6e` 已写入两个具体 e2e guard 后才标记 fixed。
- 保留了任务开始前已有的 `apps/local/studies/README.md` symlink 变更，未 stage、未改写；没有碰 `apps/local/studies/` 内容、`packages/world/src/island/island-geometry.ts`、`packages/world/src/labels/`，没有 push 或改写 git 历史。
