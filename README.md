# University

在 3D 群岛里，用真实资料和动手练习学习 AI。面向没有编程经验的成人，Web 为主，
同一应用适配手机、平板和电脑；商业能力与真实收费验收分开。

一个仓库，一个浏览器应用，两个模式：

```
apps/university 产品本体。`--mode delivery` 是交付端（3D 世界地图、关卡、复习），
                `--mode authoring` 是创作端（读磁盘、剪贴板判分）。
                三条模式边界：AI 从哪来、课文从哪来、能否访问课程背后的源码。
apps/local      创作端背后的 Node 服务与 CLI。课是它写出来的，浏览器只负责显示。
packages/core   领域模型与学习规则：课程形状、地址、FSRS 调度、判分。
packages/ui     两个模式共用的学习面：阅读器、证据、复习、markdown、语言层。
packages/world  3D 场景：世界地图、课程岛、星球。packages/ui 里 three 为零。
```

**两个模式都不许拥有另一个也需要的东西。** 课程一致因此不是同步问题——只有一份
实现，也只有一个生产者。交付端并不禁止创作课程；当它创作时，跑的是同一套工作流。

## 现在处于什么阶段

已有实际学习产品，不是设计占位页：AI 基础星球有《认识 AI，从这里开始》与
《用 AI，把日常事情做好》两条中英文路线；已有“用 AI 做应用”路线继续保留。
来源可以是官方文档、公共记录、研究、真实图片和代码。课文、互动、复习卡与练习
使用同一套内容管线，原始事实、教学变式与真实运行记录分别说明。

在设置中选择 English / 简体中文；也可以给地址加 `?lang=en` 或 `?lang=zh-CN`。
新路线正文、互动、卡片、练习与引用说明有双语版本，旧应用课程仍保留原中文内容。
已发布目录以 `apps/university/published-catalog.json` 和生成清单为准；锁定材料
不是已经交付的课程。真实支付尚未开通，不能把会员页面当作真实交易成功的证明。

当前设计与实施入口：

- `docs/reference/player-journey/v5/` — 用户旅程 V5，当前有效的一版（承接并取代 V1–V4）
- `docs/specs/active/SPEC-0001-universitylocal-parity-contract.md` — 内容与功能的
  一致性契约
- `docs/plans/active/00-ai-literacy-commercial-release.md` — 双系列交付、验证和外部缺口

先设计再开发。用户能看见的行为，先在用户旅程里定稿，再落地。

## 快速开始

```bash
pnpm install
pnpm start
```

`pnpm start` 同时打开两个壳，并告诉你哪个是哪个：

| | 地址 | 用来做什么 |
| --- | --- | --- |
| **在线端** | http://localhost:9998 | 试用、提意见 —— 3D 世界、关卡、答题、复习 |
| **本地端** | http://localhost:9999 | 自己学习、写课 —— 文件系统、剪贴板判分 |

同一个 `apps/university`，两次 `vite --mode`。9999 那一次把 `/api` 代理到
`apps/local` 起在 4317 上的服务；9998 那一次读 `content/` 里已发布的包。

启动脚本按当前发布包准备在线内容；耗时取决于本机与输入状态。

想在真手机上看（这个产品是照手机设计的，桌面窗口拉窄不是一回事）：

```bash
pnpm start --lan
```

它会打印一个本机网络地址，手机连同一个 Wi-Fi 就能打开**在线端**。
本地端不上网络——它服务的是文件系统、真实仓库检出和一个会写盘的 API，
把那些放到网络上应该是一个明确的决定，不是一个默认值。真要的话：`--lan-local`。

改完代码之后：

```bash
pnpm verify
pnpm e2e
```

要给课程岛画面打分，先生成本地课程包，再运行独立的非阻塞量尺：

```bash
pnpm content
pnpm e2e:island-look
```

它只截 WebGL 画布，在桌面和 390×844 手机视口生成四组固定镜头，并把逐项结果写到
`SHOTS/island-look/metrics.json`。红色指标是现状记录，不会让默认 e2e 或 `pnpm verify`
失败；PNG 与报告目录已被忽略，不会进入提交。

生产发布按 `docs/reference/execution/publish-lane.md` 从干净提交构建，校验产物后
部署。推送 Git 不会自动发布，不能用本地预览或开发版本截图代替官网验收。

## 给 AI 协作者

入口是 `AGENTS.md`（`CLAUDE.md` 是它的符号链接）。不要从本文件开始工作。
