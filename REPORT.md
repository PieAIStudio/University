# REPORT — SPEC-0003 step 1, `packages/world`

行为保持型重构。一次只移动一个 seam：把 `apps/online/src/world/` 抽成 `@pieai/university-world`，切断场景对 delivery shell 存储的 import。没有改样式、文案、镜头、雾、标签规则。

## 搬了什么

`apps/online/src/world/` 整目录进入 `packages/world/src/`：

- 场景：`Maps.tsx` `Stage.tsx` `grade.ts` `island.ts` `kit.tsx` `kit.json` `layout.ts` `path-language.ts` `path-overlay.ts` `labels.ts`
- 测试跟着走：`labels.test.ts` `layout.test.ts` `path-language.test.ts` `path-overlay.test.ts` `overlay-click.test.tsx`（从 `../styles.css` 的 import 删了，测试本身已经内联了同一套 stack）
- 新增：`course.ts`（场景输入契约 + `courseShapeOf`）、`course.test.ts`、`index.ts`、`README.md`、显式 `exports` map（没有 `"./*"`）

`apps/online` 改为 import `@pieai/university-world/{Maps,Stage,labels,path-overlay,course}.js`。`apps/local` **没有**依赖这个包。

GLB / Basis 仍由 `apps/online/public/` 以 `/kit/`、`/basis/` 提供。场景代码读 URL，不拥有文件。

`three` / `@react-three/fiber` / `@react-three/drei` 是 peer，版本与 `apps/online/package.json` 一致。没有往 `packages/world` 里塞 `@types/three`。

## `Course` / `CourseNode` / `courseShapeOf` 去了哪

读完代码后的选择：

| 符号 | 去哪 | 为什么 |
| --- | --- | --- |
| `CourseNode` | `packages/world/src/course.ts` | SPEC-0003 说场景收「一组 course node（id、标题、课时数、先修）」。这就是那份契约。`loadGraph` 产出它；overlay 读 study 分组、depth、track，所以这些字段跟着走。`library.ts` 只 `export type { CourseNode }`，定义不在 shell。 |
| `Course`（完整，含 prose / evidence / assets） | 留在 `apps/online/src/content/library.ts` | Shell 当领域类型用：reader、catalog、settlement。`Lesson.assets` / `sections` 绑了 `packages/ui` 的 view 类型；core 已经有 on-disk 的 `CourseManifest`。放进 world 等于渲染器拥有课文；放进 core 要么 core 依赖 ui，要么再复制一份 asset 类型。 |
| `Course`（场景子集） | `packages/world/src/course.ts` | `placeCourse` 真正用到的：id、unit/lesson 标题、`content.length`、variant、exercises/cards 的个数。Delivery 的 `Course` 结构上可赋值给它。**不是**把字段表抄两份。 |
| `courseShapeOf` | `packages/world/src/course.ts` | 纯函数，不碰 store / fetch / `localStorage`。按任务要求搬进 world。测试从 `apps/online/src/progress/source.test.ts` 一起搬走。 |

没有两边各留一份 `CourseNode`。完整 `Course` 只有 library 一份。

不确定、记在这里不当 bug 修：2D catalog（`listing.ts`）现在为了这个纯函数依赖 `@pieai/university-world/course.js`。该模块不 import `three`，exports 也把路径拆开了。如果以后觉得 catalog 不该看见 world 这个名字，下一步可以把 `courseShapeOf` 再下沉到 `packages/core`——那是另一次 seam。

## 验证（真实结尾）

`pnpm -r typecheck` — exit 0

```
Scope: 6 of 7 workspace projects
packages/avatar typecheck: Done
packages/core typecheck: Done
packages/ui typecheck: Done
packages/world typecheck: Done
apps/local typecheck: Done
apps/online typecheck: Done
```

`pnpm -r lint` — exit 0

```
packages/avatar lint: Done
packages/core lint: Done
packages/ui lint: Done
packages/world lint: Done
apps/local lint: Done
apps/online lint: Done
```

`pnpm -r test` — exit 0

```
packages/core   Tests  227 passed (227)
packages/ui     (unchanged; suite passed)
packages/world  Test Files  6 passed (6) / Tests  23 passed (23)
apps/online     Test Files  7 passed (7) / Tests  31 passed (31)
apps/local      Test Files  43 passed (43) / Tests  444 passed (444)
```

`pnpm -r format:check` — exit 0，各包均为 `All matched files use the correct format.`

```
node apps/local/scripts/check-module-boundaries.mjs
module boundaries: ok

node scripts/check-kit-portability.mjs
kit portability: ok

node scripts/check-contrast.mjs
check-contrast: ok (3 trees)
```

`grep -rn "three" packages/ui/src --include='*.ts' --include='*.tsx'`

按字面跑会命中 21 行英文单词 “three”（「three-option」「the other three」），**全是搬迁前就有的注释/文案**。过滤 renderer import 之后为空：

```
(no `from "three"` / `@react-three` / `require("three")` in packages/ui/src)
```

`apps/local` 的源码和 `package.json` 都不出现 `@pieai/university-world`。

## 前后截图

Dev server：`pnpm --filter @pieai/university-online exec vite --host 127.0.0.1 --port 18082 --strictPort`

搬完后**重启过**（lockfile / workspace manifest 变了）。Chrome headless + CDP，等 `globalThis.three` 且 `scene.children.length > 2`。

| | 路径 |
| --- | --- |
| 搬前世界地图 `#/` | `SCRATCH/before-world.png` |
| 搬前路径 `#/turing-pact/foundations-before-zero` | `SCRATCH/before-course.png` |
| 搬后世界地图 | `SCRATCH/after-world.png` |
| 搬后路径 | `SCRATCH/after-course.png` |

肉眼：同一构图、同一组岛、同一条路、同一套 DOM 标签和「今天」卡。路径上的金环透明度/半径在呼吸，文件体积差约 1KB，是既有动画不是行为变化。

console（搬前 = 搬后，没有新的）：

- React DevTools 提示（info）
- `THREE.Clock: This module has been deprecated.`
- `THREE.WebGLShadowMap: PCFSoftShadowMap has been deprecated.`

没有新的 error。没有去「修」那两条 THREE 警告。

## 没做到 / 不确定 / 发现但没修

- **没做 SPEC-0003 第 2 步。** `apps/local` 仍然不依赖 `packages/world`。
- **overlay 两层、unit-strip 点不中** — current-work Next 第 1 条，原样留下。
- **首帧黑屏** — Next 第 3 条，没修。
- **THREE 弃用警告** — 搬前就有。
- **`Stage.tsx` 仍读 `import.meta.env.DEV`。** SPEC-0003 写「没有 import.meta」指的是不要用它读内容/存储。这是 Vite 的 DEV 开关，行为保持所以没动。
- **世界地图 `scene.children` 搬前 99、搬后 109。** 截图看起来一样；更像 kit GLB 在 Suspense 里多解析了几棵树，而不是布局变了。没有为了对齐数字去改场景。
- **catalog 依赖 world 的纯函数路径** — 见上。
- **worktree 里 `apps/local/studies/.gitignore` / `README.md` 显示删除** — 开工前就这样（studies 是指向主 checkout 的 symlink），不是这次动的，没有提交。
- **第一次起 18082 时 Vite 解析不了 `@pieai/university-core`，因为 `packages/core/dist` 不存在。** 先 `pnpm --filter @pieai/university-core build` 才截到搬前图。这是 current-work 已写的 trap（core 必须 emit JS），不是这次引入的。

## 提交

`work/world-package`，未 push。
