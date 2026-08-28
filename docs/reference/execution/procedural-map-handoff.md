---
id: REF-PROCEDURAL-MAP-HANDOFF
title: Procedural Map Handoff
type: reference
status: active
canonical: true
owner: human
created: 2026-08-28
last_reviewed: 2026-08-28
domain: execution
tags:
  - current-work
  - 3d
pinned: false
---

# 程序化地图：交接

给接手这条主线的 session 读。**先读完这一页再动任何代码。**

目标只有一个：三层程序化地图做到**能商用**——作者写完课，课程岛、群岛节点、
行星页的岛群全部自己生成，不需要逐座岛手工调，而且在核显笔记本上跑得动。

## 一、你的角色（老板明确要求的）

你是**总指导 / 审美裁判 / 产品经理**，不是执行者。

- **从全局、从审美、从商业角度思考。** 不要陷进「改一个常数、截一张图、
  再改一个常数」的循环。老板反复说过这一点，因为这个循环烧掉过很多额度。
- **大量并行使用子代理。** 你的时间花在写 brief、看图、下判断上，
  不是花在敲代码上。最多同时 4 个，别把机器跑死。
- **看图再下结论。** 指标绿了不等于画面对。这一轮里有一个 agent 的
  FPS 数字很漂亮，画面是一堵黑绿色的墙。
- **主动汇报。** 发现值得说的事就说，老板会做裁决。

### 子代理命令（原样抄，不要「升级」模型名）

```bash
codex exec -m gpt-5.6-luna -c 'model_reasoning_effort="max"' --dangerously-bypass-approvals-and-sandbox "<任务>"
```

```bash
agy -p "<任务>" --model gemini-3.7-flash-high --effort high --dangerously-skip-permissions
```

- Codex 用 **luna**，不要用 sol。CLI 把 sol 排在第一位并标成「最新旗舰」，
  那是 CLI 的排序，不是老板的选择。换成 sol 导致过额度问题。
- 模型名以 `claude-` 开头时，`agy` 不加 `--effort`。
- **Grok CLI 目前 402，余额耗尽**（2026-08-28 实测），别派。
- gpt 和 gemini 都能自己调自己的图片生成模型出图。Gemini 能听声音。
- 每个 worktree 要先接内容再开工，否则 dev server 404：
  ```bash
  ln -s ../../University/apps/university/content apps/university/content
  # 每个 apps/local/studies/<id> 也从主 checkout symlink 过来
  ```
  **绝对不要**为了修 404 去跑 `pnpm content`——见下面「坑」。

## 二、架构写在哪里，以及为什么你跑不掉

这是这一页最重要的一节。老板问过「handoff 会让下一个 session 按这个走吗？
还是他自己会乱来？」答案是：**光靠这份文档拦不住，靠的是下面四样东西。**

| 东西 | 管什么 | 怎么拦你 |
| --- | --- | --- |
| [ADR-0009](../../adr/ADR-0009-the-procedural-map-is-one-pipeline.md) | 数据从哪来、能花多少预算 | `island-pipeline.test.ts` 会红 |
| [ADR-0008](../../adr/ADR-0008-one-locked-technique-per-island-element.md) | 每个元素用什么技术画 | `island-technique-lock.test.ts` 会红 |
| `AGENTS.md` 路由表 | 强制你动渲染器之前先读上面两份 | 路由检查 |
| commit message | 每个数字为什么是这个数字 | `git log` |

**ADR-0008 的绊线今天真的响了一次。** 草的重写合进来时，
`island-technique-lock.test.ts` 卡在钉死的 45 三角形上，直到 ADR 补了修订
和新测量才放行。这不是理论，是当天发生的事。

所以规则很简单：**锁只能带着测量改。** 你想改草的技术，先量，
再改 ADR，再改代码。只改代码会红。

### 四段管线，一句话一段（ADR-0009 的正文更详细）

1. **蓝图** —— 世界是什么。纯数据，从课程内容推导。
2. **场** —— 唯一真相。一张编译好的栅格，草 / 装饰 / 地表颜色**都读它**。
3. **三个投影** —— 预算按**屏幕像素**分配，不按世界尺寸分配。
   课程近景值得花三角形；世界地图上一座岛只有约 40px，只配拿到剪影、
   一次明暗断裂、一个亮点；行星页读的是身份和位置。
4. **风格表** —— 不懂代码的人唯一要碰的文件。**这一段最没做完**，
   `IslandStyle` 存在，但颜色还在往渲染器文件里漏。

第 2 段是有代价换来的：地表颜色场和草密度场的相关系数量出来是 **r = 0.31**，
在 7,949 个岛内采样点上。三分之一的岛面积在自相矛盾。这就是「乱」的来源，
不是审美问题。

## 三、现在的真实状态（2026-08-28 深夜）

main 干净，`pnpm verify` 全绿，已 push。
**八条分支已经合并，13 个 worktree 收到 1 个**（只剩等发包的 liquid）。

已经落地的：

- **一份场**。`island-field.ts` 把蓝图编译成 192x192 栅格，
  route / meadow / shore / rock 通道加烘焙 AO，草和装饰都读它。
- **一片草 = 一个三角形**。45 三角形的五叶簇换成三顶点卡片，
  taper、风、朝向相机的 Y 旋转、地形法线替换全在顶点着色器里。
  约 72 万三角降到约 8 万。密度 80,000 桌面 / 24,000 移动。
- **低机位**。68 度 / 36 单位，锁旋转，76 单位缩放上限。
- **行星页重做**。选课点升到 R=1.22 漂浮在大气层里，有光柱和地面投影环。
  这是老板明确要的，不要推翻。
- **IBL**。真正的环境探针。
- **有颜色的暗部**。主光比从 18:1 降到 2.08:1，暖棕色下半球反弹，
  课程画面暗像素减半。见下面第四节第 1 条。
- **行星页的学域身份**。五个学域各有确定性色相和轮廓 profile，
  星球陆地降饱和、云改暖象牙、边缘加大气雾。
- **贴图 spike**。三平面贴图的独立 demo，**故意留在产品管线外面**，
  等近景美术那一轮再决定接不接。

### 三条**没有**合并的分支，已经打成 tag，不要去 merge

```
abandoned/island-underside      569 行机械底盘。测量否决：那东西在世界投影里只有 8px 高。
abandoned/island-meadow         Grok 的地表颗粒实验。被 island-field 取代。
raw/island-card-vegetation      donor 卡片树，612 行。不是被否，是排错了序——
                                它的性能数字是在 45 三角草下量的，那个预算图景已经没了。
                                ADR-0008 说树在草之后，草已经落地了，可以重新量。
```

## 四、三个视觉问题：一个已修，两个还开着（都实机看过，不是猜的）

**顺序不能反，这一点已经被验证过一次。** 第 1 件是全画面问题，
它没修完之前根本没法判断第 2 件——现在它修完了，第 2 件才轮到。

### 1. 暗部压死成纯黑 —— **已修，2026-08-28 已合并**

曾经是 `keyIntensity: 9.0` 对补光 0.5，主光比 **18:1**，
课程画面 **23.88%** 的像素低于 0.08 亮度。现在是：

| 参数 | 之前 | 现在 |
| --- | ---: | ---: |
| `WORLD_SUN.keyIntensity` | 9.0 | **5.2** |
| `WORLD_SUN.hemisphereIntensity` | 0.3 | **1.3** |
| `WORLD_SUN.ambientIntensity` | 0.1 | **0.4** |
| `WORLD_ENVIRONMENT.intensity` | 0.1 | **0.8** |
| `WORLD_SUN.hemisphereGround` | `0x7f8b8e` 冷灰 | **`0x8a5b45` 暖棕** |

含环境光的总光比 **2.08:1**，不含 PMREM 的直接灯光比 **3.06:1**。
课程画面暗像素 **23.88% → 11.83%**，高光带基本没动（p95 0.740 → 0.704）。
阴影、相机、草都没改。完整测量在
[Island Look Contract](./island-look-contract.md) 第八节。

**这一条的教训写进合同了**：原合同只写了「光比应该 3:1 以上」，没写上限，
于是有人把 key 从 2.1 加到 9.0，冲过头到 18:1。现在阈值是**区间**：
总光比 2:1 到 4:1，暗像素占比不超过 15%。

### 2. 草在课程机位下读成噪点，不是草

叶片在这个距离接近亚像素，亮顶读成白色椒盐。等第 1 件修完再调，
因为现在的「噪点感」有多少是草、有多少是黑白对比过强，分不出来。

调的方向是叶片的**宽高比、颜色 ramp、以及 LOD 的密度衰减曲线**，
不是回头加密度——预算省下来是故意留着的，ADR-0008 写了。

### 2b. 群岛层：每座岛长得一模一样（还没派人做）

我亲自看过 `/turing-pact` 的实机画面。ADR-0009 那条「剪影 + 一次明暗断裂 +
一个亮点」是**做到了**的——绿色顶面、深色底盘、一个亮点，DOM 标签也清晰可读。

问题在别处：**十几座岛是同一个绿色疙瘩**，学习者没法从画面上把「那座岛」和
「那门课」对上。这和行星页第二轮在修的是**同一个问题**，所以修法必须共用同一套
色相来源，不要各修各的——那正好是 ADR-0009 存在的理由。

**行星层已经落地了**（2026-08-28 合并）：五个学域现在有确定性的色相和轮廓
profile —— general `#7C64B3`、Buzz `#7D9A62`、SupaLuv `#5C9B99`、
TuringPact `#D49A62`、UniversityLocal `#A77768`，形状 profile 是
wide / compact / elongated / faceted / tall，数据在
`packages/world/src/planet/planet-copy.ts`。

群岛层要做的就是**复用这一份**，不要发明第二套配色。这正是 ADR-0009 存在的理由。

另外顺手记一个观察，还没确认是不是缺陷：**群岛页首帧特别慢**，
dev 模式下大约 30 秒才画出来，课程岛只要 6 秒。无头 Chromium 里 30 秒都出不来。
这是付费用户看到的第二块屏幕，值得量一下生产构建下的真实首帧时间再判断。

## 五、还开着的分支

| worktree | 分支 | 干什么 |
| --- | --- | --- |
| `University-wt-liquid` | `work/liquid-in-app` | XP 球液态合并动画。依赖已指向 `@pieai/swimmer-ui-kit@1.9.0`，**等那个版本真的发到 npm 才能合**。合之前**要亲眼看动画跑一遍**——两个剪影融合是整件事的重点，静帧截图看不出来 |

判它们的时候：**先看图，再看 diff**。截图不要提交到仓库根目录，
根目录已经 `.gitignore` 掉 `/*.png` 了——上一轮有 47 张截图和 15MB 躺在根目录。

## 六、当前的阻塞（不是你造成的，也不该你在下游修）

**doc-gov 的 symlink 在 CI 里悬空，24 个受管项目的 `docs:check` 全红。**

`docs/policy/shared-rules/*.md` 是指向仓库外 `../../../../ProjectGovernanceSystem/`
的 symlink。开发机上有兄弟目录所以本地全绿；CI 只 checkout 这一个仓库，
symlink 全悬空，`doc-gov router-check` 把它判成「路径不存在」。

- University `docs-check` run 33181050210 红
- SwimmerUIKit `npm-publish` run 33180853394 红，**所以 v1.9.0 没发出去**

**不要把 symlink 改回真文件。** 老板已经定了 symlink 是最终投递方式，
这是 doc-gov 的判定问题，修在 PGS 那边。完整报告在
`scratchpad/BUG-doc-gov-symlink-ci.md`。PGS 修好之后重跑
`gh workflow run npm-publish.yml --ref main`，版本号和 CHANGELOG 都已就位。

## 七、已经拍板的产品决定，不要重开

- **课程机位低、近**，MOBA 那个角度，头像在画面中心偏上、面朝下。「一切为了视觉效果」。
- **行星页的选课点漂浮在大气层里**，不是贴在星球表面上。
- **三张参考图**（`docs/reference/island-art-reference/target-island-*.png`）
  只学**配色、明度层次、尺度层次**。它们的 3D 预算是我们的十倍以上，
  构图也太全局——我们已经定了要更近更低。**不要照抄。**
- **可读文字是 DOM，不是几何体。** 这是 web3d 基线第 7 条，portfolio 级规则。
- **donor 全部已授权**（含 elemental-serenity 的媒体资源）。
  但「有授权」不等于「该用」——草仍然是我们自己生成的，
  理由写在 ADR-0008 里，别把它当矛盾去「修」。

## 八、坑（都真的踩过）

- **在没有 `apps/local/studies/*` 的 worktree 里跑 `pnpm content` 会静默污染
  `imported.json`**，每门课的 `servedBytes` 缩水，退出码 0，`pnpm verify` 照样绿。
  已经在 `apps/university/scripts/import-courses.mjs` 里加了防缩水断言，
  但别去试探它。缺内容就 symlink，不要重建。
- **playwright 的 `page.screenshot` 会卡在 "waiting for fonts to load"。**
  用 CDP `Page.captureScreenshot`。而且 `goto` 之后要等 16 秒画布才挂上，
  6 秒会拍到 loading 卡片。
- **机器负载高的时候有几个测试会假红**，特别是
  `island-blueprint.test.ts` 和 `kenney-r01-assets.test.ts`。
  单独重跑一遍再下结论。
- **worktree 和主 checkout 是两个目录。** 你在 worktree 里改的东西，
  老板在 VS Code 里看不到，直到 merge。**汇报时永远说清楚在哪条分支、合了没有。**
- **`island-look-contract.md` 的门槛是在旧草、旧机位、旧光照下定的。**
  第一轮结构改造之后需要重新校准，别把它的红项直接当回归读。
