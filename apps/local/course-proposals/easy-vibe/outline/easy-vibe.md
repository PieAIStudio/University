# easy-vibe 的结构

> 只有章节标题和顺序，没有正文。正文在 `source/`，那是原料，已经 gitignore。
> 抓取提交 `130e9b75b28b524e8cc74e615fd9733a4e2b330d`，中文正文 195 篇。

## 它的四段

```
Stage 1  新手入门与产品原型   stage-1/          8 篇正文 + 8 篇附录
Stage 2  初中级开发           stage-2/          16 篇 + 8 份作业 PRD
Stage 3  高级开发             stage-3/          30 篇
附录     知识体系             appendix/         104 篇，9 个领域
```

## Stage 1（本次纳入的主体）

| 原章 | 大小 |
| --- | --- |
| 如何学习本课程 | 34 KB |
| AI 时代的编程初体验（贪吃蛇） | 47 KB |
| 如何判断一个好点子 | 49 KB |
| AI 编程工具介绍与使用 | 70 KB |
| 从截图复刻：第一次模仿练习 | 14 KB |
| 构建可交互的产品原型 | 27 KB |
| 为原型接入 AI 能力 | 26 KB |
| 完整项目实战：从想法到作品 | 16 KB |

附录（都在主线之外）：产品思维基础 146 KB、双钻设计模型 25 KB、
Jobs to Be Done 22 KB、The Mom Test 23 KB、创意灵感从哪里来 7 KB、
常见问题与排错 7 KB、行业场景 49 KB、消费场景 44 KB。

## Stage 2（本次纳入其中的「上线脊柱」）

前端：Lovart 素材、Figma/MasterGo、UI 设计、多端 UI、LLM 输出美化、
哈利波特画像、设计转代码、现代组件库。

后端：**Supabase 数据库 133 KB**、云服务器部署 51 KB、现代 CLI 52 KB、
**Stripe 支付 32 KB**、Zeabur/Vercel 一键部署 26 KB、**Git 工作流 16 KB**、
AI 辅助写接口 11 KB。

AI 能力：Dify 知识库 81 KB。

作业：8 份完整 PRD（文案平台、Dify Agent 平台、考务系统、落地页、
电影推荐、微服务、交通可视化、旅行规划）。

## Stage 3（本次不纳入，见下）

核心技能：Claude Code 上手、工作流、技能清单、超能力、移动开发、
**Spec Coding 36 KB**、Claude Agent SDK、**Agent Teams 82 KB**、
**MCP 15 KB**、**长任务/Ralph 30 KB**、**GitHub Issues 驱动开发 45 KB**。

AI 进阶：RAG 入门 110 KB、LangGraph、LlamaIndex。

跨平台：微信小程序、Android、iOS、Flutter、React Native、Electron、
PWA、VS Code 插件、浏览器插件、Godot、Qt、NFT、上架流程、选型。

个人品牌：个人网站与博客 53 KB。

## 附录（本次不纳入）

9 个领域 104 篇：计算机基础、开发工具、浏览器与前端、服务端与后端、
数据、架构与系统设计、基础设施与运维、人工智能、工程卓越。
其中 `ai-capability-dictionary.md` 一篇 442 KB。

---

# 三条纳入判断

## 判断一：这门课是通用课，不是实战学习

它有 `examples/`，四个能跑的小 demo（3D 方块游戏、方块游戏、看板、截图 demo），
按技能第 2 问，「背后有可运行的仓库」的答案看起来是「有」。

**但那个问题问的不是这个。** 实战学习的出处是 commit + 文件 + 行号，
指向**学习者要读懂的那份真实代码**。easy-vibe 的四个 demo 是教学插图，
不是被研究的系统；把它们做成 study，还会让 CC BY-NC-SA 的代码进到
我们的证据链里。

所以：**通用课**，出处指向 MDN / 官方文档，课程卡、关卡卡、课文页三处都标。

## 判断二：顺序要动，而且动的是「好东西被埋在附录里」

原课主线是：怎么学 → 体验贪吃蛇 → 找点子 → 装 AI IDE → 复刻 → 做原型 →
接 AI → 完整实战。**这个顺序是对的**，先让人看见能跑，再让人动脑子，
这一点我照搬。

真正要动的是另一件事：

> **它最硬的三样东西——双钻模型、Jobs to Be Done、The Mom Test——
> 都在附录里，加起来 70 KB，主线一句话带过。**

附录是「读者自己会去翻」的赌注，而初学者不会翻。这三样恰恰是
「怎么判断一个点子值不值得做」的全部答案，也正好是 University
四十门课里**一门都没讲过**的东西。

所以：**把三个附录提到主线，各拆成独立小节，每节配一个针对读者自己那个点子的练习。**
这是这次纳入里最值钱的一个动作。

同理，「常见问题与排错」那 7 KB 讲的截图—Console—Network 三步排错法，
是初学者每天都要用的东西，也被放在附录。提上来。

## 判断三：这次只做「从念头到上线」，Stage 3 和附录留到下一轮

三个理由，第三个是决定性的：

1. **规模。** 4.5 MB 一次吃不下，硬吃会得到一门每节都薄的课。
2. **重复。** University 已有 40 门课，turing-pact 那 20 门覆盖了
   「已经在写代码、要指挥 AI」那一段——契约、评测、成本、QA、上线、
   身份、留存。Stage 3 的 Spec Coding / Agent Teams / 长任务
   和它们贴得很近，要先做去重，不能直接开写。
3. **缺口在别处。** University 现在有《AI 到底是什么》（零基础认知），
   也有 turing-pact（已在代码里）。**中间那一级是空的**：
   「我知道 AI 是什么，我没写过代码，我怎么把一个念头做成别人能打开的东西。」
   easy-vibe 的 Stage 1 + 产品思维附录 + Stage 2 的上线脊柱，
   正好就是这一级。

Stage 3 的六篇（Spec Coding、MCP、Agent Teams、长任务、
GitHub Issues 驱动、Claude Code 上手）值得单独做一门，
但要先和 `turing-pact/directing-ai-agents`、`ai-contracts-first` 做去重。
记在这里，不在这一轮做。

## 隐去的东西

- **具体工具的安装步骤**：Trae/Cursor/Antigravity 的界面按钮位置。
  这类内容三个月就过期，而且它是 University 最不该承担的维护负担。
  改成讲**这类工具共有的三样东西**（补全 / 对话 / 代理），
  换了工具还成立。
- **Dify、Lovart、MasterGo、哈利波特画像**：都绑死在单一第三方产品上。
- **19 个 B 端 + 16 个 C 端行业场景**：是灵感清单，不是课。
- **`ai-capability-dictionary.md`（442 KB）**：是词典，不是课文。
