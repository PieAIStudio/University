---
id: REF-PAYMENT-BACKEND-GAP
title: Payment Backend Gap
type: reference
status: active
canonical: true
owner: human
created: 2026-08-26
last_reviewed: 2026-09-09
domain: execution
tags:
  - payment
  - wallet
  - backend
  - cross-repository
  - anonymous-auth
related:
  - REF-CURRENT-WORK
  - ADR-0001
  - ADR-0007
---

# 支付接入边界与未完成能力

本页吸收旧 launch 工作树 2026-09-05 的有效纠正，并在 R39 整合时重查
University 代码与 SwimmerBackend 本地源码 `f78f4a1`。它不证明迁移已在远端
应用、商户已获批或真实交易通过。支付实施、商户操作和部署不属于本次整合。

## 现行契约在哪里

| 事实 | 唯一来源 |
| --- | --- |
| 免费课程、会员权益、月年价格配置及钱包费用的关系 | [plans.ts](../../../packages/core/src/billing/plans.ts)、[ADR-0007](../../adr/ADR-0007-published-course-packages-are-separate-from-entitlement.md) |
| 账号前置、订单身份、购买可用性与错误说明 | [PaymentPort](../../../packages/core/src/ports/payment.ts) |
| 浏览器实际能调用的后端能力 | [payment.ts](../../../packages/backend/src/payment.ts) |
| 会员页的月年选择、购买动作和状态文案 | [PlansScreen](../../../packages/ui/src/navigation/screens/PlansScreen.tsx) |

价格以代码配置及结算报价为准，不在本页再抄一份金额。会员的结构化
批改仍消耗钱包；取消免费日额度上限不等于会员价格包含无限使用。开放辅导的计划
旗标不等于已经交付。全部已发布课程的可读性不依赖付款成功。

两个模式共用同一账号、钱包、订单与权益契约；支付不是第四个 mode port。
不在 University 复制支付 SDK、订单数据库、验签函数或钱包发放实现。

## 本仓库已接与未接

- 浏览器适配已接钱包余额和 plan grant 读取；并没有接
  `createOrder` / `getOrderStatus`，购买仍是 `unavailable`。
- 用户在轻量化修订中撤销了常驻“尚未开售”的展示。现在页面先展示会员价值、
  价格和升级动作，费用细则按需展开；只有实际购买操作失败时才显示简短结果。
  缺少下单、查询或管理能力时仍不创建订单、不扣款，不把点击说成候补登记。
- 浏览器保留按账号隔离的购买意图编号、商品与周期；请求不明或刷新后沿用
  原编号，先查询而不自动重新下单。不能保存编号时停止新请求。服务端仍须
  实现最终幂等；本地缓存不能防止恶意请求或跨设备重复。
- 月／年选择进入 `billingCycle`，新订单和后续查询都核对商品、周期、币种、
  配置价格及服务端税费合计。页面明确区分年付总额与折合月价；不信任前端
  自报价格，也不由浏览器授予权益。
- `PaymentPort.manageSubscription` 通过注入的安全客户门户返回管理入口；
  下单、查询、管理三项能力齐备才允许下单。正式适配器仍没有这些方法，
  因而未开放收费。暂停销售也不应移除已有账号的管理入口；取消下次续费
  不等于立即退款。以上是客户端合同，不是厂商取消能力已经联调的证明。
- 浏览器不授予、预留、提交或退款钱包单位；前端成功页不是付款证明。
  支付失败也不删除免费学习进度。

账号绑定沿用现有同身份绑定与冲突合并流程。匿名会话的保留期、清理负责人、
级联／审计和重试属于独立后端运维决策；不能在浏览器删除，也不能因接收款
顺便清理用户。国内渠道、匿名清理和应用壳不因本次合并自动成为已完成能力。

## 共享后端已有的基础，不要重新设计一套

本地 SwimmerBackend 的 `20260830150000_payment_orders_provider_neutral.sql`
已经定义渠道无关的报价、订单、事件、结算与退款内核。订单以
`(app_id, user_id, client_order_id)` 去重；服务商事件按服务商、test/live
模式与事件ID去重。创建订单仅供服务端角色，订单读取允许经过认证的调用。

`packages/payment-adapter/src/index.ts` 提供通用适配接口与 HMAC 助手；
未配置的 `createCheckout` 明确抛错。通用签名格式不是特定厂商适配器，
不能用它替代所选厂商要求的验签。University 尚未接入对应服务端 HTTP /
webhook 入口；退款内核存在不表示入站退款链已经开放。

`payment_cancelled` 取消未支付订单，不等于停止下一期订阅扣费。
当前有效期 grant 与循环订阅对象也不能混为一谈。若采用订阅，续期、停止
续费、退款后权益处理必须另外明确；不能用订单取消冒充订阅取消。

此前建议从 Collapse 提升共享订单能力，其“共享高风险不变量、不要在
University 复制”的理由仍保留。既然公共内核已经存在，旧文中的“先新建
订单／事件表”不再作为当前任务；其他产品的兼容迁移仍归后端仓库。

## 收费前仍需的证据

1. 确认目标环境迁移、University 报价与授权实际存在，并与产品配置一致；
   本轮没有连接或修改远端数据库。
2. 由共享后端提供经过认证的幂等下单、厂商 checkout 和已验签事件结算。
   密钥、test/live 隔离和对账留在服务端。
3. 接通浏览器的订单／查询动作，校验报价、返回订单身份及真实权益刷新；
   不把页面跳转或模拟响应当成真实支付。
4. 以受控交易验证重复事件、伪造回调、金额／环境不匹配、过期、退款和
   失败重试；若出售订阅，验证实际停止续费路径。
5. 渠道、价格包含的服务、退款规则与商户资格由产品及所选服务商确认。
   旧切片的海外优先不取消国内长期需求；此处不要求先成立公司，也不追加
   法律、税务或资质判断。

代码回归入口为 `packages/core/src/ports/payment.test.ts`、
`packages/backend/src/payment.test.ts` 和会员页相邻测试。它们只证明对应
本地契约，不替代以上外部验收。原始旧文与未提交版本已在R39来源保全中保留；
本次产品工作树的验收状态见[产品完整性计划](../../plans/active/product-completeness.md)；
主线整合状态仍见[交付面板](../../plans/active/continuous-world-delivery.md)。
