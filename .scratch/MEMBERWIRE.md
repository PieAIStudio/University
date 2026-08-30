# Memberwire 交付报告

分支：`work/memberwire`

结论：三处接线已完成，读不到会员事实时会安全回到免费基线；未执行任何 Supabase 生产发布或 Vercel 发布。

## 接了哪三处

1. **依赖**：`apps/university-grading/package.json` 和 `packages/backend/package.json` 升级到 `@pieai/swimmer-backend-client@0.6.0`，并同步 `pnpm-lock.yaml` 与 pnpm 的发布年龄例外配置。
2. **批改服务**：`apps/university-grading/src/service.ts` 的 `createProductionGradeDependencies()` 现在用带当前 access token 的 `supabase.schema("university")` 创建 `createEntitlementClient`，调用 `university_read_plan_grant`，并只把已知 `planId` 映射到本地 `BILLING_CONFIG`。匿名身份、未知方案、RPC 抛错都回到免费基线；免费基线仍先走每日免费额度，不读钱包。
3. **会员页 payment remote**：`packages/backend/src/payment.ts` 的 `createSupabasePaymentRemote()` 增加 `PaymentTransport.readEntitlement`，复用同一个 `university_read_plan_grant` RPC，并把当前 `userId` 作为 `p_user_id` 传入；`packages/backend/src/index.ts` 导出 RPC 名称供共享 backend 入口使用。会员页和批改服务因此读同一个后端事实。

会员页的两条 AI 会员承诺没有恢复；生产尚未能回答会员事实时，代码不会把“代码能问”当成“生产已部署”。

## 逐条攻击测试记录

每条都按“注入后门 → 对应测试变红 → 撤销后复绿”执行。红灯命令的退出码均为 `1`，后门没有留在工作树中。

### 1. 非会员不能被识别为会员

- 注入：把 `packages/backend/src/payment.ts` 中 `return { planId: grant.planId }` 临时改成固定返回 `{ planId: "member" }`，即使 RPC 返回 `free` 也伪造会员。
- 红灯：`packages/backend/src/payment.test.ts` 的 `reads a non-member from the shared University plan-grant RPC` 失败；期望 `{ planId: "free" }`，实际收到 `{ planId: "member" }`。
- 撤销：恢复使用 RPC 返回的 `grant.planId`；`pnpm --filter @pieai/university-backend test` 通过，2 个测试文件、6 个测试全绿。

### 2. 读权益失败必须回到免费基线

- 注入：把 `apps/university-grading/src/service.ts` 的 entitlement `catch` 临时改成返回 `member` 权益。
- 红灯：`apps/university-grading/src/service.test.ts` 的 `falls back to the free baseline when the entitlement backend cannot answer` 失败；报价实际变成 wallet 的 `kind: "available"`，而不是期望的免费 `kind: "free"`。
- 撤销：恢复 `return baselineEntitlements()`；`pnpm --filter @pieai/university-grading-service test` 通过，3 个测试文件、22 个测试全绿。测试同时确认免费报价和免费 reserve/commit 都不创建或读取钱包。

### 3. 一个账号不能读另一个账号的 plan grant

- 注入：把 `packages/backend/src/payment.ts` 的 `entitlements.readGrant(userId)` 临时改成固定的第一个测试 UUID，模拟把账号 A 的 grant 返回给账号 B。
- 红灯：`packages/backend/src/payment.test.ts` 的 `keeps the plan-grant read account-bound instead of returning another user's grant` 失败；对账号 B 的请求本应因 RLS 边界 reject，却错误 resolve 成 `{ planId: "member" }`。
- 撤销：恢复传入调用者的 `userId`；backend 与 grading 两个受影响包合计 28 个测试全绿。生产 RLS 迁移本身由 SwimmerBackend 提供，本地测试验证了 University 不替换或缓存调用者账号 id。

## 生产还缺哪一步

把 SwimmerBackend 的迁移 `20260830140000_university_plan_grant_read.sql` 真正部署到生产，使 `university.plan_grants` 和 `university_read_plan_grant` 在生产可用；随后由已有的可信履约流程通过 `university_issue_plan_grant` 为应有账号写入当前 grant。这个步骤不在本次分支执行范围内。迁移尚未部署时，University 会按本报告所述回到免费基线，不会错误放行会员能力。

## 没做完或不确定的部分

- 没有访问真实生产 Supabase，也没有执行生产迁移、发放 grant 或 Vercel 发布；因此本次只证明了客户端/服务端接线和失败关闭行为，不能声称线上账号已经识别为会员。
- 生产 adapter 的 RPC 响应解析、日期窗口和 RLS 细节由 `@pieai/swimmer-backend-client@0.6.0` 与 SwimmerBackend 迁移负责；本地测试使用契约形状的假 RPC，未替代后端已做的真实攻击测试。
- Vite 构建仍有既有的大 chunk advisory，但不影响 `pnpm verify`；本轮没有改动课程、UI 或会员页文案。

## 验证

完整命令 `pnpm verify` 已通过（exit 0），包括全仓 typecheck、lint、format、测试、build、module boundaries、内容检查、authoring 排除检查和 docs checks。全仓测试结果：core 416、local 419、grading 22、backend 6、ui 334、world 312、university 197。
