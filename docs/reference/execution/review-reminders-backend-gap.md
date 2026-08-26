---
id: REF-REVIEW-REMINDERS-BACKEND-GAP
title: Review Reminders Backend Gap
type: reference
status: active
canonical: true
owner: human
created: 2026-08-27
last_reviewed: 2026-08-27
domain: execution
tags:
  - review
  - reminders
  - web-push
  - backend
  - cross-repository
related:
  - REF-CURRENT-WORK
  - ADR-0001
---

# 复习提醒：客户端已接好，真正发出去还缺后端

这是一份跨仓库缺口说明。它记录 University 这边已经交付的浏览器契约，
以及真正保存订阅、计算到期卡、发送 Web Push、清理失效 endpoint 还必须在
SwimmerBackend 完成的工作。

这里的“建议”是给后端和产品负责人的判断材料，不是替 SwimmerBackend 拍板。
**University 没有、也不应该在本仓库建推送服务端。**

## 先给结论

复习提醒不是第四个 mode 边界。

作者端和投放端的学习者界面、结算时机、设置状态和学习数据必须一样。它们都
使用同一个 `ReviewReminderPort` 和同一份 `ProgressDocument`；浏览器只回答
“这台设备能不能订阅、用户有没有点头”，不回答“服务端什么时候给谁发什么”。

所以没有第二套 authoring/delivery 提醒实现，也没有在 University 里添加
VAPID 私钥、定时函数、发送 API 或推送数据库副本。

现在的真实状态是：**浏览器可以在用户明确同意后创建并保存 Push 订阅，设置页
明确显示“已订阅，但服务端还没接上，暂时不会真的收到提醒”；服务端接通前，
没有任何 University 代码会声称提醒已经送达。**

## University 这边已经做了什么

### 先兑现复习价值，再问一次

结算页从真实进度文档计算下一自然日的到期卡数量，只有一节课刚刚完成、并且
确实有明日卡时才显示应用内预提示。首页、注册后、刷新页面和普通设置加载都
不会自动请求浏览器权限。

预提示先说清楚：

> 明天有 N 张复习卡回来。要我提醒你吗？每天最多一条，有卡才提醒，随时可以在设置里关掉。

它只有“好”和“以后再说”。只有点击“好”才进入浏览器的
`Notification.requestPermission()`；“以后再说”只收起这一次，不改变浏览器
权限，也不把学习者永久标成拒绝。直接打开旧结算页没有这张预提示，因为那不是
一次新的价值兑现。

### 权限和平台状态是显式状态机

共享设置页保留同一个开关，并按当前能力显示：

| 状态 | 学习者看到的行为 |
| --- | --- |
| 未开启 | “打开复习提醒”；点击开关才进入同意流程 |
| 浏览器已拒绝 | 显示拒绝状态和浏览器设置说明；结算页不再自动纠缠 |
| 已开启、已订阅 | 显示可关闭的开关，并写明服务端尚未接通 |
| iPhone 普通 Safari 页面 | 显示“先添加到主屏幕并以 web app 打开”，不渲染一个按了没反应的开关 |
| 当前浏览器不支持 | 说明能力缺失，应用内复习仍可继续 |

`refresh()` 只读现有权限、已有 Service Worker 和已有订阅，不请求权限、不注册
新的 worker。拒绝后 `enable()` 也不会再次调用 `requestPermission()`。

### Service Worker 不碰首屏和原有离线行为

`apps/university/public/service-worker.js` 只处理 `push` 和
`notificationclick`：收到可见推送时展示通知，点击时回到同源路径。它没有
`fetch` 监听器、缓存安装逻辑或首屏注册逻辑；只有学习者明确点“好”后才注册。

这意味着它不会接管原有内容请求，也不会在第一次打开 App 时多出一个 worker
安装和缓存工作。当前 worker 只是客户端接收器，不是发送服务。

### 订阅进入同一份学习者进度文档

`ProgressDocument.pushSubscriptions` 按 endpoint 保存设备记录，而不是一个会被
第二台设备覆盖的单值。每条记录包含：

- endpoint；
- Push 加密所需的 `p256dh` 和 `auth` 公钥材料；
- 过期时间；
- `active` / `revoked` 状态；
- 更新时间；
- 可公开的 VAPID key 标识（私钥永远不进浏览器）。

`mergeProgress` 对 endpoint 做并集。同一 endpoint 取更新时间较新的记录；同一
时间戳下撤销墓碑优先于 active。关闭设备会保留墓碑，避免另一台设备把旧快照
上传回来时把它复活。没有 `pushSubscriptions` 字段的旧文档会被解析为空映射，
不丢课程、卡片、答案、标记、设置或 XP。

这仍然是已有的一个 learner document、一个云端 row、一个 outbox；没有为了
通知再造第二个进度存储模型。

## SwimmerBackend 还缺什么

下面这些能力不应在 University 里用浏览器表、Vercel 函数副本或前端定时器补出
来。它们是发送端的安全边界。

### 1. 认证的订阅登记和撤销接口

后端需要一个绑定已登录账号的接口，接收浏览器在用户同意后产生的订阅记录，
并校验：

1. 当前 Supabase access token 和账号身份；
2. endpoint 的合法格式和允许的 push service；
3. `p256dh`、`auth` 和公开 VAPID key 的格式；
4. active / revoked 的状态迁移和更新时间。

同一个账号可以有手机、电脑等多个 endpoint。后端不能把它们压成一个字段，
也不能以浏览器传来的 `active` 作为不可审计的最终事实。关闭、删除账号和订阅
失效都要能撤销；RLS 必须保证一个账号看不到另一个账号的 endpoint 和密钥材料。

当前 University 的整个进度文档会通过既有 `ProgressRemoteStore` 合并保存。后端
要保证保存/读取不会丢掉未知但合法的 `pushSubscriptions` 字段；迁移期间应
先用旧文档回放和双设备冲突测试验证，而不是另开一张通知专用用户表。

### 2. 以学习者时区为准的到期选择器

服务端需要从同一份云端学习数据确定“明天有卡”的账号，而不是相信浏览器的
一条字符串或本地计数。至少要定义：

- 学习者时区从哪里来、如何更新和无时区时的默认值；
- `dueAt` 的自然日边界如何计算；
- 只对 `active` endpoint 发送；
- 没有到期卡时不发；
- 同一账号同一自然日最多一条；
- 调度重试、重复执行和跨时区夏令时的幂等规则。

调度器还要有一个稳定的发送事件 id（例如账号、自然日和提醒类型的组合），
使重跑任务不会在同一天给同一台设备重复发通知。这个规则应由服务端最终
保证，不能由页面是否打开来保证。

### 3. VAPID、Web Push 加密和发送器

后端需要在受控的秘密配置中生成并保存 VAPID key pair 的私钥，构造并加密
Web Push payload，再把请求发给订阅 endpoint。私钥不得进入 Vite 环境变量、
`ProgressDocument`、localStorage、日志或浏览器响应。

发送器至少要覆盖：

1. VAPID 身份和请求签名；
2. Web Push payload 加密；
3. RFC 8030 规定的 Web Push 请求流程；
4. TLS、网络出口和 Safari 使用的 `*.push.apple.com`；
5. Safari 不接受 silent push 的约束：服务端发出的事件必须让 worker 立即
   展示一条用户可见通知。

这条链路接通前，University 的 `serverConnected` 永远是 `false`，设置页的
“暂时不会真的收到提醒”不能改成“已送达”。

### 4. 失败、重试、清理和审计

后端需要可重试但不重复的发送记录，至少记录账号、endpoint、提醒日期、事件
id、发送时间、响应状态和清理原因。要定义：

- 认证、网络和服务端暂时故障的退避重试；
- endpoint 返回 404/410 或等价失效时自动写 revoked；
- 无效密钥、过期订阅和用户关闭后的清理；
- 发送成功与“设备实际显示”的边界；
- 管理员排查所需的审计信息，以及 endpoint/密钥的保留期限。

日志不得写入学习者答案、私有仓库源码或不必要的课程正文。通知最多应携带
复习数量和返回路径等最小信息；是否允许在锁屏上显示数量，需要产品和隐私
负责人另行确认。

### 5. 账号、隐私和删除语义

后端要把订阅当作账号数据处理，补齐隐私政策、数据保留和删除路径：

- 学习者关闭提醒后，后端不能继续向该 endpoint 发送；
- 退出账号与删除账号的语义要区分，并明确另一台设备是否仍保持订阅；
- 删除账号要撤销并清理所有 endpoint 和密钥材料；
- 账号导出要说明是否包含订阅 endpoint；
- 订阅接口不能借机上传学习者的复述、阅读标记或私有源码。

## iPhone / Safari 事实（截至 2026-08-27）

限制仍然存在，界面因此必须诚实降级：

1. Apple 当前开发者文档仍写明：iOS/iPadOS 16.4 及以后支持的是 **Home
   Screen web apps**；同一页对 macOS Safari 才写的是网页（webpages）。
2. WebKit 的原始说明要求 Home Screen web app 的权限请求来自直接用户互动，
   例如点击订阅按钮；不能在页面加载时请求。
3. Safari 26 的变化是：网站添加到主屏幕时默认可以作为 web app 打开，但用户
   仍可选择关闭“以 Web App 打开”而保存成普通书签。这没有把普通 Safari 页面
   变成可推送页面，所以 University 仍检测 standalone 能力并提示重新以 web app
   打开。
4. Apple 当前文档还要求发送端准备 VAPID、保存 endpoint 与加密 key，并指出
   Safari 不支持 invisible push；收到后要立即展示可见通知。

一手资料：

- [Apple Developer · Sending web push notifications in web apps and browsers](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)
- [WebKit · Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [WebKit · WebKit Features in Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)

## 什么时候才能把“服务端没接上”改掉

至少需要下面这条交接链，并在真实 test 环境完成双设备验收：

```text
确定通知内容、时区、频率、保留和删除规则
        ↓
SwimmerBackend 建立认证的订阅登记/撤销接口
        ↓
订阅记录、RLS、撤销墓碑、失效清理和审计
        ↓
VAPID 私钥与 Web Push 加密/发送器（含 APNs 出口）
        ↓
按学习者时区选择明日到期卡，事件幂等，最多每日一条
        ↓
发送失败重试与 404/410 清理
        ↓
University 读取后端健康/发送契约，补齐可验证的 serverConnected 状态
        ↓
两个设备、拒绝/撤销、离线 outbox、iPhone Home Screen web app 的真实验收
```

在这些接口、密钥和调度能力完成前，University 的安全状态就是当前状态：学习
者可以在价值兑现后选择登记设备，进度文档会安全保存并合并订阅；浏览器和
Service Worker 不会自行发送提醒，设置页明确告诉学习者暂时收不到真正的推送。
