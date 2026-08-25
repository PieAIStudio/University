---
id: REF-ONE-APP-HANDOFF
title: One App Handoff
type: reference
status: active
canonical: true
owner: human
created: 2026-08-25
last_reviewed: 2026-08-25
domain: execution
tags:
  - current-work
  - architecture
pinned: false
---

# 合成一套代码：交接给下一个 session

这份文件是给**一个全新 session** 读的。它不知道前面几天发生了什么，所以这里写清楚：
要做什么、为什么现在做、真正的差异只有几条、按什么顺序做、以及哪些坑已经踩过了。

## 一句话

`apps/local` 和 `apps/online` 合成**一个浏览器应用**，用启动/构建模式决定它是作者端还是投放端。
`apps/local/server`（Node，21k 行）**不动**，它本来就是另一个构建产物。

## 为什么是现在，而不是更早

老板问过三次。前两次的回答是「先减，再合」，理由是：直接合并会把「两个文件不一样」变成
「一个文件里到处是 `if (mode === 'local')`」——**分叉还在，只是从看得见变成看不见**。

那个理由现在不成立了，因为减已经做完了大部分：

| 已经搬进共享层 | 在哪 |
| --- | --- |
| 「今天」面板 | `packages/ui/today/TodaySection.tsx` |
| 世界地图舞台 | `packages/world/WorldMapCanvas.tsx` |
| 课程岛的相机、石头标签、场景折叠 | `packages/world/course-map.ts` |
| 「哪块石头是亮的」读模型 | `packages/core/progress/source.ts` |
| 星球选课 | `packages/world/planet/` |
| 目录、图鉴、练习、收藏、会员、排行榜、任务 | `packages/ui/` |

而**漂移的速度没有下降**：仅 2026-08-25 一天就发现三处新的不一致（作者端没有课程岛这一层、
星球页是个盒子页不是世界、UA 入口只有一端有）。减少的是每次分叉的**大小**，不是**频率**——
频率来自「有两个地方可以做同一个决定」，只有合并能拿掉它。

## 真正的差异只有两条

数过了，不是感觉。两个壳各自构造的 port：

| Port | 投放端 | 作者端 | 是不是真差异 |
| --- | --- | --- | --- |
| Grading | `createOnlineGradingPort` | `createHttpGradingPort` | **是**（AI 从哪来） |
| Reader | `createOnlineReaderPort` | `createHttpReaderPort` | 一半是（课文从哪来） |
| Review | `createOnlineReviewPort` | `createHttpReviewPort` | **不是** |
| VocabularyReview | `createOnlineVocabularyReviewPort` | `createLocalVocabularyReviewPort` | **不是** |
| Progress / Identity | `packages/backend` + 共享 port | 同上 | 已经是一份 |

Review 和 Vocabulary 看起来是差异，其实不是：它们唯一的壳相关部分是**卡片的正文从哪来**
（投放端 `peekCourse()` 读打包内容，作者端 fetch `/api/…`）。剩下的全部落在同一个共享
progress document 上。

所以真正的差异集合是：

```
1. GradingPort   —— 剪贴板/本地 AI 宿主   vs   SwimmerAIKit（计量）
2. ContentPort   —— 本地 HTTP（存了就看见） vs   静态包（先冻结再发）
```

第三条曾经被写成「有没有作者工作台」，那是错的。`#/studio` 里没有任何东西在写课——写课是
CLI + 文件。它装的是：一个 UA 图表按钮、一个只读的「这门课引用了哪些文件」面板，以及**两个
被埋在里面的学习者功能**（分级测验 `CourseRouteQuiz`、知识笔记 `KnowledgeNotesSection`）。
那不是壳差异，那是**一个屏幕的数据只有一端有**，属于内容管线。

## 顺序

每一步结束时都必须 `pnpm verify` 绿 + `pnpm e2e` 绿 + 两端在浏览器里各开一次。
**任何一步都不允许把红的状态提交上去。** 在 worktree + 分支上做，`main` 始终可运行，
因为老板要用 `main` 学课。

### 第 0 步：worktree

```
git worktree add ../University-wt-one-app -b work/one-app
```

### 第 1 步：一个路由（最大、最risky，先做）

作者端现在有**两套地址**：hash 管导航槽（`ShellSlot`，13 个），pathname 管 study+lesson
（`AppAddress`）。投放端只有一套：`View` 联合类型，全 hash。

投放端那套是对的（可链接、刷新不丢、静态托管不会 404）。作者端换成它。

`apps/online/src/url-state.ts` 的 `View` **已经覆盖了作者端的每一个槽，只差 `studio` 一个**。
加一个 kind 就够。

已经踩过的坑（不要再踩）：Chrome 对**同文档的 hash 跳转也会触发 `popstate`**。作者端的
`sync()` 会从 pathname 重建全部状态，所以「写 hash」会顺带把 study 抹掉——2026-08-25 修过一次
（见 `apps/local/src/App.tsx` 里 `syncedPath` 的注释）。换成一套地址之后，这个补丁应该整个删掉。

### 第 2 步：把两条 port 收成一份接口

`ContentPort`：两端各自实现，但接口写死一份，放 `packages/core/src/ports/`。
`GradingPort` 已经有共享接口了。

判断标准：**Review 和 Vocabulary 两个 port 应该消失**，变成共享实现 + 注入的 ContentPort。
如果做完还留着四对 port，说明没做对。

### 第 3 步：合并 app

新目录 `apps/university/`（或者把 `apps/online` 改名——两者都行，但别留两个）。

- 一个 `main.tsx`
- 一个 `App.tsx`
- `src/ports/local/`、`src/ports/online/` 各放一套 port 实现
- `src/authoring/` 放 `#/studio` 那一支
- 启动时按 `import.meta.env.MODE` 选 port

**构建期常量，不是运行期对象。** 只有 `import.meta.env.MODE` 这种编译期能确定的值，
Rollup 才会把另一边的代码摇掉；换成一个运行期传进来的 capabilities 对象，投放端的包里
会带上整个作者端。

### 第 4 步：一个 Vite 配置，两个模式

```
vite --mode local  --port 9999   （代理 /api 到 4317）
vite --mode online --port 9998   （serve /content/）
```

**每个模式必须有自己的 `cacheDir`。** 2026-08-25 踩过：两个 Vite 跑在同一个 app 目录会
共用 `node_modules/.vite`，后启动的那个重新预打包、改掉依赖的哈希，先启动的那个还在按旧哈希
发货，浏览器拿到 `504 Outdated Optimize Dep`，页面变白。已经在 `apps/online/vite.config.ts`
和 `e2e/vite.local.config.ts` 里各留了一个 `cacheDir`，合并时保留这个做法。

### 第 5 步：删掉旧目录，更新脚本

`scripts/start.mjs`、`pnpm dev`、`pnpm e2e` 的启动器、`apps/local/scripts/check-module-boundaries.mjs`。

## 不许破坏的东西（合并前先记下当前值，合并后必须相等或更好）

```
pnpm verify           退出码 0
pnpm e2e              13 passed
测试数                 core 322 / ui 228 / world 121 / online 67 / local 454
课程数                 5 个世界 · 53 门课 · 150 单元 · 579 节
```

再加一条**新的**检查，用来替掉几条老的对齐检查：

> 投放端的构建产物里，不允许出现 `src/authoring/` 下的任何模块。

这一条能替掉「两端逐项比对」里的一部分，是净减少脚本，不是净增加。

## 已经有的防线，别删

- `e2e/G.one-chrome.spec.ts` — `G` 比对两端的导航栏/胶囊/头像，`G2` 让两端走同一条
  「点岛 → 课程岛 → 石头 → 关卡卡片」。两个断言都是 `expect(local).toEqual(online)`，
  **不是**「这边有」——后者在坏掉的整段时间里，好的那一端一直通过。
- `UniversityShell` 的 `identity` 是**必填**，`null` 是合法值。这个组合是故意的：一个壳可以
  决定不显示头像，但不能**不小心**不显示。
- `LessonDocumentKey` 是打了烙印的类型。文档用三段键，共享表面用四段键（`lessonRefKey`），
  两者都合法且**不可互换**——它们曾经被传进同一个函数，结果是一节课永远完不成。

## 合并**不会**解决的事（别在 PR 里假装解决了）

- **UA 图谱只有作者端有。** 它读本地那份 Understand Anything 图，投放端没有仓库。想让投放端
  也有，正确做法是把图谱**随课程包导出**，走内容管线，不是壳的事。
- **学习数据还没真的进数据库。** `VITE_SWIMMER_CORE_SUPABASE_URL` 没有配置，所以
  `progressRemoteStore` 是 null，所有进度/AI 判分/阅读标记都只在 `localStorage` 里。管线是通的、
  两端共用的、写法是对的——**缺的是一次外部部署**（SwimmerBackend 的 `work/university-schema`
  还没并）。这条和合并无关，两端一样。
- **分级测验和知识笔记还埋在 `#/studio` 里。** 它们是学习者功能，放错了抽屉。搬去哪是产品决定，
  等老板定。
