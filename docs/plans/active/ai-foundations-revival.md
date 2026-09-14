---
id: PLAN-AI-FOUNDATIONS-REVIVAL
title: 认识 AI，从这里开始：复活计划与阶段 0 阻塞回执
type: plan
status: active
canonical: true
owner: human
created: 2026-09-13
last_reviewed: 2026-09-14
domain: course-authoring
tags:
  - ai-foundations
  - source-snapshot
  - course-recovery
pinned: false
related:
  - REF-CURRENT-WORK
supersedes: []
superseded_by: null
---

# 认识 AI，从这里开始：复活计划

## 当前边界

**2026-09-14 恢复预检：阻塞仍在。** 当前工具再次拒绝读取 UA 必需的 agent 定义；
当前源码仍不允许从 `failed` 重试，也不允许将未完成或失败分析 retire。本轮没有再次
启动 prepare，没有改动分析状态。重新完成的 `pnpm verify` 退出 0，但这不是阶段 0
流水线验收通过。最新实测、文件保护检查和本地交付范围见文末的本轮恢复预检回执。

2026-09-13 的 owner 指令分为阶段 0–5。当前停在**阶段 0 的 UA 收尾阻塞**：
源码快照已建立且核对一致，但 UA 没有生成图谱，不能声称完成 finalize / verify。
按要求尝试的 `refresh retire` 也被现有状态契约拒绝。已调用仓库现有失败清理 API，
将本轮分析正式置为 `failed`，移除受管 UA 工作区并释放租约；没有手改 manifest，
没有伪造图谱、哈希或 `ready` 状态。

阶段 1 覆盖审计、阶段 2 教法评判、阶段 3 拆课提案均**未开始**。阶段 3 完成后仍必须
等待 owner 决定，之后才能进行阶段 4 的逐门重写和阶段 5 的解锁。当前没有改课文、
互动件、课程 ID、学习记录、发布目录或任何产品实现。

本记录不是完成验收，也不是批准改变 UA 生命周期的技术决策。恢复条件见下文。

## 阶段 0 · 做了什么、改了哪些文件

工作起点为 `main` / `origin/main` 的 `9b139aee`，工作树干净；没有创建分支或 worktree。
未重新克隆、移动或修改原文仓库；授权按 owner 已确认处理，未重新调查许可。

通过仓库 CLI 执行：

```sh
pnpm --filter @pieai/university-local university -- refresh prepare --study ai-foundations
pnpm --filter @pieai/university-local university -- snapshot list --study ai-foundations
```

固定的原料身份：

| 项目 | 本次实测 |
| --- | --- |
| 注册源码根 | `/Users/yuanfei/PieAI/_References/AI-For-Beginners`，未变更 |
| 源码 commit | `392d0df1b2647cbee104942390551f1ed9e072c8` |
| 源码 tree | `2aae827dd140bc3e986a825a125f6270295a907f` |
| Snapshot ID | `git-392d0df1b264` |
| Snapshot 创建时间 | `2026-09-13T17:19:56.559Z`，UTC |
| Snapshot 状态 | `ready`，`mode: clean`，`open: false` |
| 树条目 | 13,705；包含翻译、图片与其他非教学正文，**不是知识点数或覆盖率** |
| 完整树清单 SHA-256 | `19db3f27e165854c82fbacb771c1f2e98124fba72a2bb1c094805aace38fb290` |
| 源码 dirty / 排除内容 | `false` / `excludedPaths: []` |
| UA analysis ID | `ua-392d0df1-v2-9-4-zh-full-e98206c7358f1ff1-0dc96529a313` |
| UA 引擎 | understand-anything 2.9.4；本次记录的 revision 为 `ca28ba03a481f0ae777a77c7e32e120e4139d2a7` |
| UA 最终状态 | `failed`，不是 `ready`，也不是 `superseded` |
| 课程状态 | study 为 `archived`；唯一课程为 `stale`；61 份 `content.md` 未改写 |

树清单校验比较的是原克隆与 study 私有裸仓库对同一 commit 的
`git ls-tree -r -z` 原始字节。两边完全相同；上表 SHA-256 也按该原始字节计算。
快照实际由 `source/snapshots/git-392d0df1b264.json` 和 `source/repository.git`
中的 Git 对象组成，并不是 `source/snapshots/<id>/` 下的一份展开副本。
本轮没有打开长期 checkout。

本次 tracked 修改仅为本计划、current-work 中指向它的导航项，以及由
`pnpm doc-gov scan` 更新的 `docs/governance/MANIFEST.yml`。流水线另外生成了以下
gitignored 本地资料，不假装这些材料会随本次 Git 提交传到别的机器：

- `apps/local/studies/ai-foundations/source/snapshots/git-392d0df1b264.json` 与
  `source/repository.git/`：固定 commit 的原始材料。
- `apps/local/studies/ai-foundations/ua/<analysis-id>/manifest.json`：真实失败回执；
  `data/config.json` 保留；`workspace` 和租约均已清理。
- `.scratch/ai-foundations-revival/phase-0/`：命令原始日志。

原来的注册文件、study 状态、课程源码、locked 导出包和学习数据库均未通过本轮写入。
locked 的两个文件另已逐字节与 `HEAD` 比对相同；学习数据库只做文件哈希检查，
没有读取学习者记录或查询云端。

## 阶段 0 · 原始结果与闸门

### 流水线为什么停止

已成功读取已安装的 `understand/SKILL.md`。它要求使用插件的 agent 定义；发现实际
文件后，DevSpace 的 read 返回以下原始拒绝。没有用 shell、路径别名或另一个进程
绕过该路径边界，也没有启动外部 Codex/Claude 工作进程：

```text
Path is outside allowed roots: /Users/yuanfei/.understand-anything/repo/understand-anything-plugin/agents/project-scanner.md
```

随后按 owner 的退出指令执行 `refresh retire`，其原始错误为：

```text
"ok": false,
"error": "UA analysis ua-392d0df1-v2-9-4-zh-full-e98206c7358f1ff1-0dc96529a313 cannot be retired from status: preparing",
"hint": "The operation was stopped safely; inspect the message, fix the input, and retry."
RETIRE_EXIT=1
```

现有 [retireUaAnalysis](../../../apps/local/server/ua/adapter.ts) 只接受 `ready` /
`legacy-import`；[UaAnalysisManifestSchema](../../../packages/core/src/domain/schemas.ts)
的 `superseded` 分支还要求已有 `graphHash`、`nodeCount`、`edgeCount` 和
`completedAt`。因此不能通过补几个字段或强写状态来冒充退休成功；`--force` 也不是
绕过状态检查的开关。

为避免留下中间状态，直接调用该模块现有导出函数 `failUaAnalysis`，没有新增脚本实现
另一条清理流水线。该函数负责清理自己的受管工作区、记录失败、释放租约。原始结果：

```text
"operation": "fail-ua-cleanup",
"via": "existing exported failUaAnalysis API",
"status": "failed",
"completedAt": "2026-09-13T17:25:38.720Z"
CLEANUP_EXIT=0
```

清理后的 `status --study ai-foundations` 原始片段：

```json
"counts": {
  "preparing": 0,
  "failed": 1,
  "ready": 0,
  "legacy-import": 0,
  "superseded": 0
},
"preparingIds": [],
"readyIds": [],
"supersededIds": []
```

独立只读完整性核对的原始输出：

```text
SOURCE_SNAPSHOT_TREE_EQUAL=true
SNAPSHOT_TRACKED_ENTRIES=13705
TREE_INVENTORY_SHA256=19db3f27e165854c82fbacb771c1f2e98124fba72a2bb1c094805aace38fb290
SOURCE_HEAD=392d0df1b2647cbee104942390551f1ed9e072c8
SOURCE_STATUS=''
UA_WORKSPACE_EXISTS=false
UA_DATA_FILES=["config.json"]
UA_ROOT_FILES=["data", "manifest.json"]
LIVE_CONTENT_MD_COUNT=61
LOCKED_AI_FOUNDATIONS_EQUALS_HEAD=true
INTEGRITY_EXIT=0
```

### 仓库健康检查

清理之后的完整 `pnpm verify` 已退出 0。下面保留同一次运行各包的原始汇总，
不把额外 Node 自测、此前结果或浏览器基线加进 Vitest 计数：

```text
packages/core test:  Test Files  69 passed (69)
packages/core test:       Tests  680 passed (680)
packages/backend test:  Test Files  2 passed (2)
packages/backend test:       Tests  6 passed (6)
apps/university-grading test:  Test Files  4 passed (4)
apps/university-grading test:       Tests  27 passed (27)
packages/ui test:  Test Files  82 passed (82)
packages/ui test:       Tests  544 passed (544)
apps/local test:  Test Files  46 passed (46)
apps/local test:       Tests  470 passed (470)
packages/world test:  Test Files  123 passed (123)
packages/world test:       Tests  988 passed (988)
apps/university test:  Test Files  57 passed (57)
apps/university test:       Tests  281 passed (281)
check-shelf: 1 studies, 4 courses, 27 lessons match the manifest.
check-published-catalog: all 4 published course(s) still ship.
check-content-revisions: ok (27 lessons, 4 courses)
VERIFY_EXIT=0
```

完整日志为 `.scratch/ai-foundations-revival/phase-0/verify.log`。该运行结束后仅补充
本报告和文档导航，没有更改被测产品、课文或测试；随后独立复跑文档闸门，原始结果为：

```text
doc-gov check passed (139 docs).
doc-gov scan --check passed.
doc-gov links passed (133 current files, 229 local links).
DOCS_EXIT=0
```

新增 1 份计划，所以文档从 138 增至 139；新增导航及本计划的代码依据链接，所以链接
从 225 增至 229。`git diff --check` 退出 0，没有输出。**仓库健康检查为绿，不等于
UA 分析已完成。** `pnpm e2e` 未运行：本阶段刷新收尾条件已经失败，
未进入下一阶段，也未执行 push。owner 提供的 `235 passed / 6 skipped / 0 failed`
仍只是此前基线，不冒充本轮结果。本轮没有新增、删除、跳过或改动测试。
本阶段按阻塞退出处理，只保留本地提交；没有 force-push、改写历史或跳过 Git hooks。

原始流水线日志同目录保存为 `refresh-prepare.log`、`refresh-retire.log`、
`fail-ua-cleanup.log`、`status-after-cleanup.log`、`snapshot-list.log` 和 `integrity.log`。

## 阶段 0 · 需要 owner 决定的问题

**恢复执行环境。** 选择在能够正常读取已安装 UA agent 定义并执行该技能的宿主继续，
或由 owner 配置当前工具的允许范围。缺的是必要模板的读取能力，不是来源授权。
本轮没有更改插件权限、全局配置或工具允许根。

**是否批准先修复退出与重试路径。** 现有 CLI 不能把 `preparing` / `failed` 分析退休；
而 [prepareStudyRefresh](../../../apps/local/server/workflows/refresh-source.ts) 对同一
确定性 ID 的 `failed` 状态也会拒绝重试。后续不要直接重复 prepare、手改 manifest、
删除失败回执或编造一个 ready 分析。建议单独修复并测试“未完成分析安全终止、保留失败
原因、清理租约、分配新 retry ID”的闭环，再恢复本计划；当前没有批准或实施该修改。

## 阶段 0 · 发现但没做的后续候选

恢复后的工作顺序保持 owner 原要求，不因这次阻塞缩减研究范围：

| 阶段 | 应交付 | 当前状态 |
| --- | --- | --- |
| 0 | 首个固定快照，以及 finalize / verify 或符合契约的退休收尾 | 快照已核验；UA 收尾阻塞，现以现有失败 API 安全终止 |
| 1 | 英文原文与 61 节课逐条覆盖表；四类结论齐全；逐项判断缺项该不该补 | 未开始，不改课文 |
| 2 | 逐知识点、具体到句子的教法对比；值得改 / 保持 / owner 决定 | 未开始 |
| 3 | 12 单元归并、courseId、学习边界、发布次序、旧 lessonKey 处置的产品提案 | 未开始；完成后必须停下等 owner |
| 4 | owner 定拆法后逐门重写；读取 write-lesson 和匹配引擎的完整通关条件 | 未授权开始 |
| 5 | 按 locked README 解锁，更新真实发布集的断言和 fixture，完整浏览器闸门 | 未授权开始 |

拆课方案还须验证 study 级解锁与逐门发布之间的关系，不能仅把一个 study 下的 61 节
课改成多个 course 就宣称实现独立解锁。当前只确认了 locked README 的 study 级边界，
没有用本次阻塞代替阶段 3 的代码核查和产品提案。

本次还核对了 `lefthook.yml`：pre-push 的浏览器闸门带产品路径过滤，纯 `docs/**`
提交不会触发它。因此后续阶段 1–3 即使只产出报告，也必须显式运行完整 `pnpm e2e`
才能满足 owner 的逐阶段要求，不能把一次 docs-only push 当成浏览器验收。

本地 `learner/learning.sqlite` 存在，实测 180,224 字节。云端是否有真实学习者进度，
本轮没有查询，也不能从仓库或数据库文件大小推断为“没有”；这个问题保留给 owner。

## 阶段 0 · 对读者的实际帮助

**本轮没有改变读者可见的讲法；它把后续审计的英文原料固定为可核对的 Git 版本，
并避免把未完成的分析和未改写的 61 节课当作已验收课程。**

## 2026-09-14 · 阶段 0 恢复预检回执（仍阻塞）

### 1. 本轮做了什么、改了哪些文件

本轮开始时工作树干净，但 `main` 已比本地 `origin/main` 跟踪引用多一个提交：
`7be8744b`，即上面的首次阻塞回执。因此没有把“快照目录为空”当成当前事实，也没有
重做克隆、修改源码注册位置、改写该提交或重复启动已知无法收尾的 refresh。

本轮重新执行 `status --study ai-foundations`、`snapshot list --study ai-foundations`，
核对原克隆与私有 Git 快照的完整树清单，读取当前 refresh / retire 实现，并通过
DevSpace 正式文件读取接口复查所需 UA 定义的可达性。当前仍只有一个 ready 快照
`git-392d0df1b264`，固定的 commit 仍为 `392d0df1b2647cbee104942390551f1ed9e072c8`；
UA 是 `failed: 1`、`preparing: 0`、`ready: 0`。本轮没有执行 finalize、retire、
失败清理 API 或任何 UA 状态迁移；没有留下新的中途状态。

本轮 tracked 修改仅为本计划，以及扫描生成的 `docs/governance/MANIFEST.yml`。
原有 current-work 导航仍指向本计划，不另建重复计划。复核前后对 539 个受保护文件
逐一比较 SHA-256，包含该 study 的课文、课程元数据、注册、快照 manifest、失败回执
和学习数据库；全部相同。产品代码、测试和课程导出包的 diff 为空。

原始日志位于 gitignored 的 `.scratch/ai-foundations-revival/recheck-2026-09-14/`：
`verify.log`、`verify.exit`、`verify-summary.log`、`integrity.log`、
`protected-before.json` 和 `protection-check.log`。这些本地证据不随 Git 提交上传。

### 2. 闸门原始数字与实际阻塞

以下为本次重新执行 `pnpm verify` 的原始汇总，不是沿用上次日志：

```text
packages/core test:  Test Files  69 passed (69)
packages/core test:       Tests  680 passed (680)
packages/backend test:  Test Files  2 passed (2)
packages/backend test:       Tests  6 passed (6)
apps/university-grading test:  Test Files  4 passed (4)
apps/university-grading test:       Tests  27 passed (27)
packages/ui test:  Test Files  82 passed (82)
packages/ui test:       Tests  544 passed (544)
apps/local test:  Test Files  46 passed (46)
apps/local test:       Tests  470 passed (470)
packages/world test:  Test Files  123 passed (123)
packages/world test:       Tests  988 passed (988)
apps/university test:  Test Files  57 passed (57)
apps/university test:       Tests  281 passed (281)
check-shelf: 1 studies, 4 courses, 27 lessons match the manifest.
check-published-catalog: all 4 published course(s) still ship.
check-content-revisions: ok (27 lessons, 4 courses)
doc-gov check passed (139 docs).
doc-gov scan --check passed.
doc-gov links passed (133 current files, 229 local links).
VERIFY_EXIT=0
```

本次完整性检查原始片段：

```text
SOURCE_SNAPSHOT_TREE_EQUAL=true
SNAPSHOT_TRACKED_ENTRIES=13705
TREE_INVENTORY_SHA256=19db3f27e165854c82fbacb771c1f2e98124fba72a2bb1c094805aace38fb290
SOURCE_HEAD=392d0df1b2647cbee104942390551f1ed9e072c8
SOURCE_STATUS=''
UA_STATUS=failed
UA_WORKSPACE_EXISTS=false
LIVE_CONTENT_MD_COUNT=61
PROTECTED_FILES_CHECKED=539
PROTECTED_FILES_CHANGED=[]
PRODUCT_AND_TEST_DIFF=''
```

13,705 是 Git 树条目数，不是英文知识点数量，也不证明教学覆盖率。
本次 DS-Mac-V3 `read` 对所需 agent 文件返回的原始错误仍为：

```text
Path is outside allowed roots: /Users/yuanfei/.understand-anything/repo/understand-anything-plugin/agents/project-scanner.md
```

另有两次组合式检查被平台返回 `This tool call was blocked by OpenAI because we couldn't
determine the safety status of the request.`，因此不能宣称那些命令执行成功。所需项目内
事实随后由正式文件读取接口及可执行的独立状态查询核实；没有改用 shell、路径别名、
其他连接器或外部 agent 读取上面被拒绝的 UA 路径。

完整 verify 在本回执更新前结束；之后的变动限定为本报告与自动生成的 manifest。
本轮 `pnpm e2e` 未运行，阶段 0 的执行前提未恢复，阶段 1–3 也未开始。此前
`235 passed / 6 skipped / 0 failed` 仍只作为 owner 提供的浏览器基线，不作为本轮数字。
没有新增、删除或跳过测试；本轮按阻塞退出只作本地提交，不执行 push。

### 3. 需要 owner 决定的问题

**UA 宿主读取范围。** 需要允许所选宿主按技能读取
`/Users/yuanfei/.understand-anything/repo/understand-anything-plugin/` 下的必要定义，
或在已有相应读取权限的获准宿主执行 UA。这里需要的是特定插件目录的读取能力，
不是重新核实原文许可，也不要求无差别放开整个用户目录。

**是否授权一轮独立的失败恢复链修复。** 即便换了宿主，当前确定性分析 ID 已是
`failed`：`prepareStudyRefresh` 拒绝该状态，`retireUaAnalysis` 也只接受 `ready` /
`legacy-import`。需要先确定并测试“保留旧失败证据、为重试分配新 ID、未完成分析
可安全终止并释放租约”的契约，再恢复阶段 0。当前没有修改流水线实现、质量闸门或
任何已发布产品逻辑，不能把“放开读取权限”单独当作完整恢复条件。

### 4. 发现但没做的后续候选

恢复链修复应覆盖失败后重试、重复调用的幂等性、被中断重试的恢复，以及旧失败证据
不被覆盖；本轮只核对现有实现，没有新增这些测试。阶段 1 的覆盖表、阶段 2 的逐句
教法对比、阶段 3 的拆课方案均未冒进。云端是否有真实学习者进度仍未查询；本地数据库
仅做文件哈希保护，该问题继续保留给阶段 3 的 owner 决策。

### 5. 对读者的实际帮助

**本轮尚未改善读者可见的讲法；它确认后续审计仍可使用同一版英文原料，并验证这次
恢复检查没有改动现有课文、学习数据库或交付目录。**
