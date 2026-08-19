# 给 Codex 的提示词（一次跑完全部 5 门 Buzz 课程）

整段拷进 Codex，**只拷一次，不用改任何东西**。它会把 5 门课从头写到落地，
写完直接能在网页端学。中途不会停下来问。

---

```
仓库：/Users/yuanfei/PieAI/UniversityLocal

任务：为 Buzz 这个被学项目写 5 门课程，并全部落地到可学习状态。
一次做完，中途不要停下来问我要不要继续。

## 先读这些，读完再动手

1. course-proposals/BUZZ-CURRICULUM.md —— 全文。这是这批课的设计判断记录：
   课程地图、每门课的单元方向和素材落点、分层写法规则、已知风险。
2. .agents/skills/write-lesson/SKILL.md —— 房子的教学形状。这批课必须按它写。
3. .agents/skills/write-lesson/references/variants.md —— 五种变体的完整骨架。
4. .agents/skills/write-lesson/references/checklist.md —— 交付前逐条走一遍。
5. .agents/skills/write-lesson/references/evidence-and-failures.md —— 已经踩过的坑。

## 被学的项目

Buzz（github.com/block/buzz）：自托管的团队工作区，人和 AI agent 在同一批频道里，
底层是一条 Nostr 事件日志。Rust 后端（27 个 crate）+ Tauri 2/React 19 桌面端 +
Flutter 移动端。

源码在 /Users/yuanfei/PieAI/_donors/buzz，直接读。

study 和快照已经建好并验证过，直接用，不要重建：

  studyId       buzz
  snapshotId    git-02f640bc4559
  sourceCommit  02f640bc4559c48ac0c2ec595ef34dd2c294b0db

snapshotId 是 12 位十六进制。不要截成 8 位，截短了会报找不到快照文件。

## 这 5 门课，按这个顺序做

1. buzz-orientation        你屏幕上这套东西背后是什么      —— foundations 层级
2. buzz-reading-rust       读懂 Rust（只读不写）           —— foundations 层级
3. buzz-one-message        一条消息的一生（主干）           —— 普通层级
4. buzz-agents-as-members  agent 是成员不是机器人           —— 普通层级
5. buzz-design-tokens      那套好看的配色是怎么来的         —— 普通层级

每门课的单元方向和素材落点，见 BUZZ-CURRICULUM.md 第 6 节。

## 工作方式：一门一门来，每门写完立刻落地，再开下一门

对第 N 门课，依次做完这几步，然后才开始第 N+1 门：

  a) 读 BUZZ-CURRICULUM.md 里这门课的设计，读它点到的 Buzz 源码文件。
  b) 写提案，存到 course-proposals/<课程id>.json
  c) pnpm university course create --study buzz --input course-proposals/<课程id>.json --dry-run
     要看到 "outcome": "validated"。没通过就改到通过。
  d) 去掉 --dry-run 再跑一次，真正落地：
     pnpm university course create --study buzz --input course-proposals/<课程id>.json
     落地即 active，立刻能在网页端学，不需要再跑 reactivate。
  e) 只在第一门课之后做一次：
     pnpm university course set-default --study buzz --course buzz-orientation
  f) pnpm lint:lessons —— 要 0 问题。有问题就修，修完重跑。

**一门课完整落地了才开下一门。** 这样万一中途出问题，已经做完的课是能用的，
不会留下一堆半成品。

全部 5 门做完之后，最后跑一次 pnpm lint:lessons 确认整体干净。

## 课程规格

每门课 3 个单元，每单元 4 节上下，全课 11–13 节。
每节课 2 张卡片 + 2 道练习。**有卡片就必须有练习**，否则 schema 会拒
（卡片是在课程完成后才进复习队列的，而课程靠答练习才算完成）。

提案骨架（字段名严格照这个，多一个字段会被 strict schema 拒）：

{
  "schemaVersion": 1,
  "proposalId": "create-<课程id>",
  "targetSnapshotId": "git-02f640bc4559",
  "course": {
    "id": "<课程id>",
    "title": "《…》",
    "description": "…",
    "audience": "…",
    "objectives": ["…"],
    "units": [
      {
        "id": "…", "title": "…", "objective": "…",
        "lessons": [
          {
            "id": "…",
            "title": "<必须是一个问句>",
            "variant": "现象",
            "content": "# …（正文 markdown）",
            "evidence": [ { …见下… } ],
            "cards":    [ { "id","front","back","evidence":[…] } ],
            "exercises":[ { "id","kind":"short-answer","title","prompt","expectedAnswer","evidence":[…] } ]
          }
        ]
      }
    ]
  }
}

证据块（这是实跑验证通过的样例）：

{
  "kind": "fact",
  "snapshotId": "git-02f640bc4559",
  "sourceCommit": "02f640bc4559c48ac0c2ec595ef34dd2c294b0db",
  "sourcePath": "crates/buzz-core/src/event.rs",
  "lineStart": 11,
  "lineEnd": 19,
  "note": "一句话说明这段是什么。"
}

sourcePath 是 **Buzz 仓库根的相对路径**，不带 /Users/... 前缀，也不带 _donors/buzz/ 前缀。

## 证据这条是死规矩

正文里每一个真实项目代码块后面，紧跟一个锚点：

  [[evidence:crates/buzz-core/src/event.rs:11-19]]

- 行号必须**先打开那个文件数出来**，不许估、不许照抄本提示词里的样例。
- 锚点引用的范围必须被本节 evidence 数组覆盖（同路径，行号落在某条引用的区间内）。
- 不许用 `（位置：xxx:12）`、`**位置：**`、HTML 注释这些冒充锚点，它们不可点击。
- 锚点写在代码块**外面**，紧跟在后面那一行；写进代码块里不会解析。

读 Buzz 源码时 grep 要加 -a。这个仓库里中文和二进制文件不少，不加 -a 会被当成
二进制静默返回空，你会以为「没有」而其实有。

## 分层写法（这批课特别要注意）

write-lesson 的层级规则是按课程 id 前缀 `foundations-` 判断的。这批课 id 都是 `buzz-*`，
**不会自动命中**，所以这里显式指定：

- `buzz-orientation` 和 `buzz-reading-rust` —— **按 foundations 层级写**：
  读者可能从没写过代码，全套扶手，新词第一次出现给白话解释。
  理由：Rust 和 Nostr 对这位读者完全是新的。
- 其余三门 —— **按普通层级写**：读者已经读完前两门，Nostr 事件、kind、签名、relay
  这些词直接用，不再重讲，篇幅花在这门课真正新的东西上。
  理由不是风格偏好：同一种写法对新手有效，对已经懂的人**有害**，过度解释会拖慢他们。

另一条独立规则，每门课的每个单元里都生效：

- 单元**前 1/3** 的课：新词给白话解释；`## 答案` 可以先复述情境；`## 自检` 可以带提示。
- 单元**后 1/3** 的课：已解释过的词直接用；`## 答案` 一句话收；`## 自检` 不给提示。
- 同一个词在同一个单元里不要解释第二次。第二次解释等于告诉读者「我不指望你记住」。

## 读者是谁

编程初学者，单人创始人。已经读完另一个项目的 9 门前置课（TypeScript、React、异步、
数据、产品、质量、读代码），但**没写过 Rust，没接触过 Nostr**。

他已经把 Buzz 装好在用了 —— 建了频道，拉了几个 agent 进去协作。
**不要从「怎么安装」讲起。**

他特别想学两样：agent/harness 的设计，和这个项目的 UI 设计。

## 几条容易翻车的

- 标题必须是问句，不是名词短语，不是「X 的作用」。
- `## 先猜一下` 之前**不许出现答案**，标题里也不许。写完做删除测试：
  把 `## 答案` 往下全删掉，机制还看得出来吗？看得出来就是泄题了，重写开场。
- 恰好**一道**开放式预测，不许做成选择题（包括 A/B/C 列表和「选一个」）。
  下面单独一行写：随便猜，猜错不影响任何进度。
- 下一节标题必须是**恰好** `## 答案` 四个字，不许加后缀。答案一两句话收，
  教学内容放中段，不要把整节课倒进答案里。
- 两个变体各有一个**必须出现**的段落：
  `决策` 必须有 `## 什么时候该反过来` —— 一个被讲成「只有一个正确答案」的取舍就不是取舍，
  那样教出来的人会把它用到不该用的地方；
  `术语` 必须有 `## 它不是什么` —— 绝大多数术语误解来自过度推广，划边界才治得住。
- `## 自检` 只提问，不许出现「答案：」「答：」或括号里的解法。
- 最后一节是 `## 一句话`，恰好一句加粗的话。
- `variant` 只写在提案的 lesson 字段里，**绝不写进 content.md**（写进去会在页面上显示成垃圾）。
- 同一个单元里连续三节用同一个变体不允许。如果第三节确实只有那个变体合适，
  在报告里说明理由，别硬凑一个不合适的。
- 每 1000 字至少 2 个「你」。这是对着读者说话的可测下限。
- **不要为了亲切加内容。** 有趣但与机制无关的故事、名人轶事、可爱的题外话，
  会把读者的注意力抢走，实测让记忆和迁移**变差**。
  判据：删掉这一句，读者对机制的理解会变差吗？不会就删掉。
- 禁用词：显然 / 简单来说 / 众所周知 / 显而易见 / 不言而喻。

## 自己核对，不要自报通过

每门课落地前，随机挑 3 节，**实际打开被引用的文件数行号**，确认引的确实是正文里贴的那段。
不要凭写的时候的记忆判断。

dry-run 通过只说明证据能解析、结构合法，不说明课写得好。

## 全部做完后报告

1. 5 门课各自的落地结果（lesson 数、卡片数、练习数）。
2. 每门课的变体分布；有连续三节同变体的例外就说明理由。
3. 亲手核对过的那些课分别是哪几节，核对结果。
4. 最后一次 pnpm lint:lessons 的输出。
5. **哪些地方素材不够，或者 BUZZ-CURRICULUM.md 给的方向和源码实际情况对不上。**
   这条别省 —— 那份文件是根据一次勘察写的，可能有判断错的地方，直说，不要将就着写。

## 边界

- 只往 course-proposals/ 写提案文件，以及通过 university 命令让内容进 studies/buzz/。
  不要动 src/、server/、docs/、.agents/，不要动其他 study。
- **/Users/yuanfei/PieAI/_donors/buzz 是只读的研究对象，一个字都不许改。**
- 不要 git commit。
```
