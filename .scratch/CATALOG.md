# Catalog data pipeline closeout

本支按 `docs/reference/player-journey/v5/index.html` 的「决定 H」执行，只改数据管道，不改 UI。

## 四个状态的分工

`apps/local/server/recovery/course-recovery.ts`：

- `isPublishableStatus`（623-625）把 `active`、`stale` 定义为可发布；`draft` 和 `retired` 不可发布。
- `exportCourseRecovery`（999-1014）按可发布课程筛选，因此 `draft` 不出货，`active` 出货且事实为 `false`，`stale` 出货且事实为 `true`，`retired` 不出货。
- `serializeCourse`（431-448）对课程和 unit 也执行同一条可发布检查；study 没有可发布课程、默认课不可发布、`maxCourses` 都按 publishable 计数。
- recovery index entry schema（186-194）要求每条出货记录都有学习者事实。

另修了 `apps/local/server/content/repository.ts:292-302`：课程目录在 worktree 中可能是外部 checkout 的目录 symlink，枚举器现在会跟随这种合法的课程目录，否则真实 exporter 只能看见物理目录。

## 学习者事实

字段名是 `isBeingRewritten`。它是布尔学习者事实：`true` 表示“这门课正在改写”，`false` 表示没有这个标记。这个名字描述学习者要知道的事情，不泄漏作者桌面上的 `active` / `stale` 状态机。

它经过三段：

1. recovery index：`course-recovery.ts:1044-1049` 从 authoring status 生成 index record；它不进入 recovery course package。
2. import：`apps/university/scripts/import-courses.mjs:197-201` 读取 index record，并在 `353-401` 同时写入 public course 的输入、generated shelf 和 tracked import manifest。
3. delivery course JSON：`apps/university/scripts/public-course.mjs:17-29,193-205` 通过显式 DTO 白名单保留这个事实；`delivery-artifact.mjs:498-500` 校验 package 与 manifest 一致，`check-shelf.mjs:58-62` 校验 shelf 与 manifest 一致。

公开 course JSON 的 `course` 对象没有 `status`；实际导入后 44 个 course JSON 的 `isBeingRewritten` 是 16 个 `false`、28 个 `true`，递归检查没有精确的 `active` / `stale` 状态值。

## 目录恢复

只针对本次事故的 `turing-pact`：

- recovery index：3 门 → 31 门。
- 31 门中：3 门当前标准（`isBeingRewritten: false`），28 门早期版本（`true`）。
- 全量 delivery import：4 个 study、44 门课程、495 lessons。
- `apps/university/published-catalog.json` 未修改；导出前后 SHA-256 都是 `0b102e52b2e003b2d3e096c27d9192c7ab45821d005594eb074c1249c8976d1c`。
- 源课程 `id/status` 快照前后相同：44 门，16 active / 28 stale，digest `30804a9f8514f977fd3003755f2270c5090b02fa72c209d91e42d835bfde19d8`。
- `apps/local/studies/` 没有被本支纳入 staged diff，也没有被本支写入；源状态保护快照前后相同。

## 攻击测试红绿证据

- 四状态：`course-recovery.test.ts` 覆盖 active 出货、draft 不出货、stale 出货并带 `true`、retired 无可发布课程；recovery 相关测试最终 35/35 通过。
- recovery fact 丢失：`delivery-artifact.test.mjs` 删除 index entry 的 `isBeingRewritten`，验证会红；恢复为布尔值后重新验证为绿。
- public DTO 泄漏：同一测试注入 `course.status: "stale"`、递归 `referenceAnswer` 和 `file-manager:` 路径，DTO 闸门会红；删除注入后重新封装并验证为绿。
- shelf fact 丢失：`check-shelf.test.mjs` 把 shelf fact 改成 `false`，会报告 rewrite fact 不一致；恢复后通过。
- 下架闸门：retired 才会从 exporter 消失；现有 `check-published-catalog.test.mjs` 对已发布课程的删除会红并要求明确的 `--accept-removals` 记录。实际恢复后 `pnpm check:catalog` 为绿，没有掰 catalog 这把尺子。
- 曾经的全量 verify 首次在 build 后揭出了 symlink 枚举缺陷（28 门被报告为 no longer publishable）；修正枚举器后重新 build、export、verify，红转绿。

## 最终验证

以下均通过：

- `pnpm check:catalog`
- `pnpm check:export-freshness --study turing-pact`
- `pnpm check:export-freshness`
- `pnpm check:shelf`
- delivery pipeline 目标测试：16/16
- `pnpm verify`

## 仍不放心的地方

`isBeingRewritten` 已经到达 delivery course JSON，但本支没有改 `packages/ui` 的 `CourseView` 或渲染逻辑；地图/卡片上的 DOM 标记仍留给下一支，这是本 brief 明确划出的边界。生成的 `shelf.json` 仍保留既有 delivery read-model 的归一化 `status: "active"` 字段供现有 shelf shape 使用；本支保证的是公开课程 DTO 与课程 JSON 不泄漏 authoring status，并未擅自改 UI/read-model 契约。
