# AK1 · `@pieai/swimmer-avatar-kit@0.1.0` vs `packages/avatar`

对照评估，不是迁移。两边并立：`#/avatar-lab` 仍走 `@pieai/university-avatar`；`#/avatar-compare` 把同一粒种子同时交给两套实现。`packages/avatar/src/` 未改。

取证日期：2026-08-22。本机 `:9998` 被主仓 University 的 Vite 占用，对照页跑在本 worktree 的 `http://127.0.0.1:18080`。

---

## 1. Functional

公共面一共十个符号。三种结论只准写 *same* / *different name or shape* / *absent*。

| University (`packages/avatar/src/index.ts`) | Kit 0.1.0 | 结论 |
| --- | --- | --- |
| `Avatar` | `@pieai/swimmer-avatar-kit/react-three-fiber` 的 `Avatar` | **different name or shape** |
| `fillRecipe` | `fillRecipe`（别名 `completeRecipe`） | **same**（kit 多一层 `assertAvatarRecipe`） |
| `PALETTES` | `PALETTES` | **different name or shape** |
| `PARTS` | `PARTS` | **same** |
| `randomRecipe` | `randomRecipe`（别名 `createAvatarRecipe`） | **different name or shape** |
| `rerollPart` | `rerollPart` | **different name or shape** |
| `SPECIES` | `SPECIES` | **same** |
| `type AvatarRecipe` | `type AvatarRecipe` | **same**（结构一致；kit 的 `params` 允许 `null`） |
| `dressScene` | 无公开导出（vendor 里仍有同名函数） | **absent** |
| `PALETTE_SWATCHES` | 无此名；数据就是 kit 的 `PALETTES` | **different name or shape** |

签名对照（只列不相同的）：

```ts
// Avatar — ours
function Avatar(props: {
  recipe: AvatarRecipe;
  gaze?: boolean;
  scale?: number;
  position?: [number, number, number];
  onBuilt?: (stats: { meshes: number; verts: number; buildMs: number }) => void;
}): JSX.Element;

// Avatar — kit  (@pieai/swimmer-avatar-kit/react-three-fiber)
const Avatar: ForwardRefExoticComponent<
  Omit<ThreeElements["group"], "children" | "ref"> & {
    recipe: AvatarRecipe;
    gaze?: boolean;
    materialLibrary?: AvatarMaterialLibrary;
    onBuilt?: (avatar: AvatarHandle) => void;
  } & RefAttributes<AvatarHandle>
>;
```

```ts
// PALETTES — ours: { id, label }[]
// PALETTES — kit:  { id, label, colors: readonly string[] }[]
// PALETTE_SWATCHES — ours: { id, label, colors }[]  === kit PALETTES
```

```ts
// randomRecipe — ours: (seed?: string) => AvatarRecipe
// randomRecipe — kit:  (seed?: number | string) => AvatarRecipe
```

```ts
// rerollPart — 两边 (recipe, partId) => AvatarRecipe
// ours: 未知 partId 是 no-op（rerollGPart 找不到 slot 就 return）
// kit:  未知 partId 抛 RangeError("Unknown avatar part")
```

配方 JSON：两边 `randomRecipe(seed)` 对字符串种子一致，含取证六粒。`pnpm --filter @pieai/university-online exec vitest run src/avatar-compare/recipe-parity.test.ts` — 7 tests passed。

Vendor：Kindergrimm `811214c6dd5de18cc20335cd3d4ab0a06e45ffd4`。`packages/avatar/src/gloss/*.js` 与 kit `vendor/kindergrimm/src/gloss/*.js` **逐文件 SHA-1 相同**，University 多出的只有 `gloss.js` 和 `gcrowd.js`（kit `UPSTREAM.md` 故意排除的 lab 入口）。

### Kit 有、我们还用不上的导出

`@pieai/swimmer-avatar-kit`：`buildAvatar`、`assertAvatarRecipe`、`AVATAR_RECIPE_SCHEMA`、`AVATAR_RECIPE_VERSION`、`cloneAvatarRecipe`、`completeRecipe`、`createAvatarRecipe`、`createAvatarRecipeDocument`、`deserializeAvatarRecipe`、`EXPRESSIONS`、`parseAvatarRecipeDocument`、`serializeAvatarRecipe`，以及 `AvatarHandle` / `AvatarBuildStats` / `AvatarRecipeDocument` 等类型。

`@pieai/swimmer-avatar-kit/materials`：`FINISHES`、`createGlossMaterialLibrary`、`createStudioMaterialLibrary`、`acquireStudioMaterialLibrary`。

R3F 适配器上多出来的：`materialLibrary` 注入、`forwardRef<AvatarHandle>`、表达式 get/set。

这些是产品以后要持久化配方、多角色共享材质、或离开 React 时才会用到的面。AvatarLab 今天一个都没碰。

Walk/run：两边公开 API 都没有。Kit SPEC-0001 写明非目标。University 的 GLOSS 生成器也不是可动骨骼。按任务要求：**不删、不搬、不当死代码。**

---

## 2. Visual

命令：

```bash
pnpm --filter @pieai/university-online exec vite --host 127.0.0.1 --port 18080 --strictPort
ORIGIN=http://127.0.0.1:18080 node apps/online/src/avatar-compare/capture-evidence.mjs
```

同一粒种子、同一相机 `[0.55, 1.2, 3.5] fov 30`、同一 `dressScene`、画布 624×838、`dpr=1`、`gaze=0`、`orbit=0`。左边 ours，右边 kit。像素差：通道绝对值 > 2 计为 changed。原始数字在 `apps/online/src/avatar-compare/evidence/measurements.json`。

| 物种 | 种子 | 配方 JSON | 顶点 | changed | maxΔ | RMSE | 画面 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| bear | `ak1-bear` | 一致 | 45,566 = 45,566 | 0.069% | 33 | 0.251 | **相同角色** |
| bunny | `ak1-bunny` | 一致 | 337,135 = 337,135 | 0.241% | 90 | 0.617 | **相同角色** |
| cat | `ak1-cat` | 一致 | 63,934 = 63,934 | 0.281% | 73 | 0.730 | **相同角色** |
| robot | `ak1-robot` | 一致 | 190,210 = 190,210 | 0.610% | 85 | 1.106 | **相同角色** |
| slime | `ak1-slime` | 一致 | 195,554 = 195,554 | 0.048% | 42 | 0.226 | **相同角色** |
| humanoid | `ak1-humanoid` | 一致 | 42,644 = 42,644 | 0.078% | 50 | 0.562 | **相同角色** |

六张并排图上看不出部位、色盘或耳朵不同。残差全部落在轮廓 1px 锯齿、高光和呼吸相位（两边 `useFrame` 各自累加 `sin(t * 1.8) * 0.007`，两个 WebGL 上下文不可能锁在同一微秒）。robot 的 diff 图是灰底上的红描边，不是第二套网格。

截图路径（每种四张：ours / kit / diff / pair）：

- `apps/online/src/avatar-compare/evidence/bear-ak1-bear-{ours,kit,diff,pair}.png`
- `apps/online/src/avatar-compare/evidence/bunny-ak1-bunny-{ours,kit,diff,pair}.png`
- `apps/online/src/avatar-compare/evidence/cat-ak1-cat-{ours,kit,diff,pair}.png`
- `apps/online/src/avatar-compare/evidence/robot-ak1-robot-{ours,kit,diff,pair}.png`
- `apps/online/src/avatar-compare/evidence/slime-ak1-slime-{ours,kit,diff,pair}.png`
- `apps/online/src/avatar-compare/evidence/humanoid-ak1-humanoid-{ours,kit,diff,pair}.png`

猫种有一张作废的中间结果：headed Chrome 开着 OrbitControls 时 kit 画布被转了 90°，changed 一度报到 53%。那是相机，不是生成器。`orbit=0` 之后猫种回到 0.281%。以 `orbit=0` 的六张 pair 为准。

---

## 3. Performance

测量与 AvatarLab 读数同源：`buildGloss` 写入的 `stats.verts` / `stats.buildMs`（`performance.now()` 包住一次几何构建）。原数字「113,335 顶点、41ms」是某一次未钉死的随机配方，不是常数；本轮用同一方法在两边重测。

双画布同屏（kit 后挂载，GPU 已热）：

| 物种 | ours 顶点 | kit 顶点 | ours 首建 | kit 首建 | meshes |
| --- | ---: | ---: | ---: | ---: | ---: |
| bear | 45,566 | 45,566 | 19ms | 14ms | 8 |
| bunny | 337,135 | 337,135 | 77ms | 53ms | 17 |
| cat | 63,934 | 63,934 | 23ms | 15ms | 19 |
| robot | 190,210 | 190,210 | 49ms | 33ms | 15 |
| slime | 195,554 | 195,554 | 42ms | 30ms | 9 |
| humanoid | 42,644 | 42,644 | 24ms | 19ms | 16 |

单独画布、同一配方 `ak1-bear` → 数值种子 `3033764913`（关掉 vsync：`--disable-gpu-vsync --disable-frame-rate-limit`）：

| | 顶点 | 首建 | 稳态帧间隔中位（30 热身 + 120 帧 `useFrame` dt） |
| --- | ---: | ---: | ---: |
| ours | 45,566 | 17ms | 0.2ms |
| kit | 45,566 | 18ms | 0.1ms |

顶点两边锁死相同。首建在单独测量里 17ms vs 18ms，没有稳定谁快。有 vsync 时两边都被 16.7ms 卡住，分不出 GPU 成本。关掉 vsync 后两边都 < 1ms，也分不出。

原 113,335 / 41ms 落在本轮集合的 cat（63,934）和 robot（190,210）之间；bunny 的 337,135 / 77ms 是头发把预算抬上去的。方法复现了，那个具体配方没有钉到。

命令：同上 `capture-evidence.mjs`（读 `measurements.json` 的 `presets[].ours|kit` 与 `solo`）。

---

## 4. Build

| 检查 | online | local |
| --- | --- | --- |
| typecheck | pass · `pnpm --filter @pieai/university-online typecheck` | pass · `pnpm --filter @pieai/university-local typecheck` |
| lint | pass · `pnpm --filter @pieai/university-online lint` | pass · `pnpm --filter @pieai/university-local lint` |
| test | pass · 5 files / 32 tests · `pnpm --filter @pieai/university-online test` | pass · 42 files / 441 tests · `pnpm --filter @pieai/university-local test` |
| build | pass · `pnpm --filter @pieai/university-online build` | pass · `pnpm --filter @pieai/university-local build` |

online 的 catalog 测试需要磁盘上的 `apps/online/content/`（gitignore）。本 worktree 跑过一次 `pnpm --filter @pieai/university-online content`；跟踪的 `imported.json` / `lexicon.json` 已还原，不进 diff。

安装副作用：0.1.0 当天发布，`pnpm add` 自动在 `pnpm-workspace.yaml` 的 `minimumReleaseAgeExclude` 加了一行 `@pieai/swimmer-avatar-kit@0.1.0`。没有这一行，同日包过不了 lockfile 的最短发布龄。

### Bundle（`pnpm --filter @pieai/university-online build`）

对照前后各打一次包。Before = stash 掉对照路由源码、package.json 仍声明 kit（Vite 不打未引用依赖）。After = 当前对照路由。

| 资产 | before | after | Δ |
| --- | ---: | ---: | ---: |
| `index-*.js` 主包 | 2,403.97 kB / 803.55 kB gz | 2,404.41 kB / 803.66 kB gz | **+0.44 kB / +0.11 kB gz** |
| `index-*.css` | 128.75 kB / 20.39 kB gz | 130.63 kB / 20.56 kB gz | **+1.88 kB / +0.17 kB gz**（对照页样式写在同一份 `styles.css`） |
| `AvatarLab-*.js` | 86.36 kB / 31.78 kB gz | 3.41 kB / 1.61 kB gz | 生成器被抽到共享 chunk |
| 共享 ours 生成器 | （含在 AvatarLab） | `src-elZdQei3.js` 83.23 kB / 30.46 kB gz | 访问 lab 或 compare 都加载 |
| `AvatarCompare-*.js`（kit + 对照 UI） | 无 | 75.50 kB / 28.70 kB gz | **仅 `#/avatar-compare` 下载** |
| `react-three-fiber.esm-*.js` | 924.23 kB / 251.46 kB gz | 924.36 kB / 251.49 kB gz | ~0 |

主包几乎不动。并立期的代价是一份懒加载的 kit（28.70 kB gz）加上 CSS +1.88 kB。真正迁过去、删掉 `packages/avatar` 之后，lab 会改吃 kit chunk，不会两份生成器常驻。

local 不引用 avatar kit，构建与线上对照无关。

---

## 5. Three-bucket classification

### Kit already covers it

- `Avatar`（换入口 `@pieai/swimmer-avatar-kit/react-three-fiber`；`onBuilt` 改读 `handle.stats`）
- `fillRecipe` / `completeRecipe`
- `randomRecipe`（kit 还接受 number seed，是超集）
- `rerollPart`（AvatarLab 只把 `PARTS` 里的 id 传进去，抛错路径走不到）
- `SPECIES`、`PARTS`
- `PALETTES` / `PALETTE_SWATCHES`（用 kit `PALETTES.colors`）
- `AvatarRecipe`
- 材质库、配方信封、表达式、`buildAvatar`：今天 AvatarLab 不用，将来用 kit 的，不要在 University 再写一套

### University-specific

- `apps/online/src/avatar-lab/AvatarLab.tsx`：工坊 HUD、种子输入、物种/色盘按钮。这是产品壳，不是生成器。
- `#/avatar-compare` 及其取证脚本：本次评估用，不是产品面。
- `packages/avatar/src/gloss/gloss.js`、`gcrowd.js`：Kindergrimm 的 lab 入口，kit 有意不进包。University 抄进来了但没有公开导出。**留着，不当死代码，不往 kit 送。**

### Generic gap — 不要在这里补，先改 kit

**1. 导出 `dressScene`（或同职责的 studio 布置函数）。**

AvatarLab 和对照页都靠它设 ACES、主光、半球光、阴影地面、奶油背景。Kit 的 R3F `Avatar` 只租材质库（内部 `studioEnv`），不布置场景。没有这一层，迁过去的 lab 会丢掉现在的灯光和地面，角色还在、工作室没了。

建议 API（与现有声明对齐）：

```ts
// @pieai/swimmer-avatar-kit/materials
export function dressScene(
  scene: Scene,
  renderer: WebGLRenderer,
  options?: {
    span?: number;
    pool?: number;
    shadows?: boolean | "wall";
    wallZ?: number;
  },
): { key: unknown; floor: unknown; wall?: unknown };
```

参考实现：`packages/avatar/src/gloss/gmedia.js` 的 `dressScene`（与 kit vendor 字节相同）。测试：对一个空 `Scene` 调用后，`scene.background` 有值、存在 DirectionalLight、`renderer.toneMapping === ACESFilmicToneMapping`。发布新 minor 后 University 再升。

**2. Walk/run（已知，0.1.0 不做）。**

不要在 University 补，不要从这里提 PR。等 kit 自己的 rig/retargeting spike。

其余 API 差（`onBuilt` 形状、`randomRecipe` 接受 number、未知 part 抛错）都是 kit 更严或更宽，迁的时候改调用点即可，不必先扩 kit。

---

## 6. Recommendation

**migrate after 1 kit change**：把 `dressScene` 从 `@pieai/swimmer-avatar-kit/materials` 公开出去，发一个新版本，然后把 AvatarLab 的 import 从 `@pieai/university-avatar` 换成 kit。决定这一句的测量是：六种物种、同一种子，配方 JSON 一致、顶点一致、pair 截图像素差 < 1% 且 diff 只落在描边/高光——生成器已经是同一份艺术，剩下挡住整迁的是场景布置不在公开 API 上，不是耳朵不一样。Walk/run 继续留在现在的位置，不参与这一步。
