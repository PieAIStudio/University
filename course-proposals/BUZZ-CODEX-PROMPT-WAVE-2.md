# 给 Codex 的提示词（第二批：2 门 Buzz 课）

整段拷进 Codex。和第一批一样，中途不会停下来问。

---

```
仓库：/Users/yuanfei/PieAI/UniversityLocal

任务：为 Buzz 再写 2 门课并全部落地。一次做完，不要中途问我要不要继续。

## 先读这些

1. course-proposals/BUZZ-CURRICULUM-WAVE-2.md —— 全文。这份文件里每一条证据行号
   都已经打开文件核对过，可以直接用。
2. course-proposals/BUZZ-CURRICULUM.md 第 7 节（分层写法）和第 8 节（落地流程）。
3. .agents/skills/write-lesson/SKILL.md 及 references/ 下的 variants.md、checklist.md、
   evidence-and-failures.md。

## 已经建好的，直接用，不要重建

  studyId       buzz
  snapshotId    git-02f640bc4559       ← 12 位十六进制，不要截成 8 位
  sourceCommit  02f640bc4559c48ac0c2ec595ef34dd2c294b0db
  源码           /Users/yuanfei/PieAI/_donors/buzz（只读，一个字不许改）

Buzz 这个 study 里已有 5 门课、60 节，全部 active。**不要动它们。**

## 这 2 门课，按顺序做

1. buzz-agent-harness   《让 agent 待在频道里，需要哪些看不见的东西？》
2. buzz-desktop-ui      《这套界面好看，是靠什么撑住的？》

两门都是**普通层级**：读者已读完前两门 foundations 课，Nostr 事件、kind、签名、relay
这些词直接用，篇幅花在这门课真正新的东西上。

单元划分、每节讲什么、用哪条证据，见 BUZZ-CURRICULUM-WAVE-2.md 第 2 节。

## 每门课的做法

  a) 读 WAVE-2 大纲里这门课的设计，读它点到的源码。
  b) 写提案存到 course-proposals/<课程id>.json
  c) pnpm university course create --study buzz --input course-proposals/<课程id>.json --dry-run
     要看到 "outcome": "validated"
  d) 去掉 --dry-run 再跑一次，真正落地（落地即 active，不需要 reactivate）
  e) pnpm lint:lessons —— 要 0 问题
  一门课完整落地了才开下一门。

规格：3 个单元、11–13 节、每节 2 张卡片 + 2 道练习（**有卡片就必须有练习**）。
提案骨架和证据块格式照 course-proposals/buzz-orientation.json，那是已验证通过的样例。

## 证据规矩

- WAVE-2 大纲里给的行号已核对，可直接用。**你新增的每一个锚点，必须自己打开文件数出来。**
- 正文里每个真实项目代码块后紧跟一行锚点：[[evidence:路径:起-止]]
- 锚点写在代码块**外面**，且必须被本节 evidence 数组覆盖。
- sourcePath 是 Buzz 仓库根的相对路径，不带 /Users/... 也不带 _donors/buzz/。
- grep Buzz 源码要加 -a（仓里有二进制和中文，不加会静默返回空）。

## buzz-desktop-ui 必须配图

这门课讲界面，没有截图不算完成。至少 3 张真实截图，走 assetFiles 通道。

采集：用户本机已装 Buzz。截图后**必须**用 `sips -s format png` 明确转成 PNG——
不要相信扩展名。manifest 里的 mime 和文件真实字节不一致时，落地会被直接拒绝
（这是 2026-08-12 修的一个真实故障：一个 JPEG 顶着 .png 的名字存了进去，
之后每次出图都 422，读者看到裂图）。

## 写作要点（容易翻车的）

- 标题必须是问句。`## 先猜一下` 之前不许出现答案。
- 恰好一道开放式预测，不许做成选择题。下面单独一行：随便猜，猜错不影响任何进度。
- 下一节标题恰好是 `## 答案` 四个字，一两句话收，教学内容放中段。
- `决策` 变体必须有 `## 什么时候该反过来`；`术语` 变体必须有 `## 它不是什么`。
- `## 自检` 只提问，不给答案。最后一节 `## 一句话`，恰好一句加粗的话。
- `variant` 只写在提案里，绝不写进 content.md。
- 同一单元连续三节同变体不允许。每 1000 字至少 2 个「你」。
- 禁用词：显然 / 简单来说 / 众所周知 / 显而易见 / 不言而喻。
- **不要为了亲切加内容。** 删掉这句，读者对机制的理解会变差吗？不会就删掉。

## 这两门课特有的三个提醒

1. persona 那节讲 `None` / `Some([])` / `Some([..])` 三态时，读者有 TypeScript 底子，
   把它和 `undefined` / `[]` / `[...]` 接起来讲。这是这节能给的最大价值。
2. 讲 motion.test.mjs 那两节，重点是「设计规范写成文档靠自觉」和
   「写成测试就成了约束」的区别。这是读者作为单人创始人最该带走的一课。
3. 讲 scrollbars.css 同时写标准属性和 ::-webkit- 时，**不要写成 Buzz 做得冗余**。
   scrollbar-color 直到 2025 年 12 月（Safari 18.2）才进 Baseline，
   Buzz 这段代码写在那之前，两套都写是对的。讲清这个时间差。

## 自己核对

每门课落地前，随机挑 3 节，**实际打开被引用的文件数行号**。
dry-run 通过只说明结构合法，不说明课写得好。

## 全部做完后报告

1. 两门课的 lesson / 卡片 / 练习数，变体分布。
2. 亲手核对过哪几节，结果如何。
3. buzz-desktop-ui 用了哪几张截图，分别拍的什么界面。
4. 最后一次 pnpm lint:lessons 输出。
5. **WAVE-2 大纲哪里和源码实际情况对不上。** 这条别省——
   第一批就是因为大纲射程不够，导致 2600 个源文件里只引用了 18 个。

## 边界

- 只往 course-proposals/ 写提案，以及通过 university 命令让内容进 studies/buzz/。
- 不要动已有的 5 门课，不要动 src/、server/、docs/、.agents/，不要动其他 study。
- /Users/yuanfei/PieAI/_donors/buzz 只读。
- 不要 git commit。
```
