# Evidence 2 — 让「可验证的证据」在线上真的成立

日期：2026-08-31
工作树：/Users/yuanfei/PieAI/University-wt-evidence2
分支：work/evidence2
实现提交：942987f、70e3cfc
部署状态：没有部署，没有 push；Vercel 的 deploymentEnabled 仍为 false。

## 结论先行

结论是：**发布产物层面条件性成立，线上当前尚未成立。**

本次把 delivery 构建从 locator-only 改成了 source-equipped 的 baked 产物：当前 recovery 输入里的 3,149 条 repository evidence anchor 全部生成了可读取的固定源码片段，源码文件按内容寻址写入静态包；读者第一屏不请求源码，只有真人点击“看完整文件”后才请求对应片段，随后能看到真实代码和行号高亮。新增的发布闸门会在任何一条 repository anchor 没有片段时失败。

但是本任务明确禁止部署，所以不能把这个本地 sealed artifact 称作“线上已经修好”。下一次发布必须使用有源码镜像的机器完成 baked 构建，再把已校验的 prebuilt artifact 上传。没有源码镜像时，delivery build 现在会 fail closed，而不是悄悄产出 100% 报错的 locator-only 课程。

耦合的冷启动标题“对着真实项目学 / 每座岛是一门课。点岛进入，读完再练。”的判断也是条件性的：**在这份 baked sealed artifact 中可以成立；在没有把该 artifact 部署到线上之前，线上承诺仍不能宣称成立。**

## 1. 任务一：测量与交叉验证

### 1.1 测量口径

我没有读取课文里的 evidence token 就直接猜数字，而是同时核对了 recovery 输入、importer 统计、生成的内容目录、release.json 和浏览器网络请求。

测量口径如下：

- 递归统计 lesson、card、exercise 上的 evidence 数组。
- sourcePath + sourceCommit 视为 repository anchor；只有 sourceUrl 的记录视为 URL/general evidence。
- 当前 recovery 输入：4 个 study、44 门课、495 节课、3,306 条 evidence record。
- 其中 3,149 条是 repository anchor，157 条是 URL/general evidence。
- 课文原文中的 evidence token 字面出现次数是 1,598；台账开工快照保留的事故文案是 3,618。它们不是同一层的计数，不能把二者强行相加。本次 release gate 以实际 recovery records 的 3,149 条 repository anchor 为准，并在报告中保留这个差异，未改课文。
- 内容生成和截图证据都在本地或忽略目录中完成；没有写入 apps/local/studies/**，没有改课文。

### 1.2 none 与 baked 的体积对比

| 指标 | 原来的 none 构建 | 当前 baked sealed artifact | 差值 / 说明 |
|---|---:|---:|---|
| delivery 静态文件 | 271 | 2,418 | 增加 2,147；主要是源码片段文件 |
| 静态 payload 字节 | 23,349,033 | 25,978,922 | +2,629,889；当前数含新 release 构建产物 |
| 课程 JSON 字节 | 3,453,588 | 3,873,196 | +419,608 |
| 独立源码片段文件 | 0 | 2,146 | 3,149 anchor 内容寻址去重 |
| 去重后的源码片段字节 | 0 | 1,990,575 | 约 1.90 MiB |
| 课程 JSON + 源码片段 | 3,453,588 | 5,863,771 | 证据相关的可归因增加 +2,410,183 |
| sealed artifact 总文件 | — | 2,420 | 另含 release.json、SHA256SUMS |
| sealed artifact 总字节 | — | 27,006,918 | 含上述两个 metadata 文件 |

当前 sealed artifact 的 release.json 还记录了：

- 4 studies、44 courses、495 lessons；
- evidence mode 为 baked；
- anchors 3,149、snippets 3,149；
- 2,146 个去重片段文件、1,990,575 字节；
- payload 2,418 个静态文件、25,978,922 字节；
- 课程 JSON 3,873,196 字节；
- JS 161 个、9,993,135 字节；CSS 1 个、342,305 字节；
- 最大 JS chunk 1,679,044 字节。

发布 artifact 的验证原文是：

> delivery check: 0.0.0+evidence2-final ok; 4 studies, 44 courses, 495 lessons, 25978922 payload bytes.

### 1.3 分 study / 分课程统计

下表的 course JSON bytes 来自最终 artifact；repo anchors 是当前 recovery 输入中该课程的 sourcePath 记录；snippet files 是内容寻址后的实际文件数；snippet bytes 是去重后的静态源码字节数。

| study | course | lessons | course JSON bytes | repo anchors | snippet files | snippet bytes |
|---|---|---:|---:|---:|---:|---:|
| buzz | buzz-agents-as-members | 12 | 64,358 | 80 | 49 | 82,986 |
| buzz | buzz-design-tokens | 12 | 60,439 | 69 | 32 | 39,088 |
| buzz | buzz-one-message | 12 | 67,887 | 88 | 59 | 100,504 |
| buzz | buzz-orientation | 12 | 57,699 | 74 | 38 | 51,585 |
| buzz | buzz-reading-rust | 12 | 62,538 | 78 | 41 | 41,868 |
| **buzz 合计** | **5 门课** | **60** | **312,921** | **389** | **—** | **—** |
| general | product-website | 19 | 129,670 | 0 | 0 | 0 |
| **general 合计** | **1 门课** | **19** | **129,670** | **0** | **—** | **—** |
| supaluv | ai-branching-narrative | 12 | 93,778 | 85 | 58 | 56,603 |
| supaluv | ai-cost-and-boundaries | 4 | 30,513 | 25 | 17 | 18,534 |
| supaluv | automated-playtesting | 11 | 76,544 | 66 | 57 | 56,190 |
| supaluv | content-as-package | 11 | 83,488 | 66 | 58 | 61,183 |
| supaluv | founder-engineer | 1 | 14,315 | 19 | 6 | 10,042 |
| supaluv | generated-assets | 3 | 29,457 | 25 | 14 | 14,496 |
| supaluv | media-tooling | 12 | 81,749 | 69 | 51 | 55,215 |
| **supaluv 合计** | **7 门课** | **54** | **409,844** | **355** | **—** | **—** |
| turing-pact | agent-identity-continuity | 11 | 69,541 | 63 | 54 | 55,580 |
| turing-pact | ai-budget-and-cost | 12 | 82,203 | 81 | 64 | 49,380 |
| turing-pact | ai-contracts-first | 12 | 81,155 | 80 | 61 | 58,527 |
| turing-pact | ai-evaluation | 11 | 68,083 | 69 | 59 | 60,308 |
| turing-pact | asset-pipeline | 12 | 93,294 | 74 | 67 | 62,191 |
| turing-pact | bilingual-by-design | 12 | 104,819 | 83 | 59 | 49,241 |
| turing-pact | contracts-and-drift | 3 | 25,203 | 17 | 12 | 11,480 |
| turing-pact | directing-ai-agents | 10 | 71,733 | 71 | 34 | 35,962 |
| turing-pact | e2e-and-qa-scripts | 12 | 92,484 | 71 | 68 | 81,008 |
| turing-pact | experiments-and-rollout | 12 | 89,625 | 79 | 61 | 52,622 |
| turing-pact | failure-recovery | 12 | 87,646 | 79 | 56 | 39,690 |
| turing-pact | foundations-async | 12 | 107,766 | 83 | 54 | 32,621 |
| turing-pact | foundations-before-zero | 41 | 373,401 | 231 | 135 | 87,641 |
| turing-pact | foundations-data | 13 | 129,991 | 92 | 63 | 44,385 |
| turing-pact | foundations-logic | 13 | 128,079 | 81 | 48 | 31,306 |
| turing-pact | foundations-product | 12 | 113,054 | 90 | 63 | 48,394 |
| turing-pact | foundations-quality | 13 | 110,009 | 90 | 63 | 48,889 |
| turing-pact | foundations-reading-code | 11 | 114,108 | 81 | 25 | 12,832 |
| turing-pact | foundations-terrain | 12 | 100,862 | 93 | 60 | 39,884 |
| turing-pact | foundations-ui | 12 | 123,298 | 85 | 50 | 29,360 |
| turing-pact | identity-and-accounts | 12 | 101,910 | 83 | 65 | 55,889 |
| turing-pact | moment-design | 12 | 95,419 | 76 | 65 | 65,385 |
| turing-pact | one-codebase-many-hosts | 4 | 50,387 | 40 | 29 | 25,216 |
| turing-pact | platform-capabilities | 12 | 86,927 | 69 | 27 | 22,405 |
| turing-pact | realtime-presence | 11 | 85,516 | 73 | 63 | 62,303 |
| turing-pact | retention-engineering | 11 | 94,479 | 69 | 51 | 46,833 |
| turing-pact | solo-operations | 12 | 94,934 | 101 | 62 | 49,219 |
| turing-pact | state-and-process | 4 | 39,066 | 27 | 15 | 10,950 |
| turing-pact | structured-output-repair | 11 | 73,213 | 62 | 37 | 31,733 |
| turing-pact | testing-strategy | 3 | 34,226 | 29 | 17 | 22,616 |
| turing-pact | world-navigation | 12 | 98,330 | 83 | 79 | 78,431 |
| **turing-pact 合计** | **31 门课** | **362** | **3,020,761** | **2,405** | **—** | **—** |
| **总计** | **44 门课** | **495** | **3,873,196** | **3,149** | **2,146** | **1,990,575** |

general 的 157 条 URL/general evidence 没有源码仓库可烘焙，因此不会伪装成源码；它们继续走 URL evidence 的既有语义。

### 1.4 Vercel 限制与首屏影响

交叉核对 Vercel 官方限制（检索于 2026-08-31）：

- 静态文件上传上限：Hobby 100 MB，Pro 1 GB；
- 最大 source files：15,000；
- 构建时长上限：45 分钟；
- 构建磁盘：23 GB；
- 静态输出由 CDN 提供；带 hash 的静态资源适合长期缓存；
- Vercel CLI 支持先生成 prebuilt artifact，再用 vercel deploy --prebuilt 发布。

当前 sealed artifact 27,006,918 字节（含 metadata），约为 Hobby 100 MB 文件上传上限的 27.0%；静态 payload 2,418 个文件，远低于 15,000 个 source-file 限制。它不是 Vercel 限制下的体积问题，真正需要管的是发布输入是否完整和首屏是否读取了不必要的源码。

首屏的浏览器实测不是“所有请求都为零”，而是更精确的证据边界：

- 同一节课首屏只收到课程 JSON、应用代码和其它正常资源；
- 精确监听 /content/.../evidence/[64 hex].json，真人点击前请求数为 0；
- 点击“看完整文件”后才出现源码片段请求；
- 请求返回后弹窗显示真实 package.json 代码、行号和高亮，locator-only 数量为 0。

所以这次不把 1.90 MiB 源码片段塞进首包；它们作为静态、内容寻址的独立文件，需要时才读。这个决定和 MDN 关于延迟加载非关键资源、把交互触发的资源移出 critical rendering path 的建议一致，也与 web.dev 的 critical path / LCP 原则交叉吻合。它没有声称本次已经测出 LCP 改善；本次实测的是源码请求闸门和发布体积。

## 2. 任务二：方案、取舍与实现

### 2.1 选中的方案

选中的是“构建时从 Git mirror 烘焙，运行时按点击加载”：

1. importer 读取课程引用的 sourceCommit、sourcePath 和行范围；
2. 从对应的 source/repository.git 读出真实文件，裁剪为行号可读的源码窗口；
3. 每个片段以 JSON 文件写到 content/study/course/evidence 下，文件名由内容 hash 决定；
4. 引用本身仍先显示路径、提交短 hash、行范围和“看完整文件”按钮；
5. 短引用默认不加载；共享 reference panel 在用户打开后加载；
6. Vercel buildCommand 固定使用 --evidence baked；
7. source-equipped release 要求 baked snippets 与 repository anchors 完全相等，否则 importer 和 release artifact validator 都失败；
8. Vercel 仍只接收人工确认过的 prebuilt artifact，本次没有 deploy。

改动集中在：

- apps/university/scripts/import-courses.mjs、bake-evidence.mjs 配合 delivery artifact；
- apps/university/scripts/delivery-artifact.mjs 及其测试；
- packages/ui 的 EvidenceInlineSource、MarkdownContent 和中文文案；
- e2e/L.reader-interaction.spec.ts、e2e/start-servers.mjs；
- vercel.json 及 Vercel 配置测试；
- e2e/experience-ledger.json；
- scripts/raw-colour-registry.mjs 的现有固定材质行号同步。

importer 支持 UNIVERSITY_CONTENT_ROOT 和 UNIVERSITY_IMPORTED_MANIFEST_PATH，E2E 用它们把 baked 内容写入 .scratch/evidence2 隔离目录；如果生成内容目录是软链，会先解析真实目标再清空目标，避免删掉软链本身。apps/local/studies/** 只读，没有被作为 release input，也没有被写入。

### 2.2 没选的方案

- **继续 none**：直接保留了台账中的产品级谎言，用户点击后仍只看到“没有烘焙源码”。拒绝。
- **把所有源码内嵌进每个课程 JSON**：会把证据字节和课文解析绑定到首屏；还会重复存储相同文件窗口。拒绝，改用去重片段。
- **运行时找源代码 API**：delivery 是静态包，浏览器没有 authoring checkout；另起源码 API 会引入新的 source-access boundary、可用性、权限和部署依赖，不符合这次已有 ADR-0003 / ADR-0007 的静态交付裁定。
- **把 raw recovery package 或 private source checkout 放进浏览器包**：recovery transport 含 base64 资源，且源码仓库不是 learner payload。拒绝。
- **只换成一段解释文字**：这不是证据，违反任务的唯一判断标准。拒绝。

## 3. 截图证据与体验复核

截图在同一 delivery route、同一 1280×640 viewport、同一主题和同一浏览器环境采集；前后由真实指针路径点击，测试调用的是 humanClick，没有用 element.click() 冒充真人操作。

- [修复前：source-before-desktop.png](/Users/yuanfei/PieAI/University-wt-evidence2/.scratch/evidence2/source-before-desktop.png)
- [修复后：source-after-desktop.png](/Users/yuanfei/PieAI/University-wt-evidence2/.scratch/evidence2/source-after-desktop.png)

修复前的弹窗是“源码证据 · package.json”，能看到固定提交和 L7–9，但显示的是“源码没有随这份课程发布”，没有 code block。修复后的同一位置显示 package.json 真实的 2–9 行，包含 scripts 字段、行号和高亮，并保留搜索与复制控件。

像素差分的尺寸一致：before/after 都是 1280×640，delta ratio 为 0.18004。ScreenWalk 的 after critic 结论是：核心承诺已经补上；弹窗因真实代码变高，但代码、行号、搜索和复制控件仍可读，没有新的遮挡或 blocking overlap。复核后没有再改 UI。

## 4. 攻击测试：每项功能改动先红后绿

以下不是只看“断言数量”的记录；每一项都先制造缺陷、保存了实际失败原文，再恢复实现并重新得到绿灯。

| 改动 / 故意缺陷 | 红灯原文 | 恢复后的绿灯 |
|---|---|---|
| EvidenceInlineSource 默认延迟加载后，先不更新旧的 Markdown 测试预期 | expected null not to be null，指向 .evidence-code；该文件先出现 7 failed | 更新测试为短引用不 fetch、长 reference panel 点击后加载；UI 全量 62 files / 369 tests passed |
| E2E 请求监听器故意把所有 /... 请求当源码请求 | Expected: 0、Received: 14，e2e/L.reader-interaction.spec.ts:76 | 收窄为 /content/.../evidence/[a-f0-9]{64}.json，focused evidence e2e passed |
| 在 baked 夹具下暂时保留旧的 eager reader | Expected: 0、Received: 2，e2e/L.reader-interaction.spec.ts:78 | short citation 默认 deferred，点击后才请求；focused evidence e2e passed |
| importer 攻击：设置 UNIVERSITY_EVIDENCE_MODE=none，同时要求 UNIVERSITY_REQUIRE_BAKED_EVIDENCE=1 | Error: import-courses: baked evidence requirement needs UNIVERSITY_EVIDENCE_MODE=auto, got none | 恢复 auto + require 后：baked 3149/3149 repository evidence snippets into 2146 files (1.90 MB; 157 skipped) |
| delivery artifact validator：把 apps/university/scripts/delivery-artifact.mjs:611 的 !== 暂改成 ===，让 partial baked fixture 被错误放行 | AssertionError: expected [Function] to throw an error；Expected: null、Received: undefined，delivery-artifact.test.mjs:244:50 | 恢复 !==；partial fixture focused test passed，真实 artifact check passed |
| Vercel 配置：把 vercel.json:3 的 --evidence baked 暂改成 --evidence none | AssertionError: expected 'pnpm delivery:build ... --evidence none' to contain '--evidence baked'，vercel-config.test.mjs:7:33 | 恢复 baked；配置测试 passed |
| 台账：暂时删除 ad58cf50b131 的 guardedBy | experience ledger: the ledger does not hold ... marked fixed but names no test that keeps it fixed | 恢复 e2e/L.reader-interaction.spec.ts::真实打开一条引用后看到固定源码，且源码只在点击后加载；ledger check 为 24 findings — 12 fixed, 12 open |
| raw colour registry：把新增 deferred CSS 的 #0d1117 固定行从 93 暂改回 92 | fixed material registry entry does not exist ... evidence-inline-source.css:92:15；同时报告 raw colour ... line 93 和 pending migration count 0 is less than actual debt 1 | 恢复 registry line 93；check-raw-colours 为 fixed material 29、pending migrations 0、raw colours 29、files 9 |

另外，曾故意在没有公开浏览器配置时运行 delivery build，发布闸门按预期失败：

> delivery public config: the bundle is missing configuration the learner can feel.

它继续列出 VITE_SWIMMER_BACKEND_SUPABASE_URL、VITE_SWIMMER_BACKEND_PUBLISHABLE_KEY 和 VITE_UNIVERSITY_GRADING_URL 未设置。最终 sealed artifact 使用本机 process-local public config 完成构建，未打印或写入 secret；合成的 grading URL 只用于本地构建验证，不代表线上生产配置。

## 5. 任务三：测试与当前阻塞

### 5.1 通过的最终检查

- pnpm install：Already up to date，pnpm 11.22.0。
- UI 全量：62 test files、369 tests passed。
- core：49 files、421 tests passed。
- backend：2 files、6 tests passed。
- grading：4 files、27 tests passed。
- local：45 files、428 tests passed。
- world：49 files、320 tests passed。
- university app：46 files、210 tests passed。
- check-raw-colours self-test、review card registry self-test、content revision self-test：均按预期红绿通过。
- typecheck、lint、format:check：通过。
- module boundaries、kit portability、contrast、raw colours、shared styles、i18n：通过。
- canvas registry、review-card registry、experience ledger：通过。
- build：delivery 和 authoring 都构建成功；delivery 输出 495 个 lesson URL。
- check-shelf：4 studies、44 courses、495 lessons match manifest。
- check-content-revisions：495 lessons、44 courses。
- check:lesson-links：2 个 fixture lesson links，无 dangling / ambiguous link。
- bundle：authoring exclusion 通过，browser AI boundary 通过。
- docs:check：86 docs，links 88 files / 14 local links，0 warning。
- sealed artifact delivery:check：通过。

### 5.2 pnpm verify

最终在最终工作树执行了：

VITEST_MAX_WORKERS=1 pnpm verify

它通过了 typecheck、lint、format、全部 7 个 workspace 的测试、所有自检、边界检查、构建、shelf 和 content revision；最后在既有的源 freshness 阶段退出 1。原文是：

> check-export-freshness: the export no longer matches the courses.
>
> turing-pact — re-export failed: Study default course is not active: foundations-before-zero

这是当前机器上的 authoring source 状态，不是本次 delivery evidence 改动制造的 failure。只读检查显示：

- worktree 的 apps/local/studies/turing-pact 是指向主 checkout 的软链；
- turing-pact 的 study manifest 仍是 active；
- 课程中只有 platform-capabilities、structured-output-repair 为 active；
- foundations-before-zero 当前为 stale，而 committed recovery export 仍把它作为 default course；
- check-export-freshness 给出的修复动作是重新 export recovery，这会写课程源/恢复产物，违反本任务“不要碰 apps/local/studies/**”和“不改课文”的范围，所以没有擅自做。

因此不能把 pnpm verify 报成全绿。修复上游 study/course active 状态或由课程作者完成一次合法 recovery export 后，需要重新跑完整 verify。

### 5.3 pnpm e2e

按 BRIEF 要求实际执行了完整的 pnpm e2e，结果为 35 tests：29 passed、6 failed。

本次新加的源码证据闸门通过，原文结果为：

> 1 passed — L.reader-interaction.spec.ts:122

6 个失败不是被隐藏或通过加入豁免解决的：

1. D.local-authoring.spec.ts:27：本地落地页找不到预期按钮，页面是“书架上还没有课”；
2. F.island-pick.spec.ts:279：本地 .stagewrap canvas 不存在；
3. G.one-chrome.spec.ts:104：本地 .nav-rail__list 不存在；
4. G.one-chrome.spec.ts:238：authoring 中预期的 foundations-before-zero label 数量为 0；
5. M.experience.spec.ts:130：online desktop 的 account panel submit button 不存在；
6. M.experience.spec.ts:130：online phone 的 account panel submit button 不存在。

前四项由同一个外部源状态解释：当前 turing-pact default course foundations-before-zero 是 stale，且 worktree 的 study entries 是软链，API/shelf 没有给这条 authoring journey 提供预期的 active course。后两项发生在这次不带公开 VITE Supabase 配置的完整命令中，因此 account form 不会出现；本地 artifact build 的 public-config gate 已经证明缺配置会 fail closed。

这六项没有通过修改断言、添加 TOUCH_TARGET_EXEMPTIONS、添加 KNOWN_DIALOG_ISSUES / KNOWN_RESPONSE_ISSUES 或重采 axe baseline 来“变绿”。当前状态应被报告为 E2E 未全绿，而不是伪装成通过。

## 6. 台账与耦合标题

ad58cf50b131 已从 blocking 改为 fixed，并写入了守护它的测试：

e2e/L.reader-interaction.spec.ts::真实打开一条引用后看到固定源码，且源码只在点击后加载

这条测试同时守着两个关键性质：

- 真实指针打开引用后必须能看到 code，不接受 locator-only；
- 首屏在点击前不能请求 evidence JSON。

台账 note 记录了当前 3,306 records / 3,149 repository anchors / 2,146 files，以及 source-equipped 构建、静态发布和不部署的条件。台账检查最终为 24 findings — 12 fixed, 12 open。

标题的产品判断不能脱离发布状态：baked sealed artifact 中标题和证据能力是一致的；当前线上没有本次 artifact，因为任务禁止部署，所以线上标题仍应等待真正发布后再把“每一句都能翻到源码”作为已验证承诺。

## 7. 外部来源与下一步

本次对“静态包是否适合放证据片段”和“按需加载是否能移出首屏”的判断，交叉核对了这些公开原始资料：

- [Vercel Limits](https://vercel.com/docs/limits)：静态文件、source files、构建等限制；页面标注的最近更新为 2026-02-03。
- [Vercel CDN Cache](https://vercel.com/docs/caching/cdn-cache)：静态文件 CDN cache、hashed assets 和 immutable cache。
- [Vercel Build Output API primitives](https://vercel.com/docs/build-output-api/primitives)：静态输出如何交给 Edge/CDN。
- [Vercel Builds](https://vercel.com/docs/builds)：构建时长、内存和磁盘约束。
- [Vercel Deploy CLI](https://vercel.com/docs/cli/deploy)：prebuilt artifact 的部署方式；本次没有执行部署。
- [MDN Lazy loading](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Lazy_loading)：非关键资源延迟到交互或导航时加载。
- [MDN Progressive loading](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Tutorials/js13kGames/Loading)：关键资源先到，交互时再加载模块。
- [MDN Performance Fundamentals](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Fundamentals)：把非关键工作移出关键路径。
- [web.dev Understanding the critical path](https://web.dev/learn/performance/understanding-the-critical-path?hl=en) 与 [Optimize LCP](https://web.dev/articles/optimize-lcp)：关键渲染路径和首屏最大内容的测量原则。

内部裁定依据是 docs/adr/ADR-0003-evidence-code-ships.md 与 ADR-0007 的静态 delivery 约束；它们共同支持“源码片段必须随交付包走，但不必阻塞首屏”的拆分。

下一次发布前必须做三件事：

1. 由课程作者处理 turing-pact default course / active status 与 recovery freshness，不由本任务改源；
2. 在有 study repository mirror 的机器上运行 delivery:build --evidence baked，并保留 release.json、SHA256SUMS 和 delivery:check 结果；
3. 人工确认后使用 prebuilt artifact 发布，再重新跑线上真实点击证据和整套 pnpm e2e。

## 结论

**本次实现已把“源码不随包发布”的核心缺陷改成了可发布、可验证、按需加载、缺失即失败的 baked 方案；但因为任务禁止部署，线上承诺尚未被本次任务兑现。pnpm verify 和 pnpm e2e 也没有伪装成全绿：前者被现有 turing-pact export freshness 阻断，后者为 29/35，并明确列出 6 个源状态/公开配置失败。**
