---
name: write-concept-entry
description: 编写或复核 University 的概念词条及其 flow、demo、regions 互动件。按词条的教学形状选择互动件，继承初学者中文、字面先于类比、真实品牌控件和 zod 加浏览器双闸门；不用于 apps/local/studies 下的 lesson revision。
metadata:
  owner: University
  mode: production
  source: "concept-flow batch 2026-08-26"
---

# 编写概念词条

这个技能服务的是 `packages/core/src/concepts/data/*.ts` 里的概念词条。词条的
散文、互动件和页面渲染共用 `packages/core` / `packages/ui` 已有的一套 schema 和
renderer；不要为了一个词条再造一套页面或一套小组件。

## 先确认边界

概念住在 `packages/core`，所以技能放在仓库根 `.agents/skills/write-concept-entry/`。
根 `.agents/skills/` 是本仓库的 canonical skill root，`adopt-outside-course` 也在
这里；`apps/local/.agents/skills/write-lesson/` 服务的是 `apps/local/studies` 的
lesson revision，不是概念目录。两者都可以借用语气规矩，但不要把两个 workflow
合成一个技能。

这一批已经验证过的内容边界：如果任务说只加 `flow`，只改 `body.flow`，不要顺手
改那 281 条散文，也不要重做现有 `demo` 或 `regions`；`apps/local/server` 和
`e2e/G.one-chrome.spec.ts` 不在工作范围。

## 先按形状分派，不按覆盖率分派

不是每条词条都该有互动件。互动件缺席是有效结果：如果文字已经能教清楚，而没有
可操作的状态或空间关系，就不要为了让覆盖率好看而塞一个空 demo。

- `flow` 适合回答「这个东西在一条真实工作链路的哪一站」。它是有序、可读的路径，
  每个词条高亮自己所在的步骤；它不能表达可点击控件、状态变化、任意视觉布局或
  一个需要读者自己探索的区域。
- `demo` 适合回答「这个东西摆出来是什么样、状态改变后会怎样」。它是一个使用
  产品品牌控件的微型样品，可以有一个状态，也可以切换多个状态；它不能变成任意
  HTML、不能承载真实业务动作、不能伪装成一张自由绘图，也不能递归嵌套布局。
- `regions` 适合回答「在这个小样品里，哪一块是正在说的东西」。学习者点区域，
  错的区域可以留下反馈，点对后显示一条 reveal；区域是键盘可操作的按钮。它不能
  代替多步骤流程、不能表达任意点击后的页面跳转，也不是把答案标签预先印在图上。

### `demo` 的零件表

`DemoNodeSchema` 只有九种叶子：

`text` / `button` / `input` / `toggle` / `slider` / `badge` / `progress` /
`divider` / `block`。

容器只有两种：`row` 和 `stack`。容器只能装叶子，不能装另一个容器；也就是最多
一层容器嵌套。控件走 SwimmerUIKit 的真实组件，`toggle` 和 `slider` 的可动状态是
demo 自己的局部状态，`button` 是安全的无副作用按钮。

schema 的判据必须留在作者脑中：

> 当作者开始伪造一个原语时，说明这个原语缺失。

曾经有人用字符画「分割线」；它在主题里不会变、对屏幕阅读器只是字符串，也不是
真正的控件。正确动作是补一个经过评审的原语和 renderer，而不是用 `text` 拼一条
假线、用 `block` 假装一个按钮，或把 HTML 塞进 payload。缺零件要去加零件，不许
用文字拼假图。

### `regions` 的形状

`regions` 是 2–10 个区域、一个 `correctRegionId`、一道 `question` 和一句
`reveal`；`span` 只分 `full` / `half`，`height` 只分 `short` / `tall`。区域标签
在答对或答错后才出现，避免把问题写在图上。若想表达的是「先点 A，再看到 B」，
那是 demo 状态或正文，不是 regions。

## `flow`：先定链子，再挂词条

flow 的 `steps` 活在词条上，不在共享目录里。跨词条共用一条路径是内容复用：先
把一条链子的十步文案写好、读好、通过 schema，再把这串 `steps` 复制到需要它的
词条上，只翻动对应的 `current`。不要建立第二个 flow catalogue，也不要每条词条
从空白开始画一张略有不同的图。

这次「一次改动，从你的电脑到线上」实际覆盖 16 条词条时，160 个步骤槽位只有
一套 `label` / `description` 文案；每条词条只表达「我在第几站」。这就是为什么
先定链子再挂词条比逐条画图便宜一个数量级：链路的顺序、语气、重复检查和后续修订
只需要想一遍，词条之间的差异只剩高亮位置。

必须保留这些事实：

- `FlowPayloadSchema` 要求至少两步、最多二十步，且至少一个 `current: true`；
  没有高亮的路径是另一种、更弱的段落。
- renderer 使用真正的 `<ol>`，不是 Mermaid、canvas 或 WebGL 图；不要把可选择的
  文字和读屏语义换成一张看起来像流程图的图片。
- 同一个 `title` 的词条，去掉 `current` 后的 `steps` 必须逐字相等。改链子时要
  一次更新所有副本，再运行根脚本 `scripts/check-concept-flows.mjs`。
- 有些词是执行链子的工具而不是一站；本批 `terminal` 和 `browser-devtools`
  明确不加 flow。这种排除是判断，不是覆盖率缺口，不要自行补上。

## 语气闸门

继承 `apps/local/.agents/skills/write-lesson/` 的 house voice，但把它落到 payload
字段上：

- 面向从没写过软件的人，先说字面机制，再说类比；类比必须显式写成
  `打个比方：`，删掉类比后字面层仍然成立。
- 每个 flow step 的 `description` 是一句话，短句优先；schema 上限是 500 字符，
  `label` 上限是 80 字符，但上限不是目标。
- `demo.alt`、`regions.question`、`regions.reveal` 和其他句子字段也要是能直接
  对人说的话，不写字典腔，不把内部实现当学习者须知。
- `通常`、`常常`、`往往`、`一般`、`多数`、`可能` 等让步词是事实强度的一部分，
  不要把它们润色成「随时」或其他绝对说法。

`check-lesson-hedges.mjs` 能检查让步词丢失、绝对化和过度变长，但它接收的是
Markdown 文件，不会解析概念 TypeScript。使用它时先用 core 的真实
`sectionToMarkdown` 序列化 flow 到临时文件，再运行：

```bash
pnpm --filter @pieai/university-local lint:hedges --before /tmp/concept-flow-before.md --after /tmp/concept-flow-after.md
```

单文件扫描只能抓绝对化和「只要…才」；它不能证明一句话真的只有一个句号、类比
真的有用，不能替代人工阅读。2026-08-26 这批中，Gemini Flash 的 polish 保留了
让步词、没有新增绝对化，却让序列化正文增长 15.3%，闸门按 3% 上限拒绝了它；
正确动作是丢掉整版 polish，不手工拼修它。

## 两道闸门，缺一不可

1. **结构闸：zod 零 problem。** 让 `loadConcept` / `parseEntrySections` 真正跑
   过目标词条，确认 `flow`、`demo`、`regions` 的 payload 没被丢掉；解析问题要
   打出词条 id，而不是只看页面还能不能加载。
2. **体验闸：渲染出来看一眼。** 在真实浏览器打开代表性词条，滚到互动件，确认
   当前高亮、编号、长中文、类比和控件都摆得住。一个 schema 通过、但摆出来拥挤、
   断行失控或看不出重点的 demo，比没有 demo 更糟，因为它会把错误的画面教给人。

单测只能替你证明结构，截图或真实浏览器才能替你证明布局；两道都绿才交付。

## 模型角色：只引用唯一来源

模型分工、preflight、fallback、当前 model id 的选择和 CLI 形状，唯一来源是
[write-lesson 的 `references/models.md`](../../../apps/local/.agents/skills/write-lesson/references/models.md)。每次写作或检查前都读取它并运行它规定的
preflight；这个技能不复制角色表，也不在这里硬编码未来会过期的版本号。

角色边界保持原样：Writer/fixer 负责写和修，Detector 只报告初学者卡点，Polisher
只改口语说法；Writer/fixer 与 Detector 必须是不同家族。Detector 不得给替代句子，
否则 Writer 会被它的建议牵着走，内容会越写越胖。

本批的实际 receipt 供复盘，不是未来路由规则：Grok preflight 的真实输出是已登录，
但本任务明确选了 Codex Writer/fixer；实际 Writer 是当前 Codex（`gpt-5.6-sol`，
`ultra`），Detector 和 Polisher 是 Gemini Flash（`gemini-3.7-flash-high`，`high`）。
未来批次仍以 `models.md` 的实时 preflight 为准，并在 run report 写实际走的 arm 和
model id。

## 交付清单

- 只给形状合适的词条加互动件；不为了覆盖率填空。
- 共享 flow 的 title 相同，`steps` 除 `current` 外逐字相同，且每条至少一个高亮。
- `demo` 只用九种叶子和 `row` / `stack`，容器不互相嵌套；缺原语就上游补零件。
- `regions` 至少两个区域，正确 id 存在，问题和 reveal 都是一句话。
- 目标词条 `parseEntrySections` 零 problem，且根机械检查通过。
- 实际浏览器滚到互动件看过，并留下截图路径；不要只引用 test green。
- `pnpm verify` 必须包含并跑过 `pnpm check:concept-flows`；测试数量只能增加。
- 报告要写实际模型 arm/id/effort、hedge gate 是否运行、schema 与浏览器两道闸门
  的结果，以及哪些词条被有意排除和为什么。
