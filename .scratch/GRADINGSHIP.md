# Grading service 发布记录

日期：2026-08-31（Asia/Singapore）

## 结论

批改服务已从 `work/gradingship` 发布到 Vercel production。生产别名
`https://university-grading-ashy.vercel.app` 当前指向部署
`dpl_C5YezJe4AdahX2w1ZFtXhx8Q15ob`。

本轮没有修改批改业务逻辑；只修改了
`apps/university-grading/vercel.json` 的远程安装命令：

```json
"installCommand": "corepack pnpm@11.22.0 install --frozen-lockfile --ignore-scripts"
```

## 已证实的根因

1. Vercel 项目 `pie-0f420159/university-grading` 的设置确实是
   `Root Directory: apps/university-grading`。因此从该子目录做 `vercel build
   && vercel deploy --prebuilt` 会让 prebuilt 路径与项目 rootDirectory 叠加，最终
   静默退化成没有函数的部署；根目录的 `.vercel/project.json` 仍然属于主 App，
   没有触碰。
2. 按正确方向从仓库根做源码部署后，第一次 preview 在安装阶段失败。Vercel
   远程构建环境没有 `.git`，根 workspace 的 `prepare: lefthook install` 因找不到
   Git 仓库退出 1：

   ```text
   [ELIFECYCLE] Command "corepack pnpm@11.22.0 install --frozen-lockfile" exited with 1
   fatal: not a git repository ... /vercel
   ```

   因此最终的可发布组合是：仓库根源码部署 + 项目现有
   `Root Directory: apps/university-grading` + 远程安装 `--ignore-scripts`。

## 正确发布步骤

从仓库根目录执行；不要使用根目录 `.vercel/project.json`，不要从子目录
做 `--prebuilt`：

```bash
env VERCEL_ORG_ID=team_C63r8BVtFCpiOK1k2h7xytT9 \
  VERCEL_PROJECT_ID=prj_wvysR7BXPOOFkPA8yo9d7gxStmPY \
  vercel deploy --scope pie-0f420159 --yes

vercel inspect <preview-url> --scope pie-0f420159
# 只有输出含 "λ api/grade (...)" 才能继续

env VERCEL_ORG_ID=team_C63r8BVtFCpiOK1k2h7xytT9 \
  VERCEL_PROJECT_ID=prj_wvysR7BXPOOFkPA8yo9d7gxStmPY \
  vercel deploy --prod --scope pie-0f420159 --yes
```

## Preview inspect 证据

| 尝试 | 部署 | 结果 | `vercel inspect` 证据 |
| --- | --- | --- | --- |
| 安装脚本修复前 | `dpl_Ewyp6LRUXinwmYoGpsLZmrv1bKT4` / `university-grading-3jw94jo5f-pie-0f420159.vercel.app` | `ERROR`，构建在 install 阶段停止 | 无 Builds，未产生 `λ api/grade`；不能放行 |
| 修复后的发布 preview | `dpl_62zs3ibrLX2YPFm58RxJiATj9cYy` / `university-grading-mv3xfvsqd-pie-0f420159.vercel.app` | `READY` | `λ api/grade (1.32MB) [iad1]` |
| 失败路径隔离 preview | `dpl_8ojnYD4cWYJnWDK88fy6iobgML7w` / `university-grading-7db7djeno-pie-0f420159.vercel.app` | `READY` | `λ api/grade (1.32MB) [iad1]` |

失败路径 preview 只把该部署的 runtime `OPENROUTER_API_KEY` 覆盖为无效
smoke 值，Supabase 公开配置保持一致；没有关闭 Deployment Protection。

## Production inspect 证据

对生产部署 `dpl_C5YezJe4AdahX2w1ZFtXhx8Q15ob` 执行：

```text
vercel inspect university-grading-kqyjhvf6e-pie-0f420159.vercel.app --scope pie-0f420159
```

输出为 `status ● Ready`、`target production`，并明确包含：

```text
λ api/grade (1.32MB) [iad1]
```

随后自动别名为 `university-grading-ashy.vercel.app`。

## 线上 HTTP 验证

- 生产匿名 `GET /api/grade` 返回 `401` / `{"code":"unauthorized"}`，证明请求
  命中函数而不是静态 404；生产 `OPTIONS` 返回 `204`，CORS 头正确。
- 使用随机 `.invalid` 自动确认 learner 身份对生产端点执行认证 GET：返回
  `200`，报价为 `kind: free`、`costPowerUnits: "100"`、
  `remainingPowerUnits: "400"`。
- 没有在生产调用成功模型路径。为验证退款，在同一构建的隔离 failure preview
  上执行真实 HTTP：

  1. GET：`200`，`remainingPowerUnits: "400"`，`costPowerUnits: "100"`。
  2. POST：`502`，`code: "model_failed"`，`refunded: true`，退款返回的
     `freeQuota.remainingPowerUnits: "400"`。
  3. 再次 GET：仍为 `200` 且 `remainingPowerUnits: "400"`。

  这证明失败路径会退款且免费额度不减少，同时没有烧成功模型费用。

## 验证与未完成项

- `pnpm verify`：通过。首次运行因 worktree 缺少被 gitignore 的
  `apps/university/content` 失败；按项目启动政策从主 checkout 建立 symlink 后
  重跑通过。没有运行会重写生成清单的 `pnpm content`。
- 批改服务专项：27 tests passed，typecheck/build/format check passed。
- 预览直接 curl 会受到 Vercel Deployment Protection 保护；验证使用
  `vercel curl` 的自动 bypass，没有关闭保护。
- 本次 HTTP 验证创建了随机 `.invalid` smoke identities 以获得 learner JWT；没有
  成功模型调用。当前没有安全的 Auth 管理删除通道，因此本记录不声称这些 smoke
  identities 已删除；若要求清理，需要负责人在 Supabase Auth 管理端删除本次
  smoke identities。
