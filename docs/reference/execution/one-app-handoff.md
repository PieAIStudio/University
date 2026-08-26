---
id: REF-ONE-APP-HANDOFF
title: One App Handoff
type: reference
status: active
canonical: true
owner: human
created: 2026-08-25
last_reviewed: 2026-08-26
domain: execution
tags:
  - current-work
  - architecture
pinned: false
---

# 合成一套代码：交接给下一个 session

这份文件是给**一个全新 session** 读的。它不知道前面几天发生了什么，所以这里写清楚：
要做什么、为什么现在做、真正的差异有几条、按什么顺序做、以及哪些坑已经踩过了。

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

## 真正的差异现在有三条

数过了，不是感觉。两个壳各自构造的 port：

| Port | 投放端 | 作者端 | 是不是真差异 |
| --- | --- | --- | --- |
| Grading | `createOnlineGradingPort` | `createHttpGradingPort` | **是**（AI 从哪来） |
| Reader | `createOnlineReaderPort` | `createHttpReaderPort` | 一半是（课文从哪来） |
| SourceAccess | `createOnlineSourceAccessPort` | `createLocalSourceAccessPort` | **是**（能否触达课文背后的源码仓库） |
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
3. SourceAccessPort —— 本地 checkout / UA 图谱 / 分层动作 vs 解释能力边界与未来支持路径
```

「有没有作者工作台」不属于这三条。`#/studio` 里没有任何东西在写课——写课是 CLI + 文件；
它仍是明确的作者端专属边界。UA 图谱入口和「这门课引用了哪些文件」面板则是学习者面，
两端都渲染，`SourceAccessPort` 在本地执行或在交付端解释。分级测验 `CourseRouteQuiz` 与知识
笔记 `KnowledgeNotesSection` 也不因此变成作者端专属学习面：它们有各自的共享落点，缺少内容时
显示空态。

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

### 第 2 步：把三条边界收成一份接口

`ContentPort`：两端各自实现，但接口写死一份，放 `packages/core/src/ports/`。
`GradingPort` 已经有共享接口；`SourceAccessPort` 现在补上第三个问题：这一端能不能触达课文背后的
仓库。它返回本地动作或结构化解释，学习者面不在端口里分叉。

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

### 第 5 步：把两个学习者功能从「作者工作台」里挖出来（**必做**）

这一步在把 `#/studio` 搬进 `src/authoring/` 的**同时**做，不能拖到后面。

理由是时序：`src/authoring/` 会被构建期常量摇出投放端的包。如果这两个东西还在里面，
它们会**被构建排除在投放端之外**——问题从「藏得深」变成「编译期就没了」，更难发现。

它们都不写课（写课是 CLI + 文件），去处已经定了，见 `current-work.md` 第 12 条：

- `KnowledgeNotesSection` → **图鉴的第五个收藏夹**。`LibrarySurface` 已经管着标签页。
  两端都挂；投放端在第 11 条的管线把笔记随包导出之前显示空态——和任何一个还没有内容的
  收藏夹是同一个形状。搬的时候要改两处：`basePath` 从写死的 `/api/studies/…` 变成 prop；
  CSS 跟着搬，并且不能再读 `--campus-rule`（那是作者端才定义的变量）。
- `CourseRouteQuiz` → **课程岛的侧边面板，仅当这门课没开始过**。「我该从哪一关开始」
  只在这一刻是活的问题。`ROUTE_STARTS` 现在写死绑 `foundations-before-zero`，改成按
  courseId 索引，只对登记过入口的课渲染。

顺带：课程岛那块侧边面板两端各写了一份（投放端在 `App.tsx` 的 `underlay`，作者端在
`WorldLanding.tsx`）。这一步正好把它收成一个共享组件，测验挂在里面——**一个挂载点，
不是两个**。

**这一步是唯一会改变行为的一步，所以它单独一个提交。** 前面 1–4 步的验收线是「数字一个不差」；
这一步会新增两个可达的界面，所以它的验收线不同：
测试数**只许涨不许跌**，`pnpm e2e` 仍然 16 passed，并且两端各截一张 图鉴→笔记 和
一张「没开始的课程岛上有测验」。先把 1–4 做绿、提交，再做这一步——否则一旦出问题，
你分不清是搬家搬坏的还是这一步带来的。

### 第 6 步：删掉旧目录，更新脚本

`scripts/start.mjs`、`pnpm dev`、`pnpm e2e` 的启动器、`apps/local/scripts/check-module-boundaries.mjs`。

## 不许破坏的东西（合并前先记下当前值，合并后必须相等或更好）

```
pnpm verify           退出码 0
pnpm e2e              16 passed
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

## 这一轮**只做合并**，别的都不做

其余的活在 `current-work.md` 的 `## Order Of Work` 里，编号 1–14。**这份文件不复制那份队列**
——同一件事写两个地方然后开始漂，正是这个项目这几天一直在修的病。

不做的理由不是「没时间」，是**合并的全部安全性来自「每一步都不改变任何行为」**（第 5 步是
唯一的例外，它单独一个提交，验收线也不同——见上）。每步做完，
`pnpm verify` 和 `pnpm e2e` 必须和做之前一模一样：16 passed，测试数一个不差，课程数一节不差。
一旦掺进任何会改变行为的活，「数字变了」就不再是警报——你永远在想「是不是新功能带来的」。
**会误报的警报等于没有警报。**

下面这几条最容易被顺手做掉，所以点名。**看到了就绕开，并在 PR 里说一句「没碰」。**

（第 12 条不在这张表里——它是**这一轮必做**的第 5 步，理由见上。）

| 队列编号 | 事 | 为什么这一轮不碰 |
| --- | --- | --- |
| 1 | 学习数据接云端 | **归属者是人，不是 AI。** 需要一次真实的 Supabase 部署（`university.progress` + RLS），SwimmerBackend 的 `work/university-schema` 还没并；而且 `.env` 里要放一个 key —— 凭据由老板放置。**代码这边已经写完并且两端共用**：`ProgressPort` 写文档、`packages/backend` 挂远端、`flush()` 有冲突处理。今天没有远端只是因为 `VITE_SWIMMER_CORE_SUPABASE_URL` 没配，于是 `progressRemoteStore` 是 null。**顺带一提**：这也是两端进度看起来不一样的真正原因——`localhost:9999` 和 `localhost:9998` 是两个 origin，`localStorage` 各存各的；云端一接上就是同一行。 |
| 11 | UA 图谱进投放端 | 要改导出格式、导入脚本和阅读器 —— **是加功能，不是搬代码。** |
| 13 / 14 | 星球的美术、等级与 XP 曲线 | 一个是美术方向，一个要老板定曲线。 |

队列第 6 条（ContentPort、EvidencePort、删掉投放端重复的阅读器）**是这一轮的一部分**，不是例外
—— ContentPort 正是让那份重复阅读器可以删掉的东西。做完之后把第 6 条划掉。

## 交付的时候要说清楚三件事

1. 合并前后的那组数字，并排贴出来。
2. 两端各开一次的截图（地图、课程岛、课文、星球）。
3. 上面那张表里每一条，明确写「没碰」。
