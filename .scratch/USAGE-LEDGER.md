# University grading usage ledger

## 这次落了什么

本轮只改 `apps/university-grading`，没有改 SwimmerBackend、没有新增后端表、没有接 PostHog，也没有改批改、额度或退款的产品行为。

ledger 接在现有 `GradeDependencies` 的模型调用 seam 上。结构化 grader 从
SwimmerAIKit 的 `StructuredOutputResult.usage` 把 provider 的事实带回 service；service
在 provider 调用完成、结算完成后写一条私有记录。没有 usage 时保留 `null`，不从 prompt
长度、`maxTokens` 或经验值推算 token/cost。

## 记录字段

`GradingUsageLedgerEntry`（`apps/university-grading/src/usage-ledger.ts`）目前包含：

- `event`、`schemaVersion`：日志/未来持久化的稳定识别信息；
- `commandId`、`userId`、`planId`、`funding`、`reservationId`：内部关联和免费/钱包分组；
- `provider`、`modelId`：实际 provider 与请求模型；
- `startedAt`、`completedAt`、`elapsedMs`：只覆盖模型调用，不把结算等待混入模型 latency；
- `inputTokens`、`outputTokens`、`totalTokens`：原样保留上游已返回的计数，缺失字段为 `null`；
- `providerCost`：上游返回的 provider cost，缺失为 `null`，不自行估算；
- `usageKnown`：是否收到 usage 对象；
- `costPowerUnits`：这次结构化批改的产品计量成本，当前为 `100`，与现有 quota/wallet reservation 共用同一常量；
- `outcome`：`success`、`unknown_usage`、`provider_failure` 或 `settlement_failure`；
- `settlementStatus`：`committed`、`refunded` 或 `failed`。

`totalTokens` 不会用 `inputTokens + outputTokens` 补出来。`usageKnown: true` 也不代表每个可选字段都一定存在；因此报表还要单独统计 token/providerCost 为 `null` 的记录。

## 三种结局怎么分

一条真实模型调用只产生一条 ledger 记录，结局按下面规则归类：

| outcome | 判定 | 例子 |
| --- | --- | --- |
| `unknown_usage` | provider 调用成功、结构化结果成功，但上游没有返回 usage | response 成功、结算 committed、token/cost 为 `null` |
| `provider_failure` | provider seam 抛错；不假定这次没有账单 | OpenRouter 请求失败或 provider 返回内容无法完成结构化批改；已预留的 units 仍按既有路径退款 |
| `settlement_failure` | provider 调用成功，但 University 的 commit 没有完成 | 先拿到真实 usage，再进入既有退款路径；不把它伪装成 provider failure |

有完整 usage 且 commit 成功的记录为 `success`。如果一次调用同时缺 usage 和发生结算失败，主结局记 `settlement_failure`，`usageKnown` 仍为 `false`，这样结算故障不会被 unknown usage 淹没。

## 生产实现与未来接表位置

现在的生产 adapter 是 `createConsoleGradingUsageLedger()`：它把白名单 entry 序列化成一行 JSON，交给 Vercel/Node 的 `console.info`，不把原始 provider response 或异常对象写入日志。

唯一的生产 wiring 在 `createProductionGradeDependencies()` 返回的 `usageLedger` 字段：

```ts
usageLedger: createConsoleGradingUsageLedger(),
```

接后端私有表时，只需要在这里把 `createConsoleGradingUsageLedger()` 换成实现同一个 `GradingUsageLedger.record(entry)` 接口的后端 adapter；service 的 provider、reserve、commit、refund 控制流不改，`GradingUsageLedgerEntry` 也保持为表的输入 DTO。此轮没有写 migration、RPC、owner read API 或浏览器 select。

## 隐私边界与测试护栏

ledger entry 是显式白名单类型和显式对象构造，不转发 `GradeRequest`、`metadata`、模型 `raw`、`GradeDecision`、错误对象或 prompt/answer。模型仍然收到题目和答案，这是批改本身的必要输入；它们不会进入 ledger。

测试覆盖：

- `apps/university-grading/src/service.test.ts`：完整 usage 字段、unknown usage、provider failure、settlement failure；用可识别的 `LEDGER_PRIVATE_PROMPT_*` 和 `LEDGER_PRIVATE_ANSWER_*` 断言序列化后的 ledger 中不存在它们；
- 同一测试文件：ledger `record()` 抛异常时，批改仍返回 `200`，commit 仍只发生一次；
- `apps/university-grading/src/usage-ledger.test.ts`：生产日志 adapter 只写安全 entry 的单行 JSON。

ledger 是旁路：`record()` 的同步或异步异常会被吞掉，不会把一次已经成功的批改改成失败，也不会改变免费额度的 reserve → model → commit/refund 顺序。没有真实 provider 调用的拒绝、幂等 replay、余额不足不会伪造 usage 记录。

## 上线后如何判断 400 units/天是否正确

400 units 当前等于 4 次完整的结构化批改。至少观察一个固定窗口（建议 7–14 天），并同时看下面几组数；不要只看平均 token 或成功请求数：

1. **免费额度撞顶率**：每天触达免费 AI 的去重用户数、发起的 reserve 数、因 400 hard cap 返回 insufficient 的去重用户数和占比；另列“只剩不足 100 units”的用户。这个数回答 400 是否过早挡住真实需求。
2. **免费用户消耗分布**：每个免费用户每天实际 committed 的 units/次数的 p50、p95、p99，以及第 1/2/3/4 次批改的完成比例。它能区分“400 很少有人用到”和“多数人正好撞在第 4 次”这两个完全不同的决策。
3. **实际 provider 成本分布**：ledger 中 usageKnown 且 `providerCost` 非空记录的单次 cost p50/p95/p99、免费用户日累计 provider cost p50/p95/p99；同时报 `unknown_usage` 占比和 providerCost 缺失占比。unknown 比例没有降到可接受水平前，不把“平均成本”当事实。
4. **失败与退款账**：`provider_failure`、`settlement_failure` 各自占真实 provider attempts 的比例，及对应的 `settlementStatus`/quota commit/refund 数；provider failure 后的安全 attempt gate 要与 400 hard cap 分开计，不能把失败重试误称为用户用完额度。
5. **价值/商业对照**：在成本分布旁看“撞顶后仍继续尝试/进入会员路径”的去重人数（若购买后端上线，再接服务端 verified paid，而不是按钮点击），以及免费用户的留存/课程完成代理。400 合理的条件是：撞顶确实把少量高频成本挡住、正常学习者大多能尝到价值、且免费用户日成本的高分位仍被可接受的获客/会员毛利覆盖；这不是只凭某一个阈值自动调参。

本轮没有实现上述报表、购买成功事实或客户端 funnel；ledger 先提供第 3 组的原始事实，第 1/2/4 组需要和现有 quota reservation ledger 聚合后读取。

## 未完成或不确定

- 日志暂不是 durable ledger：保留期、访问权限、脱敏后的 owner 聚合和丢日志告警尚未实现；接表仍需单独的 SwimmerBackend 迁移和权限设计，本轮刻意不做。
- provider failure 通常拿不到 usage；记录会保留 `provider_failure` 和 `usageKnown: false`，不估算 provider cost。上游账单对账仍需 provider dashboard/invoice，当前 transport 也没有暴露 provider request id。
- `providerCost` 是 SwimmerAIKit 归一化后的上游证据，不是本地 invoice 校验值；`costPowerUnits` 是 University 的产品计量单位，不能把它直接当美元。
- 400 units 的最终判断需要真实观测窗口和明确的会员毛利/offer；本报告给出要看的数，没有擅自改额度、价格或后端数据模型。
