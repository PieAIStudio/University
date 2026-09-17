# 互动课件：配哪个，放哪儿

本页其余部分描述原有独立玩法。Owner 明确选择互动主线实验时，使用一个
`interaction-path` 编排短回合，不把每个回合计成一份大组件，也不要求第二次
练习必须教另一个知识点。重复同一能力但改变条件可以有意义；仅换一种点法却
重复同一句结论不算新学习。实验的精确载荷、来源、双语与独立练习边界见
[shared activity contract](../../../../../packages/ui/src/learning-play/README.md)。

十三种玩法的实现、载荷字段和引擎规则在
[shared activity contract](../../../../../packages/ui/src/learning-play/README.md)。
这一页只回答写课时的两个问题：**这节课配哪一种、放在哪一步。**

决定在**挑变体的同一步**做，不是课文写完之后再想。写完再配，配出来的一定是
"给这段话找个游戏"，而不是"这件事本来就该动手才懂"。

## V2: choose the learning action first

V2 uses one `interaction-path` as the continuous host, with `pedagogyVersion: 2`.
Its small decisions, material inspection, assembly/repair and exhaustive state
experiments can span several teaching responsibilities. Those steps are not new
large game engines, nor does every responsibility require an extra interaction.

The native 13 activities below remain available for tasks that actually fit their
models. Claude's short and arcade prototypes are research entries in the catalogue,
not additional valid `ActivityKind` values. Extract a typed reusable mechanism only
when a real lesson needs it; do not drop executable prototype HTML into course JSON.

Repetition is judged by learning: a changed condition or less help may be useful
practice, while a different hand gesture may still repeat the same trivial answer.
There is no automatic “second game harms learning” rule. Preserve the current
technical activity-array bound for legacy payloads; one V2 path can contain several
bounded steps without creating six independent games.

If no native mechanic fits, name the desired action, the closest engine and the
concrete missing capability. Do not invent numerical budgets, scales, facts or code
to satisfy an engine. New capability needs typed inputs, truthful feedback, native
source/recovery validation and browser evidence before it can be course-ready.

For an `experiment`, write every boolean-control combination explicitly. Its
result is the current simulation, not a promise about a live AI. Useful alternatives
can be accepted; all-on is not automatically best. A learner who already required
“保留时间” must not be told “你没要求时间” when the result omits it.

## 选哪一种：看课文用什么话描述机制

不要从变体查表。变体说的是"这节课在解决哪种困惑"，玩法说的是"读者要动手做什么"，
两者不是一一对应。**真正的线索是这节课在讲什么形状的关系。**

下面这张表的左栏是**形状的例子，不是要匹配的词表**。课文说「名字对上就能领出来」，
字面上没有"够得着"三个字，但那是一条从名字到元素的路——照样是 `connect`。
按字面找词，会把几乎每节课都判成对不上。

| 课文在说                                                 | 玩法         | 读者动手做的事                                               | **这节课必须真有**                                                                                                |
| -------------------------------------------------------- | ------------ | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| 够得着 / 伸到哪 / 走到哪 / 经过谁                        | `connect`    | 连出真实的可达关系，探针沿着连好的线走                       | 三个以上叫得出名字的东西，它们之间真实存在的通路，以及至少一条走得通的完整路径                                    |
| 这算不算 X / 它不是 A 也不是 B / 属于哪一层              | `sort`       | 把每样东西放进它属于的格子，放错时被告知这一格为什么装不下它 | ≥2 个格子，物品不少于格子数；诱饵要指向**另一个**格子，并说得出那一格为什么装不下它                               |
| A 和 B 有什么不一样 / 这两种做法 / 看起来一样其实不一样  | `contrast`   | 先猜同一样东西交给两种做法结果一不一样，再看它们各自做了什么 | 两种做法，≥2 个情况，而且**至少一个情况两边结果相同、至少一个不同**——全同或全不同引擎直接拒收                     |
| 什么时候该用这个、什么时候该用那个 / 值不值 / 代价是什么 | `weigh`      | 一种情况挑一个做法，然后发现同一个做法换个情况就不对了       | ≥2 个选项，情况不少于选项数，**每个选项都要在某个情况里赢**；输的选项要写出它在这一处的代价                       |
| 调大调小 / 多了会怎样 / 换个数                           | `tune`       | 拖动一个量，看另一个量跟着变                                 | 可拖的量有真实的上下限和单位，跟着变的量有一个**算得出来的**关系式——课文里没有真数就配不上                        |
| 到哪儿就变了 / 临界 / 边界在哪                           | `hunt`       | 试到能说出分界线在哪一侧                                     | 一个**真实的数值分界**和一段能试的输入区间。模型只有 `threshold` 和 `clamp` 两种，定性判断没有数就别配            |
| 有限的钱 / 时间 / 名额怎么分                             | `dispatch`   | 在预算里把请求分到不同通道                                   | 预算、若干通道、每次处理的代价。不谈成本的课配它就得编一个预算                                                    |
| 先做这步再做那步 / 顺序错了会怎样                        | `program`    | 排出一串命令，看它跑出来                                     | 网格、带朝向的起点、目标格、墙和检查点——课文里得真有一条"路线"                                                    |
| 怎么把要求说清楚                                         | `ai-brief`   | 把一句含糊的要求改成能执行的                                 | 一句含糊的要求、若干提问轴（轴由你的提问决定，不是写死的）、每个动作在不同约定下各自的结果                        |
| 它记得住多少 / 塞太多会怎样                              | `ai-context` | 在容量里挑该装进去的材料                                     | 一个容量上限、若干来源文件与段落、每段材料的出处依据                                                              |
| 它自己会干哪些活 / 该不该放行                            | `ai-agent`   | 看它要做什么，决定允不允许                                   | 工具能力、可达文件、授权范围，以及一份"做成了该长什么样"的目标产物                                                |
| 怎么知道它做得够不够好                                   | `ai-eval`    | 定标准，再拿它去验                                           | 三条是/否条件（信息够不够、东西在不在、在不在范围内）各自的说法，和五种结果各自的说法。轴是固定的，词全是你给的   |
| 它做错了怎么救                                           | `ai-repair`  | 在保住要紧东西的前提下修                                     | 一个能跑的产品、一个可复现的故障、若干候选改法、一条必须保住的旧功能。产品模型只有 `booking` 和 `preference` 两种 |

第四列是**引擎真的会拒收**的东西，不是建议。它从 `packages/core/src/learning-play/*.ts`
的 `isValid*` 里抄出来的——配不上的时候，十有八九是这一列里的某一样这节课没有。
上一轮有人只读第三列选了九个落点，错了三个：第三列说的是读者的手感，
**决定配不配得上的是第四列**。

`hunt` 和 `ai-repair` 这两行里的 `model` 枚举是**唯二写死在引擎里的东西**。
其余十一种，读者看到的每一个字都来自载荷——所以「这个玩法是给别的课设计的」
不是一条成立的拒绝理由，只有第四列缺料才是。

一节课的关系形状对不上任何一行，才是不配。**两个方向都会坏**：硬凑一行，是为了配而配；
按字面词找不到就判不配，是把这条规则用死——两种坏法都要在 agent report 里说得出来。

**自检一下你的判断**：如果这个单元是动手型的（读代码、改东西、做取舍），而你连着
判了三节"不配"，八成是你在按字面词匹配，回去重新问一遍「读者的手该做什么」。

**`sort` 尤其容易被漏掉**，因为术语课和对比课读起来"只是在讲清楚一件事"。判据很简单：
**这节课有没有在说"它不是什么"？** 有，就先想 `sort`。诱饵要写成读者真会犯的那个错，
并说清那一格为什么装不下它——写不出那句话，说明这条界线你自己也还没划清楚。

## 放在哪一步：三个位置，含义不同

| 角色          | 位置                                 | 它在做什么                             |
| ------------- | ------------------------------------ | -------------------------------------- |
| `observe`     | `## 先猜一下` **之前**               | 让读者先看见现象，预测题才有材料可依据 |
| `demonstrate` | 中段之内                             | 把一段讲不清的机制演一遍               |
| `apply`       | `## 答案` 与中段之后、`## 自检` 之前 | 刚学完，第一次自己用                   |

**`demonstrate` 永远不能代替评分练习。** 看懂一个演示不等于自己会做，
所以练习照旧是单独一道，单独作答。

`observe` 有一条硬线：它**不能泄题**。放在预测之前的组件只呈现现象，不给结论——
玩完之后那个问题还得是悬着的。

## 写进课文的方式：点名，不是并排

组件不能凭空出现在两段之间。**课文里要有一句把读者交给它**，
说清楚接下来要做什么、做完能看出什么。

```markdown
你已经知道两边各能碰到什么了。自己连一次试试——连错的地方，
那趟"请求"会当场走不过去。

::play{#what-each-one-can-reach}
```

写法是 `::play{#组件id}`，**井号简写，不是 `{id=…}`**。后者在这条渲染管线里
会被当成一个名叫 `id=…` 的空属性，加引号则整条指令都不成立。

**课文只指向组件，不复述它的内容。** 把组件里的节点、数值、答案再讲一遍，
等于同一件事写了两份，改一份另一份就开始撒谎。

## 面向读者的字：直说，不要比喻

组件里的每一句都要在当前可见材料与任务中**独自**读懂；不能依赖已经消失的上下文。
V2 的现实背景与具名材料负责铺垫，操作说明负责告诉读者此刻做什么。

- **标题就是这一关要回答的问题**，别写成意象。
  `谁能碰你的电脑？` 是标题；`各自的手，能伸到哪` 不是——读者得先解开比喻，
  才知道自己在干什么。
- **`brief` 要说清楚"手上要做的动作"**，不是这一关的意义。
  读者看完 `brief` 就该知道从哪下手。
- **不许出现只有我们懂的词**。`探针`、`节点`、`因果关系`、`可达`
  这些是引擎内部的说法，写给读者时一律换成大白话（`这一趟走不走得通`、`方块`）。
- **节点名越短越好，长的部分放 `note`**。`网页里的 AI` 配一句
  `你打开一个网页，在框里打字`，比 `网页上会聊天的那个` 强——后者读者得读两遍
  才知道在指什么。

### connect：如果有一个节点要连出多条线，必须说出来

这是实测栽过的一条。`chat-ai-versus-doing-ai` 左边两个方块、右边三个，
其中一个方块要连出**三条**线。读者理所当然把它读成一对一配对，连了两条就卡死，
以为组件坏了——而且**看不出来自己漏了**，因为界面当时只说"已接 2 条"。

界面已经补上了"一共几条"，但载荷这边也要配合：

- `brief` 里点明可以一对多，例如"能碰到几样就连几条"；
- 那条最容易被漏掉的线，`why` 里直接说"所以这条线也要连"；
- 六个 connect 里有两个是一对多。**一对多不是错**，但它是默认读法的例外，
  例外必须写出来。

## 数量、难度、轮换

- **一节至少 1 个，常态 1 个。** 下限由 schema 强制，见开头。上限是 3，
  但两个组件会把读者的注意力从内容拽到玩法上——这和课文里禁止塞趣闻是同一条理由，
  同样是实测的反向效应。第 2 个要在 report 里说明它教的是另一件事。
- **难度跟着单元走**：前 1/3 用 `intro`，中间 `practice`，收口的那节可以 `challenge`。
- **同一单元里最多两节连用同一种玩法**，和变体轮换是同一条线。第三节还要用同一种，
  就在 agent report 里说明为什么这是诚实的选择，而不是硬凑一个别的。
- **一个单元里配上的组件如果全是同一种**，即使不相邻，也在 report 里说一句。
  可能这个单元讲的本来就是同一类关系（读一段代码追谁连着谁，就该全是 `connect`），
  也可能是没认真看别的九种——这两种情况看起来一模一样，只有写的人分得清。

## 落地之后：把课程恢复成 active

`course open-for-edit` 会把课程和它的单元置为 `stale`，因为 `course revise` 拒绝
改动 active 的容器。**而 stale 的课程在阅读器里打不开**——读者看到的是
「课程资料没有打开」，正文一个字都没有。

所有闸门对此一律绿灯：linter 干净、`check:activities` 说 ok、引擎接受载荷、
连页面标题都正确解析出新修订的标题。**只有真的在浏览器里打开那一节才看得见。**

所以顺序是固定的，而且 reactivate 必须在最后（reactivate 之后就改不动了）：

```
open-for-edit  →  revise（一节或多节）  →  验证  →  reactivate
```

```bash
cd apps/local
node scripts/university-local.mjs course reactivate \
  --study <study> --course <course> --snapshot <snapshot-id>
```

2026-09-10 实测：三个并行 agent 各改一门课，两个把课程留在 stale 就交付了，
它们跑的每一条检查都是绿的。

## 出处：网址或者仓库里的位置，看这节课引的是哪一种

组件的 `source` 跟着这节课的出处走，两种形状都行：

- 课引的是已核实的公开网页 → `{ label, url }`，网址必须是这节课出处列表里已有的。
  如果引用的是 GitHub 源码，必须钉在具体 commit 上，不能用会移动的 `blob/main`。
  新闻、研究、官方资料及真实案例使用其真实页面与 provenance，不给网页编造 commit。
- 课引的是仓库里的代码 → `{ label, path }`。行号和 commit **你不用填**，
  `pick-activity.mjs` 会按你选中的那条出处补上 `line` / `lineEnd` / `commit`。

`label` 只写"这个位置为什么重要"的白话。**不要把路径或行号再抄一遍**——读者看到的
收条已经是 `worker.js:8@7bdf9a52` 这个形状，标签里再写一遍就是同一件事说两次。

**不许为了填这个字段去找一个新链接。** 一节课引的是 `worker.js:8`，组件的出处就是
`worker.js:8`；borrow 一个 MDN 页面来把字段填满，等于给读者一条通向别处的假线索。

（这条曾经只允许网址，结果 browser-ai 二十一节里有十五节在技术上配不了组件——
不是因为不该配，是因为字段形状替课程做了决定。后来又发现两件同类的事：`commit`
一度是自由字符串，快照号 `git-7bdf9a52bbf8` 和它钉的 commit `7bdf9a52bbf8158a…`
前十二位一样，模型三次里有两次把前者当后者填了进去，收条上印出 `@git-7bdf`；
`line` 一度只能存一个数，于是"1–4 行的三个 import"被截成了第 1 行——那是 React
的 import，跟标签说的完全不是一回事。现在这三样都由脚本从出处里取，不再由谁去抄。）

`pnpm check:activities` 会核对这些：会移动的分支、钉错的 commit、快照里没有的文件、
超出文件长度的行号。它跑的是真数据，所以红了就是真的。

## 交付之前：让引擎判，不要自己判

载荷写完，**跑一遍它自己的引擎**，确认这份情境真的能被解开。
`isValidProgramActivity`、`evaluateHunt` 的 `"invalid-activity"` 这类判定就在引擎里，
它们比任何一份手抄的规格都新。

这也是以后改组件时的变更影响分析：**引擎改了，把所有情境的解重跑一遍，
跑不通的就是受影响的课。** 不需要另建登记表或依赖图。

## 三档难度：一个组件，学习者自己切

一个组件可以写三份载荷，学习者在组件头部自己切 **入门 / 进阶 / 挑战**。

写法是给它们同一个 `family`：

```json
"activities": [
  { "id": "wiring-intro",     "family": "wiring", "difficulty": "intro",     "kind": "connect", ... },
  { "id": "wiring-practice",  "family": "wiring", "difficulty": "practice",  "kind": "connect", ... },
  { "id": "wiring-challenge", "family": "wiring", "difficulty": "challenge", "kind": "connect", ... }
]
```

**三条硬规则**，schema 和闸门各拦一遍：

1. 同一个 `family` 里 **kind 必须相同**。三档是同一个组件的三个难度，跑在同一个引擎上；
   把连线板和归类台凑成一组，切过去的人会以为是坏了。
2. 同一个 `family` 里 **难度不能重复**。
3. 正文只写**一个** `::play{#id}`，指向三个里的任意一个即可——切档的入口在组件自己身上。
   写三个 marker 就是在一页上放三个组件。

**默认从入门开始**（V5 §难度：「默认先提供入门」），不是你在正文里指的那一档。
完成记录里存的是学习者真正做的那一档，不是默认档。

### 什么时候值得写三档

不是每节都要。判断标准是**这一关的难点有没有可调的量**：

- 连线板：节点多少、有没有分支和失败路径 → 可调，值得。
- 归类台：桶的数量、有没有「两个都像」的诱饵 → 可调，值得。
- 调参台：要同时满足几个约束 → 可调，值得。
- 只有一个正确答案、去掉任何一点就不成立的关卡 → 不值得，写一档就好。

只写一档完全合法；实际覆盖以当前发布包为准，`family` 不填就是一档。
