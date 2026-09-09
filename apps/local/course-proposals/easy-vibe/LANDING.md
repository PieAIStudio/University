# 怎么把这门课落盘

这个分支**只产出提案，没有落盘**。原因写在下面，落盘只要一条命令。

## 为什么现在不落

`course create` 会往 `apps/local/studies/` 写文件，而那个目录是**所有 worktree 共享的**
（半跟踪，靠脚本链接）。一门课写到一半，会让每个平行分支的 `pnpm verify` 变红。

而这件事正在发生——主线合并在途中。所以这个分支守一条规矩：

> **全程不碰 `apps/local/studies/`。**

可以随时验证这一条：

```bash
git log --stat work/easy-vibe-course | grep 'apps/local/studies' || echo "一个字都没碰"
```

## 主线干净之后，三步

### 一、装配

```bash
node apps/local/course-proposals/easy-vibe/build-course.mjs
```

它把每个单元的 JSON 按**教学顺序**拼成一份 `full-course.json`，
顺序写在脚本里的 `ORDER` 数组，并且会拒绝重复的 id。

> 为什么必须一次性 `course create`，而不是逐个 `add-lessons`：
> **`add-lessons` 只会往后追加。**上一门课就是这么把伦理单元追到了第 2 位，
> 最后只能删掉整个目录重来。顺序必须在落盘那一刻就是对的。

### 二、先干跑

```bash
node apps/local/.university-local-build/server/cli.js \
  course create --study general \
  --input apps/local/course-proposals/easy-vibe/full-course.json --dry-run
```

期望看到 `"outcome": "validated"` 和 `"targetSnapshotId": null`。
后者不是异常——**通用课没有被研究的仓库，本来就没有快照可指。**

（如果 CLI 没构建过：`pnpm --filter @pieai/university-local build`）

### 三、真落

把 `--dry-run` 去掉，重跑同一条命令。

## 落完之后要做的三件事

1. **三处标记。**这是通用课，课程卡、进关卡片、课文页顶都要标出
   「出处是权威资料，不是本仓库代码」。理由见
   `.agents/skills/adopt-outside-course/references/general-course.md`：
   只标一处，人会在另外两处被骗到。

2. **绑星球。**这门课还没有分配星球。它在教学序列上的位置是：

   ```
   《AI 到底是什么》     零基础认知，不碰代码
           ↓
   这门课               从一个念头到一个别人能打开的网址
           ↓
   turing-pact 那 20 门  已经在真实仓库里，指挥 AI 干活
   ```

3. **补授权凭据。**`ADOPTION-NOTE.md` 里写着为什么这门课的成立
   **不依赖**原作者的授权，但致谢和凭据仍然该补上。
   把聊天截图放进这个目录，并在那份文件里写上文件名。

## 别做的事

- **别用 `--skip-check`。**三道门禁现在全绿，绿是一节一节改出来的。
- **别改 `ORDER` 数组的顺序**，除非你确实想改教学顺序——
  它就是这门课的目录。
