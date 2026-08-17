# 课程提案

这里是喂给 `pnpm university course …` 的输入文件。

**为什么它们在版本管理里，而 `studies/` 不在。**

`studies/` 是个人校园数据——你的学习进度、复习状态、源码快照，按设计永远只留在本机。
课程内容本身不是个人数据，应该有可进 Git 的恢复出口。旧提案记录了建课、修课的输入，适合
继续留作作者工作台和历史证据；但它们钉着当时的 snapshot/analysis，也可能需要按顺序重放，
所以不再把旧提案承诺成「唯一且一定可重建当前课程」的恢复源。

一条经验：凡是「丢了就再也做不出来」的东西，都该进版本管理；凡是「属于这台机器上这个人」
的东西，都不该进。当前课程成品使用 `course recovery export` 生成 canonical recovery package；
学习记录、UA 数据、snapshot object repository 和历史 revision 不进入这个包。

## 当前课程恢复

正式恢复输出只覆盖当前 active、且源码仍可按精确 commit 验证的 study。输出放在
`course-proposals/recovery/<study>/`，并提交其中的 `index.json` 与它引用的
`<course-id>.<sha256hex>.recovery.json`：

```bash
pnpm university course recovery export --study <study-id> \
  --out course-proposals/recovery/<study-id>
```

恢复前可先只读验证；真正导入时去掉 `--dry-run`：

```bash
pnpm university course recovery import --study <study-id> \
  --input course-proposals/recovery/<study-id> \
  --source <本机 Git 仓库路径> \
  --dry-run
```

恢复包只保留每门 active 课程的当前成品，并把 UA evidence 降为精确 commit/path/line 的
source-only 绑定；包会明确报告丢弃了多少 UA binding。它不会伪装成能恢复个人学习进度或 UA。
截图 provenance 中指向已注册源码仓的 `file-manager:` 绝对路径会写成
`file-manager:<source-root>`；导入时再绑定本机传入的 `--source`，仓库外路径则拒绝导出。
课程文件按内容 hash 命名且不会被覆盖；`index.json` 是最后原子写入的 commit point。导出中途
失败时，旧 index 引用的文件仍然有效，新产生但未被 index 引用的旧文件由 import 忽略。
课程内容发生正式修订后，重新运行 export 并提交新 index 与它引用的新对象；旧的未引用对象
可以在独立确认没有历史 index 需要它们后再清理，不要在课程生产过程中顺手删除。

已 archived 的 study 不属于“当前课程恢复”集合。`ul-meta` 原来学习的
`UniversityLocal-SpecialStudies` 已在完成目标后有意删除；它的四层教学内容已由 active 的
`university-local/four-layer-workbench` 接管，且现行课程修正了旧课已经过时的判分说明。因此
不要复活旧源码目录，也不要提交 `recovery/ul-meta/`。本机 archived study 与 learner 数据继续
核验后没有任何课程进度、卡片、练习、复习、会话或笔记，因此它的失效注册地址和空 study
外壳也已安全退役。以后遇到别的 archived study 时仍须先检查 learner 数据，不能照搬删除。

批量写课过程里的 detector、prompt、report 等中间文件，未来应放进已忽略的
`.scratch/campaigns/<run-id>/`。现有文件暂不移动或删除，避免打断正在进行的课程生产。

## 文件对应关系

| 文件                           | 作用                   | 命令                 |
| ------------------------------ | ---------------------- | -------------------- |
| `ai-cost-and-boundaries.json`  | 建课（SupaLuv）        | `course create`      |
| `generated-assets.json`        | 建课（SupaLuv）        | `course create`      |
| `contracts-and-drift.json`     | 建课（TuringPact）     | `course create`      |
| `state-and-process.json`       | 建课（TuringPact）     | `course create`      |
| `one-codebase-many-hosts.json` | 建课（TuringPact）     | `course create`      |
| `testing-strategy.json`        | 建课（TuringPact）     | `course create`      |
| `rebind-founder-engineer.json` | 把课程重绑到新快照     | `course revise`      |
| `enrich-unit-vs-e2e.json`      | 给已有课时加卡片和练习 | `course revise`      |
| `add-idempotency-lesson.json`  | 给已有单元加一节课     | `course add-lessons` |

## 提案里的快照 ID 会过期

每份提案都钉在一个 `targetSnapshotId` 和 `targetAnalysisId` 上。被学习的项目往前走之后，
旧提案不能直接重放——证据的行号可能已经不对了。重建课程时先确认目标快照仍然存在，
或者跑一次 `refresh audit` 看哪些证据需要重绑。
