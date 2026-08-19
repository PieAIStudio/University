# 给 Codex 的提示词：把 TuringPact 的课程全部刷新到最新版本

整段拷进 Codex。这是一个长任务，中途不要停下来问要不要继续。

---

```
仓库：/Users/yuanfei/PieAI/UniversityLocal
被学项目：/Users/yuanfei/PieAI/TuringPact（只读，一个字都不许改，也不许切分支）

任务：把 study `turing-pact` 的全部课程刷新到当前最新提交，让 31 门课全部回到
active，并且截图和代码是同一个版本。一次做完。

## 现状（我已经量过，可以直接用）

  被学项目 HEAD      658b36ef0f55   2026-08-16
  已有快照            git-3b402e069a5d（7月22日）、git-54d344a60c62（8月13日）
  已有 UA 分析        ua-3b402e06-…-179ee6bc7b4a、ua-54d344a6-…-a8d1331a4afa
  课程                31 门，其中 23 门 stale
  最深的一门          foundations-before-zero：164 项里 96 项过期，涉及 24 节课

有一个改到一半的状态需要你收尾：
`foundations-before-zero` 是 stale，因为我为了替换两张过期截图对它执行了
open-for-edit，并把 `app-is-a-pile-of-files` 改到了第 11 版（截图已重拍并钉在
54d344a6）。刷新到新快照时这两张图会再次过期，**必须再拍一次**。

## 步骤

1. 注册新快照和新分析
   pnpm university study register-snapshot（或项目里等效命令，先 --help 看清楚）
   目标提交 658b36ef0f55。
   然后跑一次 UA 分析：`prepare` → 让 UA 跑 → `finalize`。
   UA 的 worktree 是自动建自动删的，你不用手工管。

2. 审计，拿到确切的待办清单
   pnpm university refresh audit --study turing-pact --snapshot <新快照> --analysis <新分析>
   **必须同时带 --analysis**。不带的话每条原因都会是
   「UA-backed evidence has no target analysis for comparison」，清单没法看。

3. 逐门课刷新，一门做完再开下一门
   a) pnpm university course open-for-edit --study turing-pact --course <课程>
   b) 对该课每一个 stale 的 lesson 写改版提案，走
      `course revise --dry-run`（要看到 "disposition": "validated"）→ 去掉 --dry-run
   c) pnpm university course reactivate --study turing-pact --course <课程> \
        --snapshot <新快照> --analysis <新分析>
   d) pnpm lint:lessons —— 要 0 问题

   注意：reactivate 要求这门课**每一项**都对新快照 fresh，差一项都不行。
   所以 (b) 必须做完整，不能只挑几节。

## 改版提案的形状（照抄，别猜）

已验证可用的样例：`course-proposals/reshoot-daily-54d344a6.json`

必填且容易漏的：
- `targetSnapshotId` 和 `targetAnalysisId` 都要给。只给快照会被拒：
  「UA evidence must point to the target analysis identity」
- `cards` 和 `exercises` 是**全量替换**。留空数组会把它们删掉——
  必须从 `<lesson>/cards/<id>/latest.json` 和 `revisions/<n>/card.json` 读出来带上。
- `assetFiles` 的字段是 `{path, sourcePath}`，`path` 是 manifest 里的相对路径
  （如 `assets/xxx.png`），**不是** assetId。
- `expectedRevision` 要等于该 lesson/card/exercise 当前的 contentRevision。

## 截图必须重拍（这条以前没人管，现在 lint 会拦）

规则 29：`capture.sourceCommit` 必须等于本课证据的 sourceCommit。
全库 561 节课里没有一节的证据横跨多个提交，所以「本课的提交」是唯一确定的。

重拍方法已经验证过，脚本在 `course-proposals/reshoot/shoot-daily.mjs`：

  1. 在被学项目建 detached worktree（**不要动主 checkout**）：
     git -C /Users/yuanfei/PieAI/TuringPact worktree add --detach <临时目录> <目标提交>
  2. cd 进去 `pnpm install --frozen-lockfile --ignore-scripts`（约 5 秒，pnpm 硬链接）
  3. `npx vite --port <端口> --strictPort`
  4. 用 playwright 截图。脚本必须放在 worktree **内部**才能解析到模块，
     且要从 `@playwright/test` 导入（`playwright` 不是直接依赖）。
  5. 做完 `git worktree remove --force` + `git worktree prune`，不留痕迹。

三条硬要求：

- **标注框要量出来，不要用肉眼画。** 从被学项目真实类名的
  `getBoundingClientRect()` 取坐标。我第一次用 `[class*="forensic"]` 模糊匹配，
  结果框住了提示文字而不是结果面板——教错位置比不教更糟。
- **图注不许写会轮换的东西。** 每日谜题按日期推导，原图注写死了「已选中 Blink」，
  而 Blink 只在特定日期出现，根本无法复现。改成描述区域，别提具体名字。
- **MIME 必须和字节一致。** 存之前用 `sips -s format png` 明确转换，别信扩展名。
  manifest 声明和真实字节不符会被直接拒（这是 2026-08-12 修的真实故障）。

## 边界

- 只写 `course-proposals/`，以及通过 university 命令让内容进 `studies/turing-pact/`。
- 不动 `src/`、`server/`、`docs/`、`.agents/`，不动其他 study。
- /Users/yuanfei/PieAI/TuringPact 只读；临时 worktree 用完必须删干净，
  跑完 `git worktree list` 只能剩主 checkout。
- 不要 git commit。

## 做完报告

1. 31 门课最终状态，还有几门不是 active。
2. 改了多少 lesson / card / exercise，重拍了几张截图。
3. 最后一次 `pnpm lint:lessons` 和 `pnpm verify` 的输出。
4. **哪些课你判断不该刷新，为什么。** 这条别省——有些课引用的文件变化只是
   格式或行号漂移，硬改反而会把讲清楚的东西改坏；直说比硬凑更有价值。
5. 遇到的、这份提示词没写到的坑。
```

---

## 补充（如果上面那段已经发出去了，把这段单独补给 Codex）

```
补两条，都是刷新课程时最容易翻车的地方。

## 一、必须读并遵守课文技能

.agents/skills/write-lesson/SKILL.md 全文，以及 references/ 下的
variants.md、checklist.md、evidence-and-failures.md、pipeline.md。

刷新不是「把行号改对」。行号对了但说法还是旧的，等于用合法的引用讲错的话——
比明显的报错更难发现。每一节被刷新的课，正文都要重新对着新代码读一遍。

## 二、必须交叉验证，而且探测器只准报不准写

这个项目做过盲评实验（3 组各 30 分，协议是看到结果之前写死的）：

  grok 写 + 第二个模型探测 + grok 补     29/30，最低分 9
  Flash 起草 + grok 修                  25/30，最低分 7
  grok 独写                             22/30，最低分 6

B 组的下限等于另外两组的上限。做法：

1. 用 grok 写/改课文。
2. 用另一个模型（Gemini Flash 或同级）**只读代码、只报问题**，逐条核对
   「这段话说的，是不是这段代码真的在做的事」。
3. 把报告交回 grok 修补。

**探测器绝对不许直接改课文。** 让它提建议，它的建议就会变成最终答案，
而不是最好的答案。它的职责是发现缺陷，不是产出内容。

为什么这一步不能省：C 组出现过对着真实代码编造说法的情况——把
`install-git-hooks.mjs:3-10` 说成「检查工作区干净」，而那几行实际是
`git rev-parse --is-inside-work-tree`。路径真、行号真、说法假。
**这类错误没有任何机械检查器能抓**，lint 会全绿。只有第二个模型去读代码才能发现。

刷新场景比新写更危险：代码变了、旧说法还在、行号照样合法。
所以每一节改过的课都要过这一轮，不是抽查。
```
