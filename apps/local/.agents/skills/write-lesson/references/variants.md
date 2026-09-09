# The five lesson shapes

One template applied hundreds of times produces hundreds of lessons that feel
like one lesson. These are the sanctioned variations. They are not free-form:
each keeps every invariant from `SKILL.md`, and each exists because a different
*kind of thing* is being taught. Choosing by content is the point — rotating for
variety alone produces a contrived 对比 where a 现象 belonged.

Every variant shares the same spine:

```
标题（问句）
开场（具体情境或任务，可观察；不强制反常）
## 先猜一下          ← 恰好一道，低成本
## 答案              ← 立刻；标题固定为「答案」二字
<中段，因变体而异>
## 再想想（可选）     ← 跨课链接只能放这里；若有，必在中段之后、自检之前
## 自检              ← 换输入、条件或例子；只提问，不给答案
## 一句话
```

This is the prose spine. The separate exercise renders after the prose and gives
feedback; do not insert its answer into 自检 or move it into Markdown. Details of
the exercise contract live in [cards-and-exercises.md](cards-and-exercises.md).
Only the middle changes. The shape is an editorial contract, not a substitute
for checking whether a learner can apply the idea to a changed situation.

When citing repository code, use the product anchor instead of copying the source:

```markdown
[[evidence:index.html:29-31]]
```

---

## `现象` — 看见情境，理解原因或完成任务

**Use when** the reader can observe a concrete situation or needs to complete a
specific task. Surprise can help when it is real; it is not an admission test.
For a procedural lesson, show a worked example in the middle, then require a
changed-condition attempt in the self-check/exercise.

```
## <先把读者遇到的情境或任务说清楚>
## 先猜一下
## 答案
## <解释原因或示范怎样完成这件事>
## 再想想          ← 可选
## 自检
## 一句话
```

Opening that works:

> `index.html` 一共 32 行。第 30 行是一个空的 `<div>`，里面什么都没有。
> 但你打开这个页面，看到的是一整套界面。

An ordinary task also works: show an ambiguous specification and ask which
part two builders are most likely to interpret differently. No fake surprise
is needed. Supply the vocabulary/context needed to guess, not the solution.

**Trap:** explaining the core answer in the opening. Delete everything from
`## 答案` down: the central question should remain open, while the reader still
has enough information to form a reasoned guess.

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

**Use when** something crosses files or real systems: a config value reaching
the UI, a click reaching a handler, a request passing between services.

```
## <先说读者看到的结果>
## 先猜一下          ← 「它是从哪来的？」
## 答案
## <沿着有证据的路径逐站回查>     ← 每站说明发生了什么，并给相应出处
## 再想想          ← 可选
## 自检
## 一句话
```

For a repository, each stop has its own `[[evidence:path:lines]]`. Without a
repository, stops may be real systems supported by primary documentation or
recorded observations. Label a documented typical flow as such; documentation
is not evidence that a particular execution happened. See
[evidence-and-failures.md](evidence-and-failures.md#without-a-repository).
Stops follow the relevant flow, not repository or documentation-menu order.

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
## 什么时候该反过来
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
## <先展示读者会碰到这个词的情境>
## 先猜一下          ← 「这里的 X 是什么意思？」
## 答案
## <这个词在三个具体场景里怎样使用>  ← 白话解释，出处支撑
## 它不是什么
## 再想想          ← 可选
## 自检
## 一句话
```

`## 它不是什么` is mandatory: teach the boundary as well as the definition.

**Trap:** a dictionary entry or three pasted quotations. Use three situations
where the reader would actually encounter the word, explain them in plain
language, and attach the supporting source. Repository use cases use pinned
anchors; no-repository cases use verified primary documents, not invented code.

---

## Choosing

Choose the dominant learning action, not a rotation quota:

1. Is the point explaining an observable situation or completing one concrete task? → `现象`
2. Is the lesson mostly "these two are not the same thing"? → `对比`
3. Does understanding require following something across files or systems? → `溯源`
4. Is the point *why they chose this*? → `决策`
5. Is the point what a single word means? → `术语`

If two fit, choose the one that best supports the lesson's independent exercise.

Keep these five variants. If none fits, first review the learning goal and the
classification; split only when the lesson actually combines separate goals.
Do not merge/delete a useful task merely because no surprising event can be
found. If it still does not fit honestly, raise it rather than inventing a sixth
shape. After two consecutive uses, a third requires a reviewer explanation of
why forcing another variant would be worse; this is judgment, not an automatic rejection.
