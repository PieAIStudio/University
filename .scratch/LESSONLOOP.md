# write-lesson 流水线体检报告

日期：2026-08-31
分支：`work/lessonloop`
范围：只在 `.scratch/lessonloop-sandbox/` 里 dry-run；没有向真实 `apps/local/studies/` 写入内容，也没有落地真实 revision。

## 一句话结论

**今晚可以用它做隔离沙盒的小批量试写，但不能把它当成“无需人工闸门即可批量落地”的可靠流水线：四个模型阶段都跑通了，可交付稿仍未过 lesson lint，而且 linter 漏掉了一个结构问题。**

这不是“第三环今天坏了”：模型路由和 CLI 可用；坏的是交付安全边界还不够硬，尤其是 detail 比例、开场章节计数、Grok 输出净化和几个过期路径假设。

## 样本与安全边界

选取的课是 `turing-pact/foundations-before-zero/what-is-an-app/app-is-a-pile-of-files`，原始 revision 14，变体为 `现象`。

- 原文 hash：`sha256:7cf44395a325c72ef2ea6384ddbd0baf2b93769c0e5e80e277badc8f9231aa60`
- 沙盒 validation fixture 只新增了 revision 15，润色稿 hash：`sha256:8336b554db13dc80012c5dbd85b079dd7b3f981493361c78e37925bb3fce76c3`
- revision 15 的 6 条 lesson-level evidence、2 个 card id（`entry-file-name`、`title-tag-meaning`）和 1 个 exercise id（`doctype-first-line`）均未改变；3 个图片资产只是从 revision 14 复制到 validation fixture。
- `apps/local/studies/` 在本 worktree 仍只有原有的 `.gitignore` 和 `README.md`，`git status --short -- apps/local/studies` 为空。没有真实课文改动，也没有通过 `course` CLI mint revision。
- 完整运行材料在 [lessonloop-sandbox/runs/run-metadata.json](lessonloop-sandbox/runs/run-metadata.json)；原文、各阶段 stdout/stderr、草稿和独立 validation 都保留在同一沙盒目录。

## CLI preflight

在任何模型 prompt 发出前，原样执行了 `grok models` 和 `agy models`，并保存了 stdout/stderr。

| 检查 | 实测结果 |
| --- | --- |
| `grok models` | exit 0；列出 `grok-4.6`；没有出现精确文本 `You are not authenticated.`；选择 Grok Writer/fixer arm |
| `agy models` | exit 0；返回真实模型列表；选择 `gemini-3.7-flash-high` 做 Detector/Polisher |
| 家族边界 | Grok 与 Gemini 不同家族，满足“Writer/fixer 不自检” |
| Codex fallback | 未运行；因为 Grok preflight 通过，不应无故切换到未测量的 fallback |

## 每一环实测结果

| 阶段 | 确切模型 / effort | wall time | 成败与结果 |
| --- | --- | ---: | --- |
| Writer | `grok-4.6` / `high` | 635.26s（10m35.26s） | 模型调用成功，生成 `writer-draft.md`；一次 transport decoding error 后自动重试成功 |
| Detector | `gemini-3.7-flash-high` / `high` | 121.00s（2m01s） | exit 0；只报告读者卡点，没有输出替代课文 |
| Writer/fixer | `grok-4.6` / `high` | 596.75s（9m56.75s） | exit 0，生成 `fixer-draft.md` |
| 有界 Polisher | `gemini-3.7-flash-high` / `high` | 43.33s | exit 0；hedge gate 通过，生成 `polished-draft.md` |
| 以上模型阶段合计 | — | 1396.34s（23m16.34s） | 单课、串行、未测并发吞吐 |
| 独立 checklist fixture | 无模型 | — | `lint-lessons` exit 1；`check-lesson-anchors` exit 0 |

Writer 和 fixer 的 CLI stdout 前面都混入了宿主进度说明，不能未经净化就当作纯 Markdown revision；本次按第一个 H1 提取了最终草稿。初次 Writer 的本地捕获 wrapper 还误用了 zsh 的只读变量 `status`，在子进程成功后报了 wrapper 尾部错误；后续 fixer 使用了修正后的捕获方式。这是本次 runner harness 的问题，不是 Grok 模型调用失败。

## Detector 发现了什么

Detector 对初始 Writer 草稿报告了 6 个问题：

1. `DailyPuzzlePage.tsx` 的长证据段突然插入，和 `index.html → main.tsx` 主线脱节。
2. “界面不是静态图片，而是代码生成的”解释得太晚。
3. `:::detail` 在中段连续堆叠，正文主干被折叠块切断。
4. 预测题依赖的 `<title>` 线索在猜答前没有充分铺垫。
5. 截图切到入口文件的过渡不够自然。
6. detail 标题“这一行的名字会出现在哪？”脱离语境后指代不明。

它确认了预测题问的是核心、`## 答案` 紧跟预测、6 个 evidence token 都落在 manifest 范围内，且没有发现技术事实被改写。Grok fixer 处理了时序、过渡和指代问题，但没有把最终稿推过全部 checklist。

## Checklist / gate 结果

最终有界润色稿先经过 hedge gate：

- 让步词：`2 → 2`
- 绝对化：`0 → 0`
- 标准正文：`2501 → 2433`（`-2.7%`）
- 结果：通过

独立 validation fixture 的 machine audit 通过了：variant/hash、标题问句、唯一 `## 先猜一下`、预测提示语、`## 答案` 邻接、开放式预测、evidence token 与 manifest 双向覆盖、无手抄源码 fence、link 数量/位置、detail 标题和闭合、无禁用系统词、`## 一句话` 末尾格式、资产可服务、card/exercise id 不变、anchor 行号检查。

明确失败的是两项：

1. **Checklist 4：结构形状不严谨。** `现象` 变体规定一个开场章节，但最终稿有两个：`## 先看屏幕上的界面` 和 `## 接下来，我们从一个更小的例子开始`。当前 `lint-lessons.mjs` 只检查开场章节“至少”达到数量，因此错误地放过了它；这是 linter 覆盖不足，不是稿件通过。
2. **Checklist 38 / detail gate：正文展开层不足。** detail 正文为 945 字，标准正文为 1688 字，比例约 56.0%（独立审计为 0.564），低于 60% 下限。`lint-lessons.mjs` 正确 exit 1；这次失败应触发重写，不能用 baseline 豁免。

当前复制的完整 41 节课程还暴露了一个**原有**问题：`how-change-happens/hooks-catch-before-history` 的 detail 为 1108 / 1852，复制课程 lint exit 1。它不在本次目标课，也不是本次草稿造成的；真实课文保持不动。

根级 `pnpm verify` exit 0（119.23s）。其中 `check-export-freshness` 如实提示本 worktree 没有 initialized studies，构建还有既有的大 chunk warning；这些不是本次 lessonloop validation 的通过条件。

## 三条历史陷阱的今日复验

### Claude 的 `--effort`

使用 `agy --model claude-sonnet-4-6 --effort high`，exit 1，原始错误为：

```text
Error: invalid model selection (--model "claude-sonnet-4-6" --effort "high"): --effort is not supported for model "claude-sonnet-4-6"
```

陷阱仍然成立。Claude fallback 必须省略 `--effort`。

### Codex 没有 `--prompt-file`

使用 `codex exec --prompt-file ...`，exit 2，原始错误为：

```text
error: unexpected argument '--prompt-file' found

  tip: a similar argument exists: '--profile'

Usage: codex exec [OPTIONS] [PROMPT]
```

陷阱仍然成立。Codex fallback 应把 prompt 作为位置参数或 stdin 传入。

### 无界 Polisher 会把 hedge 变成绝对句

同一 `gemini-3.7-flash-high` / `high` 做无界润色，31.07s、模型 exit 0，但安全 gate exit 1：

- 让步词：`2 → 0`
- 绝对化：`0 → 7`，出现“绝不、绝对、随时能、根本不”等
- 标准正文：`2501 → 2798`（`+11.9%`）

因此有界 Polisher 的两个规则不是装饰：保留 hedge、不得增长，并且必须在模型之后机械检查。

## 断掉的引用、过期假设和错误

- `write-lesson` 引用的 7 个 references 文件都存在：`pipeline.md`、`models.md`、`variants.md`、`checklist.md`、`media.md`、`evidence-and-failures.md`、`polish-prompt.md`。
- SKILL 里的相对链接 `../../../docs/reference/lesson-pedagogy.md` 实际解析到 `apps/local/docs/reference/lesson-pedagogy.md`，该文件存在；但简报中按仓库根理解的 `docs/reference/lesson-pedagogy.md` 不存在，路径说明不精确。
- `media.md` 写的是 `src/markdown/MermaidDiagram.tsx`，该路径不存在；实际 renderer 在 `packages/ui/src/markdown/MermaidDiagram.tsx`。这是一个真实断链。
- `scripts/lint-lessons.mjs`、`scripts/check-lesson-hedges.mjs` 和 `scripts/check-lesson-anchors.mjs` 都存在并可运行。
- `pipeline.md` 提到的样本源码 `install-git-hooks.mjs:3-10` 在选定 snapshot 中存在；不是断链。
- 本次 dry-run prompt 初版把源码写成 `source/checkouts/...`，而沙盒实际是 `studies/turing-pact/source/checkouts/...`；模型后来自行搜索恢复，但生产 runner 不应依赖模型兜底，应由 dispatcher 传入可解析的绝对/规范化路径。
- 当前 linter 的“开场至少 N 个”实现与变体文档“现象只有一个开场”不一致；它漏过了本次两个 opening heading 的稿件。
- 完整课程的既有 detail debt 会让全课程 lint 失败；不能把它误认为新稿件失败，也不能把新 revision 用旧 baseline 掩盖。
- 三个同级技能只做了要求的存在性/引用完整性检查：`refresh-study` 没有缺失直接引用，`teach-from-study` 的 3 个 references 都存在，`knowledge-node` 的 `capture-proposal.md` 存在；没有对它们做端到端运行。

## 谁来修

### 我可以在代码/skill/runner 层修

- 把 `media.md` 的 Mermaid 路径改成当前实际 renderer，或改成稳定的 package-owned 引用。
- 让 runner 规范化 `studies/<study>/source/checkouts/<snapshot>` 路径，并把模型 stdout 的进度流和最终文本分开。
- 修正 runner 的 child-exit 捕获，避免 zsh 保留变量造成假失败/假成功。
- 把 linter 的 opening 检查从“至少”收紧为变体声明的精确数量，并补一个回归 fixture。
- 让 Writer/fixer 继续修本次两个问题，直到 detail ≥60%、现象开场恰好一个，再重新跑所有 gate。
- 为 Grok transport retry、超时、原始 stdout/stderr 和模型 session 结果保留结构化 receipt。

### 需要产品负责人决定或配合

- 如果未来 preflight 出现 `You are not authenticated.`，重新登录 Grok CLI；如果多人同时占用导致 transport/限流失败，需要决定排队、重试策略和并发额度。
- 接受单课约 23 分钟的串行模型耗时，还是先做批量调度/成本与吞吐评估。
- 把“lesson lint 全绿 + 每课程至少一节人工通读”设为发布门槛；不能只看模型 exit 0。
- 决定如何安排那节既有 `hooks-catch-before-history` detail debt；本次没有替产品负责人改真实课文。

## 没做完或仍不确定

- 没有把任何草稿通过真实 `course` CLI 发布，也没有 mint 真实 revision；这是简报要求的安全边界，不是遗漏。
- 只测了 1 节课、1 条串行链路；没有证明多人并发、限流、长批次稳定性。
- Detector 检查的是初始 Writer 草稿；最终稿由我逐段复读并做机械检查，但没有再加一位独立人类评分者，也没有做浏览器端视觉回归。
- validation 中的 revision 15 是隔离 fixture，不代表真实 studies 已经可发布；在 detail 和 opening 两项修复前，不能把 `polished-draft.md` 当成可落地课程。
