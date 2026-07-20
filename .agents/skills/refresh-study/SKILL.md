---
name: refresh-study
description: 在被学习项目产生新本地 Git commit 后，安全刷新 UniversityLocal 的固定源码快照、Understand Anything 知识图谱、课程与对话知识笔记。用户说“项目更新了”“重新跑 UA”“更新学习资料”“检查哪些课程过期”时使用；本地 commit 足够，绝不要求 GitHub push，也绝不分析或改写未提交文件。
---

# Refresh Study

把被学习项目的新版本带进“大学”，同时保留旧教材历史。类比：commit 是盖章后的新机器图纸；GitHub push 只是把图纸寄到异地，不是学习的前提。

## 永久边界

1. UniversityLocal 只读被学习仓库，所有快照、UA 数据、课程、笔记和学习记录都写在 UniversityLocal 的 `studiesRoot`。
2. 本地 commit 就能刷新；不要要求 push，不要访问 GitHub。
3. 快照只包含 commit。工作区未提交内容永远不进入学习资料。
4. 默认遇到 dirty 工作区必须停止。只有用户在当前对话明确同意“按当前 commit 学习并排除未提交文件”后，才能使用 `--acknowledge-dirty-excluded`。以前的同意不能永久复用。
5. 只在 `refresh prepare` 返回的受管 workspace 运行 UA，绝不在真实源码根目录运行，不安装 hook，不移动或删除源码仓库原有 `.ua`。
6. 不覆盖旧课程或笔记。内容更新必须追加 revision，旧证据永久保留。
7. 不调用 SwimmerBackend 或任何云同步。

## 1. 查看起点

```bash
pnpm university -- status --study <study-id>
```

记录 `source.headCommit`、branch、dirty entries、最新 snapshot 和 ready UA IDs。若用户说“代码改好了”但尚未 commit，解释：像老师不能引用仍在白板上修改的草稿，请先在被学习项目提交。不要代替用户提交、清理或丢弃那个仓库的改动。

## 2. 准备固定快照

先运行安全默认命令：

```bash
pnpm university -- refresh prepare --study <study-id>
```

如果它因 dirty 拒绝：

- 展示未提交条目会被排除；
- 建议用户先 commit 或自行处理；
- 只有用户明确选择“忽略这些改动，只学当前 commit”后，才重试：

  ```bash
  pnpm university -- refresh prepare --study <study-id> --acknowledge-dirty-excluded
  ```

不要自行加这个开关。

## 3. 运行返回的 UA 调用

读取 JSON 回执：

- `disposition: ready-reused`：不要重复跑 UA，直接进入 freshness audit。
- `invocation` 非空：调用已安装的 `understand` skill，并逐字使用回执里的 `workspace`、`arguments` 和 `environment`。不要替换成 live source 路径，不要删掉 `--no-auto-update`，不要改输出语言。

UA 完成后执行：

```bash
pnpm university -- refresh finalize --study <study-id> --analysis <analysis-id>
```

若 UA 失败，不要伪造 ready manifest；保留 preparing/failed 证据并报告具体阻塞。

## 4. 只读检查，再应用失效标记

```bash
pnpm university -- refresh audit --study <study-id> --snapshot <snapshot-id> --analysis <analysis-id>
pnpm university -- refresh audit --study <study-id> --snapshot <snapshot-id> --analysis <analysis-id> --apply
```

第一条用于向用户解释变化；第二条只会把受影响的 active 课程、单元和知识笔记标为 `stale`，不会自动改写教学结论，也不会修改学习历史。

把结果分成三类：

- `fresh`：证据仍有效，不改内容。
- `stale`：必须重新研究新快照后追加修订。
- `waitingForUa`：UA 身份/节点尚未就绪，先解决 UA，不能靠猜测激活。

## 5. 修订 stale 内容

### 正式课程

对每个 stale lesson 重新读取目标快照和 UA 节点，生成“同一 lesson 的完整修订包”：正文、该 lesson 全部现有 cards、全部现有 exercises。保持 course/unit/lesson/card/exercise ID 与结构不变，只追加 revision；先 dry-run：

Proposal 使用下面的严格形状；`cards` 与 `exercises` 必须完整列出该 lesson 现有 ID，不能借刷新偷偷增删课程结构：

```json
{
  "schemaVersion": 1,
  "proposalId": "stable-refresh-proposal-id",
  "targetSnapshotId": "target-snapshot-id",
  "targetAnalysisId": "optional-ready-analysis-id",
  "lesson": {
    "courseId": "course-id",
    "unitId": "unit-id",
    "id": "lesson-id",
    "expectedRevision": 1,
    "content": "# 新版讲义\n",
    "evidence": ["完整的目标快照 evidence object"],
    "cards": [
      {
        "id": "existing-card-id",
        "expectedRevision": 1,
        "front": "新版问题",
        "back": "新版答案",
        "evidence": ["完整的目标快照 evidence object"]
      }
    ],
    "exercises": [
      {
        "id": "existing-exercise-id",
        "expectedRevision": 1,
        "kind": "short-answer",
        "prompt": "新版题目",
        "expectedAnswer": "答案",
        "evidence": ["完整的目标快照 evidence object"]
      }
    ]
  }
}
```

示例里的 evidence 字符串只是位置说明，实际文件必须填写与 `knowledge-node` 相同的完整对象。`expectedRevision` 是当前 revision，不是新 revision；系统会原子地推导 `+1`、状态和 hash。`explain` 练习使用非空 `rubric`，不用 `expectedAnswer`。

```bash
pnpm university -- course revise --study <study-id> --input .scratch/course-revisions/<proposal>.json --dry-run
pnpm university -- course revise --study <study-id> --input .scratch/course-revisions/<proposal>.json
```

同一次重试必须复用 proposal ID 和文件。不得只改讲义却留下引用旧事实的卡片或练习。内容真正没有变化时也要把证据重新绑定到目标快照，不能把旧 commit 冒充新证据。

全部 stale lesson 修订后，使用系统的 freshness gate 激活：

```bash
pnpm university -- course reactivate --study <study-id> --course <course-id> --snapshot <snapshot-id> --analysis <analysis-id>
```

只要还有一个 stale/waiting 项，保持课程 stale 并报告，不能强开。

### 对话知识笔记

逐条判断 stale note：

- 结论仍成立：使用同一 note ID、`contentRevision + 1`、新证据和 `origin.kind: "source-refresh"`，走 `pnpm university -- capture` 的 dry-run/apply 流程。
- 结论已不成立：保持 stale，新增或修订一条解释“现在为什么不同”的知识，不把旧卡片悄悄改成相反答案。
- 只是个人理解且没有源码证据：freshness 不应因为 commit 变化而失效。

## 6. 复核与回执

再跑一次不带 `--apply` 的 freshness audit，并再次运行 `status`。报告：

- 使用的本地 commit（明确 `pushRequired: false`）；
- UA 版本和精确 provenance；
- 哪些课程/笔记保持 fresh、追加了哪些 revision、哪些仍 stale；
- 未提交文件是否被排除；
- 被学习仓库的 HEAD 和 status 与操作前是否完全相同。

不要用“刷新成功”掩盖仍 stale 的项目。
