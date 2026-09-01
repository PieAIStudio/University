# Parity closeout

日期：2026-09-01
分支：`work/parity`

## 缺陷一：作者端漏掉 stale 课程

根因在 `apps/local/server/workflows/learning-overview.ts:98-108`：作者端学习者货架只判断 `course.status === "active"`，因此 `stale` 课程被丢掉。交付端对应的课程访问/货架路径在 `apps/local/server/http/content-access.ts:107-141`，也需要使用同一条可发布规则。

修复：

- 把原来 recovery 内的谓词移到 `apps/local/server/content/course-status.ts:1-8`，唯一实现 `isPublishableStatus`，只接受 `active | stale`。
- `learning-overview.ts:105-108`、`content-access.ts:116-135` 复用该谓词；`draft` / `retired` 仍不进入学习者货架，且不可通过课程正文路由进入。
- `apps/local/server/http/views.ts:134-139` 在 StudyView 上携带 `isBeingRewritten: course.status === "stale"`；authoring world graph 在 `apps/university/src/authoring/world-graph.ts:58-70` 继续把这个事实传给课程节点。

## 缺陷二：偏左选课卡钻进左侧导航

根因是 `packages/world/src/camera/controls.tsx:453-470` 以前把低于 follow card 的临时 `.hint` 也当作障碍物；高卡片因此耗尽左右候选槽，旧的 overlay fallback 在 `packages/world/src/labels/labels.ts:518-526` 又只做视口 clamp，不检查固定 chrome，最终把卡片放回岛心并落到导航栏下面。

修复：

- `controls.tsx:462-469` 只读取真正能覆盖卡片的固定/共享层，并监听 `data-aside-collapsed` 的变化。
- `labels.ts:179-220` 为 aside 卡片生成越过障碍边界的左右候选；`labels.ts:403-438` 的最终 fallback 同时检查视口和障碍物，保证没有可用侧位时也不会把卡片放进固定层。
- 保留原有“跟岛走、靠右翻边”机制，不靠隐藏卡片解决问题。

## 单测与攻击 red/green

- 作者端货架探针：`apps/local/server/http/views.test.ts:150-189` 同时写入 `active`、`stale`、`draft`、`retired`，断言只返回前两者，并断言 active/stale 的布尔事实；没有钉死“改写中”文案。攻击时把唯一谓词临时改成只接受 active，结果 `1 failed / 1 passed`，期望 `{active-course, stale-course}`、实际只有 `{active-course}`；还原后 views + learning-overview 为 `2 files, 6 passed`。
- 卡片布局探针：`packages/world/src/labels/labels.test.ts:305-325` 检查极左 320×607 卡片不与导航栏重叠且确实翻到岛的另一侧。攻击时同时撤掉 aside 边界候选和安全 fallback，结果 `1 failed, 22 passed`，失败值为 `expected card.x >= 281, received 8`；还原后 labels 为 `1 file, 23 passed`。
- 额外绿证据：authoring world graph `1 file, 2 passed`；local HTTP/recovery `2 files, 35 passed`。

## 真浏览器证据

- 用户提供的缺陷截图（1440×810）：[缺陷前截图](/Users/yuanfei/PieAI/University-wt-parity/.scratch/点一座偏左的岛-卡片出现在岛旁边-1788248478177.png)。卡片左边约 247.6，导航右边约 273，课名开头被吃掉。
- 修复后的真实 Chrome E2E 截图：[online-picked-left.png](/Users/yuanfei/PieAI/University-wt-parity/SHOTS/online-picked-left.png)。使用真实鼠标点击最左侧可见课程岛，卡片移到约 x=472..792，导航仍在 x=16..273，文字开头完整可读；同一路径 online/local targeted E2E 共 `4 passed`。

## 验收命令结果

端口 `18193`、`18194`、`18195`、`18196` 在每次启动前均为空闲。

### `pnpm verify`

完整命令退出码：`0`。

- 7 个项目 typecheck、lint、format check 全部通过。
- 全量单测通过：core `49 files / 422 tests`，local `65 / 386`，world `50 / 328`，university `50 / 225`，UI `65 / 386`。
- module boundaries、kit portability、contrast、raw colours、shared styles、i18n、canvas/review registry 全部通过。
- shelf：`4 studies, 44 courses, 495 lessons`；published catalog：`44 published course(s) still ship`。
- content revisions：`495 lessons, 44 courses`；export freshness：`4 export(s)`；fixture/optional lesson links、authoring exclusion、pro-gov/doc-gov 全部通过。

### `E2E_ONLINE_PORT=18193 E2E_LOCAL_WEB_PORT=18194 E2E_LOCAL_API_PORT=18195 E2E_GRADING_PORT=18196 pnpm e2e`

原样命令退出码：`1`，`43 passed (6.1m)`、`3 failed`。目标两条 F/G 已通过；剩余 3 条都是既有账号配置前置条件失败：M 的 desktop/phone `/me` 找不到配置后才会出现的登录表单，N3 phone 找不到密码框。失败截图显示的是产品明确规定的“云端账号还未配置”降级态；本工作树没有 `VITE_SWIMMER_BACKEND_SUPABASE_URL` / `VITE_SWIMMER_BACKEND_PUBLISHABLE_KEY`，且账号单测明确要求未配置时不渲染表单。未改测试、未改账号产品行为。

在不写入仓库的已配置形状诊断中，M/N 相关 `11 passed`；使用本机不可达占位地址会触发真实网络失败和 console-clean 探针，因此没有把它冒充成完整验收结果。要得到 brief 所写的 `46 passed`，需要真实的浏览器公开 SwimmerBackend 配置。

## 边界确认

- 未修改两条 E2E 的断言、skip 或 fixme。
- 未修改 `apps/local/studies/`、`apps/university/published-catalog.json`、`apps/local/course-proposals/`。
- 未触碰 `packages/world/src/grid/`、`sky/`、`island/`、`Maps.tsx` 或 `grid/grid-palette.ts`。
