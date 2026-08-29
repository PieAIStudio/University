# 品牌 UI 现实审计：liquid-gooey donor → SwimmerUIKit 1.11.3 → University

日期：2026-08-30  
分支：`work/donor-audit`  
本轮：**不改任何运行代码**。kit 只读，产品只读，donor 只读。

| 边 | 位置 | 钉住的状态 |
| --- | --- | --- |
| donor | `/Users/yuanfei/PieAI/_donors-individual/for_SwimmerUIKit/packages/liquid-gooey/` | commit `3862ffa345217443b63696a8c331a0664eea4b04`，包 0.2.1，MIT |
| kit | `/Users/yuanfei/PieAI/SwimmerUIKit` | `@pieai/swimmer-ui-kit` **1.11.3** |
| 产品 | 本仓库 `apps/university`、`packages/ui`、`packages/world` | 依赖 **1.11.3** |

`donors-individual.md` 是声明，不是证据。下面每条「已吸收」都指到 kit **文件和行**；声明里写了但源码对不上的，降档。

---

## 证据分层（先读这个）

| 标记 | 含义 |
| --- | --- |
| **【源码】** | 本轮对着文件行读过。行为「写了并且会走到」。 |
| **【公式推算】** | 用 kit 源码里的 pad / 面积公式，在本机用产品 CSS 尺寸算的。不是 live DOM。 |
| **【kit 已有测量，本轮未复跑】** | 来自 kit `EDGE-QUALITY.md` / `CHANGELOG` 1.11.3，本轮没有再开 Storybook 量一遍。 |
| **【本轮未开产品浏览器】** | 产品页上的 `data-liquid-filter-area` 没有实地读。宽屏是否超预算，只给公式临界值。 |

LiquidMetal / OverlayGlass **不是** 这份 donor。第三问会单独点名它们，因为「kit 能做的效果产品用了多少」不能只数 gooey。

---

## 三问的短答案

1. **donor 的东西没有全都吸收。** 主干（剪影/内容分层、goo 滤镜、Morph 形状、Move 物理、Bend、成对 Melt、contact dissolve、静态 waviness）在 kit 里都有对应实现。漏掉且**没有写进拒绝清单**的，至少有：外阴影走 CSS compositor、`blobInset` / `bridgeGrow`、item 级 `effect="move"` + `MoveTuning`、`dissolve.surface`、Melt 裁到剪影的 luminance mask、大图 `downscaleHref`。历史上 waviness / contentBlur 那种漏记，这次又出现了。

2. **吸收之后确实改过，而且改的是适配自己的 UI 和性能合同，不是换皮。** 改得好的：token 驱动、进程级面积/并发预算、idle 真的停 rAF（比 donor 还干净，donor 睡着仍 3Hz 探活）、固定 seed 的静态 waviness、按短边夹紧、位移后 0.5px 重建、1.11.3 inset 从抗锯齿 `shape` 取差并少一个 primitive、`check-warnings-survive-build.mjs`。**同时有几处比 donor 差**：最大的是外阴影仍在 SVG 里做大 blur（donor 特意拆到 GPU `drop-shadow()`，注释里写过 iPhone 3x 上 SVG 大模糊到 9fps）；产品进度条还 `overflow: hidden`，这笔滤镜面积几乎看不见。

3. **产品亲手点名的液体只有一处；间接用得不少，但用的是 kit 内置的 Move + 默认 waviness，不是 Melt / Bend / dissolve。** 直接 `<LiquidGroup>` 只有选择题答对。`GameProgress` / `GameSegmentedControl` 在 kit 内部已经铺了液体，产品每放一根进度条、一组分段控件就在用。Melt、Bend、dissolve、`LiquidMetalButton`、`OverlayGlass` 组件，产品调用点为零。

---

## 第一部分：kit 对 donor 的覆盖率

能力 = 可观察的东西：组/项 prop、options 每个字段、导出 helper、每种 effect、README/demo 里演示但没做成 prop 的行为。

判定只有三种。**「已吸收」必须是行为在跑，不能只是同名 prop。** 接受了参数、某些路径上不起作用，算没吸收。

### 1.1 组级 `<Liquid>` / kit `<LiquidGroup>`

| # | 能力 | 判定 | 证据 |
| --- | --- | --- | --- |
| G1 | `blur` 默认 6 | 已吸收 | donor `Gooey.tsx:21,48`；kit `LiquidGroup.tsx:77,252` → `liquidGooeyFilter.tsx:193` |
| G2 | `contrast` 默认 18 | 已吸收 | donor `Gooey.tsx:22,49`；kit `LiquidGroup.tsx:79,253` → Filter `194–199`。intercept 公式两边都是 `0.5 - contrast*(5/12)` |
| G3 | `fill` | 已吸收（默认改了） | donor 默认 `'#fff'`（`Gooey.tsx:50`）；kit 默认 `var(--game-ui-surface, …)`（`LiquidGroup.tsx:254`） |
| G4 | `shadow`，含 inset，画在**合并后**的剪影上 | 已吸收形状，**没吸收架构** | 两边都能 parse `box-shadow`。donor 把无 spread 的外阴影拆到 SVG 元素的 CSS `drop-shadow()`（`Gooey.tsx:105–130,123–130`）；kit 全部进 SVG `ShadowPass`（`liquidGooeyFilter.tsx:98–147`）。见 M1 |
| G5 | `filterPadding` 默认 24 | 已吸收 | donor `Gooey.tsx:30,51`；kit `LiquidGroup.tsx:83,255` |
| G6 | `waviness` | 已吸收（默认与夹紧是 kit 改的） | donor 默认 **0**（`Gooey.tsx:52`）；kit token 默认 **6**（`theme.css:309`，Filter 默认 `23–26`），再按短边 30% 夹紧（`liquidGooeyWaviness.ts:6–34`） |
| G7 | `wavinessFreq` 默认 0.018 | 已吸收 | donor `Gooey.tsx:36,53`；kit `LiquidGroup.tsx:91` + token `theme.css:310` |
| G8 | 标准 div 其余 props | 已吸收 | 两边都 `...rest` 落到外层 div |
| G9 | 组级 `stroke` | kit 独有（donor 组 API 无此 prop） | `LiquidGroup.tsx:87,257`；CHANGELOG 1.9.0 |
| G10 | `wavinessClamp` | kit 独有 | `LiquidGroup.tsx:96,294–303` |
| G11 | `motion="auto\|follow\|reduced"` | kit 独有入口（Move 的组级映射） | `LiquidGroup.tsx:101,261,407` |

### 1.2 项级 `<Liquid.Item>` / kit `<LiquidGroup.Item>`

| # | 能力 | 判定 | 证据 |
| --- | --- | --- | --- |
| I1 | `effect="morph"`（默认） | 已吸收 | donor `LiquidItem.tsx:20,83`；kit `LiquidGroup.tsx:123`。省略时 kit 还把 `morph ?? {}` 送进 engine（`525–533`），形状默认 token-on |
| I2 | `effect="move"` **写在 item 上** | **没吸收，也没记录** | donor `LiquidItem.tsx:238–246` 把 item 映射到 `GooeyItem observe effect="move"`。kit 引擎的 effect 类型只有 `'morph' \| 'bend'`（`liquidGooeyEngine.ts:43`）。`LiquidGroup.tsx:523`：`engineEffect = effect === 'morph' \|\| effect === 'bend' ? effect : undefined`。item 上 `"move"` **打不开 Move 物理**；Move 只看组 `motion="follow"`。类型里仍写着 `'move'`，是同名死 prop |
| I3 | `move?: MoveTuning`（springiness / wobble / stretch / trail / advanced） | **没吸收，也没记录** | donor `LiquidItem.tsx:67–79,86`。kit `LiquidItemProps`（`LiquidGroup.tsx:105–134`）**没有 `move` 字段**。物理只从 `--game-ui-liquid-gooey-move-*` 读（`liquidGooeyMove.ts:197–`） |
| I4 | `effect="melt"` + `melt` knobs | 已吸收（API 在，产品零调用） | donor `LiquidItem.tsx:225–227`；kit `LiquidGroup.tsx:636–656` → `liquidGooeyImageMelt.tsx`。**melt 项上的 `x/y/scale/morph/bend/observe/dissolve` 被剥掉，不生效**（`186–207,519`）——这是架构分流，不是漏记 |
| I5 | `effect="bend"` + `bend.vertical/horizontal` | 已吸收 | donor `LiquidItem.tsx:28–35,229–231`；kit `123,127` + `liquidGooeyMove.ts:37–42` + engine `writeBendVars` `612–620` 发 `--lg-bend-x/y/xn/yn` |
| I6 | `BendTuning.advanced?: MoveOptions` | **没吸收，也没记录** | donor `LiquidItem.tsx:34,192–200`。kit `BendTuning` 只有 vertical/horizontal |
| I7 | `morph.shape/speed/bounce/contentBlur` | 已吸收（默认反了） | donor shape **默认 false**（`LiquidItem.tsx:43`）；kit `resolveMorphShape` 读 token，缺省 **1 → true**（`liquidGooeyEvolve.ts:213–216`，`theme.css:249`） |
| I8 | `morph.advanced.evolve` | 已吸收 | kit `MorphTuning.advanced?: Partial<EvolveOptions>`（`liquidGooeyEvolve.ts:65`），合并在 `209` |
| I9 | `morph.advanced.blobInset` | **没吸收，也没记录** | donor `LiquidItem.tsx:56–61`。kit 源码 **零处** `blobInset` |
| I10 | `morph.advanced.bridgeGrow` | **没吸收，也没记录** | donor 同上。kit 零处 `bridgeGrow` |
| I11 | `dissolve`：`true` / `0..1` / `DissolveOptions` | 已吸收，缺一个字段 | 见 D 表。`effect="move"` 上忽略 + 警告，两边一致；kit 警告仍可能被 DEV 折死，见 M12 |
| I12 | `x` `y` `scale` `transition` `delay` | 已吸收 | donor `LiquidItem.tsx:103–109`；kit `113–119`。弹簧预设 `snappy/smooth/bouncy` 数值两边相同（`spring.ts` / `liquidGooeySpring.ts:18–22`） |
| I13 | `observe` | 已吸收 | donor `110–113`；kit `129`。Bend 强制 observe（`535`） |
| I14 | `radius` number 或四角 | 已吸收 | 两边 `measureRadius` 连百分比半径都抄了同一段（donor `geometry.ts:26–38`，kit `liquidGooeyGeometry.ts:24–36`） |
| I15 | 内部 `GooeyItem.effect` 可数组组合 morph/evolve/move | 未进公开 API | donor 内部 `GooeyItem.tsx:83–92`。公开 `Liquid.Item` 已是单 effect。不记作漏吸收 |

### 1.3 Morph / Evolve 原始字段

donor `EvolveOptions`（`observer.ts:97–146`）与 kit（`liquidGooeyEvolve.ts:15–53`）字段一一对应，默认值相同：`massStiffness 320 / massDamping 17 / sizeStiffness 170 / sizeDamping 11.5 / radiusStiffness 900 / radiusDamping 60 / contentBlur 7 / roundness 1 / cornerDuration 460 / cornerDelay 0 / cornerEase cubic-bezier(0.3, 1.05, 0.4, 1) / anticipation 90 / travel 32`。

| # | 能力 | 判定 |
| --- | --- | --- |
| E1 | 质量中心 → 尺寸 → 圆角时间线 | 已吸收 `liquidGooeyEvolve.ts` + engine `paintEvolveEntry:792–823` |
| E2 | 运动中 `contentBlur` 写到内容 DOM 的 `filter: blur()` | 已吸收 engine `589–601`。dissolve 默认路径会关掉 morph，避免字糊（CHANGELOG 1.11.0；`LiquidGroup.tsx:527–528`） |
| E3 | 默认 shape off | **没按 donor 默认吸收**：kit token-on。这是有意的品牌默认，CHANGELOG 1.11.0 写了，不算漏记 |

### 1.4 Move 原始字段

donor `MoveOptions`（`observer.ts:182–219`）：`stiffness 380 / damping 18 / stretch 0.18 / tail 0.46 / force 0.5 / bend 0 / bendX 0`。

kit `MOVE_DEFAULTS`（`liquidGooeyMove.ts:29–35`）前五项相同；`bend/bendX` 不在 Move 里，而在独立 Bend。

| # | 能力 | 判定 |
| --- | --- | --- |
| V1 | 中心弹簧 + 速度拉伸 + 尾滴（主 + 两颗中滴） | 已吸收，**入口改名**为组 `motion="follow"`。`GameDisplay.tsx:98–102`、`GameSurfaces.tsx:253–257` 是仅有的生产用法 |
| V2 | 公开 0..1 knobs（springiness 0.5 → stiffness 380 那条指数曲线） | **没吸收成 item API**。token 直接是引擎值，不是 donor 公开 knobs |
| V3 | Move 上再开 `bend`/`bendX`（donor 默认为 0，可经 `advanced` 打开） | **没吸收**：kit 不能给 follow 指示器同时加 Bend |

### 1.5 Melt knobs

donor `ImageMeltOptions`（`imageMelt.tsx:15–48`）与 kit（`liquidGooeyImageMelt.tsx:39–70`）字段和默认完全一致：`blur 7 / contrast 40 / reach 0.8 / fade 17 / warp 0 / mix 1 / mixBlur 8 / gravity 1.9 / waviness 12`。

| # | 能力 | 判定 |
| --- | --- | --- |
| ME1 | 成对（组内前两张 melt 图）+ 接缝溶解 + 大理石 | 已吸收 `liquidGooeyImageMelt.tsx` MeltPair |
| ME2 | 熔融层用剪影 `<use>` 做 luminance mask，避免糊出液边 | **没吸收，也没记录** | donor `Gooey.tsx:186–227`。kit 熔融 SVG `z-index:1`，内容 `z-index:2`（`styles.css:3539–3544`），**没有** 剪影 mask |
| ME3 | 大图 canvas 降采样 `downscaleHref`（显示尺寸 ×3） | **没吸收，也没记录** | donor `observer.ts:519–548`。kit 液体模块零处 `toDataURL` / `downscale` |

### 1.6 Dissolve knobs

donor `DissolveOptions`（`GooeyItem.tsx:27–81`）。kit `liquidGooeyImageMelt.tsx:72–153`。

| 字段 | donor 默认（mapDissolve / BlendConfig） | kit | 判定 |
| --- | --- | --- | --- |
| blur / warp / pull / range / zone / mix / gravity / taper / warpFreq / flowSpeed / warpStyle / detail / active / releaseMs / fadeMs / strength / sink / seamBlur | 公开 `true` 映射到 8 / 26 / — / 49 / 18 / 0.7 / 60 / 1 / 1.7 / 22 / fractalNoise / 2 / true / 110 / 110 / 1 / 0.8 / 1.6×blur | 同套 token 默认 | 已吸收 |
| `surface: 'liquid' \| 'image'` | `'liquid'`；`'image'` 让液颈本身是两图颜色 | kit 接口**无此字段** | **没吸收，也没记录** |
| `flowSpeed` 在按住时仍搅动（环境钟） | BlendConfig 默认 26 px/s，「held instead of sitting frozen」 | kit 乘了 `min(1, speed/40)`（`liquidGooeyImageMelt.tsx:1167`），停下就不搅 | 有意改静，**未写入拒绝清单**。更像性能/合同选择，应记一笔 |

### 1.7 导出 helper

donor `index.ts` 导出：`Liquid`、`IMAGE_MELT_DEFAULTS`、`EVOLVE_DEFAULTS`、`MOVE_DEFAULTS`、`easingFunction`、`presets`、各类 options 类型。

kit `index.ts:17–38` 导出：`LiquidGroup`/`LiquidItem`、`DISSOLVE_DEFAULTS`、`IMAGE_MELT_DEFAULTS`、`resolveDissolveOptions`、预算四件套、`LIQUID_GOOEY_WAVINESS_MAX_FRACTION`。**不导出** `EVOLVE_DEFAULTS` / `MOVE_DEFAULTS` / `easingFunction` / `presets`（模块内有，包入口没有）。

这是 API 面，不是视觉能力。记一笔，不进「漏吸收」主名单。

### 1.8 滤镜与运行时（README / 源码行为，不一定是 prop）

| # | 能力 | 判定 | 证据 |
| --- | --- | --- | --- |
| R1 | 剪影 SVG + 内容 DOM，文字/控件不进 goo | 已吸收 | `LiquidGroup.tsx:451–485`，`styles.css:3524–3544` |
| R2 | 滤镜只打在 SVG 内容上，不用 CSS `url()` 打 HTML（Safari） | 已吸收 | 两边都是 `<filter>` 在 `<defs>` 里打在 `<g>` 上 |
| R3 | goo = `feGaussianBlur` + alpha `feColorMatrix` + `feComposite atop` | 已吸收 | donor `filter.tsx:103–115`；kit `liquidGooeyFilter.tsx:193–205` |
| R4 | waviness = `feTurbulence` fractalNoise **seed="7"** + `feDisplacementMap` scale=`waviness*2` | 已吸收 | donor `filter.tsx:122–137`；kit `212–226`。kit **多** 一个 σ=0.5 的重建 blur（`227–231`，1.11.1） |
| R5 | 无 spread 的外阴影走 CSS `drop-shadow()`（compositor / GPU） | **没吸收，也没记录** | donor `Gooey.tsx:105–130` 写了测量动机（iPhone 3x、9fps）。kit / NOTICE / CHANGELOG / `donors-individual.md` **都不提这次拆分** |
| R6 | SVG 上 `willChange: 'filter, transform'` 逼 WebKit 提前合成 | **没吸收，也没记录** | donor `Gooey.tsx:160–162`。kit `.game-ui-liquid-silhouette`（`styles.css:3529–3538`）没有 `will-change` |
| R7 | `isolation: isolate` + 剪影在内容之下 | 已吸收 | kit `styles.css:3524–3528` |
| R8 | 每组一条 rAF，约 500ms 静止后停 | 已吸收 | kit engine `978–986` **睡了还释放动画槽**。donor `observer.ts:510–513` 也会睡 |
| R9 | 叫醒：MutationObserver、transitionrun、animationstart、pointerdown、window scroll、ResizeObserver | 已吸收 | kit `990–1029`；donor `2185–2216` 同一组事件 |
| R10 | 睡着时 300ms `setInterval` 探活（WAAPI 安全网） | **明确拒绝**（挂在「通用 observer」下） | donor `observer.ts:2217–2221`。kit 无 interval。`donors-individual.md:51–56`、lock `rejectedScope` |
| R11 | 通用 `ObserveEngine`（任意子节点测量 + 内建 contact melt DOM） | **明确拒绝** | lock `rejectedScope`；NOTICE `114–116`；CHANGELOG 1.11.0 |
| R12 | `prefers-reduced-motion` 时弹簧折成瞬间 | 已吸收，且 kit 更稳 | donor `hooks.ts:6–16` 直接 `window.matchMedia`。kit `216–235` 同时防 `window` 和缺失的 `matchMedia`（CHANGELOG 1.10.1，jsdom/SSR） |
| R13 | 组件驱动位移：内容与 blob **同一 JS 时钟** 写 transform | 已吸收 | donor README 仍写「编成 CSS `linear()`」，**源码已经改成 JS 时钟**（`GooeyItem.tsx:210–218` 注释：Safari 滤镜负载下 CSS 过渡会和 blob 撕裂）。kit engine 同样 JS 插值（`liquidGooeyEngine.ts:183–187,362–368`）。吸收的是源码，不是过期 README |
| R14 | 旋转不镜像（donor README「v1」） | 两边都没有 | 不是漏，是共同限制 |
| R15 | 无环境钟；waviness 静态 | 已吸收（kit 合同更硬） | seed 固定；dissolve 的 flowSpeed 还被速度门了（见上） |

### 1.9 本轮真正的产出：没吸收，也没记录

下面这些 **既不在实现里（或实现是空壳），也不在 `donors-individual.md` / `NOTICE` / CHANGELOG / lock `rejectedScope` 里被点名为不要**。和当年 waviness / contentBlur 同类。

| ID | 漏了什么 | 为什么不是「拒绝」 | 产品当下疼不疼 |
| --- | --- | --- | --- |
| M1 | **外阴影 CSS `drop-shadow()` 拆分** | 文件里完全没提这次架构。kit 仍用 SVG `feGaussianBlur` 画 `0 13px 26px` | **疼。** 产品几乎每根 `GameProgress` / 分段指示器都带 `--game-ui-shadow-button`。进度条还 `overflow: hidden`，26px 模糊被裁掉，面积照付。见第三部分公式 |
| M2 | SVG `will-change: filter, transform` | 没记录 | 中。Safari 上 donor 专门为「液面落后内容一两帧」加的 |
| M3 | `blobInset` | 没记录 | 产品现在没有头像堆/照片 chip，暂不疼 |
| M4 | `bridgeGrow` | 没记录 | 同上 |
| M5 | item 级 `effect="move"` + `MoveTuning` | 声明只说「给选中指示器和进度前缘用了 Move」，没说 item API 不做。公开类型仍包含 `'move'` | 产品没人传 `effect="move"`，所以没爆。谁照着 donor README 写会静默得到 Morph |
| M6 | `BendTuning.advanced` | 没记录 | 产品零 Bend |
| M7 | `dissolve.surface: 'image'` | 没记录 | 产品零 dissolve |
| M8 | Melt 剪影 luminance mask | 没记录 | 产品零 Melt |
| M9 | `downscaleHref` | 没记录 | 产品零 Melt/dissolve。一旦用照片会在 WebKit CPU 上很疼，donor 自己写过 |
| M10 | dissolve `flowSpeed` 在静止时搅动 | 没记成拒绝 | 产品零 dissolve。kit 改静符合「无环境钟」，应补一句拒绝/改编说明 |
| M11 | 组 pad **不含** 外阴影（donor 外阴影不进 SVG 滤镜区） | 是 M1 的后果 | 同 M1 |
| M12 | 子项 border 警告、dissolve-on-move 警告仍看 `import.meta.env.DEV` | 1.11.2 修了**预算**警告，这两条没进 `check-warnings-survive-build.mjs` | 产品用的是发布包。`LiquidGroup.tsx:599` `DEV !== false` 在产物里为假，**子项误用 border 的警告在 University 里不会响** |

`rejectedScope` 现在只有一句：「general observer loop」。不要把 M1–M11 事后说成早就拒绝了。

### 1.10 声明写了吸收、源码对得上的（抽查，不是照抄）

| 声明 | 源码是否真跑 |
| --- | --- |
| 剪影/内容分层、blur+matrix、圆角、阴影语法、弹簧编译 | 是 |
| Move 中心/拉伸/尾 | 是，但只有 `motion="follow"` |
| Morph 形状 + contentBlur | 是，且默认开 |
| Bend + `--lg-bend-*` | 是 |
| 静态 waviness seed 7 | 是 |
| 成对 Melt + 大理石 + 只融 `<img>` | 是 |
| 通用 observer 不进 | 是，有记录 |

没有「声明吸收、源码失踪」的条目。有的是**声明吸收了一半、另一半既没做也没拒绝**。

---

## 第二部分：产品对 kit 的使用率

范围：`apps/university/src`、`packages/ui/src`、`packages/world/src`。

### 2.1 直接调用 `<LiquidGroup>`：1 处

`packages/ui/src/review/ChoiceBlock.tsx:180–202`

```180:202:packages/ui/src/review/ChoiceBlock.tsx
          <LiquidGroup
            className="choice-block__correct-merge"
            aria-hidden="true"
            fill="var(--game-ui-success)"
            stroke="1px solid color-mix(in srgb, var(--game-ui-success) 62%, transparent)"
            shadow="var(--game-ui-shadow-button)"
            motion="auto"
          >
            <LiquidGroup.Item className="choice-block__correct-mark" x={correctMergeSettled ? -3 : -16} transition="bouncy">
              <span>✓</span>
            </LiquidGroup.Item>
            <LiquidGroup.Item className="choice-block__correct-label" x={correctMergeSettled ? 3 : 16} transition="bouncy">
              <span>答对了</span>
            </LiquidGroup.Item>
          </LiquidGroup>
```

用到的：组 `fill/stroke/shadow/motion="auto"`，项 `x` + `bouncy`。**没传** `morph` / `effect` / `waviness` / `dissolve`。

**【源码路径推断，未截图】** 因为没传 `morph`，kit 会送 `morph ?? {}`，`resolveMorphShape` 读 token `1` → 形状开。engine 走 `paintEvolveEntry`（`isShape` 为真），位移时会 `writeContentBlur`。答对那一下，「✓ 答对了」有机会被最多 7px 的内容模糊。donor 默认 `shape: false`，同样写法在 donor 里只做液桥、不糊字。

CSS 尺寸（`choice-block.css:81–96`）：`min-height: 2.25rem`，item `min-height: 28px`，inline-flex。大约 160×36 量级。

### 2.2 间接：kit 自己把液体藏进了两个控件

产品每用一次这些控件，就在用液体，即使源码里看不见 `LiquidGroup`。

**`GameProgress`** → 内部 `LiquidGroup motion="follow"` + `shadow="var(--game-ui-shadow-button)"`（kit `GameDisplay.tsx:98–120`）。轨道 **14px 高**，`overflow: hidden`（kit `styles.css:887–895`）。

产品调用点：

| 文件 | 行 | 场景 |
| --- | --- | --- |
| `packages/ui/src/lesson/LessonNav.tsx` | 246 | 课文工具条「课文进度」 |
| `apps/university/src/lesson/Settlement.tsx` | 154 | 结算「N / M 关」 |
| `packages/world/src/planet/PlanetPage.tsx` | 150、208 | 选课列表行 + 详情卡 |
| `packages/ui/src/navigation/screens/LevelProgress.tsx` | 25 | 等级 XP 条 |
| `packages/ui/src/navigation/screens/LeagueScreen.tsx` | 47 | 段位进度 |
| `packages/ui/src/navigation/screens/QuestsScreen.tsx` | 30、67 | 每条任务 + 今日汇总 |
| `packages/ui/src/navigation/screens/BadgeWall.tsx` | 27、55 | 未获得徽章每枚一根 + 总进度 |
| `apps/university/src/authoring/CourseSection.tsx` | 103 | 作者端课程完成度（已开始才显示） |
| `packages/ui/src/entry/DemoMiniature.tsx` | 74 | 概念 demo 缩略 |

**`GameSegmentedControl`** → **两个** `LiquidGroup`：静态底 + `motion="follow"` 指示器（kit `GameSurfaces.tsx:238–277`）。选项 `min-height: 44px`，组 `padding: 4px`（`styles.css:162–178`）。

产品调用点：

| 文件 | 行 | 场景 |
| --- | --- | --- |
| `packages/ui/src/lesson/LessonReader.tsx` | 475 | 课文工具条「讲解层级」 |
| `packages/ui/src/reference/LibrarySurface.tsx` | 96 | 图鉴 tab |
| `packages/ui/src/navigation/screens/PlansScreen.tsx` | 276 | 会员年/月切换 |
| `packages/ui/src/entry/DemoMiniature.tsx` | 170 | demo 状态切换 |

课文阅读一屏里同时存在：工具条 `GameProgress` + `GameSegmentedControl`（2 个液体组）+ 答对时再加 ChoiceBlock。动画槽默认 **2**。idle 500ms 后放槽（engine `984–986`），所以**依次**动通常够用；**同时**动（滚动唤醒 + 切层级 + 答对）会挤。徽章墙未获得徽章可到约 10 根 `GameProgress` + 1 根汇总，同屏液体组远大于 2。**【源码推断】** 本轮没有在徽章墙用控制台抓 `the liquid animation budget is insufficient`。

### 2.3 产品全局 token

`apps/university/src/styles.css:4178–4184`：

```css
/* University intentionally opts into the kit's organic liquid edge. The kit
   default is zero so consumers can adopt the effect intentionally; ... */
:root {
  --game-ui-liquid-gooey-waviness: 6px;
  --game-ui-liquid-gooey-waviness-freq: 0.018;
}
```

**【源码】** kit 1.11.3 `theme.css:309` 已经是 `--game-ui-liquid-gooey-waviness: 6`。产品注释过期，这组覆盖是冗余的。效果仍在：所有液体表面（含进度条）都带起伏，14px 条上被夹到 **4.2px**（kit 测试 `liquidGooeyEngine.browser.test.tsx:293`）。

### 2.4 kit 有、产品调用为零的液体能力

| kit 能力 | 产品 |
| --- | --- |
| `effect="melt"` 及全部 melt knobs | 无 |
| `effect="bend"` / `--lg-bend-*` | 无 |
| `dissolve` | 无 |
| item `effect="move"`（本身是死 prop） | 无 |
| 显式 `morph={{ shape, contentBlur, … }}` | 无（吃默认） |
| `setLiquidGooeyBudget` / `setLiquidMetalContextBudget` | 无 |
| `LiquidMetalButton` | **零 import** |
| `OverlayGlass` 组件 | **零 import**。唯一近亲：`packages/world/src/WorldMapCanvas.tsx:241` 给地图 hint 写了 `data-game-ui-tone="glass"` |
| kit `GameTabs` / `GameSlider` | 产品没用这两个；它们内部也**没有**液体。donor 的 Move 示例偏偏是 slider / tab indicator |

Storybook 里 `LiquidGroup` 的 MergingPieces / Melt / Bend / Waviness 网格，产品一条没接。

### 2.5 设计承诺 ↔ 今天的实现

v5 是现行旅程，v4 未被推翻的部分仍有效。v5 **没有**写出「liquid / gooey / 果冻」这些词。对照的是**动效时刻**，不是名词。

| 设计时刻 | 出处 | 今天 | 空缺？ |
| --- | --- | --- | --- |
| 答对是一盏灯，不能冒充读完 | v5 §01 | ChoiceBlock 答对：`LiquidGroup` 合并「✓」+「答对了」；选项本身仍是普通描边按钮 | 答对有液体。**选项本身**不是液态选中 |
| 答错 | v5 / ChoiceBlock 注释 | 普通 danger 描边 + `GameCallout`，无液体 | 有意：错不庆祝。不是空缺 |
| 读完是另一盏灯 | v5 §01、结算 | `Settlement.tsx` 一行「读完了。」+ 普通 `GameProgress` + `<ol>` 列卡片/连击 | **空缺。** 答对有合并仪式，读完没有对应时刻 |
| 结算先说「明天 N 张卡」再问提醒 | v5 | 文案和预提示在，动效是列表 | 低优先级空缺 |
| XP 怎么算、防刷 | v4 §07.1（v5 未推翻） | `LevelProgress` 用 `GameProgress`（因此有 Move 前缘）。数字是条，不是飞出的球 | **不是空缺。** v3 明确：不印「+40 经验」飞字，印真实解锁。`procedural-map-handoff.md` 里的 `XpOrbAnimator` 是过期实验，不要当设计债捡回来 |
| 节点弹窗：标题、代价、奖励印在开始按钮上 | v3 抄多邻国结构 | `NodeCard.tsx:59` `GameButton variant="primary"`，普通按钮 | 结构在。液体/金属都没上。v3 要的是信息，不是特效 |
| 讲解层级切换 | 阅读器工具 | `GameSegmentedControl` → kit follow 指示器。这是产品里**最好看的液体** | 已用 |
| 课文进度 | 工具条 | `GameProgress` 14px 液条，阴影被 overflow 裁掉 | 用了，但几乎看不见阴影/尾 |
| 图鉴 / 会员周期切换 | v4 图鉴、定价 | 分段控件，有 follow | 已用 |
| unit 状态动画若出现则克制、不同步乱跳 | v5 决定 D | 3D 节点，不是 2D 液体 | 别把 Bend/Morph 套到头像或节点上。v5 写明金色环不要上下弹 |
| 主题切换 | v5 | kit token，无液体 | 不是液体空缺 |
| 决策 CTA（解锁/购买） | kit 自己给 `LiquidMetalButton` 的用法 | 产品全程 `GameButton` | kit 能力闲置。支付后端仍有 gap，排后面 |

**空缺里值得当提案的：** 读完仪式；答对合并是否该关掉 contentBlur；进度条为看不见的阴影付滤镜面积；徽章墙液体组数量 vs 预算 2。**不要当提案的：** XP 飞球、头像弹跳、Melt 两张照片（旅程里没有这个时刻）。

---

## 第三部分：比 donor 好在哪，差在哪

### 3.1 我们做过的适配（自己核对，不照抄）

| 适配 | 源码 | 相对 donor 的实际收益 |
| --- | --- | --- |
| 进程级动画槽 2 + 面积 480 000 | `liquidGooeyBudget.ts:10–11` | donor 无上限。超了 snap 并 `console.warn`（1.11.2 起警告在发布包里仍活着，`check-warnings-survive-build.mjs`） |
| 共享 rAF，idle 停，**并释放槽** | engine `978–986` | donor 也睡 500ms，但睡着仍 3Hz `setInterval`（`observer.ts:2217–2221`）。kit 更接近「零空闲」 |
| 拒绝通用 observer | lock `rejectedScope` | 换掉会丢掉预算和完全停钟。理由成立。CHANGELOG 写 donor「不睡」**过强**——donor 睡，只是有探活、无预算 |
| token 取值，不硬编码物理 | `theme.css:242–342` | 产品改 waviness 只需 CSS。University 已经这么做了（尽管注释过期） |
| 固定 seed 静态 waviness | Filter `seed="7"` | 与 donor 相同的静态场；kit 默认打开（donor 默认 0） |
| 按短边 30% 夹紧 | `liquidGooeyWaviness.ts`；1.11.1 | 14px 条上 6px 会咬掉 43% 高度。夹到 4.2px。**【kit 已有测试】** `liquidGooeyEngine.browser.test.tsx:293` |
| 位移后 0.5px 重建 | Filter `227–231`；1.11.1 | donor 没有。给被挪到像素之间的边一点抗锯齿。面积 +`ceil(0.5*3)=2` px pad |
| inset 从 `shape` 取差，省掉未消费的 BINARIZE | Filter `28–37,234–236`；1.11.3 | **【kit 已有测量，本轮未复跑】** 孤立 150px 圆 rim breaks 2.51 → 1.25；常见 inset+drop 无描边无 spread：**16 → 15** primitives（`EDGE-QUALITY.md`）。donor 凡 inset 都从 `bin` 取差（`filter.tsx:18,43–45`） |
| `check-warnings-survive-build.mjs` | `scripts/check-warnings-survive-build.mjs` | 拦住「DEV 在库构建期折成 false」。**只查两条预算文案**，不查 border / dissolve-on-move 警告（M12） |
| jsdom/SSR `matchMedia` 防护 | `LiquidGroup.tsx:216–235` | donor hook 会在无 `matchMedia` 时扔 |
| 组级 `stroke` | kit 独有 | 产品 ChoiceBlock 用了。解决「孩子自己画边，液桥接不上」 |

### 3.2 我们比 donor 差的地方

1. **外阴影在 SVG 里做大模糊（M1）——保真度未必差，性能和预算明确差。**  
   donor 把 `0 13px 26px` 这种层移到 compositor。kit 的 `ShadowPass` 对 `shape` 做 `stdDeviation = blur/2 = 13` 的全区域模糊（`liquidGooeyFilter.tsx:113–120`），并且 `shadowExtentOf` 把 `26*1.5+13=52` 加进 pad（`LiquidGroup.tsx:237–247,325–337`）。  
   产品 `--game-ui-shadow-button` 正是这一层 + `inset 0 2px 0`（`theme.css:161–162`）。  
   **进度条还 `overflow: hidden`（`styles.css:887–894`）**：26px 外阴影在 14px 轨道里几乎不可见，滤镜面积照算。  
   donor 自己的注释（`Gooey.tsx:105–110`）写：iPhone 类 3x 上拖一下，SVG 大模糊把整块 padded 区每帧 CPU 栅格化，测到 9fps。**【本轮未复测 fps】** 引用的是 donor 源码里的测量，不是我们今晚的。

2. **没有 `will-change` 提升滤镜层（M2）。** donor 为 WebKit「液面落后内容」加的。kit 没有。

3. **默认 shape on + contentBlur 7，打在产品唯一的亲手庆祝上。** ChoiceBlock 没关。**【源码路径，未截图】**

4. **item `effect="move"` 是空壳（M5）。** 保真度/API 陷阱。

5. **Melt 不裁剪影、不降采样（M8/M9）。** 产品没用。一旦用，糊出液边 + 大图 CPU 是 donor 已经付过学费的。

6. **1.11.3 的 inset-AA 在药丸/现场指示器上，breaks 计数几乎不动**（`EDGE-QUALITY.md:31–34` 2.64 → 2.64）。圆上的虚线修了；52px 分段指示器的「顶有底无」设计带还在。不要把 1.11.3 说成现场指示器也腰斩。

### 3.3 预算在产品真实尺寸下：多数宽裕，有两条会咬人

公式（kit `LiquidGroup.tsx:325–343` + engine 面积）：

```
basePad = ceil(blur*3 + filterPadding + shadowExtent + stroke + waviness + (waviness>0 ? 2 : 0))
area    = (W + 2*pad) * (H + 2*pad)
预算    = 480_000
```

`shadowExtent` 对 `--game-ui-shadow-button` = **52px**（来自 26px blur）。donor 若外阴影走 CSS，SVG pad 几乎只剩 inset 的 2px。

**【公式推算，本轮用上述公式在本机算】**

| 表面（CSS 推断尺寸） | kit 面积 | 占预算 | 若外阴影走 CSS（近似 donor） |
| --- | ---: | ---: | ---: |
| 进度条 360×14（窄工具条） | 121 392 | 25% | 53 592（11%） |
| 进度条 750×14（桌面课文） | 205 632 | 43% | 98 832（21%） |
| 进度条 1100×14（68rem 栏） | 281 232 | 59% | 139 432（29%） |
| 进度条 1800×14 | 432 432 | 90% | 220 632（46%） |
| 进度条 2200×14 | **518 832** | **108% 超** | 267 032（56%） |
| 分段 240×52 | 115 068 | 24% | 54 668 |
| 分段指示器 120×44 | 80 352 | 17% | 33 152 |
| 答对合并 ~160×36（含 shape slack 21） | 115 872 | 24% | 56 672 |
| 行星行 / 徽章条 ~220–280×14 | 9–10 万 | ~20% | ~4 万 |

临界：进度条宽度 **≳ 2020px** 时，单组面积超 480k，**Move 直接 snap，这条液体等于没有。** 课文中栏 `minmax(0, 68rem)` 本身不到这个数；工具条若将来拉满超宽屏，会踩线。**【本轮未读 live `data-liquid-filter-area`】**

并发槽 = 2，idle 释放。课文阅读「进度 + 分段 follow」正好两槽；答对第三组要等前两个睡着。徽章墙多根进度条同屏，只有先动到的两根有尾。

CHANGELOG 1.11.0 写「全开效果 307 892 / 480 000」是 Storybook 演示尺寸，不是产品 14px 条。产品单组通常远小于此；产品的风险是 **窄条 × 大阴影 pad** 和 **组数 > 2**，不是 Melt 全开。

**结论：** 预算对「一根 14px 进度条 + 一组分段」是宽裕的（桌面约 40–60%）。它紧张的方式是：(a) 为看不见的 26px 阴影付约 **2×** 面积；(b) 同屏很多 `GameProgress`；(c) 超宽进度条会整组降级。若某效果「一进产品必然降级」，当前最接近的是超宽进度条和徽章墙的第 3 根起。

### 3.4 每帧工作量（未重新测 fps）

**【源码 + kit 已有测量】** 产品默认链（waviness + drop + offset-inset，无描边）：**15** 个 SVG primitive（EDGE-QUALITY 现场青色指示器 1.11.3）。ChoiceBlock 有 stroke → 再加 BINARIZE + StrokePass（约 4），约 20。

donor 同视觉：外阴影 0 个 SVG blur pass + 1 个 CSS `drop-shadow`；SVG 侧约 11 primitive（goo 3 + waviness 2 + bin 1 + inset ~4 + merge）。kit 把最贵的那次 blur 留在 SVG 里。

kit 睡后 `activeGroups` 回到 0，静止帧不再跑弹簧。waviness 是静态滤镜，**静止仍要栅格化**，只是没有 JS 钟。14px × 宽条 × 15 primitive 的静止成本，本轮没有量化。

---

## 排序提案

按「每单位风险换来的视觉半径」排，不按实现难度。改什么、何时改，由你定。本轮不改代码。

### 1. 答对合并：显式关掉 shape / contentBlur

- **改什么：** `ChoiceBlock.tsx` 的两个 `LiquidGroup.Item` 传 `morph={{ shape: false }}`，或 `contentBlur: 0`。液桥、bouncy 位移、组 `stroke/shadow` 都留下。
- **落点：** `packages/ui/src/review/ChoiceBlock.tsx:188–201`。这是产品唯一亲手写的液体时刻。
- **视觉：** 「✓ 答对了」保持锐利，液面仍能并上。现在默认 token 会在位移中给内容最多 7px 模糊——donor 默认不会。
- **风险：** 低。一行 props。若你就是要果冻字，这条不做。
- **为何第一：** 半径是整个答对瞬间；风险接近零。先别在别处铺液体，先让这一下是清楚的。

### 2. 进度条不要为看不见的阴影付 52px pad

- **改什么（两条里选）：**  
  (A) kit 按 donor 把无 spread 外阴影改 CSS `drop-shadow()`（M1）；或  
  (B) 产品侧 `GameProgress` 不经我们之手——那是 kit 内部。要动只能动 kit，或给 `GameProgress` 加「轨道裁切时不要外阴影」的 kit API。  
  过渡：先在 kit 给进度条这条路径跳过外阴影 SVG pass。
- **落点：** kit `GameDisplay.tsx:98–104` + `liquidGooeyFilter.tsx` / `Gooey.tsx` 那套拆分。产品所有 `GameProgress` 立刻受益（课文条、结算、XP、任务、徽章、行星页）。
- **视觉：** 14px 条上外阴影本来就被 `overflow: hidden` 裁掉，**(B) 视觉半径小**；**(A) 在分段指示器上阴影仍可见**，Safari 掉帧少，半径中。
- **性能：** 同尺寸面积大约减半（公式表）。超宽条从「会超 480k」回到安全区——这是让**已经接上的液体真正还能动**。
- **风险：** (A) kit 滤镜架构，要回归 EDGE-QUALITY；(B) 低。
- **为何第二：** 不是新特效，是让现在铺得最广的液体不再交隐形税。单位风险换来的是「所有进度条和指示器付得起」，比再做一个 Melt 半径大。

### 3. 读完仪式：给结算一个和答对同级的合并时刻

- **改什么：** `Settlement.tsx` 「读完了。」不要只是 `<p>`。用 `LiquidGroup` 把「读完了」和「N 张卡进复习」并成一次用户引起的 merge（和 ChoiceBlock 同一套：组拥有 fill/stroke/shadow，字在内容层）。
- **落点：** `apps/university/src/lesson/Settlement.tsx:148–177`。v5 的第二盏灯。
- **视觉：** 读完/答对终于是两种仪式，而不是一种液体 + 一种标题。半径大（每节课一次）。
- **风险：** 中。要设计，不要飞 XP。v3 写过结算印的是真实解锁，不是 `+40`。卡片进队列、连击天数可以是第二、第三颗液滴，不要新做球。
- **为何第三：** 设计承诺里最大的空缺。风险高于 1、2，但视觉半径是「每节课结束」。不要先做 Melt 照片。

### 4. 把漏记写进 kit 的拒绝/吸收清单（不改运行时）

- **改什么：** kit `donors-individual.md` + lock `rejectedScope` + NOTICE 补上 M1–M11：外阴影拆分是故意还是忘了；`blobInset`/`bridgeGrow`/item Move/`surface`/mask/`downscaleHref` 要还是不要。
- **落点：** 只文档。本轮产品仓库不改 kit。
- **视觉：** 零。
- **风险：** 零。
- **为何第四：** 不换视觉，但能阻止第三次「既没吸收也没拒绝」。排在有视觉的后面，是因为你要的排序是视觉半径；它仍然值得很快做，免得下一轮审计再付一遍。

### 5. 徽章墙：进度条不要每枚一独立液体组

- **改什么：** 未获得徽章的细条改成普通填充，或共享一个预算更大的组；总进度那一根留下 follow。
- **落点：** `packages/ui/src/navigation/screens/BadgeWall.tsx:27,55`。
- **视觉：** 小（细条本来就看不清尾）。收益是：别把全局 2 槽占满，避免同会话里课文答对被 snap。
- **风险：** 低。
- **为何第五：** 防的是「液体在错误的地方把正确的地方挤掉」。半径是负向的——减少噪音。

### 6. kit：外阴影 compositor 拆分 + `will-change`（M1+M2 正餐）

- **改什么：** 移植 donor `Gooey.tsx:105–162` 的拆分和 `willChange`。SVG pad 只为 inset/spread/stroke/waviness 留。警告守卫扩到 border / dissolve-on-move。
- **落点：** SwimmerUIKit `liquidGooeyFilter.tsx`、`LiquidGroup` 的 SVG 样式、`check-warnings-survive-build.mjs`。发 1.11.4，产品只升版本。
- **视觉：** 分段指示器阴影更跟手；Safari 少掉帧。进度条看起来几乎一样（仍被裁）。
- **风险：** 中高（滤镜图、EDGE-QUALITY 全套要重跑）。1.11.3 刚动过 inset。
- **为何第六：** 和 2 是同一件事的完整版。2 可以先走产品/kit 小切口；6 是 donor 那笔已经付过学费的性能合同。风险更高，所以排后。

### 7. 不要做的（反提案，避免假空缺）

- **XP 球 / Melt 两张图 / Bend 头像：** v3/v5 明确不要飞经验和节点弹跳。Melt 旅程里没有时刻。
- **把 item `effect="move"` 先暴露给产品：** 在 kit 修好空壳之前，产品调用等于 Morph。
- **给课文工具条再叠一组液体：** 已经 2–3 组，槽是 2。
- **LiquidMetal 上「开始」：** 那是另一份 donor（ThreeUI）。节点卡要的是代价和奖励印在按钮上，不是色散金属。等支付 CTA 再谈。

---

## 附录 A · 产品液体表面尺寸（公式，非 live DOM）

pad 假设：`blur=6`，`filterPadding=24`，阴影 `--game-ui-shadow-button`（extent 52），waviness 请求 6 并 30% 夹紧，有波时 +2px AA。

进度条临界宽 ≈ **2020px**（`(W+202)*216 > 480000`）。课文中栏 68rem 通常低于此。

## 附录 B · 本轮没做的测量

- 没有打开 University 浏览器去读 `data-liquid-filter-area` / `data-liquid-motion`。
- 没有复跑 kit `measure-liquid-edge.mjs`（沿用 `EDGE-QUALITY.md` 1.11.3 数字）。
- 没有在设备上复现 donor 声称的 9fps。
- 没有截 ChoiceBlock 答对那一帧看字是否真糊——**提案 1 的前提是源码路径，建议先看一眼再改。**

## 附录 C · 版本与钉

- kit `package.json` version `1.11.3`
- 产品 `apps/university` / `packages/ui` / `packages/world` 均 `"@pieai/swimmer-ui-kit": "1.11.3"`
- donor lock：`3862ffa345217443b63696a8c331a0664eea4b04`，`rejectedScope` 仅 general observer
