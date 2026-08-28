---
id: REF-PROCEDURAL-MAP-HANDOFF
title: Procedural Map Handoff
type: reference
status: active
canonical: true
owner: human
created: 2026-08-28
last_reviewed: 2026-08-29
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

现在还多了一条并行主线：**SwimmerUIKit 的液体动效语言**（第九节）。

---

## 零、交接那一刻先做这三件事

**这份文档交接时，有 5 个子代理正在后台跑。** 它们不属于你的 session，
你接手时它们可能已经结束、可能还在跑、也可能被杀掉了。

1. **先查还有谁活着：**
   ```bash
   for p in $(pgrep -f "codex exec"); do lsof -a -p $p -d cwd 2>/dev/null | tail -1 | awk '{print $NF}'; done | sort -u
   ```
2. **再查每个 worktree 交了什么：**
   ```bash
   cd /Users/yuanfei/PieAI/University
   for w in grass2 foliage mapconfig liquid; do
     printf "%-10s " $w
     echo "commits:$(git -C ../University-wt-$w log --oneline main..HEAD 2>/dev/null|wc -l) dirty:$(git -C ../University-wt-$w status --porcelain 2>/dev/null|wc -l)"
   done
   git -C ../SwimmerUIKit-wt-move log --oneline main..HEAD | wc -l
   ```
3. **第五节有每个代理的任务和验收标准。** 已经交了的按那里的标准判；
   还在跑的就等；被杀掉的按那里的 brief 重发。

---

## 一、你的角色

你是**总指导 / 审美裁判 / 产品经理**，不是执行者。

- **从全局、从审美、从商业角度思考。** 不要陷进「改一个常数、截一张图、
  再改一个常数」的循环。老板反复说过这一点，因为这个循环烧掉过很多额度。
- **大量并行使用子代理。** 你的时间花在写 brief、看图、下判断上。
  实测同时 5 个 codex 没问题。
- **看图再下结论。** 指标绿了不等于画面对。这条今天又被验证了一次，
  代价是一整轮返工，见第三节。
- **主动汇报，能自己裁决就裁决。** 老板明确授权：能定的自己定，最后告诉他。

### 子代理命令（原样抄，不要「升级」模型名）

```bash
codex exec -m gpt-5.6-luna -c 'model_reasoning_effort="max"' --dangerously-bypass-approvals-and-sandbox "<任务>"
```

```bash
agy -p "<任务>" --model gemini-3.7-flash-high --effort high --dangerously-skip-permissions --print-timeout 90m
```

- Codex 用 **luna**，不要用 sol。CLI 把 sol 排在第一位并标成「最新旗舰」，
  那是 CLI 的排序，不是老板的选择。
- 模型名以 `claude-` 开头时，`agy` 不加 `--effort`。
- **`agy` 的 `--print-timeout` 默认只有 5 分钟**，长任务必开 `90m`。
  2026-08-28 有两次 Antigravity「timeout」失败就是这个原因，
  当时误判成模型能力问题，其实是超时默认值。
- **Grok CLI 402，余额耗尽**（2026-08-28 实测），别派。
- 每个 worktree 要先接内容再开工，否则 dev server 404：
  ```bash
  ln -s ../../University/apps/university/content apps/university/content
  ```
  **绝对不要**为了修 404 去跑 `pnpm content`——见第十节「坑」。

### ⚠️ 派视觉任务时必须加 `-i`（2026-08-29 学到的，代价是一整轮返工）

```bash
codex exec -m gpt-5.6-luna -c 'model_reasoning_effort="max"' \
  --dangerously-bypass-approvals-and-sandbox \
  -i /path/to/目标参照图.jpg \
  -i /path/to/改造前.png \
  -i /path/to/上一版失败的.png \
  "<任务>"
```

**背景：** 8/29 派了一个草的美术任务，只给了数字指标。代理老老实实达标了
每一条，画面却更难看。查它 2.6MB 的日志，`view_image` 调用次数是 **0**——
**它从头到尾没看过自己改出来的图**，只是在浏览器里逐像素算数字。

这不是智力问题，是**它没有眼睛**。给视觉任务只给阈值，就像隔着墙让人调音响、
只告诉他「低音要够」——他能做的只有把旋钮拧到底。

**规则：任何涉及「好不好看」的任务，必须用 `-i` 附上参照图，
并在 brief 里明确要求代理每次截完图都用 `view_image` 自己看一遍。**

---

## 二、两条流程铁律（今天用真金白银换来的）

### 铁律 1：所有视觉阈值必须是**区间**，不能只写下限或只写上限

**同一个错误已经犯了两次。**

- 8/28 灯光：`island-look-contract.md` 只写了「光比应该 3:1 以上」。
  有人照做，把 key 从 2.1 一路加到 9.0，冲到 **18:1**，
  把 23.88% 的画面像素压成纯黑。花了一整轮修回来。
- 8/29 草：我给的指标是「裸地 20% **以上**」「噪点至少降 35%」。
  代理做到 36.3% 和 72%，每条都过——**整座岛从绿岛变成了米黄色沙丘**，
  低多边形切面裸露，塑料感比改造前更强。

**一条只有下限的规则，就是下一次过头的邀请函。**

现在 `island-look-contract.md` 里已经写死了这条元规则。
你新增任何视觉阈值时，上下都要卡住。

### 铁律 2：数字是护栏，参照图才是目标

数字只能**防退化**，产生不了好看。派美术任务的正确形状是：

1. `-i` 附上**目标参照图**（donor 成品图）、**改造前**、**上一版失败的**
2. 要求代理**先用文字描述三张图的差别**，再动代码（强制视觉锚定）
3. 要求它一次交**三个候选**（保守 / 居中 / 大胆），沿同一条轴变化，
   同机位同尺寸同 seed 各截一张——你挑一个。
   一个来回解决问题，而不是「调一版→你看→打回→再等 40 分钟」
4. 区间只用来拦明显退化；**如果某个候选好看但越界，让它说出来，你判断**
5. 最后一句永远加上：**「交之前自己先看一眼图。数字都达标但你觉得难看，
   以你的眼睛为准，把情况写进报告。」**

---

## 三、架构写在哪里，以及为什么你跑不掉

老板问过「handoff 会让下一个 session 按这个走吗？还是他自己会乱来？」
答案是：**光靠这份文档拦不住，靠的是下面四样东西。**

| 东西 | 管什么 | 怎么拦你 |
| --- | --- | --- |
| [ADR-0009](../../adr/ADR-0009-the-procedural-map-is-one-pipeline.md) | 数据从哪来、能花多少预算 | `island-pipeline.test.ts` 会红 |
| [ADR-0008](../../adr/ADR-0008-one-locked-technique-per-island-element.md) | 每个元素用什么技术画 | `island-technique-lock.test.ts` 会红 |
| `AGENTS.md` 路由表 | 强制你动渲染器之前先读上面两份 | 路由检查 |
| commit message | 每个数字为什么是这个数字 | `git log` |

**ADR-0008 的绊线真的响过一次。** 草的重写合进来时，
`island-technique-lock.test.ts` 卡在钉死的 45 三角形上，直到 ADR 补了修订
和新测量才放行。这不是理论。

规则：**锁只能带着测量改。** 想改草的技术，先量，再改 ADR，再改代码。

### 四段管线，一句话一段

1. **蓝图** —— 世界是什么。纯数据，从课程内容推导。
2. **场** —— 唯一真相。一张编译好的 192×192 栅格，
   草 / 装饰 / 地表颜色**都读它**。
3. **三个投影** —— 预算按**屏幕像素**分配，不按世界尺寸分配。
   课程近景值得花三角形；世界地图上一座岛只有约 40px，只配拿到剪影、
   一次明暗断裂、一个亮点；行星页读的是身份和位置。
4. **风格表** —— 不懂代码的人唯一要碰的文件。**这一段最没做完**，
   `IslandStyle` 存在，但颜色还在往渲染器文件里漏。

第 2 段是有代价换来的：地表颜色场和草密度场的相关系数量出来是 **r = 0.31**，
在 7,949 个岛内采样点上。三分之一的岛面积在自相矛盾。这就是「乱」的来源。

---

## 四、已经落地的东西（不要推翻）

main 在 `76070b3`，`pnpm verify` 全绿。**main 当前有未提交的改动
（`package.json` / `pnpm-lock.yaml` / `pnpm-workspace.yaml`，PGS 升到 0.9.9），
那是老板另一个 codex 会话的在途工作，不要替它提交，也不要 revert。**

- **一份场**。`island-field.ts` 把蓝图编译成 192×192 栅格，
  route / meadow / shore / rock 通道加烘焙 AO。
- **一片草 = 一个三角形**。45 三角形的五叶簇换成三顶点卡片，
  taper、风、朝向相机的 Y 旋转、地形法线替换全在顶点着色器里。
- **低机位**。68 度 / 36 单位，锁旋转，76 单位缩放上限。
- **行星页重做**。选课点升到 R=1.22 漂浮在大气层里，有光柱和地面投影环。
  老板明确要的，不要推翻。
- **IBL**。真正的环境探针。
- **有颜色的暗部**。主光比从 18:1 降到 **2.08:1**，暖棕色下半球反弹
  （`hemisphereGround: 0x8a5b45`），课程画面暗像素 23.88% → 11.83%。
  完整测量在 [Island Look Contract](./island-look-contract.md) 第八节。
- **行星页的学域身份**。五个学域各有确定性色相和轮廓 profile：
  general `#7C64B3`、Buzz `#7D9A62`、SupaLuv `#5C9B99`、
  TuringPact `#D49A62`、UniversityLocal `#A77768`；
  形状 profile 是 wide / compact / elongated / faceted / tall。
  数据在 `packages/world/src/planet/planet-copy.ts`。

### 三条**没有**合并的分支，已经打成 tag，不要去 merge

```
abandoned/island-underside      569 行机械底盘。测量否决：世界投影里只有 8px 高。
abandoned/island-meadow         Grok 的地表颗粒实验。被 island-field 取代。
raw/island-card-vegetation      donor 卡片树，612 行。不是被否，是排错了序——
                                性能数字是在 45 三角草下量的，预算图景已经变了。
```

---

## 五、正在跑的五个代理（交接时的状态）

任务 brief 全文在
`/private/tmp/claude-501/-Users-yuanfei-PieAI-University/91850ce5-9000-4af4-82d2-911f5fc73729/scratchpad/task-*.md`
（scratchpad 是 session 级的，可能已经没了；下面写了每个的核心要求，够你重发）。

### 1. `University-wt-grass2` / `work/grass2` —— 草的美术

**已有提交 `6a77137`（第一版，过头了，不要 revert，在它上面改）。**

第一版把 80,000 实例降到 17,640，裸地做到 36.3%，梯度能量降 72%——
**每个指标都达标，画面塌了**（见铁律 1）。

第二版正在跑，带 `-i` 三张参照图，要三个候选。验收：

| 指标 | 区间 |
| --- | --- |
| 岛面裸地像素占比 | 20% – 30% |
| 相邻像素梯度能量下降幅度 | 35% – 60% |
| 岛面绿色占比（HSL 色相 70–160、饱和 ≥0.15） | ≥ 改造前的 78% |
| 桌面端草实例数 | 24,000 – 30,000 |
| 画布暗像素占比（亮度 <0.08） | ≤ 13% |
| 帧内三角形总数 | 不高于改造前 |

**比数字更重要的结构要求**：裸地必须**有意义**——长在路线沿线、近岸坡脚、
陡坡、岩石露头周围，用 `island-blueprint.ts` / `island-field.ts` 里已有的
route mask 和坡度。**不是「草长得稀」，是「这里本来就不长草」**（看 donor 图）。

参照图：
- 目标：`/Users/yuanfei/PieAI/_donors/elemental-serenity/elemental_serenity.jpg`
- 改造前：`/tmp/grass2-before-course-near-1440x900.png`
- 失败的：`/tmp/grass2-after-course-near-1440x900.png`

### 2. `University-wt-foliage` / `work/foliage` —— 把 Kenney 方块树换成 donor 植被

课程岛的树现在是 Kenney Nature Kit 的 `tree_default` / `tree_detailed` /
`tree_pineDefaultB`，灌木是 `plant_bushDetailed`。几何感太强，和画意风格的草、
地形、天光互相打架。

**已定的规则：自然元素（树、灌木）走 donor 画意路线，Kenney 只留给建筑**
（fantasy-town 那套墙 / 屋顶 / 摊位 / 灯，donor 没有对应物，也不打架）。

donor 的技术在
`_donors/elemental-serenity/src/Game/World/Managers/BushManager/BushManager.class.js`
和 `src/Shaders/Materials/bush/*.glsl`：`MeshSurfaceSampler` 在发射器网格
（`bushEmitter.glb`）表面采样，每点放一张叶片卡片，颜色由 shadow / mid /
highlight **三段色**按法线插值算出来——这就是那种「画出来的」质感的来源。
容易漏的一点：它给 InstancedMesh 配了 `customDepthMaterial`，
否则 alpha 剪裁的叶片会投出方块影子。

已合法引入并登记在 `packages/world/src/island/elemental-serenity-assets.json`
的模型：`treeTrunks.glb`、`leaf.glb`、`bushEmitter.glb`、`rocks.glb`、
`grass_blade.glb`、`bridge.glb`、`camp.glb`、`tent.glb`。
**叶片 alpha 贴图 `leave_alpha_map_256x256.png` 还没登记**，
要用就走同样的登记流程（sha256 / bytes / provenance / registeredOn），
不许偷偷引用 donor 目录。能用着色器程序化生成叶形遮罩就更好。

验收：课程视角和世界视角各要前后对比图，两个视角的三角形数和 draw call
前后对比。**世界视角一座岛约 40px，只需要剪影，绝不能在那里跑叶片实例。**

### 3. `University-wt-mapconfig` / `work/mapconfig` —— 程序化地图配置台

老板不是 3D 工程师，他现在不知道哪棵树是哪个包里的、草怎么分布、
参数在哪个文件的哪个常量里，所以没法和我们精确沟通。

做一个 authoring 模式下的路由（走 `#/studio` 那条已有的作者工作台分支，
建议 `#/studio/map`），三个 tab：**行星 · 群岛 · 课程岛**。每个 tab：
左侧是这一层的实时画面（**必须复用 `packages/world` 里真跑的组件**，
不许为这个页面复制简化版场景），右侧是检视面板。

面板要逐个资源列出：资源名、来自哪个包、**具体文件路径**、字节数、
单模型三角形数、这一层当前画了多少实例、用的哪条技术锁。

**这个页面最重要的功能不是滑块，是「每一行参数都显示它的出处」**
（哪个文件、哪个导出常量），加上一个「复制修改说明」按钮，输出形如：

```
packages/world/src/island/island-grass.ts
  ISLAND_GRASS_LIMITS.course.desktop: 80000 -> 24000
```

老板可以直接把这段贴给 AI 说「照这个改」。

三条硬性数据规则：
1. **面板里每个数都必须从真跑的模块 import 进来算，不许抄字面量。**
   要有测试钉住这一点。
2. 在 `packages/world/src/inspector/` 下为每层导出
   `describePlanetLayer()` / `describeWorldLayer()` / `describeIslandLayer()`，
   UI 只负责渲染这份描述。
3. **`packages/ui` 必须保持 zero `three` 依赖**（AGENTS.md 规则）。

交互分三类，界面上要**明确区分**：可实时调（数值）、可替换模型（下拉框列出
`island-asset-registry.ts` 里所有已登记资源）、只读（技术锁——标注「要改这个
必须先修订 ADR-0008」）。**诚实比功能多重要。**

控件层用 `leva`（2026 年 R3F 生态的既成方案），不要自己造滑块。
表格用 SwimmerUIKit 的组件和令牌（brand-kit-first）。

### 4. `University-wt-liquid` / `work/liquid-in-app` —— XP 球 + 修 LiquidGroup 误用

见第九节。

### 5. `SwimmerUIKit-wt-move` / `work/liquid-move` —— 吸收 donor 的 Move 效果

见第九节。

---

## 六、还开着的视觉问题

### 群岛层：每座岛长得一模一样（**还没派人做，优先级最高的未开工项**）

实机看过 `/turing-pact`。ADR-0009 那条「剪影 + 一次明暗断裂 + 一个亮点」
是**做到了**的，DOM 标签也清晰可读。

问题在别处：**十几座岛是同一个绿色疙瘩**，学习者没法把「那座岛」和「那门课」
对上。行星层已经解决了同一个问题（第四节的五个色相 + 五种轮廓 profile）。

**群岛层要做的就是复用 `planet-copy.ts` 那一份，不要发明第二套配色。**
这正是 ADR-0009 存在的理由。

### 群岛页首帧慢（还没量，不确定是不是缺陷）

dev 模式下约 30 秒才画出来，课程岛只要 6 秒。无头 Chromium 里 30 秒都出不来。
**这是付费用户看到的第二块屏幕**，值得量一下生产构建下的真实首帧时间。

---

## 七、商业上的停止线（老板认可的判断）

这张地图对生意的作用只有三条，验收标准就钉在这三条上：

1. **学习者一眼看得出地形的形状和自己的路线** —— 这是功能，不达标就是 bug
2. **截图发给朋友不丢人** —— 这是营销门槛，也是判断「够了」的那条线
3. **手机上 60fps**

**达到这三条就停手。** 剩下的美术等有真实用户反馈了再调——
现在再往下抠，是在没有用户数据的情况下猜他们喜欢什么。

还有一条排序原则：**草和树不能分开评判。** 各分支各自判断「好不好看」，
但学习者看到的是它们叠在一起的样子。所以**合并完必须有一次整体调和**，
那一轮总指导自己看图定夺，不外包。单项的完美在合并后往往是错的。

---

## 八、当前的阻塞

**doc-gov 的 symlink 在 CI 里悬空。** `docs/policy/shared-rules/*.md` 是指向
仓库外 `../../../../ProjectGovernanceSystem/` 的 symlink。开发机上有兄弟目录
所以本地全绿；CI 只 checkout 这一个仓库，symlink 全悬空，
`doc-gov router-check` 判成「路径不存在」。

后果：**SwimmerUIKit v1.9.0 没发到 npm**（npm 上还是 1.8.1），
所以 `work/liquid-in-app` 合不了。

**不要把 symlink 改回真文件。** 老板已经定了 symlink 是最终投递方式，
这是 doc-gov 的判定问题，修在 PGS 那边。**老板那边的 codex 会话正在修**
（已经推到 0.9.9，SwimmerUIKit 也有 `ca6b67a chore: restore SSOT shared-rule
symlink delivery`）。

PGS 修好之后：
```bash
gh workflow run npm-publish.yml --ref main
```
版本号和 CHANGELOG 都已就位。发出去之后把
`apps/university/package.json` 的依赖确认成 `1.9.0`，`pnpm install`，
再合 `work/liquid-in-app`。

---

## 九、SwimmerUIKit 的液体动效语言（并行主线）

### 已经查实的事：融合是对的，用法是错的

老板反馈「融合以后中间还看得见一条边框弧线」。做了对照实验：
在 Storybook 的 `Clay/Effects/LiquidGroup` → `MergingPieces` 里，
把子元素自己的边框用 JS 去掉，剪影**立刻变成一个完美的融合体，
中间有正确的颈部，没有任何内部接缝**。

**滤镜没问题。两处用法错了，而且是同一个错误犯两次：**

1. `src/stories/LiquidGroup.stories.tsx` 的演示元素是 `<button>`，
   CSS 没清掉浏览器默认的 `border: 2px outset`。而且这个 story
   **根本没给 `<LiquidGroup>` 传 `stroke`**——之前以为「看到的外轮廓是组件画的」，
   其实那也是按钮自己的边框。**这个示例从头到尾演示的都是错误用法。**
2. `apps/university/src/app/XpOrbAnimator.tsx` 给 `LiquidGroup.Item`
   刷了 `background`。`.game-ui-liquid-item` 就是内容层本身，
   加背景会在融合剪影上盖一个硬边圆片。

组件早就在开发模式下报警了，控制台有
`LiquidGroup.Item children should not have their own border, outline, or box-shadow.`
——**警告是对的，但靠人看警告防不住错误**，写组件的人自己写的示例也踩了。

### API 事实（决定了设计怎么做）

`LiquidGroup`：`fill` / `stroke` / `shadow` / `blur` / `contrast` / `motion`。
`LiquidGroup.Item`：只有几何——`x` `y` `scale` `radius` `transition` `delay`。

**颜色属于整个组，不属于单个 item。** 一团融合的液体是一种物质、一个颜色。
所以 XP 球**不可能**和头像不同色。已定的设计：融合成同一材质同一颜色，
「这是奖励」不靠球的颜色表达；优先尝试吸收那一刻整个 group 的 `fill`
朝强调色短暂偏移约 300ms 再回落，**做不干净就不做**，退回到
「融合动作本身就是反馈」。**绝不允许为这个效果 fork 或魔改 SwimmerUIKit。**

### donor 与吸收政策（已改）

donor `liquid-gooey`（Jakub Antalik，MIT，npm 上是 0.2.1），
检出在 `/Users/yuanfei/PieAI/_donors-individual/for_SwimmerUIKit/packages/liquid-gooey/`，
pinned commit `3862ffa345217443b63696a8c331a0664eea4b04`。
公开演示 https://gooey.jakubantalik.com/ 。
项目级发现入口是 SwimmerUIKit 根目录的 `donors-individual.md`。

它有四套东西：**Morph**（已吸收）、**Move**（正在吸收）、
**Bend**、**dissolve / imageMelt**（排队）。

**三条已定的判断：**

1. **不能当 npm 依赖用。** 它是一个人维护的 0.x 包。SwimmerUIKit 底下站着
   24 个项目，品牌套件的职责是「稳定的地板」，地板不能架在 pre-1.0 上。
   而且我们这份实现多了 donor 没有的三样：设计令牌、进程级动画/滤镜面积预算、
   空闲自动休眠的共享时钟——换成依赖等于丢掉这些再包一层。
2. **不能一次全量吸收。** 整包 4,182 行，`observer.ts` 一个文件 2,223 行。
   没在用的代码 = 没在测的代码。**为一把螺丝刀买下整个工具箱，
   从今天起要负责整箱不生锈。**
3. **按需求分批吸源码，一次一个效果。** 许可证是 MIT，
   `docs/policy/shared-rules/donors.md` 明说「怎么用、用哪一部分、抄多少，
   由每个项目自己决定」，发版只需在第三方声明保留版权行。
   **所以不需要净室重写**——物理数学就是物理数学，重写只会引入 bug。
   拿代码 + 保留 MIT 归属 + 接进我们的架构（令牌 / 预算 / 休眠时钟）。

**每吸收一批，`donors-individual.md` 的 adoption boundary、`NOTICE`、
`donors-individual-lock.json` 必须同步更新。** 那里现在还白纸黑字写着
「deliberately did not take Move」，不改它，下一个会话读到的就是过期的决定。

### 吸收顺序和落点（已定）

| 吸收什么 | 落在哪个组件 | 顺序 |
| --- | --- | --- |
| **Move**（橡皮拖尾） | `GameSegmentedControl` tab 指示器、`GameProgress` | **进行中** |
| **Morph 形变**（`shape:true`） | `GameDialog` 从按钮展开、`GamePanelSystem` 展开、输入框聚焦 | 第二 |
| **dissolve / imageMelt** | `GameAvatar` 换头像、`GameCardFan`、课程完成时刻 | 第三，先评估 |
| **Bend**（随速度弓身） | `GameCardFan` 拖拽 | 最后 |

### 动效语义（这是「风格」的定义，照做）

老板的原话是「把各个能加动画的地方都加，就形成了自己的风格」。
**方向对，但「加满」会杀死风格**，已经和老板对齐过：

> 一个人如果每句话都用感叹号，那就等于没有感叹号。

而且有硬约束：滤镜有性能预算（同时 2 组动画、滤镜面积上限 48 万像素）。
满屏液体会打爆预算，引擎会**悄悄把动画降级成硬切**——那看起来不是克制，是坏了。

**风格 = 一套词汇，每个动作永远只表达同一个意思：**

| 动作 | 语义 |
| --- | --- |
| **合并** Morph | 两个东西变成一个：奖励结算、收纳、确认 |
| **跟随** Move | 选中、进度、拖拽 |
| **熔解** Dissolve | 替换、转场 |
| **静止** | **默认** |

第四条是硬规则：**液体只在「用户自己造成的状态变化」时出现。**
环境性的、闲置的、纯装饰的液体动画一律不加。
这样学习者看见液体流动，**就知道刚才有件事发生了**——
这才是风格，不是到处都有，而是每次出现都有确切含义。

### ⚠️ SwimmerUIKit 主仓库工作区被占用

老板另一个 codex 会话正在 `/Users/yuanfei/PieAI/SwimmerUIKit` 改 CI 和
AGENTS.md。**不要往主 worktree 派写任务**，开 worktree
（`SwimmerUIKit-wt-*`）。两个会话同时写一个工作区，丢的是没提交的那份。

---

## 十、已经拍板的产品决定，不要重开

- **课程机位低、近**，MOBA 那个角度，头像在画面中心偏上、面朝下。
- **行星页的选课点漂浮在大气层里**，不是贴在星球表面上。
- **三张参考图**（`docs/reference/island-art-reference/target-island-*.png`）
  只学**配色、明度层次、尺度层次**。它们的 3D 预算是我们的十倍以上。**不要照抄。**
- **可读文字是 DOM，不是几何体。** web3d 基线第 7 条，portfolio 级规则。
- **donor 全部已授权**（含 elemental-serenity 的媒体资源）。
  但「有授权」不等于「该用」——草仍然是我们自己生成的，理由在 ADR-0008，
  别把它当矛盾去「修」。
- **自然元素用 donor，建筑元素用 Kenney。**

---

## 十一、坑（都真的踩过）

- **在没有 `apps/local/studies/*` 的 worktree 里跑 `pnpm content` 会静默污染
  `imported.json`**，每门课的 `servedBytes` 缩水，退出码 0，`pnpm verify` 照样绿。
  已经加了防缩水断言，但别去试探。缺内容就 symlink。
- **Playwright 的 `page.screenshot()` 会卡在 "waiting for fonts to load"。**
  必须用 CDP：
  ```js
  const cdp = await page.context().newCDPSession(page);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path, Buffer.from(data, 'base64'));
  ```
  而且 `goto(url, { waitUntil: 'domcontentloaded' })` 之后要等 **20–35 秒**
  R3F 画布才画出真内容，等太短只会截到 loading 卡片。
- **截图不要放仓库。** 根目录已 `.gitignore` 掉 `/*.png`——
  上一轮有 47 张截图和 15MB 躺在根目录。放 `/tmp`。
- **机器负载高时有几个测试会假红**，特别是 `island-blueprint.test.ts`
  和 `kenney-r01-assets.test.ts`。单独重跑一遍再下结论。
- **worktree 和主 checkout 是两个目录。** 你在 worktree 里改的东西，
  老板在 VS Code 里看不到，直到 merge。**汇报时永远说清楚在哪条分支、合了没有。**
- **合并 worktree 时注意 merge base 漂移。** main 在你派活期间可能被
  老板的 codex 会话推进（PGS 版本升级就是这样）。
  `git diff main..HEAD` 看到的「降级」可能只是分支 base 旧，不是代理干的。
- **`island-look-contract.md` 的部分门槛是在旧草、旧机位、旧光照下定的。**
  结构改造之后需要重新校准，别把它的红项直接当回归读。
