---
id: REF-SWIMMER-BACKEND-MIGRATION
title: SwimmerBackend Learner Progress Migration
type: reference
status: active
canonical: true
owner: human
created: 2026-08-26
last_reviewed: 2026-08-26
domain: execution
tags:
  - backend
  - migration
  - progress
  - sync
pinned: false
related:
  - ADR-0001
  - REF-CURRENT-WORK
supersedes: []
superseded_by: null
---

# SwimmerBackend Learner Progress Migration

这是给产品负责人执行的 staging → production 操作包。完整 SQL 只在同目录的
[`swimmer-backend-migration.sql`](./swimmer-backend-migration.sql)；本文件是它的
步骤、验收、回滚和未决事项。`current-work.md` 第 1 项只指向这里，不再复制一份
表结构或 XP 决策。

本次仓库改动没有连接真实后端，也没有替 owner 执行任何远端 SQL。代码运行行为
保持不变：没有配置时仍是安静的本机缓存；配置并登录后才绑定云端 learner row。

## 先看这条安全红线

> **浏览器只需要 `sb_publishable_…` 这一类可公开的 key。绝不要把
> `sb_secret_…`、`service_role` 或任何服务器密钥放进浏览器、`.env.example`、
> 提交、截图或验收记录。**

仓库里的 [`apps/university/.env.example`](../../../apps/university/.env.example) 只放
占位符。真实 project URL、publishable key、测试邮箱和密码由 owner 在自己的
SwimmerBackend 控制台、部署变量或本机 `.env.local` 中填写；本仓库不保存它们。

## 1. 代码已经钉死的契约

| 远端事实 | 为什么是这个形状 | 代码证据 |
| --- | --- | --- |
| schema 是 `university`，表是 `progress` | adapter 每次都调用 `client.schema("university").from("progress")` | `packages/backend/src/browser.ts:94-95` |
| 一行对应一个 Auth user | `user_id` 是 load、insert、update 的选择键；身份端提供 `user.id` | `packages/backend/src/browser.ts:98-149`；`packages/core/src/ports/identity.ts:16-25,60-65` |
| `document jsonb` | 一个 mergeable learner document 包含 lessons、cards、words、streak、XP、批注、答案、复习答案和 account data | `packages/core/src/ports/progress.ts:110-126`；`packages/core/src/progress/document.ts:20-31` |
| revision 是乐观锁 | 先读 `document, revision`，更新时带 `.eq("revision", currentRevision)`，成功值是 `currentRevision + 1` | `packages/backend/src/browser.ts:108-149`；`apps/university/src/account/progress-remote.test.ts:70-85` |
| insert 允许首次上传，重复 insert 要回读 | 缺行时 insert `user_id/document/revision: 1`；`23505` 后重试 | `packages/backend/src/browser.ts:127-135` |
| 只给登录用户自己的行 | 浏览器只在 `signed_in` 后用 `status.user.id` bind progress；SQL 用 `auth.uid() = user_id` 的 select/insert/update 三道门 | `apps/university/src/account/session.ts:10-39`；`packages/core/src/ports/identity.ts:108-145` |
| XP 不再把永久 ledger 留在服务端 document | 当前 merge 是 event-id union + sum，已知会无界增长；已决定改成 server counter + bounded window | `packages/core/src/progress/merge.ts:95-103,138-145`；`packages/core/src/progress/port.ts:187-198`；本条是 `current-work.md:256-262` 所指向的执行决定 |

### 为什么 SQL 使用触发器，而不是要求一个新 RPC

当前浏览器 adapter 没有发送 `xp_total` 或 `xp_event_window`，也没有调用 RPC：它
只发送 `document` 和 `revision`。这由
`packages/backend/src/browser.ts:108-149` 和
`apps/university/src/account/progress-remote.test.ts:70-85` 直接证明。

所以迁移把 XP 的服务端收口放在同一张 `university.progress` 表的
`BEFORE INSERT OR UPDATE` 触发器里：客户端请求契约不变，服务端把收到的
`document.xpEvents` 规范化成计数器镜像；不能把 SQL 写成客户端并未实现的 RPC
契约。

## 2. 执行前置条件

按顺序完成下面事项；任何一项不清楚就停在 staging，不要猜。

1. 在目标 SwimmerBackend 控制台登记 **University** 应用，并确认这是 staging
   项目。控制台的应用登记名称、project ref 和发布流程没有出现在仓库代码中，
   owner 需要自己记录，不能把它们回填进本仓库。
2. 为 staging 准备一个真实可收信的测试邮箱，并另准备第二个测试账号用于
   RLS 隔离检查。不要把邮箱或密码写入提交。若 email confirmation 开启，先在
   控制台确认测试账号，或由 owner 完成确认信流程。
3. 在 SQL Editor 运行下面的预检：

   ```sql
   select
     to_regclass('university.progress') as existing_progress_table,
     to_regclass('public.progress') as public_progress_table,
     to_regclass('core.progress') as core_progress_table;
   ```

   如果 `university.progress` 已存在，先导出并人工比对，不要直接套这份迁移。
   如果只有 `public.progress` 或 `core.progress`，也不要把它改名或复用；本产品
   明确要求新的 `university` schema。
4. 确认备份 / PITR 保留策略和 owner 的恢复权限。SQL 里没有删除既有数据的
   语句，但“回滚”仍然需要知道数据写入后的恢复路径。

## 3. 执行迁移和接线

1. 在已通过预检的 staging SQL Editor 中，原样运行
   [`swimmer-backend-migration.sql`](./swimmer-backend-migration.sql)。它包在
   `begin; … commit;` 中；中途报错时先执行 `rollback;`（若编辑器已经自动回滚，
   也要确认事务没有提交），不要只执行剩下半段。
2. 在 SwimmerBackend 的 Data API / API settings 中把 `university` 加入
   **Exposed schemas**。这不是客户端自动完成的设置；SQL 已授予
   `authenticated` 使用 schema 和对表的 select/insert/update 权限，但没有给
   `anon` 客户端权限。不要把 `core` 或 `public` 当成替代 schema。
3. 在 staging 构建环境或本机私密文件提供两个构建期变量。模板的接线关系是：

   | 变量 | 喂给谁 | 代码证据 |
   | --- | --- | --- |
   | `VITE_SWIMMER_CORE_SUPABASE_URL` | `@pieai/university-backend` 的 Supabase client；同时承载 Auth 和 `university.progress` Data API | `packages/backend/src/browser.ts:12,41-69` |
   | `VITE_SWIMMER_CORE_PUBLISHABLE_KEY` | 同一个 browser client 的公开 publishable key | `packages/backend/src/browser.ts:13,41-53,56-74` |

   `apps/university/.env.example` 是键名和占位符的唯一模板。复制为本地
   `.env.local` 或填入部署平台的构建变量后，重启 / 重新构建 Vite；Vite 是构建期
   接线。代码会拒绝以 `sb_secret_` 开头或含 `service_role` 的值，见
   `packages/backend/src/browser.ts:45-53,72-74`，但这不是把秘密放进浏览器的
   许可。
4. 用 staging 的构建打开两个彼此独立的真实浏览器 profile。建议 A、B 不共用
   localStorage；可以用 Chrome 与 Firefox，也可以用同一浏览器的两个独立 profile。
   验收过程中不要打开 `pnpm e2e`，也不要让两个 profile 共用同一个已登录标签页。
5. 每个浏览器进入「个人档案」（手机底部是「我」），看到「登录」页后填「邮箱」
   和「密码」，点「登录」。成功后应看到「已经登录」和当前邮箱；这些是统一
   `AccountPanel` 的真实控件，见 `packages/ui/src/navigation/slots.tsx:94-118`、
   `packages/ui/src/navigation/empty/AccountPanel.tsx:22-39,72-85,142-195`。

## 4. XP 收口的具体形状

SQL 建的仍然是一张表、一行一个用户；XP 只是同一行里的服务端字段，不是第二
张 XP 事件账本：

| 字段 | 作用 |
| --- | --- |
| `xp_total bigint` | 服务端计数器，唯一的累计总数；范围限制在浏览器安全整数内。 |
| `xp_event_window jsonb` | 有界去重窗口。键是 event id，值含 `amount` 和服务端写入的 `accepted_at`；每次写入只保留最近约 30 天。 |
| `document.totalXp` | 给现有客户端读的服务端计数器镜像；触发器忽略请求里自报的值并重写它。 |
| `document.xpEvents` | 给现有客户端读的“当前窗口内 id → amount”镜像，不再是服务端永久 ledger。 |

一次写入的顺序是：

1. 先按 `OLD.xp_event_window.accepted_at >= now() - 30 days` 清理过期 id。
2. 逐个看请求里的 `document.xpEvents`。窗口内已有的 id 不加分；窗口外的 id
   只接受一次，并把它的 amount 加进 `xp_total`，同时写入本次服务端时间。
3. 用 `xp_total` 重写 `document.totalXp`，用窗口重写 `document.xpEvents`，再写回
   `NEW`。因此客户端仍得到一个能被 `parseProgress` 读取的文档。
4. 首次 insert 可以接收客户端旧文档里的 `__legacy_total__` 兼容种子；已有
   server total 的 row 会忽略这个由 compacted document 合成的种子，避免把已计入
   的历史再次加进去。这对应 `packages/core/src/progress/document.ts:73-100`
   的兼容行为。

revision 由两道门保护：adapter 的 update 条件必须命中旧 revision，数据库触发器
还要求新 revision 恰好是旧值加一；表约束再限制它不能超出安全整数范围。两个设备
同时写时，后到的 adapter 会重新 load、merge，再以新 revision 重试，见
`packages/backend/src/browser.ts:108-149`。

### 窗口的诚实边界

30 天保证的是：同一个 event id 在服务端窗口内重复提交不会重复计数。当前客户端
的 `xpEvents` 只有 `event_id -> amount`，没有事件产生时间；随机 id 的生成也只有
`packages/core/src/progress/port.ts:596-599`。因此一个设备离线超过窗口、带着旧的
完整本地 ledger 回来时，服务端无法区分“新事件”和“已过期的旧事件”，超过窗口
后不承诺绝对不重复。这是有界幂等的明确代价，不应在验收记录里伪装成无限幂等。

如果产品要求“离线数月也绝不重复”或要服务器判定客户端是否作弊，代码还需要把
事件时间 / 服务器可验证的评分输入送进一个新的服务端接口；现有 port 只送 amount，
本次按“不改运行时代码”的范围不替它设计。

## 5. 先做静态 SQL / 权限验收

owner 在 staging SQL Editor 以管理员身份检查，浏览器路径另见下一节。把结果截图
或抄录到外部 staging 记录，但不要把用户邮箱、project URL、key、token 放进仓库。

```sql
select
  user_id,
  revision,
  xp_total,
  (document ->> 'totalXp')::bigint as document_total_xp,
  (select count(*) from jsonb_object_keys(document -> 'xpEvents')) as document_event_count,
  (select count(*) from jsonb_object_keys(xp_event_window)) as server_window_count,
  created_at,
  updated_at
from university.progress
order by updated_at desc;
```

通过条件：`document_total_xp = xp_total`；`document_event_count` 与
`server_window_count` 一致；新用户只有一个 `user_id` row；`revision` 是非负整数。

再检查 RLS 和 grants：

```sql
select
  c.relrowsecurity,
  c.relforcerowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'university' and c.relname = 'progress';

select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'university' and tablename = 'progress'
order by policyname;

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'university' and table_name = 'progress'
order by grantee, privilege_type;
```

通过条件：`relrowsecurity` 为 true；有且只有面向 `authenticated` 的 select、
insert、update 自有行策略；`anon` 没有表权限；`authenticated` 没有 delete 权限。

## 6. 两个真实浏览器的四条验收路径

### 共用准备

- 浏览器 A、B 都用同一个 staging origin；A、B 是同一个测试账号，除 RLS 隔离
  小节外不要换账号。
- 打开两边的 Network 面板，过滤 `progress`；同时准备管理员 SQL Editor，查询
  时只看 `revision`、计数和必要的 lesson key，不复制 Auth header。
- “上传成功”以三件事同时成立为准：界面动作完成、`progress` 请求没有错误、
  SQL Editor 看到 row/document 发生预期变化。客户端没有把同步状态文字放在
  屏幕上，不能把“看见页面”当作云端成功。

### A. 首次上传

1. 在全新浏览器 profile A 打开 staging；点左侧「个人档案」或手机底部「我」。
2. 在「登录」页填 owner 提供的真实 staging 测试账号，点「登录」。确认出现
   「已经登录」和该账号邮箱。
3. 点「学习」，在「今天」卡上点「开始学习」（已有本机进度时可能显示
   「继续学习」）。
4. 读完一节课，滚到课末题目；在「用自己的话」输入框填回答，点「提交」，再点
   「完成本次更新」。这正是已有真实浏览器 walk 使用的完成顺序。
5. 在 SQL Editor 查询该用户的 row，记录登录后的 revision `R0` 和完成后的
   revision `R1`；同时看 `document.lessons` 中出现这节课、`xp_total > 0`，且
   `document.totalXp = xp_total`。

通过：首次登录没有报错；`university.progress` 自动出现且只有该用户一行；
本机完成的 lesson、XP 和 revision 都上传，`R1 > R0`（若动作间有多个自动保存，
允许一次以上递增）。

### B. 并发合并

1. 在 A、B 都登录同一账号并打开过同一初始状态后，记录两边看到的远端 revision
   `R`。不要 reload B；要让 B 保留一个可验证的旧本机快照。
2. 在 A 打开一个当前可进入的 lesson X，按“提交”→“完成本次更新”，等 SQL
   Editor 看到 revision 从 `R` 增长。
3. 不 reload B；在 B 打开另一个不同的当前可进入 lesson Y，也按同样顺序完成。
   两边不要选同一 lesson key，否则只能证明同一事实幂等，不能证明两个设备的
   独立改动都被保留。
4. 等 B 的 `progress` 请求结束后，查询 row 的 `document.lessons`、XP 和
   revision；必要时在 B reload 一次，确认界面仍显示 X、Y 两边各自留下的进度。

通过：X 和 Y 两个独立 lesson 都在同一行里，先写入的设备没有被后写入的设备
覆盖；XP 是两边新增事件的合计；revision 每次成功保存只向前走。若要加压
revision guard，可在 B 的保存请求变 pending 时让 A 完成 X，再等 B 结束；最终
仍必须同时保留 X、Y，不能以“最后一个 PATCH 返回 200”单独判通过。

### C. 断网出队

1. 保持 B 登录同一账号；先记下 SQL Editor 的 revision `R_before` 和当前
   `xp_total`。
2. 只在 B 的浏览器 DevTools Network 选择 **Offline**（不要关闭整个电脑网络，
   以免影响 A 和 SQL Editor）。
3. 在 B 打开一个尚未用过的可进入 lesson，完成一次读课 / 答题 /「完成本次更新」，
   或做一个会写入 learner document 的收藏动作。
4. 确认页面仍然能完成动作、进度或 XP 在 B 的界面上变化；Network 中对应的
   `progress` 请求应失败或无法送达。回到 SQL Editor 查询同一 row。
5. 保持 B 的页面和 tab 不动，记录失败时间和本机看到的变化；不要手动删
   `university.progress` row。

通过：断网不阻塞学习；B 的本地缓存保留变化；云端 row 在断网期间仍是
   `R_before` / 原 document（可能有 A 的已完成变化，但不能包含这次 B 的离线变化）；
   后续恢复网络前没有把离线动作当成已上传。

### D. 重连 flush

1. 在仍保留离线改动的 B 中，把 Network 从 **Offline** 恢复为 No throttling；不要
   先清 localStorage，也不要先退出登录。
2. 观察 B 的 Network：恢复网络后，`progress` 的 load/save 请求应自动出现。现有
   接线监听浏览器 `online` 事件；若浏览器的 DevTools 模拟没有发出该事件，恢复
   网络后 reload 一次，作为同一 dirty outbox 的重试，不要重新做动作。
3. 查询 SQL Editor，记录新 revision `R_after`、`xp_total` 和
   `document.lessons` / `document.xpEvents`。离线动作应出现，计数器只增加一次；
   `server_window_count` 不应出现同一个 id 的重复键。
4. 在 B reload，回到「个人档案」或对应学习路径，确认离线完成的内容仍然存在；
   同时确认 A 的先前内容也没有消失。

通过：恢复网络后无需重新点击提交，dirty document 自动 flush 到同一个用户 row；
云端 revision 向前走、离线动作可见、XP 没有因为失败重试而重复计数；reload 后
界面和云端一致。

### RLS 隔离门（四条路径之外，但发布前必须做）

1. 用全新浏览器 profile C（或清晰隔离的第二个真实账号，不要复用带 A 本机缓存的
   B）登录第二个 owner 提供的 staging 测试账号。
2. 先让 A 有一条明显的 lesson / XP，再让 C 打开个人档案和学习页；C 不应看到 A
   的进度。必要时在浏览器 Network 看到 C 的 `user_id` 请求只返回自己的 row。
3. 管理员 SQL Editor 应看到两个不同 `user_id` 的 row；客户端 C 不得读取、修改
   A 的 row。

通过：跨用户访问不是“页面没做入口”，而是 Data API 经过 `authenticated` grant
和 `auth.uid()` RLS 后确实拿不到别人的行。

## 7. 回滚

### SQL 执行中出错

- `commit` 之前：停止继续粘贴，执行 `rollback;`，再检查
  `to_regclass('university.progress')` 和 schema 是否仍按预期；不要只重跑报错
  后面的语句。
- Data API 的 Exposed schemas 是控制台设置，不属于 SQL 事务；如果 SQL 回滚，
  同时把控制台里临时加入的 `university` 暴露项撤掉。

### 迁移成功但还没有写入 learner row

1. 先停止 staging 构建或从构建变量移除两项 `VITE_SWIMMER_CORE_*`，让浏览器回到
   既有的本机模式；缺少 env 在 `packages/backend/src/browser.ts:45-69` 是静默
   unconfigured，不会连接后端。
2. 确认 `select count(*) from university.progress` 为 0，且 schema 中没有 owner
   另建的对象。
3. 只有在 owner 明确确认“表为空且没有其他消费者”后，才可执行表级撤销：

   ```sql
   begin;
   drop trigger if exists progress_before_write on university.progress;
   drop function if exists university.progress_before_write();
   drop function if exists university.progress_xp_amount(jsonb);
   drop table if exists university.progress;
   commit;
   ```

   不要顺手 `drop schema university`；schema 可能已被其他 owner 对象使用。

### 已经写入 learner row

- 不要 `delete`、`truncate` 或直接 drop table 来“回滚”。先停用构建变量，导出 /
  备份 `university.progress`，保留 `revision`、`document`、`xp_total` 和
  `xp_event_window` 的原样快照。
- 若只是触发器逻辑问题，保留表和数据，在备份可读并核对后由 owner 用修正后的
  migration 在 staging fix-forward；修正期间不要让两个版本的客户端同时写同一行。
- 若必须回到某个时间点，使用 SwimmerBackend owner 已确认的备份 / PITR 流程；
  本仓库无法凭空给出恢复时间点，也不替 owner 执行恢复。
- 控制台的 University app 登记和 Exposed schema 可以在应用停用后撤销，但撤销
  暴露不等于删除数据；需要保留数据时只撤销暴露和构建接线。

本次仓库提交的撤销是普通的单提交 `git revert` 路径；本工作树不会 merge、push
或代替 owner 修改远端。

## 8. 产品负责人需要补充 / 本代码无法确定的事

- 目标 SwimmerBackend 项目（staging 和 production）及其 app registration / 发布
  流程；代码只证明需要 project URL 和 publishable key，没有 app id 字段。
- email/password 是否开放、确认信策略、两组可收信 staging 测试账号，以及谁拥有
  它们；本仓库不保存真实邮箱或密码。
- `university` 在 Data API 的 Exposed schemas 中的控制台开关；SQL grants 不能
  替代这项平台配置。
- 30 天窗口是否是最终业务承诺。代码能证明的是当前事件 payload 没有事件时间，
  所以超过窗口的长期离线 replay 不可能提供无限幂等；若不能接受，需要另一个
  服务端接口 / payload 决策。
- XP amount 是否需要服务端反作弊校验。现有 `addXp(eventId, amount)` 和保存契约
  把 amount 当作客户端已算好的值；本迁移只收口计数与去重，不声称它完成了评分
  授权。
- 生产发布的 host、CORS / domain allow-list、备份保留和 PITR 操作人；这些不在
  当前仓库代码或文档里，不能臆造。

## 9. Closeout 记录

- **目标与范围：**为 owner 生成不含真实凭据、可在 staging 先跑的
  `university.progress` 迁移和四条真实浏览器验收路径；不改运行时代码、不连接
  真实后端、不跑 `pnpm e2e`。
- **主泳道：**仓库拓扑 / 知识维护。
- **保住的契约：**一个 `university.progress` row、现有 `document` JSON 请求、
  `.eq("revision", old)` 乐观锁、可选登录、本机离线 cache/outbox、两壳共用一套
  adapter；RLS 只让 `auth.uid()` 访问自己的 row。
- **选的边界形状：**`docs/reference/execution/` 作为执行事实的唯一权威住处，
  runbook 与唯一 SQL 文件相邻；`apps/local` 不接管外部 DB。否掉了把 migration
  塞进 `apps/local`、另造第二张 XP ledger、或要求新 RPC 的方案。
- **证据与闸：**客户端源码、fake-remote 测试、账户 UI、XP merge / parser、
  官方平台要求由 owner 在控制台落实；本地会跑静态 secret/path 检查、doc-gov
  检查和 `pnpm verify`，不跑占用固定端口的 e2e。
- **文档 / 清理决定：**新增本 runbook 和 SQL，新增 Vite env 占位模板；只把
  `current-work.md` 第 1 项改成指针并带 `Pinned-Override: REF-CURRENT-WORK`，
  不删除不明归属的旧文件，也不提交 `apps/university/src/content/imported.json`。
- **回滚路径：**事务失败即 rollback；空表才允许表级撤销；有数据则先停用接线、
  备份、fix-forward 或走 owner 的 PITR，不做盲删。
- **有意变化：**远端 row 的 XP 存储从无界 document ledger 收口为 server counter
  + 约 30 天 event-id window；现有浏览器输入通过触发器兼容，不改变页面行为。
- **剩余不确定性：**平台登记 / 暴露操作、账号和恢复策略、长期离线的窗口语义、
  XP 反作弊授权仍需要 owner 决策。
