# The five lesson shapes

One template applied hundreds of times produces hundreds of lessons that feel
like one lesson. These are the sanctioned variations. They are not free-form:
each keeps every invariant from `SKILL.md`, and each exists because a different
*kind of thing* is being taught. Choosing by content is the point — rotating for
variety alone produces a contrived 对比 where a 现象 belonged.

Every variant shares the same spine:

```
标题（问句）
开场（悬念坐实，可观察）
## 先猜一下          ← 恰好一道，低成本
## 答案              ← 立刻；标题固定为「答案」二字
<中段，因变体而异>
## 再想想（可选）     ← 跨课链接优先放这里；若有，必在中段之后、自检之前
## 自检              ← 只提问，不给答案
## 一句话
```

Only the middle changes. That is the whole design: the parts that carry the
learning psychology are fixed, the part that carries the subject matter flexes.

After every real code block, use the product anchor — not a prose location line:

```markdown
[[evidence:index.html:29-31]]
```

---

## `现象` — 观察到的意外

**Use when** there is something a learner can see that contradicts what they
would expect. The default, and the best one when it fits.

```
## <先把读者看到的反常之处说清楚>
## 先猜一下
## 答案
## <回答「为什么会这样」>
## 再想想          ← 可选
## 自检
## 一句话
```

Opening that works:

> `index.html` 一共 32 行。第 30 行是一个空的 `<div>`，里面什么都没有。
> 但你打开这个页面，看到的是一整套界面。

**Trap:** writing 现象 as a summary of the mechanism. The 现象 section must
contain no explanation at all — only what is observable. If deleting everything
from `## 答案` down still leaves the mechanism obvious, you leaked.

---

## `对比` — 两个东西老是搞混

**Use when** two things are routinely confused: 文件 vs 文件夹, dev vs build,
null vs undefined, `==` vs `===`.

```
## <先把两种情况点名>
## 先猜一下          ← 「这两个哪个会……？」
## 答案
## <逐项比较两种情况>
## <说明分别什么时候用>
## 再想想          ← 可选
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
## <先说读者看到的结果>
## 先猜一下          ← 「它是从哪来的？」
## 答案
## <沿着真实路径逐站回查>     ← 每站：代码块 + [[evidence:…]]
## 再想想          ← 可选
## 自检
## 一句话
```

Each stop is one file, one line range, one sentence. **Every stop gets its own
`[[evidence:path:lines]]`** — this variant is the reason inline anchors exist.
Stops follow the order the value actually travels, not repository tree order.

**Trap:** listing files in repository order, or marking stops with
`（位置：…）` instead of `[[evidence:]]`.

---

## `决策` — 为什么这么选

**Use when** the project made a tradeoff a beginner would not have made, and
the reasoning is the lesson.

```
## <说明这次选择面对的情境>
## 先猜一下          ← 「你会怎么选？」
## 答案              ← 第一句可以说「他们选了…」；标题仍是「答案」
## <这次选择换来了什么，又付出了什么>
## <什么时候应该反过来>
## 再想想          ← 可选
## 自检
## 一句话
```

`## 什么时候该反过来` is mandatory in this variant. A tradeoff presented as
having one right answer is not a tradeoff, and teaching it that way produces
someone who applies it where it does not belong.

**Trap:** writing it as if the choice were obvious. If it were obvious, there
would be no lesson. **Also trap:** renaming the answer heading to
`## 答案（他们选了什么）` — that breaks every check looking for exact
`## 答案`.

---

## `术语` — 这个词到底在说什么

**Use when** a word carries meaning the learner keeps guessing wrong: commit,
state, render, build, mount.

```
## <先展示这个词真实出现的一句话>   ← 从被学项目里原样引用
## 先猜一下          ← 「这里的 X 是什么意思？」
## 答案
## <这个词在项目里怎样使用>       ← 各带 [[evidence:…]]
## <这个词不等于什么>
## 再想想          ← 可选
## 自检
## 一句话
```

`## 它不是什么` is mandatory. Most term confusion is over-generalisation, and
the boundary is what fixes it.

**Trap:** a dictionary definition. The three uses must come from the studied
project, with product anchors — not paraphrases of docs alone.

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
