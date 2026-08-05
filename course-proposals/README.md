# 课程提案

这里是喂给 `pnpm university course …` 的输入文件。

**为什么它们在版本管理里，而 `studies/` 不在。**

`studies/` 是个人校园数据——你的学习进度、复习状态、源码快照，按设计永远只留在本机。
但课程内容本身不是个人数据，而且如果只存在于 `studies/` 里，那么一次磁盘故障就意味着
所有课程连同重建它们的方法一起消失。提案是**唯一能重建课程的东西**，所以它们跟着代码走。

一条经验：凡是「丢了就再也做不出来」的东西，都该进版本管理；凡是「属于这台机器上这个人」
的东西，都不该进。提案属于前者，学习记录属于后者。

## 文件对应关系

| 文件 | 作用 | 命令 |
| --- | --- | --- |
| `ai-cost-and-boundaries.json` | 建课（SupaLuv） | `course create` |
| `generated-assets.json` | 建课（SupaLuv） | `course create` |
| `contracts-and-drift.json` | 建课（TuringPact） | `course create` |
| `state-and-process.json` | 建课（TuringPact） | `course create` |
| `one-codebase-many-hosts.json` | 建课（TuringPact） | `course create` |
| `testing-strategy.json` | 建课（TuringPact） | `course create` |
| `rebind-founder-engineer.json` | 把课程重绑到新快照 | `course revise` |
| `enrich-unit-vs-e2e.json` | 给已有课时加卡片和练习 | `course revise` |
| `add-idempotency-lesson.json` | 给已有单元加一节课 | `course add-lessons` |

## 提案里的快照 ID 会过期

每份提案都钉在一个 `targetSnapshotId` 和 `targetAnalysisId` 上。被学习的项目往前走之后，
旧提案不能直接重放——证据的行号可能已经不对了。重建课程时先确认目标快照仍然存在，
或者跑一次 `refresh audit` 看哪些证据需要重绑。
