# CTAPINCH 交付报告

日期：2026-08-31
分支：`work/ctapinch`

## 机制

实现位于 `packages/ui/src/cta/LiquidCtaTransition.tsx`，按钮仍是原生可聚焦、可点击的 SwimmerUIKit `GameButton`。点击时先读取按钮 wrapper 的 viewport `DOMRect`，再读取目标的 viewport 矩形；动画层是挂在 `App` 外、不会随路由卸载的单个 DOM overlay。

动画只有一个 `LiquidGroup motion="follow"`，静止态 `waviness={0}`。它把两个屏幕矩形放在同一组里：源形状沿目标方向移动，SwimmerUIKit 的短生命周期 follow tail 负责中段拉丝；目标形状从近乎不可见长成落点。形状阶段是：

`press → stretch → thread → break → land`

断开阶段会让正在缩小的源形状沿已经走过的路径略微回拉，同时让落点形状在目标处长出来，确保断开读作分离而不是两个胶囊重叠。源按钮本身的文字、焦点环、点击区域从未被 transform；overlay `pointer-events: none` 且 `aria-hidden`。

## 目标坐标

目标没有重新计算一套 3D 逻辑。`packages/world/src/camera/controls.tsx` 的 `LabelProbe` 已经是课程标记的投影源：它使用现有 `Vector3.project(camera)`，再结合 canvas 的 `getBoundingClientRect()` 把结果转为浏览器 viewport 像素。`WorldMapCanvas` 将这条投影流交给 App；当前课程标记投影不到屏幕、没有 label 节点或坐标不可用时，注册表为空，点击仍直接导航，不显示 overlay。

课程地图目标使用 `courseMapDestinationId(studyId, courseId)`；结算进度目标使用 `lessonProgressDestinationId(studyId, courseId, lessonId)`。后一个目标由结算页挂载的 `LiquidDestination` 注册，因此课文按钮即使先导航，目标在新路由挂载后也能接续；目标等待有界，不会阻塞导航。

## 两个 CTA 共用一套

| CTA | 源 | 目标 | 接入点 |
| --- | --- | --- | --- |
| 首页「开始学习 / 继续学习」 | TodaySection 桌面课程卡、手机 next-up 卡 | 世界地图上同一 `courseId` 的课程标记矩形 | `App.tsx` + `TodaySection.tsx` |
| 课文底部「完成本次更新」 | LessonReader 底部按钮 | 结算页课程进度条 | `LessonScreen.tsx` + `SettlementHost.tsx` + `Settlement.tsx` |

按钮只增加了可选 `destination`，导航回调仍然照常执行；两个 CTA 没有复制动画实现。

## 时长与手感

最终时长为 **352 ms**，落点保留 **72 ms** 的短暂 settle hold。352 ms 足够让按下、拉长、拉丝和断开各自占据可见帧，同时不会把原本立即发生的路由变成等待；72 ms 让最后一帧落点稳定后再清理 transient overlay。测试/取帧时可通过 `window.__universityLiquidCta.setProgress(0..1)` 确定性取样；生产路径只在 active transition 中使用 `requestAnimationFrame`。

## 浏览器帧证据

帧由真实浏览器 session 在 Vite delivery 页面中抓取，并按进度顺序亲自目检。桌面为 `1280×720`，手机为 `390×844`。关键进度点为 `0.20 / 0.50 / 0.70 / 0.82 / 0.90 / 0.98`；其中 `0.82–0.90` 是断开区间。

首页 CTA：

- 桌面：`.scratch/ctapinch/home-desktop-p020.png`、`home-desktop-p050.png`、`home-desktop-p070.png`、`home-desktop-p082.png`、`home-desktop-p090.png`、`home-desktop-p098.png`
- 手机：`.scratch/ctapinch/home-phone-p020.png`、`home-phone-p050.png`、`home-phone-p070.png`、`home-phone-p082.png`、`home-phone-p090.png`、`home-phone-p098.png`

课文完成 CTA 到进度条：

- 桌面：`.scratch/ctapinch/completion-desktop-p020.png`、`completion-desktop-p050.png`、`completion-desktop-p070.png`、`completion-desktop-p082.png`、`completion-desktop-p090.png`、`completion-desktop-p098.png`

静止态参考：`.scratch/ctapinch/rest-desktop.png`、`.scratch/ctapinch/rest-phone.png`。

目检结论：源按钮先保持规则胶囊，随后向目标移动；中段是带尾部的拉丝；断开区间能看到源形状缩小并与目标落点分离；末帧是目标矩形，而不是一个方块平移。手机源按钮较宽，仍走同一机制，目标可见时没有 off-screen 落点。

## 静止态、导航和无障碍证据

- `LiquidCtaTransitionLayer` 在没有 transition 时返回 `null`，active 之前不启动自己的 rAF；单测 `does not schedule a driver while the CTA is resting` 覆盖这一点。
- 静止按钮的 SwimmerUIKit surface 仍是 `data-liquid-motion="static"`、`data-liquid-waviness="0"`；没有重新加入 ambient waviness。
- 首页真实点击立即进入 lesson；真实完成课文后立即进入 `/done`，随后在结算目标挂载后继续动画。
- `prefers-reduced-motion: reduce` 下真实点击仍导航，snapshot 为 `null` 且页面不存在 `[data-liquid-cta-flight]`。
- 缺少目标时，单测确认点击回调仍执行、无 overlay；注册目标晚到时单测确认 transition 立即从 pending 进入 active。
- 原有 `LiquidCtaButton` 测试仍覆盖 native button、键盘 press、焦点与 reduced-motion；overlay 不参与 hit testing。

## 验证结果

已通过：

- `pnpm --filter @pieai/university-ui exec vitest run src/cta/LiquidCtaButton.test.tsx src/cta/LiquidCtaTransition.test.tsx`（12 tests）
- UI / world / app 的 typecheck、lint、format check
- Settlement、LessonScreen、SettlementHost 相关测试（19 tests）
- `node .../impeccable/scripts/detect.mjs --json ...`（无反模式结果）
- `pnpm verify`（全量通过：类型、lint、格式、全包测试、边界、构建、shelf/revision/link 检查和 docs check）

## 未完成或不确定的部分

- 本轮没有可调用的独立 AfterCritic；帧检查是我在真实浏览器中的逐帧目检，不把它表述为独立审稿结论。
- 课文完成 CTA 的确定性帧集本轮保存了桌面版；共享机制和首页 CTA 已保存桌面/手机两种宽度，手机结算页专属帧没有单独再录一套。
- follow tail 由 SwimmerUIKit 的短时物理跟随渲染，确定性 progress 控制的是本项目的 authored phase/geometry；截图在每个 progress 点等待了 follow tail 稳定，因此不是逐像素关闭 kit 内部弹簧的纯静态快照。
- `pnpm verify` 中 `check-export-freshness` 明确报告本机没有 initialized studies，因此它只能通过检查，不能在这台机器上证明作者源与 recovery export 的新鲜度；这与本次 CTA 代码变更无关。
