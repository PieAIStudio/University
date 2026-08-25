# University

3D 游戏化的 AI 学习产品。Web 为主，移动端与桌面端出壳，面向付费学习者。

一个仓库，一个浏览器应用，两个模式：

```
apps/university 产品本体。`--mode delivery` 是交付端（3D 世界地图、关卡、复习），
                `--mode authoring` 是创作端（读磁盘、剪贴板判分）。
                两者的差别只有 src/ports/ 里的两条：AI 从哪来、课文从哪来。
apps/local      创作端背后的 Node 服务与 CLI。课是它写出来的，浏览器只负责显示。
packages/core   领域模型与学习规则：课程形状、地址、FSRS 调度、判分。
packages/ui     两个模式共用的学习面：阅读器、证据、复习、markdown、语言层。
packages/world  3D 场景：世界地图、课程岛、星球。packages/ui 里 three 为零。
```

**两个模式都不许拥有另一个也需要的东西。** 课程一致因此不是同步问题——只有一份
实现，也只有一个生产者。交付端并不禁止创作课程；当它创作时，跑的是同一套工作流。

## 现在处于什么阶段

设计阶段。仓库里还没有产品实现，只有：

- `docs/reference/player-journey/v4/` — 用户旅程 V4，当前有效的一版（取代 V1/V2/V3）
- `docs/specs/active/SPEC-0001-universitylocal-parity-contract.md` — 内容与功能的
  一致性契约
- 一个 DOM 占位页，用来让 `pnpm verify` 从第一天起就是真的门禁

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

第一次启动会先把课程内容导进在线端，约一分钟，只发生一次。

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
```

## 给 AI 协作者

入口是 `AGENTS.md`（`CLAUDE.md` 是它的符号链接）。不要从本文件开始工作。
