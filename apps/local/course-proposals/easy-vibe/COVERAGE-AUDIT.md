# 覆盖盘点：easy-vibe 剩下的那些篇，哪些该做成课

> 盘点对象：`source/` 里 195 篇中，`CURRICULUM.md` 没有取用的部分。
> 判断依据：读了全部 195 篇的完整标题结构；推荐项读了正文；
> 出处可行性用 `check-adoption.mjs` 的同一套主机规则**逐条真实请求验证过**（见 §4）。
> 盘点人不是来附和 `CURRICULUM.md` 的。凡是我认为你砍错了的，写在 §2。

---

## 0. 先纠正一个数

你说的「134 篇」，实际是 **137 篇**：

| 段 | 篇数 | 体量 | 在 CURRICULUM 里 |
| --- | --- | --- | --- |
| Stage 1 | 19 | 476 KB | 大部分取用 |
| Stage 2 | 33 | 674 KB | 取了「上线脊柱」，**其余 21 篇没处理** |
| 故事与导航 | 6 | 40 KB | 未取用 |
| **Stage 3** | **32** | **762 KB** | **整段未取用** |
| **附录** | **105** | **2495 KB** | **整段未取用** |

195 − 58（Stage 1 + Stage 2 + 其它）= **137**。

但这个数本身还掩盖了一件事：**「在范围内」不等于「被吸收了」。**
Stage 2 那 33 篇里，`CURRICULUM.md` 真正落到单元的只有 7 篇。
另外 21 篇（8 份作业 PRD 共 16 个文件、Dify、Lovart、MasterGo、
哈利波特画像、现代组件库、LLM 美化界面、多端 UI 规范）在
`outline/easy-vibe.md` 里被点了名，但既没进单元表，也没被明确判为不做。
其中两篇是真的漏了，不是砍了 —— 见 §2.7。

所以本报告实际盘点 **137 + 2 = 139 个判断点**。

---

## 1. 逐篇分类

四个标签的含义：

- **强烈推荐** —— 我认为不做是浪费。有权威出处，和现有 45 门课不重复。
- **可做** —— 值得做，但要么优先级低于上一档，要么要先合并、先砍一半。
- **与已有课重复** —— University 已经有课覆盖了它，指名写在理由里。
- **不值得做** —— 出处不可行、绑死单一第三方产品、或者它本来就是目录不是课文。

统计：**强烈推荐 24 · 可做 39 · 与已有课重复 18 · 不值得做 58**。

### 1.1 Stage 3 · 核心技能（11 篇）

| 篇 | 大小 | 判断 | 理由（一句） |
| --- | --- | --- | --- |
| `core-skills_workflow` | 25KB | **强烈推荐** | 四类项目 × 四类任务的协作策略 + 项目知识库（CLAUDE.md / 常见问题 / ADR），`directing-ai-agents` 只讲了「让 AI 先读什么」，没讲「不同项目该换什么打法」。 |
| `core-skills_spec-coding` | 35KB | **强烈推荐** | 你在单元 11 用 5 节承接了它，但 EARS、Given/When/Then、ADR、纵向切片、验证关卡、Spec 生命周期三模式、五个误区一条都没进去 —— 详见 §2.1。 |
| `core-skills_agent-teams` | 80KB | **强烈推荐** | 多 agent 的拓扑、成本倍数、合同优先、任务粒度、文件冲突、先研究再实现；University 45 门课**零覆盖** —— 详见 §2.2。 |
| `core-skills_skills` | 39KB | **强烈推荐** | SKILL.md 的形状、三层渐进加载、description 怎么写才会被触发、Skills vs MCP vs 提示词的分界；`directing-ai-agents` 只有 `pin-a-skill-by-its-hash` 一节，讲的是钉版本不是写技能。 |
| `core-skills_mcp` | 15KB | 可做 | 大半是会过期的配置指南；durable 的那一半（为什么要一个标准而不是 N 个集成、工具/资源/提示三种能力、密钥别写进配置、锁版本）应与 `appendix_8_ai-protocols` 合并成 2–3 节。 |
| `core-skills_basics` | 50KB | 可做 | 安装步骤和 11 个快捷键三个月就过期；但 CLAUDE.md 作为项目记忆、`.claudeignore` 与 token 成本、先 plan 再写、上下文压缩、权限配置这五件事是长期成立的。 |
| `core-skills_github-iterative-development` | 44KB | 可做 | 「用工单系统承载规格」这条链路值得讲，但正文绑死 Matt Pocock 的一套 Skills，且出处几乎全在 `github.com`（**已被故意排除**），要重写成不指名工具的讲法。 |
| `core-skills_claude-agent-sdk` | 25KB | 可做 | 读者必须已经在写代码，受众比第一门课高两级；概念上与 `ai-contracts-first`（注入、闸门、租约）和 `structured-output-repair` 有交集，但 SDK 本体没讲过。 |
| `core-skills_long-running-tasks` | 29KB | **与已有课重复** | 与 `directing-ai-agents` 的「一个循环要有停止条件」三节 + `a-budget-is-part-of-the-grant` 直接重叠；只有「AI 判断不了自己做完没有」这条根因值得补进那门课，不值得单开。 |
| `core-skills_superpowers` | 18KB | 不值得做 | 一个具体插件的技能清单加安装步骤，正是 `outline` 判断三要排除的那类；它的 durable 部分（TDD、先计划、完成前验证）已在 `foundations-quality` + `testing-strategy` + spec-coding 里。 |
| `core-skills_mobile-development` | 32KB | 不值得做 | 七套「手机连电脑」的第三方方案（Happy Coder / HAPI / Tailscale / Termux / ngrok / Sealos），出处一个都不在白名单，且半年后至少换掉三套。 |

### 1.2 Stage 3 · AI 进阶（3 篇）

| 篇 | 大小 | 判断 | 理由 |
| --- | --- | --- | --- |
| `ai-advanced_rag-introduction` | 107KB | **强烈推荐** | 全课第二大正文；索引→检索→生成、三代演进、分块策略、模型选型、评测指标一应俱全，University 一门没有 RAG。评测那节要和 `ai-evaluation` 划界（那门讲的是自家用例的离线/在线尺子）。 |
| `ai-advanced_langgraph-advanced-rag` | 14KB | 不值得做 | 绑死 LangGraph，`langchain` 域名不在白名单；只有「客服的四类路由」值得摘出来并进 RAG 课的一节。 |
| `ai-advanced_llamaindex-enterprise-knowledge-base` | 14KB | 不值得做 | 绑死 LlamaIndex，同上；「企业知识库最核心的不是检索是拆分」+ 版本/权威来源/边界三种意识值得并进 RAG 课。 |

### 1.3 Stage 3 · 跨平台（16 篇）

| 篇 | 大小 | 判断 | 理由 |
| --- | --- | --- | --- |
| `cross-platform_choose-platform` | 17KB | **强烈推荐** | 十条架构路线 + 三个前置问题 + 决策表 + 四个误区；它问的是「第一版做哪一端」，`one-codebase-many-hosts` 问的是「一个产品怎么在三端跑」，不是同一个问题 —— 详见 §2.8。 |
| `cross-platform_app-publishing` | 19KB | **强烈推荐** | 五个平台的上架流程 + 通用发布前检查 + 审核最常见失败原因 + 不要全量发；出处 `developer.apple.com` / `developer.android.com` 都在白名单且已验证 —— University **零覆盖**。 |
| `cross-platform_pwa-local-app` | 13KB | 可做 | `web.dev/learn/pwa` + MDN Service Worker 都已验证可用，出处完全没问题；和已有课不重叠。 |
| `cross-platform_browser-ai-extension` | 12KB | 可做 | `developer.chrome.com/docs/extensions` 已验证；「功能就发生在网页旁边」是一个真实的产品形态。 |
| `cross-platform_vscode-extension` | 18KB | 可做 | `code.visualstudio.com/api` 已验证；不过受众是「给开发者做工具的人」，比第一门课高两级。 |
| `cross-platform_android-app` | 11KB | 可做 | `developer.android.com` 在白名单；但 Jetpack Compose 的细节比 University 现在任何一门都窄。 |
| `cross-platform_ios-app` | 11KB | 可做 | `developer.apple.com` 在白名单；同上。 |
| `cross-platform_electron-voice-to-text` | 11KB | **与已有课重复** | `one-codebase-many-hosts`「外壳 / electron-three-switches」+ `platform-capabilities`「运行时壳 / electron-not-native」已讲过，而且 `electronjs.org` 还不在白名单。 |
| `cross-platform_react-native-expo` | 17KB | 不值得做 | `reactnative.dev` 请求失败、`docs.expo.dev` 不在白名单，一条出处都建不起来。 |
| `cross-platform_flutter-app` | 21KB | 不值得做 | `flutter.dev` 不在白名单，同上。 |
| `cross-platform_wechat-miniprogram` | 18KB | 不值得做 | `developers.weixin.qq.com` 不在白名单，且正文绑死 Trae + HBuilderX + 微信开发者工具三件套。 |
| `cross-platform_wechat-miniprogram-backend` | 30KB | 不值得做 | 同上，还多绑一个腾讯云 CloudBase。 |
| `cross-platform_godot-game-development` | 22KB | 不值得做 | `docs.godotengine.org` 不在白名单。 |
| `cross-platform_qt-industrial-hmi` | 28KB | 不值得做 | `doc.qt.io` 不在白名单，且「工控上位机」离 University 的读者太远。 |
| `cross-platform_nft-minting` | 17KB | 不值得做 | `docs.soliditylang.org` 不在白名单，且这是 University 明确不碰的方向。 |
| `cross-platform_ai-native-creator` | 6KB | 不值得做 | 三站成长路线的导读，是目录不是课文 —— 顺带说，它印证了你的分级判断是对的。 |

### 1.4 Stage 3 · 其它（2 篇）

| 篇 | 大小 | 判断 | 理由 |
| --- | --- | --- | --- |
| `personal-brand_personal-website-blog` | 52KB | **与已有课重复** | 与 `general/product-website`（定方向 / 做内容 / 做体验 / 交付，四单元）结构性重叠，差别只是题材换成学术主页、工具链换成 Jekyll + Ruby；GitHub Pages 那一小段可以补进 CURRICULUM 单元 8。 |
| `stage-3_index` | 6KB | 不值得做 | 导航页。 |

### 1.5 附录 1 · 计算机基础（12 篇）

| 篇 | 大小 | 判断 | 理由 |
| --- | --- | --- | --- |
| `power-on-to-web` | 38KB | **强烈推荐** | 从按下电源到网页出现的完整一条链，附录里最好的一篇「全景」；`foundations-before-zero` 讲的是「项目文件拆开是什么」，这篇讲的是「机器在干什么」。 |
| `computer-networks` | 26KB | **强烈推荐** | URL→DNS→TCP 握手→HTTP→渲染；出处 RFC 1035 / RFC 9110 / MDN 全部已验证。 |
| `data-structures` | 14KB | 可做 | `docs.python.org` 的 Data Structures 教程能撑住出处；`foundations-logic`「一堆东西怎么处理」只讲了 list/map/fold，没讲选型。 |
| `algorithm-thinking` | 12KB | 可做 | 二分 / 排序 / 递归 / 贪心，出处同上；但对「有个念头想做出来」的读者优先级不高。 |
| `type-systems` | 10KB | 可做 | `typescriptlang.org` 撑得住静态/动态、推断、泛型；与 `foundations-reading-code` 的类型几节有部分重叠。 |
| `data-encoding-storage` | 14KB | 可做 | 乱码从哪来、图片音频怎么变成数字；MDN 的字符编码条目 + RFC 3629 能撑。 |
| `transistor-to-cpu` | 18KB | 不值得做 | 半加器、全加器、触发器 —— **白名单里没有任何一个站讲这个**，一条出处都建不起来。 |
| `computer-organization` | 20KB | 不值得做 | 冯诺依曼、指令系统、缓存、流水线，出处同上不可行。 |
| `operating-systems` | 6KB | 不值得做 | 进程 / 内存 / 文件系统，出处不可行。 |
| `compilers` | 12KB | 不值得做 | 词法、语法、AST、优化，出处不可行。 |
| `programming-languages` | 5KB | 不值得做 | 5KB 的范式与选型速览，太薄且出处不可行。 |
| `vibe-coding-fullstack` | 14KB | 不值得做 | 领域全景图 + 成长路径，是导读；且与 CURRICULUM 单元 1 和单元 11 的定位重叠。 |

### 1.6 附录 2 · 开发工具（10 篇）—— 整组是被低估最狠的一块

| 篇 | 大小 | 判断 | 理由 |
| --- | --- | --- | --- |
| `debugging-art` | 16KB | **强烈推荐** | 读懂报错、二分法、橡皮鸭、最小复现、AI 时代怎么把现象交给模型；CURRICULUM 单元 2 只给了 1 节 —— 详见 §2.5。 |
| `debugging-art_index` | 7KB | **强烈推荐** | DevTools 五个面板各回答什么问题，`developer.chrome.com/docs/devtools` 已验证；CURRICULUM 只给了 1 节讲三个面板。 |
| `environment-path` | 5KB | **强烈推荐** | PATH 查找顺序、export 的作用域、`.env` 与生产注入的分工、三类真实排错；CURRICULUM 只有 `secrets-go-in-the-environment` 1 节。 |
| `ports-localhost` | 10KB | **强烈推荐** | 端口冲突、同源与跨域、三个最常见排错；CURRICULUM 只有 `localhost-and-ports` 1 节，而这是新手第一周必撞的墙。 |
| `git-version-control` | 18KB | 可做 | `git-scm.com` 已验证；三个区域 / 分支 / 远程 / 冲突，CURRICULUM 的三节（`commit-push-go-back` 等）只到「能退回去」。 |
| `package-managers` | 15KB | 可做 | 语义化版本、锁文件、全局 vs 本地、虚拟环境；`docs.npmjs.com` 不在白名单，但 `nodejs.org` 和 `docs.python.org` 能撑住大部分。 |
| `ssh-authentication` | 4KB | 可做 | 公钥私钥、生成配置、常见排错；`docs.github.com` 的 SSH 页 + RFC 4251 可用。 |
| `regex` | 5KB | 可做 | MDN 正则完全够；但工具性太强，做成一节附在别的课里比单开好。 |
| `command-line-shell` | 15KB | 可做 | 前两节（终端是什么、终端和 Shell 的解耦）能做；后面的网格系统、转义序列、cooked/raw、信号找不到白名单出处。 |
| `ide-basics` | 17KB | **与已有课重复** | 与 CURRICULUM 单元 2 的 `what-an-ide-is` + `what-ai-ide-adds` 重叠。 |

### 1.7 附录 3 · 浏览器与前端（15 篇）

| 篇 | 大小 | 判断 | 理由 |
| --- | --- | --- | --- |
| `html-css-layout` | 45KB | **强烈推荐** | MDN 全覆盖；University 45 门课里，`product-website` 讲的是页面怎么排版做决策，`foundations-ui` 讲的是 React 组件 —— **HTML/CSS 本体一门没讲过**。 |
| `browser-as-os-rendering` | 37KB | **强烈推荐** | 渲染管线、重排重绘、合成与 GPU、事件循环；`developer.chrome.com` + `web.dev` 已验证，零覆盖。 |
| `frontend-engineering` | 38KB | **强烈推荐** | 转译 / 打包 / tree shaking / HMR / SourceMap / 资源指纹，`vite.dev` 已验证；`foundations-terrain` 的 `dev-server-vs-build` 只有一节。 |
| `web-performance` | 31KB | **强烈推荐** | `web.dev/articles/vitals` 已验证；加载、渲染、交互三类瓶颈，零覆盖。 |
| `javascript-deep-dive` | 26KB | 可做 | 与 `foundations-reading-code` / `foundations-logic` 重叠不小，但闭包、DOM、事件、异步的餐厅类比是新的。 |
| `javascript-runtime` | 17KB | 可做 | `nodejs.org` 的事件循环页已验证；调用栈、GC、内存泄漏是 `foundations-async` 没有的。 |
| `frontend-framework-nature` | 25KB | 可做 | 「数据变了界面怎么办」「为什么要虚拟 DOM」，`react.dev` 能撑；`foundations-ui` 讲的是怎么用，不是为什么这么设计。 |
| `routing-navigation` | 34KB | 可做 | MDN History API + `react.dev`；和 `world-navigation`（那门讲的是产品结构的外化）完全不是一件事。 |
| `state-management` | 36KB | 可做 | 只做「组件通信为什么会失控」的原理部分；Vuex/Pinia/Redux/MobX/Zustand 的横向对比出处不可行，砍掉。 |
| `typescript` | 19KB | 可做 | `typescriptlang.org` 已验证；与 `foundations-reading-code` 的类型几节部分重叠。 |
| `graphics-animation` | 10KB | 可做 | MDN Canvas 已验证；University 有 3D（packages/world）但没有 2D Canvas 入门。 |
| `realtime-communication` | 5KB | 可做 | MDN SSE / WebSocket 已验证；`realtime-presence` 讲的是在场包和名册（产品层），这篇讲三种传输的选型。 |
| `a11n-i18n` | 7KB | 可做 | W3C WCAG 已验证；`bilingual-by-design` 覆盖了 i18n 的一半，**无障碍完全没讲过**。 |
| `frontend-frameworks` | 21KB | 不值得做 | 前端演进史，史料性强；讲 jQuery 时代找不到权威原始资料。 |
| `frontend-project-architecture` | 16KB | 不值得做 | 「按用户量分级的目录结构」，没有任何权威站规定目录该怎么放 —— 这正是那条出处规矩要挡的东西。 |

### 1.8 附录 4 · 服务端与后端（20 篇）

| 篇 | 大小 | 判断 | 理由 |
| --- | --- | --- | --- |
| `auth-authorization` | 29KB | **强烈推荐** | 认证 vs 授权、Session、JWT、OAuth2、密码哈希、CSRF/XSS；RFC 6749 / RFC 7519 / NIST SP 800-63B / MDN **全部已验证**。`identity-and-accounts` 讲的是产品里登录怎么落地，这篇讲协议本体。 |
| `api-design` | 19KB | **强烈推荐** | REST 命名、状态码语义、错误结构、版本向后兼容、响应结构；RFC 9110 已验证。`ai-contracts-first` 讲的是 AI 侧的契约盒子，不是 HTTP 接口设计。 |
| `http-protocol` | 8KB | 可做 | RFC 9110 + MDN；和 `api-design`、`api-intro` 三篇内容互相重叠，应合并成一个单元而不是三节。 |
| `caching` | 42KB | 可做（要砍） | 穿透 / 击穿 / 雪崩 / 一致性写得很好，但 `redis.io` 不在白名单；只有 MDN 的 HTTP 缓存那一半建得起出处。 |
| `concurrency-async` | 28KB | 可做（要砍） | 进程 / 线程 / 协程；`go.dev` 不在白名单，只有 `nodejs.org` 的事件循环那一段能撑，其余与 `foundations-async` 重叠。 |
| `serialization` | 11KB | 可做 | MDN JSON + RFC 8259；Protobuf 那一段出处不可行，砍掉。 |
| `file-storage` | 8KB | 可做（要砍） | 块/文件/对象三种存储的分界能讲；S3/OSS 出处不可行，`supabase.com` 的 Storage 文档可以代打一部分。 |
| `request-journey` | 10KB | 可做 | 和 `computer-networks` 讲同一条链，**合并，不单独立节**。 |
| `api-intro` | 10KB | **与已有课重复** | 与 CURRICULUM 单元 6 的 `what-an-api-is`、`401-429-timeout` 重叠。 |
| `backend-layered-architecture` | 30KB | **与已有课重复** | 依赖方向那条铁律，`contracts-and-drift` 的 `layers-are-dependencies` 已讲；且 Controller/Service/Repository 的分层没有权威站可引。 |
| `cross-platform` | 13KB | **与已有课重复** | 与 `one-codebase-many-hosts` + `platform-capabilities` 重叠，也和 Stage 3 的 `choose-platform` 重复（那篇更好）。 |
| `backend-languages` | 85KB | 不值得做 | 15 种语言逐个介绍，是词典不是课文；且 `go.dev` / `kotlinlang.org` / `rust-lang.org` 都不在白名单。 |
| `client-languages` | 12KB | 不值得做 | 同上。 |
| `backend-project-architecture` | 26KB | 不值得做 | 「按用户量分级」，同 §1.7 的前端那篇。 |
| `web-frameworks` | 27KB | 不值得做 | 物理机→单体→容器→微服务→Serverless；Docker / K8s 出处不可行。 |
| `message-queues` | 23KB | 不值得做 | 出处不可行（Kafka / RabbitMQ 都不在白名单）。 |
| `async-task-queues` | 8KB | 不值得做 | 同上。 |
| `rate-limiting-backpressure` | 6KB | 不值得做 | 出处不可行；限流的产品侧含义 `ai-budget-and-cost` 的闸门一节已有。 |
| `search-engines` | 7KB | 不值得做 | `elastic.co` 不在白名单。 |
| `domain-specific-languages` | 27KB | 不值得做 | YAML / IaC / 胶水代码混在一篇里，出处零散，主题也不成立。 |

### 1.9 附录 5 · 数据（7 篇）

| 篇 | 大小 | 判断 | 理由 |
| --- | --- | --- | --- |
| `database-fundamentals` | 25KB | **强烈推荐** | 表行列、SQL 本体、B+ 树索引、ACID 事务、查询优化；`postgresql.org` 已验证。CURRICULUM 单元 7 那 5 节**一行 SQL 都没有** —— 详见 §2.6。 |
| `data-visualization` | 12KB | 可做 | 图表选型、仪表盘布局、「这些图表在骗你」；`nngroup.com` 在白名单，零覆盖。 |
| `data-models` | 8KB | 可做 | 文档 / 图 / 时序 / 向量四种模型；`postgresql.org` + `supabase.com`（pgvector）能撑一半。 |
| `data-tracking` | 13KB | **与已有课重复** | 与 `foundations-product`「想知道用户在干什么，又不能偷看」整个单元重叠。 |
| `data-analysis` | 7KB | **与已有课重复** | 漏斗与留存，与 `retention-engineering` + `foundations-product` 重叠。 |
| `ab-testing` | 7KB | **与已有课重复** | 与 `experiments-and-rollout`（把上线写成可证伪的假设、先登记才能变体）重叠。 |
| `data-governance` | 11KB | 不值得做 | 数据血缘、元数据、ODS/DWD/DWS 分层，企业数据平台向，受众完全不符。 |

### 1.10 附录 6 · 架构与系统设计（4 篇）

| 篇 | 大小 | 判断 | 理由 |
| --- | --- | --- | --- |
| `distributed-systems` | 11KB | 不值得做 | CAP、一致性模型、分布式事务；出处不可行，且一个人做产品用不上。 |
| `high-availability` | 10KB | 不值得做 | 几个 9、RPO/RTO、混沌工程；出处不可行，且 `solo-operations` 已从单人视角讲过「线上还活着吗」。 |
| `monolith-to-microservices` | 7KB | 不值得做 | 出处不可行。 |
| `system-design-methodology` | 11KB | 不值得做 | 四步法与容量估算；出处不可行（这类内容的权威来源本来就是书和面试题）。 |

### 1.11 附录 7 · 基础设施与运维（13 篇）

| 篇 | 大小 | 判断 | 理由 |
| --- | --- | --- | --- |
| `ci-cd` | 30KB | **强烈推荐** | 构建产物 → 服务器 → 部署 → DNS → HTTPS → CI/CD → 监控，一条完整链；`docs.github.com` 的 Actions 页已验证。CURRICULUM 单元 8 讲到「一键部署」为止，**没有任何一门课讲门禁怎么在推送时挡住你**。 |
| `dns-https` | 9KB | 可做 | RFC 1035 / RFC 8446 / MDN 全部已验证；CURRICULUM 的 `domain-and-the-lock` 只有一节。 |
| `cloud-iam` | 31KB | 可做（要砍） | 最小权限、AK/SK 保管、MFA 这三件事能用 NIST 撑住；IAM 本体在 AWS/阿里云文档里，不在白名单。 |
| `linux-basics` | 12KB | 不值得做 | 文件系统、权限、Shell；白名单里没有任何 Linux 官方站。 |
| `docker-containers` | 8KB | 不值得做 | `docs.docker.com` 不在白名单。 |
| `kubernetes` | 7KB | 不值得做 | `kubernetes.io` 不在白名单，且受众完全不符。 |
| `infrastructure-as-code` | 10KB | 不值得做 | Terraform 不在白名单。 |
| `gateway-proxy` | 28KB | 不值得做 | Nginx 官方站不在白名单（且请求失败）。 |
| `load-balancing-gateway` | 18KB | 不值得做 | 同上。 |
| `cloud-platforms` | 17KB | 不值得做 | 云厂商全景，出处不可行。 |
| `cloud-storage-cdn` | 61KB | 不值得做 | 附录里第二大的一篇，可惜整篇建立在对象存储厂商文档上，一条出处都不在白名单。 |
| `monitoring-logging` | 18KB | **与已有课重复** | 与 `solo-operations`「线上还活着吗」（探针要有 deadline、留片段不留全文、便宜探针贵回合）重叠。 |
| `incident-response` | 9KB | **与已有课重复** | 分级、时间线、指挥、复盘，与 `solo-operations` 整门重叠。 |

### 1.12 附录 8 · 人工智能（16 篇）

判断这一组时的关键事实：`what-is-ai-really` 有 **12 单元 60 节**，
写给绝对零基础（游戏类比、手机备忘录练习），概念覆盖面很宽但每一节都很浅。
所以「重复」在这里要分两种：**概念被讲过**，和**深度已经够了**。

| 篇 | 大小 | 判断 | 理由 |
| --- | --- | --- | --- |
| `context-engineering` | 21KB | **强烈推荐** | KV 缓存与前缀稳定、滑动窗口、Lost in the Middle、分级钉住、压缩、四层上下文；`docs.anthropic.com` 的 prompt-caching / context-windows / token-counting **三页都已验证**。`ai-budget-and-cost` 讲的是怎么给钱记账，不是怎么少花。 |
| `ai-agents` | 18KB | **强烈推荐** | 工具调用、规划、记忆、核心循环、能力分级；`directing-ai-agents` 讲「你怎么指挥它」，这篇讲「它内部怎么转」，是那门课缺的前一步。 |
| `ai-protocols` | 12KB | **强烈推荐** | MCP 与 A2A，USB-C 和企业微信两个类比都立得住；比 Stage 3 那篇 MCP 配置指南好得多，两篇应合并，以这篇为骨。 |
| `prompt-engineering` | 15KB | **强烈推荐** | Few-shot、思维链、让 AI 反问、模板；**其中「防止指令注入」一条 University 完全没有，而那是安全问题不是技巧问题**。`docs.anthropic.com` 有全套。 |
| `embedding-vector-retrieval` | 11KB | **强烈推荐** | 向量索引、相似度、向量库、端到端 pipeline；`what-is-ai-really` 的 `close-meanings-close-numbers` 只讲到「用法接近数字就接近」，建不出 RAG。 |
| `rag` | 9KB | 可做 | 作为 RAG 课的入门节；主体正文用 Stage 3 那篇 107KB 的。 |
| `ai-native-app-design` | 9KB | 可做 | AI 产品的交互模式（流式、可中断、可编辑、置信度展示）没讲过；`nngroup.com` 有 AI UX 的原始研究。 |
| `transformer-attention` | 11KB | 可做（进阶） | QKV、多头、位置编码比 `what-is-ai-really` 的 `where-it-looks-when-reading` 深一层；但受众很窄，且要明确标成进阶，否则读者会觉得在看第二遍。 |
| `multimodal-models` | 15KB | 可做（进阶） | 与 `what-is-ai-really` 的「让电脑看见」+ `words-and-pictures-in-one-place` 概念重叠，深度不同。 |
| `llm-principles` | 24KB | **与已有课重复** | 与 `what-is-ai-really`「让电脑读懂话」10 节几乎一一对应（分词、向量、注意力、续写、幻觉）。 |
| `neural-networks` | 14KB | **与已有课重复** | 与「最小的那个零件」5 节（一个神经元就是算术、堆成一层、权重是在乎多少、更深看得更多、冷热校正）近乎逐条对应。 |
| `ai-history` | 18KB | **与已有课重复** | 与「不用学也能显得聪明」+「那它到底算不算聪明」两个单元重叠。 |
| `image-generation` | 8KB | **与已有课重复** | 与「会画画的 AI」5 节重叠；潜空间/流匹配那部分更深，但对 University 的读者没有落点。 |
| `speech-synthesis-recognition` | 10KB | 不值得做 | 出处不可行；`media-tooling` 已从「一个人的流水线」角度讲过付费语音。 |
| `model-finetuning-deployment` | 9KB | 不值得做 | LoRA / 量化 / 部署；University 的读者不训模型，`ai-cost-and-boundaries` 已经把「什么时候不该自己搞模型」讲清楚了。 |
| `ai-capability-dictionary` | 431KB | 不值得做 | 是词典不是课文 —— 同意你原来的判断。 |

### 1.13 附录 9 · 工程卓越（7 篇）+ 索引（2 篇）

| 篇 | 大小 | 判断 | 理由 |
| --- | --- | --- | --- |
| `security-thinking` | 6KB | **强烈推荐** | 全篇只有 6KB，但 **University 45 门课一门安全课都没有**；MDN 的 Types of attacks + NIST 都已验证 —— 详见 §2.4。 |
| `open-source-collaboration` | 6KB | 可做 | 贡献流程与许可证；`docs.github.com` 已验证，零覆盖，而且和 University 自己的处境直接相关。 |
| `technical-writing` | 6KB | 可做 | 文档类型与写作原则；和本仓库的 doc-gov 是同一件事，但作为课受众窄。 |
| `technology-selection` | 6KB | 可做 | 选型维度与决策矩阵；应并进 `choose-platform`，不单开。 |
| `testing-strategies` | 8KB | **与已有课重复** | 测试金字塔与 TDD，与 `testing-strategy` + `foundations-quality` + `e2e-and-qa-scripts` **三门**重叠。 |
| `code-quality-refactoring` | 10KB | 不值得做 | 坏味道与重构手法的权威来源是书（Fowler），白名单里建不起出处。 |
| `design-patterns` | 9KB | 不值得做 | 同上（GoF）。 |
| `appendix_index` | 19KB | 不值得做 | 导航页。 |
| `stage-2_index` 等 | — | 不值得做 | 导航页。 |

---

## 2. 漏掉的宝贝

这一节是本报告的重点。前面 §1 回答的是「剩下的能不能做」，这一节回答的是
**「你砍掉的东西里，哪些其实不该砍」**。

### 2.1 Spec Coding 被压成了 5 节，而它值 15 节

`CURRICULUM.md` 单元 11 用 5 节承接了 35KB 的 `spec-coding`，
并且把这个单元的作用定义为「交接」。这两件事各自都有道理，合在一起就出问题：

**这一单元既是全课的最后一单元，又是全课唯一讲规格的地方，
而它交接的目的地（turing-pact 那 20 门）读的是 Rust 和 TypeScript 真实仓库。**
一个刚做完「说人话」网页的人，走到单元 11 的最后一节，
下一步是一堵墙，不是一级台阶。

而原文里被丢掉的部分，恰恰全是**不依赖任何工具、不会过期**的方法：

| 被丢掉的 | 它是什么 | 为什么可惜 |
| --- | --- | --- |
| Spec / Plan / Tasks 三份文件的分工 | 行为、方案、顺序分开写 | 单元 11 的 `the-smallest-spec` 把三件事压成一件 |
| 「先让 AI 提问，每次最多 4 个」 | 一条可以直接抄的澄清提示词 | 这是把模糊需求变具体的**唯一**可操作办法 |
| 把形容词改成验收标准 | 「实时」「好用」怎么变成可观察的句子 | 全课教了很多次「说清楚」，这是第一次给出判据 |
| 四类边界：空 / 失败 / 权限 / 重复 | 一张必查清单 | 初学者 90% 的返工来自这四类，一条清单就能挡住 |
| EARS 与 Given/When/Then | 两种固定句式 | 写完直接能变测试，这是「规格」和「愿望」的分界 |
| ADR | 把技术选择的原因存下来 | University 自己 `docs/adr/` 就是这么运转的 |
| 纵向切片 | 一张任务交付一小段完整价值 | 直接对着 CURRICULUM「一节只教一件事」的同一个道理 |
| 验证关卡 | 不许用「任务打钩」代替验收 | 和 `foundations-quality`「what-done-means」是同一条 |
| Spec 生命周期三模式 | 快照 / 长期锚点 / 唯一源头 | 决定文档会不会烂掉，团队必须选一个 |
| 五个误区 | 尤其「需求变了却只改代码」 | 这是让规格失效的头号原因 |

**结论：你砍 Stage 3 的三条理由里，第 2 条（和 turing-pact 重复）在 Spec Coding 上不成立。**
`ai-contracts-first` 和 `contracts-and-drift` 讲的是**代码里的契约**
（契约盒子、层依赖、契约测试、冻结接口）；
Spec Coding 讲的是**写给人和 AI 看的需求文档**。
两者的读者、产物和检查方式都不一样。我认为这里砍多了。

### 2.2 Agent Teams（80KB）整篇丢掉，是这批材料里最大的一处浪费

University 45 门课，**没有一门讲「同时指挥多个 AI」**。
`directing-ai-agents` 的三个单元全部是关于**一个** agent 的：
读什么、循环怎么停、哪些事只有你能做。

而 `agent-teams` 讲的是完全另一层的东西，而且每一条都不依赖具体产品：

- **拓扑**：星型（子代理向主代理汇报）和网状（成员互相通信）不是同一种东西
- **成本是乘的不是加的**：3 人团队 3–4 倍，5 人 5–6 倍，还有启动开销和协调开销
- **合同优先**：并行开工之前必须先定接口，否则 `{username,password}` 撞上 `{user,pass}`
- **任务粒度**：15–30 分钟一件，太大失去并行、太小协调成本超过干活
- **文件冲突**：按目录分人，必须改同一个文件时改成串行阶段
- **先研究再实现**：两阶段，让架构不匹配在写代码前暴露
- **不适合的场景**：高度串行的任务没有并行空间，简单修改的启动开销大于收益

顺带说一句：这些结论和你自己在 `MEMORY.md` 里记下的教训是同一批
（派发前先看负载、封顶 4 个、被中途杀掉的 agent 一行不提交、
高负载下跑验证会把好分支跑红）。**这块知识你已经付过学费了，
它就写在这 80KB 里，而它是原课里唯一一块 University 完全没有替代品的内容。**

### 2.3 「上下文工程」这一整块，你的成本课解决的是另一个问题

`ai-budget-and-cost` 讲的是**记账**：预扣、提交、退款、算最坏情况、幂等。
`context-engineering` 讲的是**少花**：前缀稳定让缓存命中、分级钉住、中间迷失、压缩。

两者的关系是：一个管「别把钱算错」，一个管「别把钱花掉」。
其中「把时间戳写在 System Prompt 第一句会让整个缓存失效」这一条，
是任何做 AI 产品的人第一个月就该知道、但几乎所有人都是撞过才知道的事。
`docs.anthropic.com/en/docs/build-with-claude/prompt-caching` 已验证可用。

### 2.4 45 门课，零安全课

`security-thinking` 只有 6KB，是附录里最小的几篇之一，很容易被扫过去。
但盘完 45 门课我可以确认：**XSS、CSRF、SQL 注入、越权、密钥泄露，
University 一句都没有系统讲过。**

现有的最近似物是：
- CURRICULUM 单元 6 `the-key-is-a-password`（密钥别写页面里）
- `identity-and-accounts`（展示身份 ≠ 真实身份）
- `foundations-product`（有人会捣乱，有法律要遵守）

这三处加起来，够让读者知道「有这回事」，不够让他挡住任何一次真实攻击。
而这门课的产出是**要放到公网上、还要收钱的东西**。
出处已验证：MDN 的 Types of attacks、NIST SP 800-63B、W3C。

### 2.5 排错这一组，你自己犯了 outline 判断二里指出的那个错

`outline/easy-vibe.md` 的判断二写得很好：

> 附录是「读者自己会去翻」的赌注，而初学者不会翻。

然后 CURRICULUM 把 `common-errors`（7KB）提上了主线 —— 这一步对。
但同一个主题的另外四篇留在了附录里，而它们加起来 38KB，比被提上来的那篇厚五倍：

| 篇 | 大小 | CURRICULUM 给了几节 |
| --- | --- | --- |
| `debugging-art` | 16KB | 0 |
| `debugging-art_index`（DevTools 五个面板） | 7KB | 1（`console-network-elements`，讲三个面板） |
| `ports-localhost` | 10KB | 1（`localhost-and-ports`） |
| `environment-path` | 5KB | 1（`secrets-go-in-the-environment`） |

**一个跟着这门课做完单元 5 的人，在单元 6 接 AI 的时候一定会撞上
端口被占、`command not found`、`.env` 没生效、密钥读不到这四件事中的至少两件。**
现在这门课给他的全部装备是三节。这不是「留到下一轮」的问题，
这是第一门课自己的漏。

### 2.6 单元 7 讲了数据库，但一行 SQL 都没有

CURRICULUM 单元 7 五节：一刷新就没了 / 表行列 / 增查改删 / 谁能看谁的数据 / 登录是什么。
方向完全正确，但停在了「知道有这么回事」。

`database-fundamentals`（25KB）里有而这五节里没有的：
一条真实的 `SELECT` 长什么样、索引为什么能快一千倍、
事务的「全有或全无」、以及一个查询慢了该看什么。

一个人如果真的要靠 AI 做出能卖的东西，他早晚要在某个凌晨读懂一条 SQL。
这一篇的出处（`postgresql.org`）已验证，是附录里出处最扎实的几篇之一。

### 2.7 Stage 2 里有两篇，你既没取也没判

`outline/easy-vibe.md` 的「隐去的东西」列了 Dify、Lovart、MasterGo、
哈利波特画像、行业场景、能力词典 —— 都写了理由。但这两篇不在任何一边：

**`stage-2_backend_modern-cli`（51KB）** —— CLI AI 编程工具。
CURRICULUM 单元 2 讲的是 AI IDE 的三档（补全 / 对话 / 代理），
而 2026 年一个零基础的人最可能真正上手的是 CLI。
更要紧的是：**University 这个产品自己就是围绕 CLI agent 建的**，
第一门课却让读者以为 AI 编程等于在编辑器里开个侧边栏。
这一篇应该变成单元 2 的一到两节（「还有一种没有界面的用法」），
出处走 `docs.anthropic.com/en/docs/claude-code/*`，已验证。

**`stage-2_backend_cloud-server-deployment`（50KB）** —— 自己买 VPS。
CURRICULUM 单元 8 只讲一键部署，这是对的（对这门课的读者也够了）。
但这 50KB 里有一段是通用的：**部署平台全景决策图**
（什么时候够用一键、什么时候必须要台常驻机器）。
其余（买机器、SSH、ufw、Nginx、certbot）出处全部不可行，不做。

### 2.8 一个没被说出口的假设：第一版一定是网页

CURRICULUM 单元 4 把念头收敛成「白板上的三页」，
单元 5 直接开始「让 AI 做出那三页」—— 中间跳过了一个问题：
**这三页应该长在哪儿？**

`choose-platform`（17KB）问的正是这个：用户从哪里打开它、
需要哪些设备能力、谁来长期维护。它的十条路线里，
网页只是第一条，后面还有小程序、原生、桌面、插件。

这不是要在第一门课里教十种平台。这是说单元 4 和单元 5 之间
**缺一节课，让读者自己说出「我这个东西该做成网页」这句话**，
而不是被课程默认掉。一节，不是一个单元。

### 2.9 那么，砍掉 Stage 3 和 104 篇附录，到底砍错了没有

**砍 104 篇附录：对了一半。**
你的理由是「规模」和「留到下一轮」。但盘完之后我认为，
这 105 篇不是一个整体，它按**出处可行性**裂成很清楚的两半：

- **约 45 篇永远做不了**（不是这一轮做不了）：晶体管、CPU、操作系统、编译器、
  Linux、Docker、K8s、Nginx、Terraform、Kafka、Redis、Elasticsearch、
  15 种后端语言、对象存储 CDN —— 白名单里没有它们的官方站，
  而按 §4 的分析，其中大部分**也不该为了它们去扩白名单**。
- **约 25 篇现在就该做**：开发工具那 4 篇、浏览器前端那 4 篇、
  auth、api-design、database、ci-cd、security、以及 AI 那 5 篇。

所以正确的记法不是「留到下一轮」，而是
**「45 篇结案不做，25 篇进下一门课的排期，其余 35 篇待定」**。
「留到下一轮」这句话的问题是，它让一份永远不会兑现的欠条一直挂在账上。

**砍 Stage 3：砍多了，具体多了四篇。**
`spec-coding`、`agent-teams`、`workflow`、`skills` 这四篇，
加起来 179KB，是原课里最新、最稀缺、最贴 University 自身产品定位的一块，
而你给的理由（和 turing-pact 重叠）经逐节比对只对其中一篇成立
（`long-running-tasks` 确实与 `directing-ai-agents` 重复）。

---

## 3. 建议切成几门课

先说结论：**四门，加两处对第一门课的当场修补。**
另有两门作为第二批候选，它们要不要做是产品决定，不是覆盖决定。

### 先做的四门

#### 课 A · `debugging-and-environment`《跑不起来的时候，你在看什么》

| | |
| --- | --- |
| **面向谁** | 已经能让 AI 写出东西、但一出错就只会重开一遍的人 |
| **规模** | 5 单元 · 28 节 |
| **取自** | `debugging-art`、`debugging-art_index`、`ports-localhost`、`environment-path`、`package-managers`、`git-version-control`、`ssh-authentication`、`security-thinking`、`browser-as-os-rendering`（只取排错相关）、`command-line-shell`（前两节） |
| **单元** | ① 报错不是敌人（读懂一条报错 · 5 节）② 五个面板各回答什么问题（6 节）③ 端口、地址和跨域（5 节）④ 环境变量与密钥（5 节）⑤ 版本、锁文件与退回去（7 节） |

**和已有课的边界**：`foundations-quality` 讲「怎么知道没写错」（测试、类型、门禁），
这门讲「已经写错了，怎么找到它」。CURRICULUM 单元 2 那三节是入门，这门是它的下一级 ——
两者要在文案上互相指路，不是并列。

#### 课 B · `many-agents`《当 AI 不止一个：把活分出去，还收得回来》

| | |
| --- | --- |
| **面向谁** | 已经会用一个 AI 编程助手，开始想让它一次干更多的人 |
| **规模** | 5 单元 · 30 节 |
| **取自** | `agent-teams`(80KB)、`workflow`(25KB)、`ai-agents`(18KB)、`context-engineering`(21KB)、`skills`(39KB)、`mcp`(15KB) + `ai-protocols`(12KB)、`basics` 的 durable 部分、`long-running-tasks` 的根因一节 |
| **单元** | ① 它内部怎么转（工具调用、规划、记忆、循环 · 6 节）② 它看得见什么（上下文分层、缓存、中间迷失、压缩 · 6 节）③ 让它够得着外面（MCP、工具/资源/提示、密钥与锁版本 · 5 节）④ 把方法固化下来（Skills 的形状、什么时候写、怎么被触发 · 5 节）⑤ 不止一个的时候（拓扑、成本倍数、合同优先、粒度、文件冲突、先研究再实现 · 8 节） |

**和已有课的边界**：`directing-ai-agents` 讲**一个** agent 的授权、停止条件、读什么 ——
这门一律 import 不重写，单元 5 开头明确说「停止条件和四道闸在那门课，这里只讲多出来的部分」。
`ai-budget-and-cost` 讲记账，单元 2 讲少花，两处互相点名。

#### 课 C · `spec-before-code`《先写清楚，再让它写》

| | |
| --- | --- |
| **面向谁** | 第一门课单元 11 交接出来的人 —— 已经做出过东西，开始被返工折磨 |
| **规模** | 4 单元 · 20 节 |
| **取自** | `spec-coding`(35KB) 全部、`github-iterative-development`(44KB) 的工单化部分、`api-design` 的契约部分、`workflow` 的 ADR 部分 |
| **单元** | ① 什么时候该停下来写（4 节）② 一份规格有哪几层（行为 / 边界 / 验收 / 未解决 · 6 节）③ 两种句式和一种记录（EARS、Given-When-Then、ADR · 4 节）④ 让它照着做，改需求时先改哪里（纵向切片、验证关卡、生命周期三模式、五个误区 · 6 节） |

**和已有课的边界**：`ai-contracts-first` / `contracts-and-drift` 讲**代码里的**契约
（类型、层依赖、契约测试、冻结接口）；这门讲**写给人和 AI 看的**规格文档。
两门在「什么叫做完」这个点上会合，各自从一头讲。
CURRICULUM 单元 11 的 5 节保持不动，改成明确指向这门课。

#### 课 D · `ship-it`《交出去》

| | |
| --- | --- |
| **面向谁** | 东西做完了，卡在「怎么让别人真的装上」的人 |
| **规模** | 4 单元 · 22 节 |
| **取自** | `app-publishing`(19KB)、`choose-platform`(17KB)、`ci-cd`(30KB)、`pwa-local-app`(13KB)、`browser-ai-extension`(12KB)、`dns-https`(9KB)、`technology-selection`(6KB)、`cloud-server-deployment` 的决策图部分 |
| **单元** | ① 它该长在哪一端（三个问题、十条路线、四个误区 · 5 节）② 机器替你把关（构建产物、CI 门禁、推送前挡住什么 · 6 节）③ 域名、证书和那把锁（4 节）④ 交到商店手里（通用发布前检查、四个平台的差别、审核最常见的失败、不要全量发 · 7 节） |

**和已有课的边界**：CURRICULUM 单元 8 到「一个别人点得开的网址」为止；
这门从网址之后开始。`experiments-and-rollout` 讲变体怎么登记，
`solo-operations` 讲上线之后出事怎么办 —— 这门讲第一次把包交出去。

### 对第一门课的两处当场修补（不是新课）

1. **单元 2 加 1–2 节**：「还有一种没有界面的用法」—— CLI agent。
   取自 `stage-2_backend_modern-cli`，出处走 `docs.anthropic.com/en/docs/claude-code/*`。
   理由见 §2.7。
2. **单元 4 与单元 5 之间加 1 节**：「这三页应该长在哪儿」。
   取自 `choose-platform` 的前三个问题，答案对这门课的读者仍然是「网页」，
   但要让读者自己说出来。理由见 §2.8。

### 第二批候选（做不做是产品决定）

| 课 | 规模 | 取自 | 为什么是「候选」而不是「该做」 |
| --- | --- | --- | --- |
| `web-under-the-hood`《网页背后那台机器》 | 6 单元 · 34 节 | `power-on-to-web`、`computer-networks`、`html-css-layout`、`browser-as-os-rendering`、`frontend-engineering`、`web-performance`、`javascript-runtime`、`a11n-i18n` | 材料最厚、出处最扎实，但它是一门**前端基础课** —— University 要不要开这条线，是定位问题不是覆盖问题 |
| `data-and-who-can-see-it`《数据存在哪，谁看得见》 | 5 单元 · 26 节 | `database-fundamentals`、`auth-authorization`、`api-design`、`http-protocol`、`serialization`、`data-models`、`security-thinking`（如果没进课 A） | 同上；且它和 CURRICULUM 单元 7、`identity-and-accounts` 的边界需要先谈清楚才能开写 |
| `rag-and-retrieval`《让它先查再答》 | 4 单元 · 20 节 | `rag-introduction`(107KB)、`embedding-vector-retrieval`、`rag`、`ai-native-app-design`、两篇企业实战的产品设计部分 | 材料够、出处够（`docs.anthropic.com/embeddings` + `supabase` pgvector 已验证），但**受众要求已经会写后端**，比现有任何一门通用课都高 |

---

## 4. 出处可行性（逐条真实请求验证过）

`packages/core/src/domain/url-evidence-hosts.json` 里 29 个 `authorityHosts`，
匹配规则是后缀匹配（`hostMatches`：`pages.nist.gov` 命中 `nist.gov`）。
我按推荐清单挑了 68 个候选 URL 真实请求了一遍。

### 4.1 已验证可用 —— 这些课的出处不用担心

| 站 | 验证到的页 | 能撑住哪门课 |
| --- | --- | --- |
| `docs.anthropic.com` | claude-code/mcp · docs/mcp · sub-agents · agent-skills/overview · prompt-caching · context-windows · token-counting · tool-use · hooks · memory · settings · agent-sdk · embeddings · develop-tests | **课 B 全部**，课 C 的一部分 |
| `developer.chrome.com` | devtools/overview · extensions/get-started | 课 A 单元 2、课 D 单元 4 |
| `web.dev` | learn/pwa/service-workers · articles/vitals | 课 D、`web-under-the-hood` |
| `developer.apple.com` | app-store/review/guidelines · HIG/onboarding | 课 D 单元 4 |
| `developer.android.com` | studio/publish | 课 D 单元 4 |
| `docs.github.com` | actions/understanding-github-actions · issues/about-issues · pages | 课 C、课 D 单元 2 |
| `rfc-editor.org` | RFC 6749(OAuth2) · 7519(JWT) · 9110(HTTP) · 1035(DNS) · 8446(TLS) | `data-and-who-can-see-it`、课 D 单元 3 |
| `nist.gov` | pages.nist.gov/800-63-3/sp800-63b | 安全与口令那几节 |
| `postgresql.org` | indexes-intro · tutorial-transactions | `database-fundamentals` |
| `code.visualstudio.com` | api/get-started | VS Code 插件（若做） |
| `git-scm.com` · `nodejs.org` · `vite.dev` · `react.dev` · `typescriptlang.org` · `docs.python.org` · `www.w3.org` · `supabase.com` · `docs.stripe.com` · `vercel.com` · MDN | 全部验证通过 | 课 A、第二批各课 |

**关键结论：`docs.anthropic.com` 一家就足以支撑课 B 的全部 30 节。**
这是本次盘点里最重要的一个可行性发现 —— 也是为什么「Stage 3 出处难」这个直觉是错的。

### 4.2 活着但不在白名单 —— 要做就得先扩

| 站 | 状态 | 挡住了什么 | 我的建议 |
| --- | --- | --- | --- |
| `modelcontextprotocol.io` | 200 | MCP 规范本身 | **可以不加** —— `docs.anthropic.com/en/docs/mcp` 已足够；加它的收益只有「引规范原文」 |
| `docs.docker.com` · `kubernetes.io` · `redis.io` · `elastic.co` · `terraform`(hashicorp) | 均 200 | Docker / K8s / 缓存 / 搜索 / IaC | **不建议加**。加了以后要做的那几篇（§1.11）University 的读者用不上，等于为不做的课扩权限 |
| `go.dev` · `kotlinlang.org` · `flutter.dev` · `docs.expo.dev` · `electronjs.org` · `doc.qt.io` · `docs.godotengine.org` · `docs.soliditylang.org` · `developers.weixin.qq.com` | 均 200 | 各语言与各端 SDK | **不建议加**。这些是「绑死单一第三方产品」那条规矩要挡的东西，而不是出处不够 |
| `docs.npmjs.com` | 200 | 语义化版本、锁文件 | **建议加**，理由和当初加 `docs.github.com` 一样：它是包管理的事实标准文档，且课 A 单元 5 用得上 |
| `reactnative.dev` · `nginx.org` | 请求失败 | — | 一条验不了的出处比没有出处更糟（`ADOPTION-NOTE` 已就 `platform.openai.com` 立过这条规矩） |

### 4.3 找不到权威出处，因此做不了的选题

这一档要写清楚，因为它决定了「留到下一轮」这句话对哪些篇是假的。

| 选题 | 为什么建不起出处 |
| --- | --- |
| 晶体管 → 逻辑门 → 加法器 → CPU | 白名单里没有任何一个站讲数字电路 |
| 冯诺依曼架构、指令系统、缓存、流水线 | 同上 |
| 操作系统的进程 / 内存 / 文件系统 | 同上 |
| 编译原理（词法、语法、AST、优化） | 同上 |
| Linux 文件系统与权限模型 | 白名单里没有 Linux 官方站 |
| 分布式（CAP、一致性）、高可用、微服务拆分、系统设计四步法 | 权威来源本来就是书与论文，不是官方文档站 |
| 重构手法、设计模式 | 权威来源是 Fowler 与 GoF，同上 |
| 「按用户量分级的目录结构」（前端 / 后端两篇） | **没有任何权威站规定目录该怎么放** —— 这正是那条出处规矩要挡的：它是某个人的习惯，不是事实 |
| 15 种后端语言横向对比、客户端语言选型 | 需要 10 个以上语言官网同时进白名单，且它本来是词典不是课 |
| 消息队列、限流算法、搜索引擎倒排索引 | Kafka / RabbitMQ / Elasticsearch 都不在白名单 |
| 对象存储与 CDN（61KB） | 整篇建立在云厂商文档上 |
| 终端的网格系统、转义序列、cooked/raw、信号 | ECMA-48 不在白名单；这一篇只有前两节能做 |
| EARS 句式 | 没有白名单内的原始出处 —— **课 C 单元 3 要注意**：EARS 那一节要么改成讲 Given/When/Then（可引 RFC 风格的行为描述实践 + `docs.anthropic.com` 的验收标准写法），要么讲成「有一类固定句式」而不指名 EARS |
| 各种 Spec 工具（Spec Kit / OpenSpec / Kiro / Superpowers / Ralph） | 全部住在 `github.com`，而 `github.com` **被故意排除**（见 `ADOPTION-NOTE.md`）。课 C 必须讲方法不讲工具 |

---

## 5. 优先级：如果只能再做一门

**做课 A（`debugging-and-environment`）。**

我知道这不是最诱人的答案 —— 最诱人的是课 B，因为 Agent Teams 是这批材料里
最稀缺、最贴 University 定位、最没有替代品的一块（§2.2）。
但作为产品判断，我认为先做 A，有三个理由，第三个是决定性的：

1. **它的出处最扎实。** 课 A 的每一条都落在 MDN / `developer.chrome.com` /
   `git-scm.com` / `nodejs.org` / `vercel.com` / `docs.github.com` 上，
   §4.1 全部验证通过，没有一节需要扩白名单，也没有一节依赖某个会改版的产品。
   课 B 有 30 节压在 `docs.anthropic.com` 一家上 —— 那家没问题，
   但把一门课的全部可信度押在一个厂商的文档站上，是要先想清楚的事。

2. **它和现有 45 门课的重叠面积最小。** 逐节比对下来，
   课 A 唯一的接缝是 CURRICULUM 单元 2 那三节，而那三节本来就该是它的入口。
   课 B 要和 `directing-ai-agents`、`ai-budget-and-cost` 划两道边界，
   课 C 要和 `ai-contracts-first`、`contracts-and-drift` 划两道边界 ——
   划错了就是重复投资。

3. **第一门课会源源不断地生产出课 A 的读者，而现在它们无处可去。**
   一个跟着 CURRICULUM 走到单元 6「接 AI」的人，
   撞上端口被占、`.env` 没生效、`command not found` 的概率接近 100%，
   而全课给他的装备是三节。**一个卡住的读者不会去买第二门课。**
   Agent Teams 的那 80KB 三个月后还在硬盘上（原理不会过期，只有工具会）；
   一个在单元 6 放弃的读者不会回来。

**排期建议：A → B → C → D。**

**什么情况下 B 应该排到 A 前面**：如果你决定 University 的下一个定位动作是
「我们是唯一一门系统讲多 agent 的中文课」，并且愿意接受这门课
每半年要跟一次官方文档的改版 —— 那 B 先做是对的，
因为这个位置现在是空的，而它不会空太久。

---

## 6. 记一笔：这次盘点推翻的两个说法

- **「Stage 3 和 turing-pact 贴得很近，要先去重」** ——
  逐节比对后只对 `long-running-tasks` 一篇成立。
  `spec-coding` / `agent-teams` / `workflow` / `skills` 这四篇（179KB）
  与 turing-pact 的重叠面积接近于零。
- **「附录留到下一轮」** ——
  105 篇里约 45 篇因为找不到权威出处**永远做不了**，
  把它们记成「下一轮」，会让一份不会兑现的欠条一直挂在账上。
  正确的记法是：45 篇结案，25 篇排期，35 篇待定。
