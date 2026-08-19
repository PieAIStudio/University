# Buzz 学习地图

写课程的人先读这一份，再动手。它不是目录，是**判断记录**：为什么教这些、为什么不教那些、
为什么是这个顺序。目录在第 5 节，但脱离前四节看目录，会写出一堆正确而没用的课。

地基已经建好并验证过（第 7 节）。第一批要写的 5 门课在第 6 节。

---

## 1. 三个判断，其中两个跟最初的要求不一样

### 1.1 「能教的都教」这条得改

Buzz 的实际体量（已数过，不是估的）：

| 部分 | 规模 |
| --- | --- |
| Rust 后端 | 27 个 crate，约 27 万行 |
| 桌面端 TS/TSX | 约 34 万行 |
| 移动端 Dart | 约 9.9 万行 |
| 仓库总计 | 3798 个受控文件 |

按本项目的课程规格（一门课 3 单元、11–13 节），把这些讲一遍是 **200 节课以上**，
按已有节奏是半年量级的工程。

但真正让「都教」不成立的不是量，是**它在动**。HEAD 是 `02f640bc`，提交时间 2026-08-07，
提交信息是 `feat(desktop): unify add agent flows (#5015)` —— 第 5015 号 PR。这个项目
每天都在改。本系统的证据钉在一个快照上，写得越久，后面的课引用的行号越可能已经不是那个东西了。
一次性下单 200 节课，等写完，前面写的已经在漂移。

所以改成**分批**：先写 5 门（第 6 节），跑完读一遍，确认口味对了再下一批。地图上的 14 门
一门不少（第 5 节），只是不一次性交出去。

### 1.2 Buzz 桌面端不是 Electron，是 Tauri

这个区别值得单独说，因为它直接影响你以后做自己 App 的选型。

- **Electron**：把一整个 Chrome 浏览器打包进你的 App。装机体积 100MB 起步，内存吃得多，
  但所有平台上跑的是同一个浏览器内核，行为完全一致。
- **Tauri**：用**系统自带的浏览器内核**（macOS 用 WebKit，Windows 用 Edge WebView2），
  自己只带一层 Rust 写的壳。体积一个数量级小，代价是不同系统上的浏览器内核不完全一样，
  偶尔要处理差异。

打个比方：Electron 是开餐厅时把整套厨房设备搬进去，租金贵但你确定每家店后厨一模一样；
Tauri 是租下已经带厨房的场地，便宜轻便，但每家店的灶台型号略有不同。

Buzz 选了 Tauri 2 + React 19（`desktop/src-tauri/`、`desktop/package.json`）。移动端
没有复用这套，而是用 Flutter 另写了一份（`mobile/lib/`，Dart）。**「一套代码上所有端」在这个
项目里并不成立** —— 这本身就是一节好课（第 5 节 C11）。

### 1.3 读不懂 Rust，后面一半的课是隔靴搔痒

Buzz 的核心价值全在 Rust 里：事件模型、relay、认证、工作流引擎、agent harness。
TuringPact 那边是 TypeScript/Capacitor/Electron，**Rust 对这位学习者是全新的**。

有三条路：先学一门 Rust（太远，也不是要求的）；只教 TS 部分（避开了核心，而「实现了我想做的
70%」那 70% 主要在后端）；或者——

**教「读」，不教「写」。** 这两件事的难度差一个数量级。会读一个 Rust 函数签名、认得
`Result`/`Option`/`?`/`match`/`async`/`Arc`，就能跟着逻辑走完一条链路；这大概是 12 节课的事，
而学会写 Rust 是几个月。

本项目已有先例：`foundations-reading-code` 就是一门只教读的课。所以这条是**顺着系统已有的设计**，
不是新发明。

---

## 2. Buzz 是什么（核实过的事实，可直接用作课程素材）

一句话：**一个自托管的团队工作区，人和 AI agent 在同一批房间里，底层是一条 Nostr 事件日志。**

拆开说，每条都在源码里有落点：

- **所有东西都是同一种事件。** 消息、表情回应、工作流步骤、代码审查通过、git 事件，全部是
  签了名的 Nostr 事件（NIP-01），六个字段：`id` / `pubkey` / `kind` / `tags` / `content` / `sig`。
- **`kind` 这个整数是唯一的分发开关。** 加一个功能 = 加一个 kind 号，老客户端看不见也不会坏。
  `crates/buzz-core/src/kind.rs` 里有 151 个 `pub const`。
- **relay 是唯一真相。** 没有 P2P，没有 gossip。客户端全部通过 WebSocket 连一个 relay，
  由它做认证、验签、落库、扇出、建索引、触发自动化。
- **agent 是成员，不是机器人。** agent 有自己的密钥对、自己的频道成员资格、自己的审计轨迹。
  跟人的区别只是「另一把钥匙」。
- **身份即密钥。** secp256k1 密钥对，人走 NIP-42 认证，agent 走 NIP-98。
- **访问控制只有一个闸门：频道成员资格。**

规模与成色的旁证，这些本身也是教材：

- `docs/nips/` 有 18 份自定义协议规范（NIP-AE、NIP-PMA、NIP-MP……）—— 这个项目扩展协议时
  是**先写规范再写代码**的。
- `docs/spec/` 里有 `MultiTenantRelay.tla`（TLA+）和 `MultiTenantAuth.spthy`（Tamarin）——
  **用形式化方法证明**多租户隔离和授权，不是嘴上说说。开源项目里这非常罕见。
- 根目录有 `.agents/skills`、`.claude/skills`、`.codex/skills`、`.goose/skills` ——
  他们自己也在用 agent skills 干活，跟本项目是同一套路子，可以直接对照着教。

### 2.1 关于设计：那套「专业感」是配方，不是天赋

这是这次勘察里最值钱的发现，也直接回答「他这个设计师还挺专业吧」这个问题。

**配色不是调出来的，是选的。** `desktop/src/shared/styles/globals/theme.css` 第 3 行和第 69 行
的注释直说了：浅色主题是 **Catppuccin Latte**，深色是 **Catppuccin Macchiato**，强调色都是
mauve。Catppuccin 是一套开源社区色板，拿来直接系统化套用的。

整套配方是：

| 层 | 用的什么 | 解决什么 |
| --- | --- | --- |
| 色板 | Catppuccin（Latte / Macchiato） | 不用自己调色也好看，且深浅两套天然配对 |
| 语义 token | CSS 变量 `--background` / `--primary` … | 组件里不写具体颜色，换主题不用改组件 |
| 无障碍基元 | Radix UI | 弹窗、下拉、焦点管理这些坑不自己踩 |
| 样式 | Tailwind v4 | 尺寸、间距、字号成体系 |
| 图标 | lucide-react | 一整套风格统一的图标 |

**对你的意义：这是可复制的。** 你不需要成为配色专家，你需要选对一套已经被验证的系统然后一致地用。
这件事比「学会审美」现实得多，也是 C9/C10 两门课存在的理由。

而且它不只是抄配方 —— `desktop/tailwind.config.js` 里留了真实的设计推理，比如第 22 行那段
关于阴影的注释，大意是：Tailwind 自带的阴影都往 y 轴偏，打在朝左的边上几乎看不见，所以为左侧
面板单独定义了一个 `panel-left`。**这种「为什么这么做」的注释，是 `决策` 变体课的天然素材。**

还有 `desktop/public/harness-logos/CREDITS.md`：逐个记录了每个第三方 logo 的来源、commit、
许可证、改了什么。这是创始人真会用到的技能 —— 怎么合法地用别人的商标。

---

## 3. 学习者是谁

- 编程初学者，已经（或即将）读完 TuringPact 那边 9 门 `foundations-*`：TypeScript、React、
  异步、数据、产品、质量、读代码。
- **没写过 Rust。没接触过 Nostr。** 这两样是真空。
- 单人创始人。Buzz 实现了他想做的 App 的约 70%，所以他要的不只是「看懂」，是**看懂到能改**。
- 已经在用了 —— 装好了、建了频道、拉了好几个 agent 进去协作。所以**不要从「怎么安装」开始讲**。
- 明确说了很欣赏它的 UI 设计和 agent/harness 设计，想从中学产品设计。

三个目标，课程地图要同时服务：

1. **用得顺**（当下）
2. **看懂到能改**（那 70%，以及自己补的 30%）
3. **学它的设计品味**（明确要求）

---

## 4. 语气分层：两条独立的规则，别混成一条

这条是被专门问到的，所以写精确一点。`write-lesson` 技能里其实是**两个不同的机制**：

### 规则 A：按课程层级调温（跨课程）

- `foundations-*` 课程：读者可能从没写过代码，**全套扶手**。
- 其余课程：读者已经读完 foundations。**少铺垫，术语直接用**，篇幅花在这门课真正新的东西上。

理由不是风格偏好：同一种写法对新手有效，对已经懂的人**有害** —— 过度解释会拖慢已经建立理解的读者。

### 规则 B：扶手要递减（同一单元内）

- 单元的**前 1/3**：新词第一次出现给白话解释；`## 答案` 可以先复述情境再回答；`## 自检` 可以带提示。
- 单元的**后 1/3**：本单元已解释过的词直接用；`## 答案` 一句话收；`## 自检` 不给提示。
- **同一个词在同一单元里不解释第二次。** 第二次解释等于告诉读者「我不指望你记住」。

### 这两条在 Buzz 课程里怎么落

规则 A 是按课程 id 前缀 `foundations-` 判断的。Buzz 的课程 id 都是 `buzz-*`，**不会自动命中**。
所以要显式指定：

- **`buzz-orientation` 和 `buzz-reading-rust` 按 foundations 层级写（全套扶手）。**
  理由：Rust 和 Nostr 对这位读者是全新的，TuringPact 的基础在这里不迁移。
- **其余所有 Buzz 课程按普通层级写。** 读者此时已经读完前两门，Nostr 事件、kind、
  签名这些词直接用，不再重讲。

规则 B 在每一门课的每一个单元里都生效，没有例外。

---

## 5. 课程地图（14 门，分 5 批）

顺序原则：**不按架构分层，按能看懂的顺序。** 照着 `ARCHITECTURE.md` 从 `buzz-core` 往上讲是
参考手册的顺序，不是学习的顺序 —— 那等于让初学者从最抽象的类型定义开始。

这里的主轴是**跟着一条消息走**：你敲下回车之后，它经过了什么，最后怎么出现在别人屏幕上。
这条线串起客户端、签名、WebSocket、relay 的 12 步流水线、Postgres、Redis、扇出。其他所有课都挂在这条线上。

| 批次 | 课程 id | 讲什么 | 层级 |
| --- | --- | --- | --- |
| **1** | `buzz-orientation` | 你屏幕上这套东西背后是什么 | foundations |
| **1** | `buzz-reading-rust` | 读懂 Rust（只读不写） | foundations |
| **1** | `buzz-one-message` | 一条消息的一生（主干） | 普通 |
| **1** | `buzz-agents-as-members` | agent 是成员不是机器人 | 普通 |
| **1** | `buzz-design-tokens` | 那套好看的配色是怎么来的 | 普通 |
| 2 | `buzz-identity-is-a-key` | 身份就是一把钥匙，丢了会怎样 | 普通 |
| 2 | `buzz-kind-as-switch` | 一个整数决定一切 | 普通 |
| 2 | `buzz-component-recipe` | Radix + shadcn + Tailwind 这个配方 | 普通 |
| 3 | `buzz-workflows` | 用 YAML 写自动化 | 普通 |
| 3 | `buzz-one-app-many-platforms` | 一套东西怎么上四个平台（Tauri≠Electron） | 普通 |
| 3 | `buzz-git-as-events` | 代码托管也是事件 | 普通 |
| 4 | `buzz-selfhosting` | 自己跑起来并运维 | 普通 |
| 4 | `buzz-extending` | 给它加一个你自己的功能 | 普通 |
| 5 | `buzz-proving-isolation` | 用数学证明隔离（TLA+ / Tamarin） | 普通 |

第 1 批这 5 门是**能独立成立的一段弧**：搞清楚它是什么 → 学会读它 → 跟完一条主干 →
拿下最关心的两块（agent 和设计）。读完这 5 门，人已经能自己在这个仓库里找路了。

---

## 6. 第一批：5 门课的逐单元设计

下面给的是**方向和素材落点**，不是逐节稿。具体每节的标题、变体、行号，由写课的人读源码后决定 ——
行号写在这份文件里只会过期，而且会诱导照抄不核对。

每门课 3 个单元；每单元 4 节课上下（全课 11–13 节）。

### C1 `buzz-orientation` —— 你屏幕上这套东西背后是什么（foundations 层级）

读者已经在用了，所以不讲安装，讲「你每天看到的这些，底下是什么」。

- **U1 一个 URL 就是一个工作区** —— community / relay / URL 三者的关系；七个界面
  （Home / Stream / Forum / DM / Agents / Workflows / Search）分别是什么模型。
  素材：`README.md`、`VISION.md` 的 Surfaces 表。
- **U2 你发的不是消息，是一条签了名的事件** —— 六个字段；为什么每条都要签名；
  `kind` 是唯一的开关。素材：`ARCHITECTURE.md` 第 2 节、`crates/buzz-core/src/event.rs`。
- **U3 谁能看见什么** —— 频道成员资格是唯一闸门；开放/私密/DM/访客四种；
  为什么「全局订阅收不到私密频道的事件」是刻意的安全边界。
  素材：`VISION.md` Access 表、`ARCHITECTURE.md` 第 4 节关于 fan-out 排除全局订阅那段。

### C2 `buzz-reading-rust` —— 读懂 Rust（foundations 层级）

**全部例子必须来自 Buzz 源码，一个玩具例子都不要有。** 这样它同时是 Rust 课和 Buzz 课。

- **U1 一个结构体和它的方法** —— `crates/buzz-core/src/event.rs` 全文只有 74 行，
  包含结构体、`Option<T>`、`impl`、公私字段之分，以及一个精彩的测试：
  被篡改的事件 `verify_id()` 通过但 `verify_signature()` 失败。这是天然的 `现象` 开场。
- **U2 Rust 怎么处理「可能失败」** —— `Result` / `Option` / `?`。
  素材：`crates/buzz-core/src/error.rs`（20 行）、`verification.rs`（71 行）。
- **U3 读懂 relay 的函数签名** —— `async` / `Arc` / 借用符号 `&`。
  目标很具体：读完这单元，能看懂 `crates/buzz-relay/src/handlers/event.rs` 里一个处理函数的
  签名在说什么。素材：`crates/buzz-core/src/filter.rs`（300 行）、relay 里的处理函数。

### C3 `buzz-one-message` —— 一条消息的一生（主干课）

**这门课以 `溯源` 变体为主**（一站一站往回走，每站一个 `[[evidence:]]`）。
`ARCHITECTURE.md` 第 221–244 行给出了 12 步流水线，每一步都能落到真实代码。

- **U1 从你按下回车到一条签好名的事件** —— 桌面端构造事件、用私钥签名、通过 WebSocket 发出。
- **U2 relay 收到之后的 12 步** —— 认证 → 验签 → 成员资格 → 落库 → 发布 → 扇出 →
  索引 → 审计 → 触发工作流。重点讲**为什么后三步是「发射后不管」的**，以及为什么
  `OK` 是在整条流水线走完后才回给客户端，而不是落库就回。
  素材：`ARCHITECTURE.md` 第 4 节、`crates/buzz-relay/src/handlers/event.rs`、`ingest.rs`。
- **U3 怎么回到别人的屏幕上** —— 订阅注册表、三级扇出、Redis 在多机时的角色；
  以及临时事件（正在输入、在线状态）为什么走一条完全不同的短路径、根本不落库。
  素材：`crates/buzz-relay/src/subscription.rs`、`ARCHITECTURE.md` 第 5 节。

### C4 `buzz-agents-as-members` —— agent 是成员，不是机器人

这是最想学的一块。核心不是「怎么配 agent」，是**它凭什么能跟人平权**。

- **U1 平权靠的是什么** —— agent 有自己的密钥对、自己的频道成员资格、自己的审计轨迹；
  跟人的唯一区别是认证走 NIP-98 而不是 NIP-42。为什么这比「权限开关」更干净。
- **U2 一次 @提及 怎么变成一次 agent 调用** —— ACP 谐波：relay 上的提及 → 排队 → 拉起 agent 进程
  → JSON-RPC 往返 → 结果作为事件发回频道。素材：`crates/buzz-acp/src/`（`relay.rs`、`queue.rs`、`pool.rs`）。
- **U3 一个壳装下所有宿主** —— goose / codex / claude-code 命令行参数各不相同，
  它怎么统一成一个接口。素材：`crates/buzz-acp/src/config.rs` 里的
  `default_agent_args` 匹配表（约 694–700 行）、`desktop/public/harness-logos/`。
  顺带对照本项目自己的做法。

### C5 `buzz-design-tokens` —— 那套好看的配色是怎么来的

明确点名想学设计，所以第一批就放一门。**不要写成设计理论课**，全部落到这个仓库里的具体代码。

- **U1 好看不是天赋，是选对了色板** —— Catppuccin Latte / Macchiato；
  为什么选一套现成的社区色板胜过自己调；深浅两套怎么天然配对。
  素材：`desktop/src/shared/styles/globals/theme.css` 开头两段（第 2–3 行、第 68–69 行）。
- **U2 为什么组件里不写颜色** —— 语义 token（`--background`、`--primary`、
  `--sidebar-*`）；换主题不用改一行组件代码；`--buzz-*` 那些专用 token 为什么单独存在。
  这是 `决策` 变体的好题目。
- **U3 那些不起眼的地方** —— 字号阶梯为什么用 rem 而不是 px（缩放时能跟着变）；
  为什么专门定义了一个 `nsec-key` 字号（私钥要显示得足够大好抄）；
  为什么要自己写一个 `panel-left` 阴影。素材：`desktop/tailwind.config.js`
  第 10–35 行那几段注释 —— 那里写着**真实的设计推理**，是这门课最值钱的部分。

---

## 7. 地基（已建好并验证）

不用再建，直接用。以下都是实跑出来的，不是抄的。

```
studyId       buzz
snapshotId    git-02f640bc4559
sourceCommit  02f640bc4559c48ac0c2ec595ef34dd2c294b0db
sourceRoot    /Users/yuanfei/PieAI/_donors/buzz
```

快照里 `excludedPaths` / `submodulePaths` / `lfsPaths` **全为空** —— 整棵树的任何文件、
任何行都可以直接引用作证据，没有盲区。

已经用一份最小提案跑通了 `course create --dry-run`，结果 `"outcome": "validated"`。
所以证据格式、课程形状、快照解析这三样都被证明可用。那份探针提案的证据块长这样：

```json
{
  "kind": "fact",
  "snapshotId": "git-02f640bc4559",
  "sourceCommit": "02f640bc4559c48ac0c2ec595ef34dd2c294b0db",
  "sourcePath": "crates/buzz-core/src/event.rs",
  "lineStart": 11,
  "lineEnd": 19,
  "note": "StoredEvent 结构体：三个 pub 字段加一个私有的 verified。"
}
```

对应正文里的锚点写作 `[[evidence:crates/buzz-core/src/event.rs:11-19]]`，
路径是**被学项目的仓库根相对路径**，不带 `_donors/buzz/` 前缀。

---

## 8. 从提案到能读的课，只有两步（实测过）

**第 1 步 —— 先干跑校验**

```bash
pnpm university course create --study buzz --input course-proposals/<课程id>.json --dry-run
```

要看到 `"outcome": "validated"`。这只说明**证据能解析、结构合法**，不说明课写得好。

**第 2 步 —— 去掉 `--dry-run`，落地**

```bash
pnpm university course create --study buzz --input course-proposals/<课程id>.json
```

**落地即 `active`，立刻出现在网页端，可以直接学。不需要再激活。**

> 这里有个陷阱，是实跑才发现的：`--dry-run` 的输出里写着 `"courseStatus": "draft"`，
> 会让人以为还要再跑一次 `course reactivate`。**不用。** 干跑说 draft 是因为它压根没往磁盘写东西；
> 真正 apply 之后状态直接是 `active`。已用探针课全程验证：建课 → 网页端 YOUR STUDIES
> 立刻出现「Buzz · 1 门课可学习」。
>
> `course reactivate` 是给**改过之后重新发布**用的，不是新建课的必经步骤。

**只在第一门课做一次 —— 设为该 study 的默认课**

`buzz` 这个 study 的 `defaultCourseId` 初始是 `null`：

```bash
pnpm university course set-default --study buzz --course buzz-orientation
```

**整体体检：**

```bash
pnpm lint:lessons
```

教学形状由它把关；泄题和废话机器查不出来，得人读。

---

## 9. 已知风险

- **证据会漂移。** Buzz 每天都在改（PR 已到 #5015）。快照钉死在 `02f640bc`，
  所以课程内容永远对得上；但快照和上游的差距会越来越大。哪天要跟进，用 `refresh-study`
  工作流，不要手改快照。
- **Rust 深度的度不好把握。** C2 的目标是**读**，不是写。如果写课的人开始讲所有权、
  生命周期标注、trait 泛型，说明跑偏了 —— 判据是：这一节教的东西，是不是读懂 Buzz 某段真实代码
  所必需的？不是就删。
- **设计课容易写飘。** C5 每一节都必须落到这个仓库里的真实文件和真实注释。
  一旦开始讲通用设计理论（对比度、留白、格式塔），就偏了。
- **移动端（Flutter/Dart，9.9 万行）这一批完全没覆盖。** 是有意的：它是第二套实现，
  不是理解 Buzz 的必经之路。等前面几批读完再判断值不值得。
