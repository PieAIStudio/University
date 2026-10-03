---
id: PLAN-15-ACCOUNT-CENTER-ADOPTION
title: "15 · Account center and shared closeout adoption"
type: plan
status: active
canonical: true
owner: ai-assisted
created: 2026-10-02
last_reviewed: 2026-10-02
domain: execution
tags:
  - accounts
  - sso
  - adoption
related:
  - REF-WORK-QUEUE
  - REF-CURRENT-WORK
supersedes: []
superseded_by: null
---

# Task 15 · 账号中心与共享注销接入

**等待 Owner 明确决定开始时间，默认跳过，不得自动执行。** University 正在冻结新功能、
准备内测；排入队列只保存需求，不是内测前必须接入的许可。即使前面的 14 号任务完成、
账号中心上线或共享包发布，也不能解除这条等待。仅 University 自己的会话实施本任务，
共享库会话只编写本任务包，不修改 University 产品代码。

## 1. Outcome

Owner 放行后，学习者使用同一个品牌账号进入 University，在账号中心管理安全设置；
局部退出与全部退出范围清楚，旧会话不能继续授权受保护操作，已保存的学习数据不因退出
丢失。注销复用 BE-1 与 AuthKit 的共享流程，不建立第二套恢复、删除或身份服务。

## 2. Owner 原话、前置与已核对现场

> University 的接入只能写成 University 仓库队列里的任务包（docs/plans/active/），由
> University 自己的会话执行，不要直接改 University 的代码。University 现在冻结新功能、
> 准备内测，单点登录什么时候接由 Owner 决定；University 的注销会复用 BE-1 和 AuthKit
> 的注销流程。

解释：这是后续接入队列，不是推翻冻结，也不是立即启用所有登录方式。按
[现有队列](../../reference/execution/work-queue.md)排序，保留已有编号。它与课程制作、
退役和内容仓库迁移没有功能上的强制依赖；那些任务结束后必须重新定位接口，不假定旧
路径还在。Owner 未批准本任务时可跳过，不阻挡内测和其他已批准的独立任务。

2026-10-02 只读核对基线 `d08df8ec`：

- `packages/backend/package.json` 与 `packages/ui/package.json` 的 AuthKit 仍为 0.1.9，
  UI 使用 UIKit 2.14.0；不能把上游发包等同本产品采用。
- `packages/backend/src/browser.ts` 是两种模式共享的浏览器账号/进度装配，使用普通
  Supabase 会话；`packages/ui/src/navigation/empty/AccountPanel.tsx` 与 `AuthHandoff.tsx`
  拥有账号界面和返回页。未来从这些职责定位，不按本日行号机械替换。
- `packages/backend/src/account-closure.ts` 当前请求 University 的审核型删除 RPC，
  返回 `review-required`，不是 BE-1 完成删除。已有请求和审计必须保留，不能把旧回执
  改写成已自动注销，也不能同时提交两条不同删除流程。
- 上游 AuthKit 0.7.0 已私有发布，包含 SSO 与此前生命周期组件；0.8.0 的 UIKit 3
  兼容本轮只准备候选。执行时重新读取实际发布版本和 peer 范围，生产不装未发布候选。
- Backend 的账号中心宿主已部署但保持关闭；DNS/CNAME、真实 OAuth 配置和产品接入
  尚未验收。BE-1 恢复码和全产品覆盖的两张后续迁移也仍有托管应用门禁。

开始代码前，按 portfolio 定位相邻 `SwimmerAuthKit/README.md` 的 SSO 与生命周期合同，
`SwimmerBackend/docs/reference/account-security-runtime.md`、
`SwimmerBackend/docs/plans/active/account-center-activation.md` 及 Directing 的唯一上游
交接表 `UPSTREAM-STATUS.md`。独立 checkout 缺少这些资料时请求准确合同，不复制私有源码。
账号中心、OAuth 客户端/回调、提供方和数据库授权分别核对，不能从“允许改代码”推导
“可以改正式共享配置或删除真实数据”。

## 3. 接入范围与不变量

1. **先画清实际身份与数据路径，再接入。** 按当前 V7 用户旅程约定处理入口和返回页，
   authoring/delivery 继续共享一份实现。盘点浏览器直接 Data API、Node 服务、同步 outbox、
   长连接、付费/判题请求和签名下载的身份边界；需要新增服务接线时与 Backend 协调，
   不新造 OAuth、令牌缓存、父域 Cookie、密码学或第四个业务 port。
2. **复用已发布 AuthKit。** 产品 Node 会话使用 `sso`；账号中心才用 `ssoCenter`。
   OAuth 续期不得塞入普通 SDK 的 refresh 流程。每个受保护请求及实际数据通道必须验证
   当前会话，不能只在页面挂载时记一次 userId，不能在核验失败时退回匿名访问。
   账号中心使用已登记 client、准确 HTTPS 回调与批准的 scope，不放通任意返回地址。
3. **账号与学习数据不换人。** 保留原用户 UUID、匿名进度与已登录进度的现有归属规则。
   旧账号退出、切换到另一账号或离线恢复时，缓存/outbox 不得写给新账号。没有 Owner
   明确批准，不自动合并账号、覆盖云记录、清空未同步内容或重新创建身份。
4. **退出可验证。** local 只退出当前产品会话；global 明确是所有产品和设备。返回页面、
   focus/pageshow 和受保护操作重新核验。未过期旧 Cookie 重放也应拒绝；网络未知显示
   未确认，不宣告退出成功，不循环自动再登录。已接收的后台工作、长连接与已签发下载
   单独按服务端合同处理，不声称 HTTP 登录组件能收回已经送达的内容。
5. **注销只接共享能力。** 使用 AuthKit 的确认、重新认证、恢复码和取消界面及 BE-1
   的后台端点。University 只提供它拥有的幂等产品清理处理器、数据清单和回执，注册到
   Backend 的完整处理器集合。保留 14 天宽限期与无需重新登录的受限取消能力；普通退出
   不删除课程、学习记录或作品。旧审核请求的过渡由明确规则承接，不能悄悄删表或丢队列。
   缺迁移、处理器、邮件/调度、近期验证或 MFA 证明时保持未启用，禁止空处理器假成功。

**不在范围内：** 改课程或内容仓库、重做地图/渲染、批量升级 UIKit 3、另造登录/注销系统、
修改其他产品、把管理凭据放浏览器、绕过私有包权限、改已应用迁移、开启收费短信/模型调用、
操作真实用户数据。PGS PLAN-0009 等账号中心正式启用与 Directing 接入后再做账号相关
收敛；这张接入任务不是提前重构的许可。

## 4. How it is judged

本任务包编写只读源码并运行文档检查，不重新启动正在受阻的整套产品验收。
**本日实际测得 `pnpm doc-gov check` 为 172 docs（新增本任务前）。** 现有队列记录的
`26a296fe` 基线为 430 browser / 40 timing；这是必须保留的底线，不是当前全绿声明。
当前 11 号任务的原始回执为 428 passed / 3 failed，timing 未执行，必须由其原会话先收口；
不能借新增任务包推动该未通过门禁的提交。

执行者获准启动后，先重新测量当时基线和相邻任务新增测试，随后按以下门禁收口：

| Gate | Command | Requirement |
| --- | --- | --- |
| 快速及整合 | `pnpm verify` | 真实运行并全过；不是浏览器替代品 |
| 完整用户旅程 | `pnpm e2e` | 不低于现有 430 底线并保留所有后续新增检查，0 failed |
| 时间预算 | `pnpm e2e:timing` | 保留至少现有 40 项并全部通过 |
| 文档 | `pnpm docs:check`、`git diff --check` | 合同、当前说明和任务生命周期对齐 |

**通过数只能增加，不能靠删除/跳过用例、上调超时或换金图变绿。** 先失败再修复，保留
原始失败。真实双账号正反例至少覆盖：第一次/再次登录、MFA 未完成、局部退出不影响另一
会话、统一退出后的旧凭据、A→B 账号切换不串进度、离线拒绝与恢复、取消注销和中断重试。
同一账号的原进度/收藏/阅读记录在接入前后核对，authored/delivery 使用相同账号规则。

前端浅深色、桌面/窄屏以及返回原课程均须真实浏览器截图并逐张查看。隔离环境再做
真实 OAuth 续期/撤销、端点权限、邮件与产品清理的串联验证；虚拟后端不冒充正式投递。
Touch ID、真人提供方登录或收件箱确认需要 Owner 的参与时明确停在该步。

## 5. Delivery discipline

只有 Owner 明确放行后，University 自己的会话才开始实现。一个任务、一份可回退提交、
一个正常 push，保留现有 pre-push 完整门禁；检查失败就停在本任务，不推给后续队列。
共享库、Backend、产品源码保存、包发布和正式部署分别给准确回执，不能相互代替。
不 force-push、不改写历史。失败回退关闭新入口/配置、保留旧正常登录，不复活已撤销会话、
恢复码或删除已保存的用户数据。生产部署仍按本仓库既有明确授权发布流程。

本任务包只是待执行输入，不证明上述产品行为已经实现。编写者不得运行本任务或借文档
push 一起推走其他会话尚未通过验收的源码提交。

## 6. Report back

向 Owner 报告实际采用的包/部署/后端版本，每个环境的真实测试命令与原始数字、新截图、
保留的旧账号/进度证明、注销清理回执、未验证项和回退办法。将“候选可安装”“正式配置
就绪”“产品已接入”“真人验收通过”分开写，不用一个“全部完成”覆盖不同状态。
