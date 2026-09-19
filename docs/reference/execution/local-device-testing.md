---
id: REF-LOCAL-DEVICE-TESTING
title: Local Preview, Devices and Web-to-Local Tooling
type: reference
status: active
canonical: true
owner: ai-assisted
created: 2026-09-07
last_reviewed: 2026-09-18
domain: execution
tags:
  - local-preview
  - physical-device
  - tooling
pinned: false
related:
  - REF-CURRENT-WORK
  - PLAN-CONTINUOUS-WORLD-DELIVERY
---

# 本机预览、真机与 Web 工具

只在接本机服务、手机或工具时读取。这里保存可恢复的本机信息，不是产品部署配置、
权限授权书或验收台账。动态地址和权限每次重查；产品通过项只记活动计划。

## Owner 主线走查入口（2026-09-16）

本轮走查使用 `/Users/yuanfei/PieAI/University` 的 `main`，不使用互动实验工作树。
Owner 已明确要求保留其他 AI 的互动实验；不合入、不删除、不停止那些工作树或服务。
以下地址由仓库现有 `pnpm start` 启动，不需要重新安装依赖或重新生成课程。

| 用途 | 本机地址 |
| --- | --- |
| 优先走查实际用户体验（delivery） | `http://127.0.0.1:9998/planet?lang=zh-CN` |
| 作者/本地学习端（authoring） | `http://127.0.0.1:9999/planet?lang=zh-CN` |
| 账号和找回密码 | 对应端口的 `/me?lang=zh-CN`；展开账号入口 |
| 中文认识 AI | 对应端口的 `/ai-literacy/understanding-ai?lang=zh-CN` |
| 中文日常实践 | 对应端口的 `/ai-literacy/ai-for-real-life?lang=zh-CN` |
| 英语对照 | 同一地址将 `lang=zh-CN` 改为 `lang=en` |

当前服务已启动时直接打开，不重复执行启动命令。重启机器或服务停止后，在终端运行：

```sh
cd /Users/yuanfei/PieAI/University
pnpm start
```

保留该终端；Ctrl-C 由启动器停止自己拥有的三个子进程组。API 是 4317，不是供
Owner 浏览的入口。两个端的 UI、账号和学习规则共享，区别是课程来源和判题通道；
9998 是本机运行的交付版，不等于公网站点，9999 也不等于永久离线。
HTTP LAN 只适合无账号的界面/学习走查；邮件恢复/账号用本机回环或 HTTPS 官网，
不把手机 HTTP 地址改写成手机自己的 127.0.0.1，不为预览降低认证回跳安全。

地图新导航见[完成记录](../../plans/completed/map-navigation-evolution.md)。正常画面没有常驻
“地图目录”和“总览”；先点地图空白取得焦点，再按 Space 打开快捷操作。手机从左上
导航进入“更多→快捷操作”。输入文字、操作按钮、打开其他弹窗时，Space 保留原用途。
点星球/岛/节点只选中，对象旁“进入”才换页；Esc/点空白取消，拖动和缩放不等于取消。

启动保持使用 `pnpm start`，不要直接用 `node scripts/start.mjs` 取代：父 pnpm 的依赖
检查先完成，避免构建后多个服务同时恢复依赖。已有服务不重复启动，端口占用先查归属。

建议走查顺序：首次进入/选课 → 两系列首课与后段课 → 来源/图片/互动/答题/返回 →
账号/注册/邮箱验证码/找回与修改密码/继续学习 → 个人页/设置/练习/复习/会员。
先正常桌面，再窄窗口或真实手机。会员展示可检查，但真实收费按 Owner 指令保持关闭。
账号删除入口只申请人工核查，成功编号不是已完成删除；不要用重要账号作删除实验。

截图只需附当前 URL、哪里不对、希望怎样；不必诊断代码。可连续编号批量发送，
同一问题跨尺寸仍归一条。后续执行者统一归入已有体验台账并记录 Owner 为发现者，
待 Owner 本轮走查完成后再集中修改，不在走查期间不断改变页面基线。
截图遮住邮箱、验证码、密码及邮件回跳中的认证参数；无需发送任何密钥或个人学习记录。
本次启动及只读实际浏览器证据在 `.scratch/account-closeout/owner-preview.log` 和
`owner-walkthrough/receipt.json`；检查状态只归当前活动计划，不把本页当发布收据。

## 历史源码归属（2026-09-12）

当前工作入口是整合后的 `University/main`，见 [current-work](current-work.md)。
下文 R40/R39/R38 的地址、设备连接与工作树状态均为历史记录，不是当前在线
承诺。2026-09-12 实查的 21999 监听者仍属于 `University-visual/apps/university`，
不能借它证明 main 已验收。每次验证重新核对监听者、源码/构建身份和实际页面；
不接管、停止或删除别人的预览与设备连接。

## R40 历史基线预览（2026-09-09）

预览已迁回主目录`/Users/yuanfei/PieAI/University`，不是旧3D或临时整合树：

| 模式 | 当前地址 | 进程工作目录 |
| --- | --- | --- |
| delivery 正式构建 | `http://127.0.0.1:20798/planet` | `University/apps/university` |
| authoring 正式构建 | `http://127.0.0.1:20799/planet` | 同上，代理API20797 |
| 手机LAN，同一delivery构建 | `http://192.168.1.135:20000/planet` | 同上，仅当前LAN地址 |
| 本机课程API | `http://127.0.0.1:20797/` | `University/apps/local`，原main校园 |

本次逐个核对并停止旧项目服务，退役19997／19998／19999／20001；没有重启ADB、
Safari调试服务或手机，也没有删除配对。HTTP与进程归属已核实，未验证重启自动恢复。
旧3D／course／play／launch工作树及后来完成收尾的integration不再是工作入口；保全位置
由活动计划链接。此前预建的`University-visual`与`University-courses`已按用户决定取消，
当前继续在main迭代；以后实际开工时再从最新main建对应工作树，不提前占位。
Easy Vibe仍由另一任务进行，本次未改其目录、分支或服务。

以下R39／R38连接和错误保留原时点，不据当前桌面构建或服务迁移认定F10真机通过。

## R39 整合环境边界（历史，2026-09-09）

当前临时整合树为相邻 `University-integration`；原 `University-3d` 的19998／19999／
LAN20000仍保留，不能把旧服务当作整合版。默认E2E自行管理18093／18094／18095及
18096，随测试退出；这些不是承诺常驻的预览地址。实际常驻服务使用前仍核对PID与cwd。

R39已另起本机正式构建预览：delivery `http://127.0.0.1:20798/`、authoring
`http://127.0.0.1:20799/`，后者代理到API20797。Vite进程cwd为整合树的
`apps/university`，API为其`apps/local`；仅回环监听，原手机LAN20000仍是保留的3D版本。
这些会话需保持运行，未验证重启自动恢复。

整合树的课程测试输入是经过校验的固定副本，来源身份见活动计划，不是新的课程编写
目录；不在测试API写课。NIST来源准入已随主线／课程代码合并，旧R38的400错误保留
如下，不作为新整合代码仍失败的判断。

新工作树还须有账号的公开客户端配置，否则账号页诚实显示“未配置”，不能把它当作
配置了账号服务的验收。此次现有 `local.public.env` 中还发现部署字段名（含
`VERCEL_OIDC_TOKEN`），没有输出或复制这些字段，也没有修改中央文件或读取服务端
secret store；只向临时树投影项目使用的URL、publishable key与grading URL。该文件
仅为本机忽略的环境输入，不入Git；不能根据“public”文件名直接整包复制配置。

R39尚未重新验收实体设备。以下连接、授权及真机证据保留各自时点；不会因合并或桌面
E2E通过而把F10关闭。

## R38 连接说明（历史连接与独立错误）

2026-09-09更新：Android继续使用原TLS/LAN20000；本机能够读页面、注入可信触摸并
取得实体横竖屏收据，复跑失败仍在活动计划保留。iPhone打开Remote Automation后已经
成功建立真实Safari会话（非模拟器）；后来会话失效，新的请求返回`could not connect to device`。
CoreDevice列出已配对的iPhone 12 Pro Max（iPhone13,4），但打开本项目Safari页面需要的
开发镜像挂载返回`kAMDMobileImageMounterNetworkUnauthorizedError`及HTTP Unauthorized。
已停止这一操作，不更换通道绕过；没有重配、重装或更改安全设置。原错误见
`.devspace-visual/astra-r38/iphone-open-project.json`，不把这项工具链错误称作手机未准备好。
未做重启恢复实验。临时LAN开发端口20004已由本轮关闭；原19998/19999/20000保留。

作者端当前独立问题：`/api/studies/general`的既有课程源返回400，原因是NIST网址尚不在
本支路的来源准入表中。HTTP入口200不表示作者端地图可用；交付端仍读取既有已导出内容。

用户已在Android Chrome inspect中看到University LAN页面，iPhone Web Inspector也已能读取
该项目DOM/CSS；这些证明网页可访问及Mac检查链已建立，不是产品验收。本机会话额外实查：
`adb devices -l` 返回 `adb-d9fc88ec-MqXSOi._adb-tls-connect._tcp device`、
`model:Redmi_K30_Pro`。19998/19999/20000的进程cwd均为本工作树`apps/university`，
20000实际运行的是delivery生产`vite preview`，不是旧示例中的dev server。
AI自动化能否完成全部触摸/方向/恢复动作仍须独立取得回执，验收状态只在活动计划记录。

本机会话随后对LAN页面完成Android CDP读取和截图：实际视口392×766、DPR2.75。
第一次 `/json/list` 返回空列表；仅用标准Chrome VIEW intent打开上述University URL后恢复，
没有重新配对、重启ADB或建立页面reverse。具体脚本为
`.devspace-visual/astra-r38/android-page-proof.mjs`，临时debug forward已移除。
原生Safari现有20002 driver的 `POST /session` 则明确返回：
`session not created` / `Remote Automation is turned off (turn it on via Settings > Safari > Advanced > Remote Automation)`。
这不是Web Inspector断线。用户只需开启iPhone的该开关，之后重试同一接口；不要求重做连接。
历史HTTP500/locked/disconnected记录保留，不把本次更具体的错误写成设备未准备好。

当前优先沿用 `http://192.168.1.135:20000/` 和已配对的无线ADB TLS；不默认切USB，
不另配页面转发，不删除配对或重启全局ADB/Safari服务。仅为CDP连接创建的本机临时
debug-socket forward须限定目标设备、绑定回环、保留原映射并在结束后移除自己的映射。
iPhone继续沿用现有Safari网络检查链；自动化接口错误不表示手机未准备好。

## 连接依据（历史事实，使用前重查）

| 项目 | 已知事实及证据边界 |
| --- | --- |
| 项目 | `/Users/yuanfei/PieAI/University-3d`；Vite 服务 cwd 为该目录下 `apps/university`。 |
| 手机 LAN 预览 | 2026-09-07 曾用 `http://192.168.1.135:20000/`，随后服务退出；这是恢复线索，不是当前在线地址，须重查本机IP和监听。 |
| 桌面入口 | 本机 delivery 19998、authoring 19999 为既有入口；使用前各自验证归属，不能只凭端口记忆。 |
| iPhone | 用户截图显示 Mac Safari 的 Web Inspector 已连接显示名 `PiEiPhone12PM` 的 Safari 页面，并能读到 DOM/CSS；用户报告已开启 Connect via Network。未独立验证拔线后的重连。 |
| iPhone 未知 | 实际型号、iOS/Safari 版本、DPR、性能、触控和后台恢复尚未在本轮采集；显示名不等于型号证明，截图里的 body 尺寸不等于屏幕分辨率。 |
| Android | 2026-09-07 实查 Redmi K30 Pro、Android 12、MIUI `V140`、Chrome `151.0.7922.71`，已配对ADB TLS。R32后续触摸/前后台收据见活动计划；本页不另记验收状态。 |

网页可达、Mac能检查手机、AI能控制检查器、产品验收是四个不同状态。
Android收据不能替代iPhone；旧版本号、显示名、截图像素也不能当当前设备规格。

## 重启手机预览

先确认当前 Mac 仍拥有 `192.168.1.135`，检查端口与进程工作目录：

```bash
cd /Users/yuanfei/PieAI/University
lsof -nP -iTCP:20000 -sTCP:LISTEN
# 把上一步的 PID 代入；不要杀掉未知/其他工作区进程。
lsof -a -p <PID> -d cwd
```

已有正确服务且正常响应就复用，不重启、不再起一个副本。仅在服务停止、端口空闲、
依赖/core/内容链接满足项目 baseline 后，执行用户已验证的命令：

```bash
pnpm --filter @pieai/university-app exec vite preview --mode delivery --host 192.168.1.135 --port 20000 --strictPort
```

保持这个终端会话运行；它结束后预览可能随之停止。启动后确认输出仍是指定 IP/端口，
再让手机打开完整地址。网络更换或 DHCP 改变地址时，重新查 Mac 的实际局域网 IP，
替换命令及手机地址并更新本页日期；不要照旧 IP 重试，更不要放宽到公网监听或关闭防火墙。
worktree 缺输入时先运行项目 baseline 的 `pnpm worktree:prepare .`，不要在缺少课程源时
裸跑 `pnpm content` 来掩盖 404。HTTP 200 只证明服务响应，不证明 3D、课程及登录都已就绪。

## 两条独立连接与验收

页面传输：Mac Vite → 局域网/USB 转发 → 手机浏览器。检查链：Mac Safari Web Inspector
→ 已授权 iPhone Safari。Connect via Network 作用于检查链，不会自动启动 Vite，也不会
把 localhost 改成 Mac 地址。网络重连失败可先回到已信任的 USB 连接排查，不删除授权重来。

Android 当前沿用已配对的 ADB TLS + LAN 20000，不另配 Chrome 的 Port forwarding，
不切回固定 5555、不并装第二套转发。下方`adb reverse`是历史可选路线，不是当前前置要求。
所有调试连接只对可信设备/网络开放。

正式真机证据记录设备/系统/浏览器版本、完整 URL、构建/源码身份、可见 viewport/DPR、
主题、真实触摸动作及前后台状态；分别验证页面进入/返回、拖缩、文字/键盘和暂停恢复。
截图与时间采样分开。HTTP LAN 不能替代 HTTPS/安全上下文/原生壳验收，不为通过测试关闭浏览器安全。

官方操作参考：[Apple 检查 iOS](https://developer.apple.com/documentation/safari-developer-tools/inspecting-ios)、
[Android ADB / 无线调试](https://developer.android.com/tools/adb)、
[Chrome USB 转发](https://developer.chrome.com/docs/devtools/remote-debugging/local-server/)。

## Android：配对无线 ADB 的恢复路径

2026-09-07 本机 ADB 为 `36.0.0-13206524`。实际在线设备标识为
`adb-d9fc88ec-MqXSOi._adb-tls-connect._tcp`，mDNS 广播 `_adb-tls-connect._tcp`，
当时连接端点为 `192.168.1.133:43343`。截图中的 `192.168.1.133:5555` 是较早路线，
不是当前固定配置；IP、连接端口、设备标识每次以实际输出为准。

配对是信任关系，连接是当前会话，反向转发是当前端口映射：三者不等同。
没有做重启实验，不保证 MIUI 重启后仍保持无线开关、同一端口或转发。
断线先恢复连接及映射，不先删配对、读密钥、重做 USB 授权或重启全局 ADB server。

```bash
adb devices -l
adb mdns services
# 若目标未在线，再用手机「无线调试」页或 mDNS 的当前连接端口：
adb connect <PHONE_IP:CONNECT_PORT>
# CONNECT_PORT 不是「使用配对码配对」弹窗里的 PAIRING_PORT。

# 从 devices 的在线 TLS 行复制精确标识；多设备时禁止省略 -s。
adb -s '<DEVICE_FROM_LIST>' reverse --list
# 仅当 tcp:19998 映射缺失且 Mac 上正确项目服务正常时创建；已有不同映射先停下核对。
adb -s '<DEVICE_FROM_LIST>' reverse --no-rebind tcp:19998 tcp:19998
adb -s '<DEVICE_FROM_LIST>' reverse --list
```

手机 Chrome 打开 `http://localhost:19998/`；这里由 ADB reverse 转到 Mac 回环的
19998，无需启动 LAN 20000。iPhone 的 LAN/Safari 检查通道仍独立，不互相替换。
无线开关关闭、网络隔离或 mDNS 不可达时先检查设备/网络；不要开放公网调试、关闭防火墙
或把配对码放入脚本。只有配对确实已撤销才需要用户重新配对。

本机只读入口 `.scratch/tooling/android-page-proof.mjs`；已有触摸/恢复测试入口
`.devspace-visual/astra-r31/android-acceptance.mjs`。先读实际脚本，严格选择本项目唯一页面，
保留原路由、方向和reverse，移除自己的临时forward；没有匹配页就停止，不读无关标签页或通知。
历史测量只由活动计划链接，脚本存在或连接成功都不是最后代码验收。

## DevSpace与可选工具

新线程没有workspaceId时打开一次，已有则复用。显式读取当前AGENTS、baseline和面板，
不依赖旧会话注入。`exec_command` 使用 `cmd`，长命令用返回的sessionId收取退出结果；
参数/传输错误与安全拒绝分开报告。不要重装私有桥接或扩大allowed roots来维持会话。

Web专用技能按当下实际广告索引读取。用户入口为 `~/.devspace/skills/` 的
`web-ai-to-local-best-practice` / `web-ai-to-local-feedback-loop`，不复制回项目，
不恢复已退役的项目反馈技能。目录名字或manifest不证明当前宿主已加载。
来源校验若仅接受localhost，LAN用独立PID/cwd/HTTP证据，不改守卫使它虚假通过。

| 需要 | 沿用的入口与边界 |
| --- | --- |
| 普通网页/回归 | 项目Playwright及已有Chrome/WebKit配置；版本查当前依赖。WebKit不是实体Safari/iPhone，agent-browser也不自动接入它们 |
| Blender | 既有本机 `.devspace-reports/blender-mcp.md` 保存源码pin、隔离环境和用法；不重装、不把其渲染代替WebGL验收 |
| 桌面授权缺口 | `.devspace-reports/peekaboo-readiness.md` 保留未完成的安装/权限核验；使用前重查，不继承别的App权限或禁用系统防护 |
| CLI子代理/声音 | 有需要再核对 `agy --help` / `agy models`；限定文件所有权并独立验收，声音安排Gemini听感。旧模型ID/超时报告不构成当前可用性证明 |

工具安装不作为3D研发前置条件。没有明确缺口，不并装重复MCP/自动化栈；
不读取凭据、剪贴板或个人通知，也不为取得验收结果降低浏览器或系统安全。
