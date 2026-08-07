# The five lesson shapes

One template applied 481 times produces 481 lessons that feel like one lesson.
These are the sanctioned variations. They are not free-form: each keeps every
invariant from `SKILL.md`, and each exists because a different *kind of thing*
is being taught. Choosing by content is the point — rotating for variety alone
produces a contrived 对比 where a 现象 belonged.

Every variant shares the same spine:

```
标题（问句）
现象 / 情境          ← 悬念坐实，可观察
## 先猜一下          ← 恰好一道，低成本
## 答案              ← 立刻
<中段，因变体而异>
## 再想想（可选）     ← 跨课链接放这里
## 自检              ← 计入完成度
## 一句话
```

Only the middle changes. That is the whole design: the parts that carry the
learning psychology are fixed, the part that carries the subject matter flexes.

---

## `现象` — 观察到的意外

**Use when** there is something a learner can see that contradicts what they
would expect. The default, and the best one when it fits.

```
## 现象
## 先猜一下
## 答案
## 为什么是这样
## 再想想
## 自检
## 一句话
```

Opening that works:

> `index.html` 一共 32 行。第 30 行是一个空的 `<div>`，里面什么都没有。
> 但你打开这个页面，看到的是一整套界面。

**Trap:** writing 现象 as a summary of the mechanism. The 现象 section must
contain no explanation at all — only what is observable.

---

## `对比` — 两个东西老是搞混

**Use when** two things are routinely confused: 文件 vs 文件夹, dev vs build,
null vs undefined, `==` vs `===`.

```
## 两个东西
## 先猜一下          ← 「这两个哪个会……？」
## 答案
## 逐条对照
## 什么时候用哪个
## 自检
## 一句话
```

**The prediction question is the whole trick here**: ask for a concrete
consequence, not a definition. "把 A 换成 B，会发生什么？" not "A 和 B 有什么区别？"

**Trap:** a comparison table with no consequence. The learner leaves able to
recite the difference and still unable to choose.

---

## `溯源` — 这个值是从哪来的

**Use when** something crosses files: a config value reaching the UI, a click
reaching a handler, a build input becoming an output.

```
## 你看到的结果
## 先猜一下          ← 「它是从哪来的？」
## 答案
## 一站一站往回走     ← 每站一个 evidence 锚点
## 自检
## 一句话
```

Each stop is one file, one line range, one sentence. **Every stop gets its own
inline anchor** — this variant is the reason inline anchors exist.

**Trap:** listing files in repository order instead of in the order the value
actually travels.

---

## `决策` — 为什么这么选

**Use when** the project made a tradeoff a beginner would not have made, and
the reasoning is the lesson.

```
## 情境和约束
## 先猜一下          ← 「你会怎么选？」
## 答案（他们选了什么）
## 代价和收益
## 什么时候该反过来
## 自检
## 一句话
```

`## 什么时候该反过来` is mandatory in this variant. A tradeoff presented as
having one right answer is not a tradeoff, and teaching it that way produces
someone who applies it where it does not belong.

**Trap:** writing it as if the choice were obvious. If it were obvious, there
would be no lesson.

---

## `术语` — 这个词到底在说什么

**Use when** a word carries meaning the learner keeps guessing wrong: commit,
state, render, build, mount.

```
## 一句真实出现的话   ← 从被学项目里原样引用
## 先猜一下          ← 「这里的 X 是什么意思？」
## 答案
## 三个真实用例
## 它不是什么
## 自检
## 一句话
```

`## 它不是什么` is mandatory. Most term confusion is over-generalisation, and
the boundary is what fixes it.

**Trap:** a dictionary definition. The three uses must come from the studied
project, with anchors.

---

## Choosing

Ask in order; take the first that fits honestly:

1. Is there something observably surprising? → `现象`
2. Is the lesson mostly "these two are not the same thing"? → `对比`
3. Does understanding require following something across files? → `溯源`
4. Is the point *why they chose this*? → `决策`
5. Is the point what a single word means? → `术语`

If two fit, prefer the one earlier in the list — `现象` carries the most
suspense per sentence.

If none fit, the lesson is probably trying to teach two things. Split it, or
raise it rather than inventing a sixth shape.
