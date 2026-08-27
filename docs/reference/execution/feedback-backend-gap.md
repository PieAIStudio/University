---
id: REF-FEEDBACK-BACKEND-GAP
title: Feedback Backend Gap
type: reference
status: active
canonical: true
owner: human
created: 2026-08-27
last_reviewed: 2026-08-27
domain: execution
tags:
  - feedback
  - backend
  - rls
  - cross-repository
related:
  - REF-CURRENT-WORK
  - REF-PAYMENT-BACKEND-GAP
  - SPEC-0003
---

# 意见：浏览器已经会说实话，SwimmerBackend 还缺一张桌子

这是一份跨仓库缺口说明。它记录 University 这边已经交付的浏览器契约，以及
真正保存学习者意见、让作者在 `#/studio` 看到全量意见还必须在 SwimmerBackend
完成的工作。

**本轮不在 University 建表、不添加 Supabase migration、不创建第二个服务。**
后端正在重组，这份文档是可执行的交接方案，不是已经应用到后端的迁移。

## 先给结论

反馈不是一块新的后台产品，也不是举报表的另一个名字。它属于“学习者对自己
正在学的材料说了一句话”这个域：作者端把同一份结构化意见复制给现有 AI 工作流，
交付端把同一份结构化意见写进 SwimmerBackend。两边的按钮、字段和即时回应由
共享 `FeedbackNote` 决定；差异只在 `apps/university/src/ports/index.ts` 选择的
传输端口。

当前真实状态是：

- `FeedbackPort` 已有 `submit` 和 `readMine` 契约；作者端 transport 是剪贴板，
  交付端 transport 是 SwimmerBackend；
- 交付端提交成功后才会显示“收到。这条记在《课名》第 N 版上了。”；请求失败时
  显示没有送出，也不会偷偷复制到剪贴板；
- `#/studio` 的反馈读取接口、owner-only 答题聚合接口和按课程/版本/课分组的视图
  已经定好，但后端表或答题聚合没接好时分别显示能力缺口；有真实反馈表且没有
  记录时才显示“还没有收到反馈”；
- 交付端只发送意见正文和下方的最小上下文，绝不发送学习者答案原文、课文正文
  或邮箱。

## 为什么不装现成的反馈平台

Feedbackland、UserBubble、FasterFixes 以及类似 Quackback 文章里列的工具可以
启发“收集一条话、以后聚类”的形状，但它们不应该成为 University 的依赖。
理由不是“我们想自己写”，而是它们和这个产品的边界不相容：

1. 它们是独立应用或独立库，通常带着自己的账号、数据存储和部署面。装进去，
   就变成第二套账号、第二个数据仓库、第二处需要守的部署；University 的法律
   是一个 SwimmerBackend，学习者账号和学习数据应该仍然只有一个归属。
2. 它们默认的模型是公开的功能投票板：大家给同一个功能投票、看同一个榜单。
   University 要回答的是“某位学习者在某一节课的某一版卡住了”，这不是公开
   投票，也不应该把学习者的学习痕迹暴露给其他学习者。
3. 聚类真正有价值的不是一个通用组件会把句子分组，而是它知道上下文：哪门课、
   哪一版、哪一次尝试、是否登录、在哪条路由、什么视口。University 已经有
   这些信息；把一句话送到外部组件反而会丢掉最有用的部分，还多了一次数据边界。

所以复用的是形状和思路：表、RLS、只让意见所有者读自己的记录的安全形状参考
`collapse.reports`；按课程和版本做确定性聚类；以后若需要“这一节大家在抱怨
什么”，再做离线的固定分类。**不复用举报数据域，不引入上述平台的包、账号或
部署。**审阅入口直接用已经存在的 `#/studio`，不创建新后台。

## 浏览器契约和数据边界

### 发送什么

`FeedbackPort.submit` 的输入只有：

| 字段 | 用途 |
| --- | --- |
| `message` | 学习者主动写下的意见；这是反馈正文，必须由学习者点击提交才发送 |
| `locator` | `studyId / courseId / unitId / lessonId`，没有具体课程页面时为 `null` |
| `contentRevision` | 该课当前版本；没有具体课程页面时为 `null` |
| `exerciseAttemptCount` | 当前课、当前版本已有的练习尝试次数；只有计数，不含答案 |
| `signedIn` | 提交当下的登录状态；它是上下文，不是 RLS 的身份判断 |
| `route` | 当前 hash/path |
| `viewport` | 当前浏览器宽高 |

浏览器不会把整个 `ProgressDocument` 交给反馈适配器。适配器也不会从进度文档
读取 `ExerciseAttemptRecord.answer`、`RetrievalAttemptRecord.answer` 或任何课文
缓存；后端 insert 使用显式字段白名单。邮箱只存在身份端口的登录状态里，不进入
反馈输入、数据库 insert 或安全的 select 列表。

作者端的剪贴板文本会额外带壳名、主题和时间，方便作者把它贴进现有 AI 对话；
这些是本地 hand-off 的上下文，不是交付端发送到表里的新字段。

### 读什么

`FeedbackPort.readMine()` 只供学习者读自己的已保存意见。匿名学习者没有稳定的
“自己的”云端身份，所以交付端匿名提交成功后 `readMine()` 返回空列表，并不把
所有匿名意见读回来。

`FeedbackReviewSource.listAll()` 是作者工作台的另一项能力。它只选择安全的反馈
字段，依赖后端 owner RLS 才能读全量；学习者的端口没有 `listAll`，UI 也没有把
它伪装成普通 learner action。`listAnswerAggregates(studyId)` 是同一 read model
里的第二项 owner-only 能力：它只返回课 / 版本 / 练习数量、首答记录数、首答通过
数和总尝试数，不返回任何答案原文。现在后端还没有这个聚合 view / RPC，所以
Studio 的右栏显示“答题汇总还没接好”，不会把当前作者的 `ProgressDocument` 当成
全体学习者的通过率。

## 确定性聚类先于 AI

第一层不需要 AI：`studyId + courseId + unitId + lessonId + contentRevision` 就
足以回答“哪一节的哪一版收到了多少条意见”。Studio 的细部按“课程 → 内容版本
→ 具体一节”展开，并把同一组的答题数据放在旁边。

之后如果记录量真的值得归纳，离线批处理才可以在已授权的意见文本上做固定标签：
“太难 / 太简单 / 内容有误 / 界面有问题 / 其他”。这不是实时聊天，不向学习者
承诺修复时间，也不把模型放在每次提交的路径上。第一层的计数永远以数据库里的
真实记录为准。

## 意见和答题数据必须并排看

意见是弱信号，答题数据是强信号。只听见“太难”的人，可能正是快要放弃的人；
觉得刚好的人通常不会主动写意见。Studio 因此同时显示：

- 意见条数和意见原话；
- 当前课程/版本/课的练习总数；
- 第一次通过率（首答通过数 / 首答记录数）；
- 总尝试次数，以及有首答记录的题数。

没有答题记录时显示“暂无答题数据”，不是 `0%`；没有反馈记录时显示“还没有
收到反馈”，不是一张填着 0 的指标卡。没有当前版本课程结构时，历史版本也不
借用今天的练习总数来假装可比。聚合接口没接好时显示“答题汇总还没接好”，也
不把一位作者的本地进度冒充总体数据。

**不自动改课。** 让 AI 读着抱怨就直接改课程，等于让最吵的人决定课程走向，
还可能把一个误解改成全体学习者的新教材。未来最多是 AI 提议、列出依据，并
同时引用意见聚类和答题数据；人批准后才进入既有的课程作者流程。

## 给 SwimmerBackend 的可执行 SQL

下面的 SQL 假定 University schema 已经由 SwimmerBackend 的现有迁移创建，并使用
一个由 Auth 管理员写入 `app_metadata` 的不可由用户自行修改的 owner claim：
`university_feedback_owner=true`。这不是把 owner id 写死在客户端，也不是让
`user_metadata` 决定权限。后端如果在重组中选定了统一 owner helper，应在应用前
把最后一个 owner policy 的表达式替换成那个已发布 helper，并保持同样的测试矩阵。

```sql
begin;

set local lock_timeout = '15s';
set local statement_timeout = '5min';

create schema if not exists university;

comment on schema university is
  'University learner data: progress and explicitly submitted product feedback.';

create table if not exists university.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users(id) on delete set null,
  message text not null,
  study_id text,
  course_id text,
  unit_id text,
  lesson_id text,
  content_revision integer,
  exercise_attempt_count integer not null default 0,
  signed_in boolean not null,
  route text not null,
  viewport_width integer not null,
  viewport_height integer not null,
  created_at timestamptz not null default now(),
  constraint feedback_message_length_check
    check (length(btrim(message)) between 1 and 2000),
  constraint feedback_locator_all_or_none_check
    check (
      (study_id is null and course_id is null and unit_id is null and lesson_id is null)
      or
      (study_id is not null and course_id is not null and unit_id is not null and lesson_id is not null)
    ),
  constraint feedback_content_revision_check
    check (content_revision is null or content_revision > 0),
  constraint feedback_attempt_count_check
    check (exercise_attempt_count >= 0),
  constraint feedback_route_length_check
    check (length(route) between 1 and 512),
  constraint feedback_viewport_check
    check (
      viewport_width between 1 and 10000
      and viewport_height between 1 and 10000
    )
);

comment on table university.feedback is
  'Learner-submitted product feedback. No answer, lesson body, or email is stored.';

create index if not exists feedback_course_revision_created_idx
  on university.feedback (study_id, course_id, content_revision, created_at desc);

create index if not exists feedback_user_created_idx
  on university.feedback (user_id, created_at desc);

alter table university.feedback enable row level security;
alter table university.feedback force row level security;

revoke all on university.feedback from public, anon, authenticated, service_role;
grant usage on schema university to anon, authenticated, service_role;
grant insert (
  message,
  study_id,
  course_id,
  unit_id,
  lesson_id,
  content_revision,
  exercise_attempt_count,
  signed_in,
  route,
  viewport_width,
  viewport_height
) on university.feedback to anon, authenticated;
grant select (
  id,
  message,
  study_id,
  course_id,
  unit_id,
  lesson_id,
  content_revision,
  exercise_attempt_count,
  signed_in,
  route,
  viewport_width,
  viewport_height,
  created_at
) on university.feedback to authenticated;
-- `readMine()` needs this only as a filter column; its select projection never returns it.
grant select (user_id) on university.feedback to authenticated;
grant select, insert, update, delete on university.feedback to service_role;

drop policy if exists feedback_learner_insert on university.feedback;
create policy feedback_learner_insert on university.feedback
  for insert
  to anon, authenticated
  with check (
    (
      ((select auth.uid()) is null and user_id is null)
      or
      ((select auth.uid()) is not null and user_id = (select auth.uid()))
    )
    and signed_in = ((select auth.uid()) is not null)
  );

drop policy if exists feedback_learner_read_own on university.feedback;
create policy feedback_learner_read_own on university.feedback
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists feedback_owner_read_all on university.feedback;
create policy feedback_owner_read_all on university.feedback
  for select
  to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'university_feedback_owner') = 'true'
  );

commit;
```

几个刻意的细节：

- `user_id` 由数据库的 `auth.uid()` 默认值填充，客户端没有写入另一个人的 id
  的权限；匿名行保留 `null`，但没有匿名 select policy；
- owner policy 与“读自己的”是两个可组合的 select policy。普通登录学习者只能
  看到 `user_id = auth.uid()` 的行，owner 才能看到全部行；service role 是后端
  运维角色，不是浏览器 owner UI 的替代品；
- 没有客户端 update/delete policy。意见是 append-only 的事实；纠正、删除和
  保留期限是后端 owner 的支持/合规动作；
- `user_id` 只额外授予了作为 `readMine()` 过滤条件所需的列权限；适配器的
  `FEEDBACK_COLUMNS` 投影仍不选择它，owner 工作台也不会把账号 id 或邮箱变成
  UI 数据；
- owner claim 来自 `app_metadata`，不能使用学习者可编辑的 `user_metadata`，也
  不能在 Vite 环境变量里放一个“万能 owner id”。

## Runbook：后端接入顺序

### 1. 先确认后端归属和 claim

SwimmerBackend 负责人先确认 `university` schema 的 owner、Data API 暴露方式、
`auth.jwt()` 的 claim 命名，以及哪个 Auth 管理动作会设置和撤销
`university_feedback_owner`。如果后端统一角色函数已经发布，使用它替代 SQL 中
的直接 claim 表达式；不要在 University 仓库里再造一张角色表。

### 2. 在 staging 应用 SQL

在后端仓库保存并审查这段 migration，先在无数据的 staging 分支执行。检查 schema
usage、精确的 table grants、RLS 是否 force、Data API 是否能访问 `university`
schema，以及 migration runner 是否允许 `gen_random_uuid()`。

### 3. 做四种权限烟囱

用 publishable key 发起真实 Data API 请求，准备匿名请求、普通学习者 A、普通学习者
B、owner 四种会话：

1. 匿名可以 insert 一行，匿名 select 得到 0 行/不被授予 select；
2. A 可以 insert 和读自己的行；
3. B 读不到 A 的行，也不能 update/delete A 的行；
4. owner 可以读 A、B 和匿名行的全部安全字段，但 Studio adapter 的 select 返回里
   没有 `user_id` 和邮箱；
5. A/B/owner 都不能通过客户端 insert 另一人的 `user_id`；
6. 对每个角色都插入一次带答案原文、课文正文、邮箱字段的“恶意额外 JSON”，
   确认 PostgREST 只接受白名单列，而 University adapter 的实际 insert 也不
   会转发这些键。

匿名没有“读自己的”语义是有意的：没有账号 id 就没有可验证的所有权。若产品
以后需要匿名回看，必须先另行设计不可伪造的 receipt/token 和保留策略，不能把
所有匿名行开放出来。

### 4. 先接表，再打开客户端能力

后端 migration、RLS smoke 和 owner claim 都通过后，部署与现有
`VITE_SWIMMER_BACKEND_SUPABASE_URL` / `VITE_SWIMMER_BACKEND_PUBLISHABLE_KEY` 同一
套配置。浏览器复用现有 backend client，不新增 URL、函数、cron、Vercel route
或第三方 SDK。

上线后验证：

- 学习者点提交，收到“记在《课名》第 N 版上了”，刷新后没有变成剪贴板提示；
- 模拟表不可用或权限拒绝，页面显示没有送出，不显示对勾；
- owner 打开 `#/studio`，能先看课程/版本汇总，再展开到课和原话；
- owner-only 答题聚合接口就绪后，Studio 才在右侧显示通过率和尝试覆盖；接口未
  就绪时右侧明确显示能力缺口；
- 后台聚合器从现有 `university.progress` 文档读取答案事实并只返回计数，原始进度
  文档、答案字段仍不出现在浏览器反馈请求中。

### 5. 后续批处理另立发布闸

只有确定性分组稳定、样本量足够、数据保留与删除规则明确后，才讨论离线固定分类。
分类结果应是可重跑的批处理产物，保留模型版本和输入记录的最小审计信息；不要
把分类塞进实时提交，也不要让分类结果直接写回课程。任何课程改动都必须是“AI
提议 → 人审阅 → 既有作者流程发布”，并且提议同时列出答题数据。

## 回滚路径

### 客户端紧急止血

如果后端上线后 insert 或 RLS 出现问题，先让交付端 transport 进入已有的
`unavailable` 状态：控件继续显示，提交明确说“没有送出”，不会退回剪贴板，不会
造成学习者以为已提交。修复后端后重新启用同一端口即可，不需要迁移客户端进度。

### 后端回滚

后端先停止 owner 工作台读取和反馈 insert 的发布开关，保留已写入数据；修复
policy 或权限时用前向 migration，不改写已经应用的 migration 历史。只有确认
没有生产数据、已经导出并获得负责人批准时，才执行反向删除：

```sql
drop policy if exists feedback_owner_read_all on university.feedback;
drop policy if exists feedback_learner_read_own on university.feedback;
drop policy if exists feedback_learner_insert on university.feedback;
drop table if exists university.feedback;
```

删除表会不可逆地删除学习者意见，不能作为普通故障处理；默认回滚是撤销客户端
能力、保留表和数据，再发布修正 migration。

## 完成定义

这条缺口只有在以下证据齐全后才能从“还没接好”改成“已接通”：后端 migration
审查记录、四类会话的真实 RLS smoke、匿名/登录两条提交路径、owner 的 studio
全量读取、失败不打勾且不复制的浏览器证据，以及一次确认答案/课文/邮箱没有进
反馈请求的自动化测试。未满足前，University 的诚实状态就是本文开头列出的状态。
