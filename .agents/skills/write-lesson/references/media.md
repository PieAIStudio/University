# Pictures, animation, and video

A lesson that is only prose reads like something a machine produced. That
instinct is right. What follows is how to act on it without making the lesson
teach worse — which is the easy and common outcome.

## The finding that sets every rule below

Adding pictures to words beats words alone (the multimedia principle). But
**decorative** pictures are a different thing entirely:

> Learners did **not** learn better when illustrations were purely decorative —
> but they **reported liking the lesson more**.

Read that twice. Decoration buys affection, not understanding. And the coherence
principle — exclude extraneous material — is supported in **23 of 23**
experiments at a median effect size of **0.86**, one of the largest in the
field. Recent meta-analytic work puts "remove seductive detail" among the biggest
positive effects of any technique (g ≈ −0.37 to −0.41 for leaving it in).

This is the same trap as 「暖，是换说法，不是加内容」 in SKILL.md, wearing a
different costume. Both times the thing that makes a lesson *feel* better is not
the thing that makes it *teach* better, and intuition always votes for the first
because its reward is immediate.

## The test

**Delete the image and add one sentence. Is the reader worse off?**

No → delete it. Same test the detail layer uses.

| kind | example | verdict |
| --- | --- | --- |
| decorative | a photo of phone apps on a lesson about apps | **banned** — the reader is holding a phone |
| representational | "this is that folder" | allowed, sparingly, and it must be **real** |
| explanatory | text files → tool → the icon you tap | **this is where the gain is** |

Per lesson: **at most 3**, and each must survive the test alone. A lesson needing
more is usually two lessons.

## Never take a picture off the web

This project is heading for commercial use. An image someone else made is
someone else's property, and "found on Google" is not a licence.

Ordered by preference:

1. **Capture it yourself from the studied project**, at the pinned commit. This
   is the strongest kind: it is real, it is the actual subject of the lesson, and
   it belongs to us. `kind: "real-screenshot"` — the schema *requires* `capture`
   provenance (commit, route, state, viewport, locale, recipe). That requirement
   exists so a picture of a program is never an unverifiable claim.
2. **Draw it** — `kind: "diagram"`. For structure and relationships, prefer
   **Mermaid**: the project already renders it (`src/markdown/MermaidDiagram.tsx`,
   and the `mermaid-diagrams` skill). A Mermaid diagram is text, so it diffs,
   reviews, and **never goes stale** — which a screenshot always eventually does.
3. **A screenshot of the author's own machine** (Finder, a terminal). Yours to
   use. Crop hard: OS chrome, sidebars, and desktop clutter are extraneous
   material, and extraneous material is what principle 1 above is about.
4. **A properly licensed third-party image** — CC0 / CC-BY / Wikimedia, with the
   licence in `source.license` and credit in `source.attribution`. Last resort.
5. **AI-generated** — `kind: "ai-illustration"`, which the schema forces to carry
   a visible `aiNote`. Rarely the right answer for a course about real code.

**A screenshot beats a diagram at proving something is real. A diagram beats a
screenshot at showing how parts relate, and does not rot.** Use each for its job.

## Animation

Research is against the intuition here: animations frequently do **not** beat
static graphics (Tversky et al.). Two reasons worth understanding:

- **Transient information effect** — the animation moves on while the learner is
  still processing what it just showed, so working memory has to hold the past
  and take in the present at once. A static picture waits.
- **Congruence principle** — dynamic presentation pays only when the *content
  itself is dynamic*. Animating static content just adds load.

So:

- ✅ "tap this, and the page becomes that" — the content is a change over time
- ❌ "here is what the folder contains" — nothing moves; use a still
- Required either way: the reader can **pause and replay**. An animation that
  cannot be stopped loses to a still every time.

## Video: link, never embed

External video is welcome as a pointer and must not become part of the lesson's
spine.

**Why not embed:** this whole system rests on evidence pinned to an immutable
commit — the lines you read today are the lines you read in three years. A
YouTube segment at 8:05–9:03 can be deleted, made private, or re-cut so that
timestamp is different content, **and nothing will tell us it changed.** Putting
un-pinnable material inside a lesson's argument breaks the one guarantee the
project sells.

So:

- Link out, with the timestamp, marked plainly as leaving the campus and outside
  our control.
- **The lesson must still be complete if the video dies.** One sentence of prose
  carrying the point, always. The video is enrichment, never the carrier.
- Never as evidence for a claim. Evidence is pinned source, full stop.

If embedding is ever wanted, use [`lite-youtube-embed`](https://github.com/paulirish/lite-youtube-embed)
rather than an iframe — it loads nothing from Google until the reader clicks.
Do not hand-roll this.

## Authoring

```markdown
:::figure[真实界面：每天一题的结果页]{#turing-pact-daily-result}
真实截图 · 已选中 Blink，结果面板已展开。
:::
```

`#id` matches an entry in the manifest's `assets`. Register the file under the
revision's `assets/`, with `sha256`, `bytes`, `mime`, dimensions, and — this one
is not optional — `alt`. A reader using a screen reader, and every future search
over this course, has only the `alt` text. Describe what the picture *shows*, not
that it is a picture.

`:::video` exists for `kind: "screen-recording"`, which the schema requires to
carry `durationMs`.
