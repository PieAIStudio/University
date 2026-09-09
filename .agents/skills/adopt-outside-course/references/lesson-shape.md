# 一节课装什么

**这份文件不再定义课文形状。**

课文的形状由 `write-lesson` 技能单独拥有，它是唯一的出处：

- 骨架、变体、15 条不变量：
  `apps/local/.agents/skills/write-lesson/SKILL.md`
- 五种变体各自的小节结构：
  `apps/local/.agents/skills/write-lesson/references/variants.md`
- 落盘之后真正把关的检查器：`apps/local/scripts/lint-lessons.mjs`，
  它跑在 `pnpm verify` 里。

## 为什么这里空了

这份文件曾经完整规定过一套六小节骨架：`## 学习目标`、`## 先给结论`、
`## 一个类比`、`## 工作示例`、`## 自检`、`## 重点`。

那套骨架已经退休。现行骨架是
`先猜一下 → 答案 → 中段 → 自检 → 一句话`，而 `write-lesson` 明令**禁止**
上面六个里的五个。

两处定义并存的代价是实测出来的，不是假设：

- `apps/local/scripts/check-proposal-shape.mjs` 当时**要求**那六个小节，
  而 `lint-lessons.mjs` **要求**现行骨架。一节课不可能同时通过两边。
- 更糟的是 `lint-lessons.mjs` 只检查 manifest 里声明了 `variant` 的课，
  而照着这里的旧示范做出来的课**不带 `variant`**——于是它既不符合现行骨架，
  又不会被任何检查器看见。闸门是绿的，因为它没在看。

所以这里不再有第二份定义。**要写课文，去读 `write-lesson`。**

这个技能负责的是它自己的活：判断一门外部课能不能纳入、拿到授权、抓提纲和正文、
拆章分节、防止逐字照抄、以及把引用换成权威原始资料。
