---
id: POLICY-SHARED-WEB3D-CAPABILITY-ALIGNMENT
title: Web3D Capability Alignment
type: policy
status: stable
canonical: true
owner: human
created: 2026-08-17
last_reviewed: 2026-08-17
domain: web3d
tags:
  - shared-rule
  - web3d
  - capability-alignment
pinned: true
related: []
supersedes: []
superseded_by: null
---

# Web3D Capability Alignment

适用场景：你在 PieAI 的 Web3D 项目里（Break / YaZu / OwnMySpace / Non-Heroes /
Show / TuringPact / PieAIStudio-Site）做画面、音频、物理、输入、壳、资产或
AI 接入相关的工作。

核心原则：**同一个能力，全产品线只学一次。** 先查品牌套件，再查 donor，再自造。

## 0. 动手前先做这三步

1. 读 `docs/policy/shared-rules/donors.md`（就是 `_donors/donors.md`）。
   先看当前产品那一行：写「不用」就不要搬。新 donor 的网址只加在那一份文件里。
2. 组合工作区里读 PGS 的
   `docs/reference/web3d-capability-catalog.md`；独立 clone 没有 PGS checkout 时，
   以本规则下方八条基线和项目自己的证据为准，不猜本机绝对路径。
3. 如果目录里有这个能力，读它列出的**内部参考实现**和 PGS 的
   `docs/reference/web3d-capability-baseline.md`。
   2D UI、模型调用、账号、调色、游戏服骨架先走
   `docs/policy/shared-rules/brand-kit-first.md`，不要用 donor 替换品牌套件。

这三步比自己从零试快得多。反例是真实发生过的：YaZu 做出了很好的调色，Break 手工
抄了一遍，OwnMySpace 又独立写了第三套更弱的——因为没人知道前两套存在。

## 1. 能力基线（八条，必须满足或登记例外）

1. 一个 canvas 只有一个 renderer owner，不跑两套 render loop
2. 明确的色彩管线：有 tone mapping，**sRGB 只编码一次**
3. 至少一层 grade/post，且在文件头登记来源
4. DPR clamp + 移动端降级档
5. 音频解锁策略（首次手势前不调 `resume()`）
6. AI 调用必须经 `@pieai/swimmer-ai-kit`，产品代码里不出现 provider SDK
7. 2D UI 用 `@pieai/swimmer-ui-kit`，不在 WebGL canvas 里重做按钮和表单
8. 移动/桌面出口契约：输入意图抽象、安全区适配、运行时无外部 CDN、
   音频解锁、生命周期暂停/恢复

不满足就由 portfolio control plane 的 owner 在 PGS portfolio manifest 里登记
`technologyExceptions` 并写清理由，不要默默跳过。

## 2. 画面要"商业化"，先查这四件事

按性价比排序，不是按难度：

1. **灯光**。调色救不了没打光的场景。先确认场景有明确的主光/补光/环境光。
2. **tone mapping**。默认 ACESFilmic。没有它，画面永远是"网页 demo"质感。
3. **grade（调色）**。冷阴影 + 暖高光 + 轻微对比扩张 + vignette。
   一个全屏 pass，成本极低，视觉收益最大。
4. **AO（环境光遮蔽）**。物体和地面接触处的阴影。没有它，场景像贴纸浮在背景上。

参考实现：YaZu `src/render/post/colour-grade.ts` + `grade-shader.ts`
（commit `095b00bc92ca260c3469e3d489bcb354d8aa6083`）。

## 3. 最容易踩的坑：重复编码

`EffectComposer` 插进去以后，three 在非 canvas render target 上会跳过 ACES 和 sRGB。
如果你没接管这件事，很容易出现**两次 tone mapping** 或**两次 sRGB 编码**。

它不会报错。它只会让画面发灰或死黑，而且事后极难定位。

判断方法：把整条链路写下来，从场景渲染到最终 blit，数一遍 tone map 出现几次、
sRGB 编码出现几次。各应该是一次。

## 4. 抄结构，不要抄数值

调色常数、物理参数、粒子预算、音量都是**场景相关**的。

真实证据：YaZu 的源码注释写明 donor 的 contrast pivot `0.5` 对 YaZu 是错的——
YaZu 的中间调实测在 display-linear `0.066`，按 0.5 扩张会把整个画面压暗。
Break 又因为自己是夜景，去掉了 YaZu 的第二条 filmic 曲线。

所以：读结构、理解为什么这么排，然后**在你自己的场景上重新测一遍中间调**。
如果你的文件头写不出"我重调了什么、为什么"，说明这次吸收还没做完。

## 5. 跨项目取经要登记来源

从另一个 PieAI 项目吸收实现，和从外部开源 donor 吸收一样要留记录。写在吸收文件的
头注释里：

- 来源仓库和**精确 commit**（不能写分支名，内部项目变得比外部 donor 快得多）
- 读了哪些源文件
- 复用了什么
- 改了什么、为什么
- 明确拒绝了什么、为什么

范本：`Break/src/client/game/render/ChasePostFx.tsx` 的文件头。

哪个项目是哪个能力的参考实现，查
PGS `docs/reference/internal-reference-implementations.md`。

如果来源项目工作树是脏的，先钉一个真实 commit 再吸收——你没法引用还没提交的东西。

## 6. 不要为了"统一"而安装

装依赖 ≠ 用上能力。

真实证据：`@react-three/postprocessing` 早就装在 Break、OwnMySpace、Show 三个项目里，
唯独 YaZu 没装——但画面最好的是 YaZu。装上不会自动变好看。

一个这个周期不会渲染出来的依赖，会占 bundle 体积和移动端 GPU 预算、
每次版本清扫都要跟、出现在每次安全审计里，而且会误导下一个读 `package.json` 的
AI 以为项目打算用它。

**能力想占位，占在基线清单的槽位里，不要占在 `package.json` 里。**
用到的时候 `pnpm add` 只要十秒；真正的摩擦从来不是安装，而是不知道该用什么、
不知道怎么调。

## 7. 外部 donor

产品线只有一份名单：`docs/policy/shared-rules/donors.md`。
新网址加在那一份里，并更新「各产品怎么用」。不要写进 `AGENTS.md`。

**WOC（world-of-claudecraft）不是渲染代码 donor。** 它是 Svelte + plain
Three.js 0.165，没有 React 也没有 R3F，渲染层无法移植到 R3F 栈。它的价值在音频解锁
策略、Capacitor/Electron 壳、移动 HUD、资产流水线和运行诊断。YaZu 的调色来自
procedural dungeon，不是 WOC。
