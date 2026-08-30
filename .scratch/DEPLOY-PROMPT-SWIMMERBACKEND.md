# 交给 SwimmerBackend 项目里的 codex 的提示词

把下面整段（从「任务开始」到「任务结束」）粘给在
`/Users/yuanfei/PieAI/SwimmerBackend` 里跑的 codex。

---

任务开始

你在 `/Users/yuanfei/PieAI/SwimmerBackend`，分支 `main`，
HEAD 应该是 `ed3ad138ddeb033b296a1b12b362ff2cedc21afb`，已经推到 origin。

这一趟要把**三份已经合并但还没上生产**的迁移发布到生产库：

- `20260830130000_university_free_grading_attempt_gate.sql` — 计费闸门
- `20260830140000_university_plan_grant_read.sql` — 会员识别
- 支付结算后端（订单 / 事件 / 原子结算 / 退款与争议撤销）

现在的状态：本地 `pnpm test` 里除 `verify-platform-contracts` 外全绿；
那一处红报的是 18 条 "registered relation is missing"，**那是待发布信号，
不是缺陷**——注册表已经声明了这三份迁移的关系，生产库还没有。发布完它应该转绿。

## 步骤

**第一步：确认起点**

    git fetch origin && git status -sb && git rev-parse HEAD

HEAD 必须等于 `ed3ad138ddeb033b296a1b12b362ff2cedc21afb`，
并且和 `origin/main` 一致。不一致就停下来报告，不要自己 rebase 或 push。

**第二步：跑 Staging Preview**

    gh workflow run staging-preview.yml --ref main -f reset_data_less_staging=false

拿到 run id：

    gh run list --workflow=staging-preview.yml --limit 1

等它跑完（约 5-7 分钟）：

    gh run watch <run-id>

**如果 staging 失败**：先看日志判断是偶发还是系统性的。
只允许**重试一次**；第二次同样失败就停下来把日志报给我，不要绕过。

**第三步：生产发布**

staging 成功后，用同一个 SHA 和那次 staging 的 run id：

    gh workflow run production-release.yml --ref main \
      -f release_sha=ed3ad138ddeb033b296a1b12b362ff2cedc21afb \
      -f staging_run_id=<上一步成功的 staging run id> \
      -f confirm_project_ref=lgoknzuxefecikfyvpzk \
      -f allow_out_of_order=false

`confirm_project_ref` 那道闸是故意的，它就是要人确认打的是生产库。

**第四步：验收**

发布完成后，确认 `verify-platform-contracts` 返回 `ok: true`，
并且注册的关系数**比上一次（67）多**——多出来的就是这三份迁移的表和函数。
把最终数字报给我。

## 不许做的

- 不许改任何迁移文件。**迁移是只进不退的**，
  尤其不许动已经在生产跑了的 `20260830120000_university_free_grading_quota.sql`。
- 不许 `--force` push，不许 rebase main。
- staging 没绿之前不许跑 production-release。
- 失败不许绕过闸门，停下来报告。

任务结束
