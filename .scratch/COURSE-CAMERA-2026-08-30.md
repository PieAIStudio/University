# 课程镜头收紧记录

日期：2026-08-30
分支：`work/course-camera`
范围：课程岛默认镜头、课程岛平移/缩放范围、课程路径的 DOM 标签可读性。

## 结论

我把默认课程镜头定在“头像约占画布高度八分之一”的构图目标：不是把岛拍成总览，而是让头像、脸和前方一小段路径共同成为主体。这个目标是看渲染结果后选的，不是从模型尺寸反推的。

最终使用 `COURSE_DISTANCE = 23`、`COURSE_POLAR = 68°`，并让镜头站在 live lesson 的 `+Z` 正面，目标点在 live lesson 后方 2 个单位、上方 4 个单位。这样符合 v5 决定 C：能看到头像的脸；同时镜头随着当前 live lesson 的位置移动。

我先看过更近的候选构图。候选头像在桌面画面已经超过 1/6，手机中段的下缘又靠近底部 chrome；把正面偏移收回到 19、保留 23 的默认距离后，桌面是约 15%，手机是约 12%，脸清楚，头像下方没有被控件截断，前方仍能读出短路径。这是我选择最终值的视觉依据。

### 最终头像份额

份额按头像自身的 body、耳朵和内耳 mesh 投影框计算，分母是 WebGL canvas 高度，不把 DOM 课程卡片算进画布。目标区间是 10%–16.67%。

| 状态 | 视口 | 投影框 top → bottom | 头像高度 | 画布高度 | 画面份额 |
| --- | --- | ---: | ---: | ---: | ---: |
| 起点 | 桌面 1440×900 | 626.065 → 760.862 | 134.797px | 900px | 14.98% |
| 中段 | 桌面 1440×900 | 626.011 → 760.855 | 134.844px | 900px | 14.98% |
| 起点 | 手机 390×844 | 388.119 → 458.154 | 70.035px | 591px | 11.85% |
| 中段 | 手机 390×844 | 388.123 → 458.155 | 70.032px | 591px | 11.85% |

## 实现与交互

- `frameCourse` 不再瞄准四个 lesson 之后的绝对位置；它以 live lesson 为唯一锚点，镜头和目标共享 live lesson 的横向位置。课程前进时，镜头因此跟着头像走，弯路仍然在画面里展开。
- 相机站在 `+Z` 正面而不是拍头像后脑勺；桌面和 390×844 起点/中段截图都确认能看到脸。
- 保留 `MapControls` 的平移和滚轮缩放，没有删除任何能力。范围从 `36 / 30–76` 改为 `23 / 18–54`（默认 / min–max）；`68°` 极角不变。18 只用于近距离查看眼前地面，54 让学习者仍可拉远查看更多后续 levels，但不回到旧的整岛总览。
- 新鲜浏览器页等待 30 秒后，滚轮把实际距离从 `23.2594` 改到 `24.7360`；横向 wheel 平移把 target.x 从 `6.2055` 改到 `12.5379`。桌面和手机两次都无 page error。
- 可读文字仍然是 DOM。为避免 live lesson 的 kind icon 盖住头像脸，只移除了重复的 live icon；DOM 的「开始」标签、其它 lesson 标签和路径仍保留。
- 改后固定 judge 的 `domLabelContrastMin` 最低是 `8.6739`，所有桌面/手机镜头都高于不可谈判的 `4.5`：课程 design 桌面 `8.6739`、手机 `10.2033`；course-near 桌面/手机 `12.5226 / 12.5524`；course-far 桌面/手机 `10.64 / 10.576`；world design 桌面/手机 `12.6155 / 13.4513`。
- 没有修改 `packages/world/src/island/look-contract.ts` 的阈值。

## 固定 judge：改前 → 改后

比较规则沿用 `e2e/J.island-look.spec.ts` 的 ratchet：`min` 指标更高为好，`max` 指标更低为好，`range` 指标按距离合法区间边界的 margin 比较。下面列出所有发生变化的 ratchet 指标；没有列出的 ratchet 指标在所有 shot/viewport 中不变。

### 变好

| shot / viewport | 指标（改前 → 改后） |
| --- | --- |
| course-near / 桌面 | `lightnessP2` 22.2714 → 22.2487；`domLabelContrastMin` 7.82 → 12.5226；`landCoverage` 0.9162 → 1 |
| course-far / 桌面 | `sceneLinearRange` 9.632 → 13.796；`grassLightnessSpread` 49.5804 → 53.6879；`lightnessP2` 26.6745 → 23.0834；`lightnessStdDev` 16.1706 → 16.2035；`domLabelContrastMin` 8.5492 → 10.64；`landCoverage` 0.6466 → 0.7714 |
| course-design / 手机 | `domLabelContrastMin` 8.5282 → 10.2033 |
| course-near / 手机 | `domLabelContrastMin` 10.2261 → 12.5524；`landCoverage` 0.9601 → 1 |
| course-far / 手机 | `sceneLinearRange` 11.099 → 15.735；`landMedianLightness` 48.4938 → 52.605；`grassLightnessSpread` 45.6111 → 49.4044；`lightnessP2` 25.4694 → 22.7128；`landCoverage` 0.8273 → 0.8671 |

### 变坏

| shot / viewport | 指标（改前 → 改后） |
| --- | --- |
| course-near / 桌面 | `sceneLinearRange` 16.447 → 5.686；`landMedianLightness` 46.5314 → 39.2856；`landP95Lightness` 71.8745 → 53.4286；`landLightnessRise` 25.3432 → 14.1431；`backgroundLightnessSpread` 16.2235 → 0；`grassLightnessSpread` 49.0739 → 25.6484；`grassLightnessP95` 71.8121 → 48.8736；`lightnessP98` 76.8166 → 56.191；`lightnessStdDev` 14.7605 → 6.7783；`grassHueCount` 9 → 5；`grassHueSpread` 119.6667 → 70.677；`accentArea` 0.0003 → 0 |
| course-far / 桌面 | `landMedianLightness` 50.7658 → 50.4706；`landP95Lightness` 76.5469 → 75.5462；`landLightnessRise` 25.7811 → 25.0756；`backgroundLightnessSpread` 53.5292 → 43.5495；`grassLightnessP95` 77.9585 → 77.258；`lightnessP98` 92.067 → 85.8128；`grassHueSpread` 120 → 119.717；`accentArea` 0.0048 → 0.0015 |
| course-near / 手机 | `sceneLinearRange` 21.529 → 4.361；`landMedianLightness` 47.825 → 39.6919；`landP95Lightness` 77.0391 → 48.0839；`landLightnessRise` 29.2141 → 8.392；`backgroundLightnessSpread` 27.5155 → 0；`grassLightnessSpread` 48.1151 → 22.1062；`grassLightnessP95` 70.3865 → 45.7713；`lightnessP2` 22.2254 → 22.2487；`lightnessP98` 81.7453 → 54.9768；`lightnessStdDev` 16.6698 → 6.4264；`grassHueCount` 9 → 6；`grassHueSpread` 119.6341 → 73.6407；`accentArea` 0.0274 → 0 |
| course-far / 手机 | `landP95Lightness` 82.1279 → 80.8839；`landLightnessRise` 33.6341 → 28.279；`backgroundLightnessSpread` 35.5042 → 31.8223；`grassLightnessP95` 73.2836 → 72.9974；`lightnessP98` 84.346 → 83.7498；`lightnessStdDev` 16.8114 → 16.4666；`accentArea` 0.0659 → 0.0511；`domLabelContrastMin` 10.5911 → 10.576 |

course-design/桌面和 world-design/桌面、手机的 ratchet 数值没有变化。`keyToFillRatio`、`propsPerLessonNode`、`rimPropShare`、`nodeOcclusionShare`、各层计数及 world props 也没有变化。

### 非 ratchet 的变化

这些指标没有参与 ratchet，但也一并记录：

- `displayDarkPixelShare`：course-near 桌面 `0.136876 → 0.100766`（变好），course-far 桌面 `0.076672 → 0.118308`（变坏）；course-near 手机 `0.157484 → 0.087084`（变好），course-far 手机 `0.095067 → 0.101026`（变坏）。其它 shot 不变。
- `domLabelCount`：course-near 桌面 `12 → 4`、course-far 桌面 `8 → 7`、course-far 手机 `6 → 7`。这是移除 live 重复 kind icon 和紧构图导致的可见 DOM 标签数量变化，不是把文字移进 WebGL；course-near 手机仍是 6。

固定 judge 正式改后结果：`1 passed`，8 个 shot/viewport 均完成；阈值红色项是原有 look contract 的现状，不是本次悄悄移动的阈值。

## Renderer 性能观测

只读取 renderer 的 `renderer.info.render.calls` 和 `renderer.info.render.triangles`，没有报告受其它 agent 干扰的 frame timing。每组都使用同一 fresh tab、等待 25–30 秒，并通过 `readPixels` 检查画布不是 stale tab 的假黑帧；改后普通课程截图的 5×5 采样为 22–25/25 个非黑点。

| 状态 / 视口 | draw calls 改前 → 改后 | 三角形改前 → 改后 |
| --- | ---: | ---: |
| 起点 / 桌面 | 244 → 214（-30） | 419,902 → 418,102（-1,800） |
| 起点 / 390×844 | 234 → 212（-22） | 352,946 → 351,650（-1,296） |
| 中段 / 桌面 | 251 → 224（-27） | 376,356 → 418,714（+42,358） |
| 中段 / 390×844 | 230 → 218（-12） | 339,544 → 352,020（+12,476） |

结论是 draw calls 四组都下降，起点三角形略降；中段三角形反而上升，这是真实的坏变化，不能宣称“所有性能都变好”。镜头收紧减少了总览范围，但在中段也让部分近处细节进入有效渲染集合，后续若要继续压性能，应单独做课程 dressing/LOD 优化，而不是再牺牲这次已经确认可用的构图。

## 截图路径

所有截图都已打开复核。普通课程路径截图包含起点和中段，固定 judge 截图另存为固定压力证据。

### 普通路径：改前

- [桌面起点](SHOTS/course-camera-before-desktop-start.png) / [canvas](SHOTS/course-camera-before-desktop-start-canvas.png)
- [桌面中段](SHOTS/course-camera-before-desktop-mid.png) / [canvas](SHOTS/course-camera-before-desktop-mid-canvas.png)
- [手机起点 390×844](SHOTS/course-camera-before-mobile-start.png) / [canvas](SHOTS/course-camera-before-mobile-start-canvas.png)
- [手机中段 390×844](SHOTS/course-camera-before-mobile-mid.png) / [canvas](SHOTS/course-camera-before-mobile-mid-canvas.png)

### 普通路径：改后

- [桌面起点](SHOTS/course-camera-after-desktop-start.png) / [canvas](SHOTS/course-camera-after-desktop-start-canvas.png)
- [桌面中段](SHOTS/course-camera-after-desktop-mid.png) / [canvas](SHOTS/course-camera-after-desktop-mid-canvas.png)
- [手机起点 390×844](SHOTS/course-camera-after-mobile-start.png) / [canvas](SHOTS/course-camera-after-mobile-start-canvas.png)
- [手机中段 390×844](SHOTS/course-camera-after-mobile-mid.png) / [canvas](SHOTS/course-camera-after-mobile-mid-canvas.png)

### 固定压力 judge

- [改前 metrics](SHOTS/island-look-before/metrics.json)
- [改后采集 metrics](SHOTS/island-look-after/metrics.json)
- [正式 ratchet 输出 metrics](SHOTS/island-look-final/metrics.json)
- 正式输出 PNG 在 [SHOTS/island-look-final](SHOTS/island-look-final/)；改前 PNG 在 [SHOTS/island-look-before](SHOTS/island-look-before/)，改后采集 PNG 在 [SHOTS/island-look-after](SHOTS/island-look-after/)。

## 验证

- `pnpm verify`：通过。
- `ISLAND_LOOK_VARIANT=after ISLAND_LOOK_OUTPUT_DIR=SHOTS/island-look-final pnpm e2e:island-look`：通过，`1 passed`。
- 浏览器：桌面和 390×844 均检查起点/中段、头像脸、DOM 标签、平移、滚轮缩放；fresh tab 的 `readPixels` 非黑，控制台没有 page error。仅有项目原有的 `THREE.Clock` deprecation warning。
