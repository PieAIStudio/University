# CTAPINCH 第二轮交付报告

日期：2026-08-31
分支：`work/ctapinch`
基线：`930a83c` 保留，所有本轮改动都在其之上。

## 本轮结论

保留第一轮的 352ms 动画、72ms settle、静止零成本、reduced-motion 跳过、原生按钮和 `setProgress(0..1)` 取帧接口；重做落点和跨屏接入。

本轮唯一启用的转场是同屏的：`完成本次更新` → 课内顶部进度条。

- `packages/ui/src/lesson/LessonNav.tsx:276-307` 把课内 `GameProgress` 注册为目标。
- `liquidProgressDestinationRect()` 只测量进度条已填充边缘的一颗 16–22px 液滴，不测量整块组件或 `7/8` 文本。
- 桌面路线先向右进入空气区，再沿右侧下行，最后在工具栏高度横向回收；手机让大源形状留在按钮上融化成小圆滴，再从右边缘离开。这样中段不会把正文当成跑道。
- 断开阶段源液滴收缩并回退，目标处长出小液滴；`p=1` 时源形状归零，目标液滴落在已填充轨道边缘，由工具栏层吸收。
- 液体覆盖层为 `z-index:1`，课文内容为 `z-index:2`，工具栏为 `z-index:41`；覆盖层仍 `pointer-events:none`、`aria-hidden`，真实按钮文字、焦点环和命中区没有 transform。
- 未重新加入静止态 waviness，外阴影仍由 SwimmerUIKit 2.0.0 的 compositor 路径提供。

## `开始学习` 的关闭位置

这一轮没有给跨屏共享元素手写 overlay：

- 桌面 Today 面板在 `packages/ui/src/today/TodaySection.tsx:92-95` 使用 `GameButton static`，直接调用 `onOpenLesson`。
- 手机地图 next-up 卡在 `apps/university/src/app/App.tsx:615-642` 使用 `GameButton static`，直接 `setView({ kind: "lesson", ... })`。
- 同时删除了 `courseMapDestinationId`、地图 marker screen projection 和 `setLiquidDestination` 这条只服务跨屏 CTA 的链路；没有留下 pending、投影回调或死目标。

将来重新打开时，应在两页布局都由同一个 View Transitions 方案拥有之后再接入；本轮不引入 View Transitions。

## 文字不被遮挡的程序化证明

测试在 `packages/ui/src/cta/LiquidCtaTransition.test.tsx:159-211`：

1. `liquidFlightCoverageRects()` 计算每个样本的源液滴、目标液滴和 follow-tail 覆盖走廊。
2. 对目标填充宽度 `0 / 84 / 334 / 668`、进度 `0 / .05 / .2 / .5 / .85 / .93 / .98 / 1`，分别在 `1280px` 和 `390px` 下取帧。
3. 把覆盖矩形与模拟的可读 DOM 节点（关闭按钮、进度值、正文、手机内容列）逐一做相交检测。
4. 桌面路线几何上把走廊放入右侧空气区；若窄屏几何路径进入内容区，则测试断言液体层 `z-index:1` 严格低于内容层 `z-index:2`，因此不会可见地遮挡文字。

同一测试文件还覆盖了目标缺失时点击仍执行但没有 overlay、目标晚挂载时开始、目标卸载时取消 ghost flight，以及 352ms 阶段顺序和小液滴落点。`LiquidCtaButton.test.tsx` 覆盖原生按钮、零 waviness、键盘焦点和 reduced-motion；`apps/university/src/app/TodayCard.test.tsx` 断言首页按钮为静态 GameButton 且没有 `data-liquid-cta`。

真实浏览器还检查了桌面/手机的 `getComputedStyle`：每个取帧点的 `flightZ=1`、`contentZ=2`；首页点击从根路径直接进入 lesson，且没有 `[data-liquid-cta-flight]`。

## 取帧证据

真实 Vite delivery 页面通过 `window.__universityLiquidCta.setProgress()` 取帧，桌面 `1280×720`、手机 `390×844`；每帧等待 SwimmerUIKit follow 合成稳定后保存。文件全部在：

`.scratch/ctapinch/round2/`

- 桌面：`completion-desktop-p020.png`、`p050.png`、`p070.png`、`p082.png`、`p090.png`、`p098.png`、`p100.png`
- 手机：`completion-mobile-p020.png`、`p050.png`、`p070.png`、`p082.png`、`p090.png`、`p098.png`、`p100.png`

目检重点：p070 不再把橙色团块放在标题上；p082–p090 断开后是小液滴/右侧空气区残留；p098–p100 的目标液滴与进度条填充边缘重合，而不是另起一根横条。

## 未完成或不确定

- 跨屏 `开始学习` 动效是有意未做，不是遗漏；等待后续 View Transitions 方案。
- 手机中段液体为保护文字而大部分走出右侧可视区，视觉存在感低于桌面；这是本轮“文字不可遮挡”红线下的明确取舍，后续若要加强手机表现，应先设计安全的共享元素路径，不能把液体放回正文上。
- SwimmerUIKit 内部 follow 弹簧仍由 kit 渲染；`setProgress` 只确定本项目的 authored phase/geometry，截图通过等待合成稳定取样，并非关闭 kit 内部物理的逐像素静态快照。
- 没有独立 AfterCritic；本轮使用真实浏览器截图、DOM 矩形相交记录和单测复核。
- `pnpm verify` 的 `check-export-freshness` 提示本机没有 initialized studies，因此不能在此环境证明作者源与 recovery export 的新鲜度；这与本轮 UI/CTA 代码无关。
