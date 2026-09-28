---
id: PLAN-V7-07-WEEKLY-BOSS
title: "V7 · 07 The weekly boss"
type: plan
status: completed
canonical: true
owner: ai-assisted
created: 2026-09-27
last_reviewed: 2026-09-28
domain: learning-experience
tags:
  - v7
  - retention
related:
  - REF-WORK-QUEUE
  - ADR-0010
supersedes: []
superseded_by: null
---

# Task 07 · The weekly boss

## Context the executor does not have

- Repository `/Users/yuanfei/PieAI/University`, branch `main`; queue rules in
  [the work queue](../../reference/execution/work-queue.md). Step over `00-`.
- Design authority: [V7](../../reference/player-journey/v7/index.html) mechanic 8
  ("每周一只大怪"). Binding decision R1: the weekly boss now; limited-time events
  later.
- Questions come from the learner's own practice pool: only exercises from
  lessons this learner finished this week, deterministic grading first (the
  grading tiers in the root router still apply). ADR-0010 still holds: the
  system never adapts difficulty by itself.
- Depends on `01-` (monster on the island) and `02-` (the throw and flee). The
  purple-chest reward and pack use `02-` and `06-`; if `06-` was skipped, give
  the chest without the pack and record it.

## 1 Outcome

Every Monday a big monster stands at the island's edge; answering five questions
drawn from what the learner studied that week chases it away and opens a purple
chest.

## 2 What the Owner said

> 「从玩家心理学出发，把手游让人上瘾的招数……用在学习上……能增加就增加，不强求。」

## 2a The rules, decided 2026-09-28

The Owner handed the design over: 「按吸引从长期角度和短期角度抓住用户……让用户觉得
有趣……你来定。」 What was decided, and the pull each rule is for:

| Rule | Pull |
| --- | --- |
| The boss has five hearts. Each right answer throws a star and takes one, and a heart taken stays taken until Sunday night, on every device. | Short: every answer visibly does something. Long: a two-minute visit is never wasted, so coming back to finish it is cheap. |
| A wrong answer costs nothing: the boss shakes its head, the question goes back into its pool, and the card names the lesson it came from with a way to reread it. The answer itself is never shown, because the bundle does not carry it. | No punishment for being wrong (V7's three things we do not do); the miss turns into a reason to reread. |
| A fight asks as many questions as the boss has hearts left. When they run out with hearts still standing, another round can start at once. | "Losing costs nothing and can be retried" without ever blocking. |
| Five in a row in one round from full hearts is flawless: the purple chest upgrades to gold, by the same first-try rule every chest already has. | Tension without a penalty: the only thing at stake is a bigger chest. |
| Each heart earns 10 XP (a two-to-three-day review earns about that), the win another 50. | The weekly boss is worth about three lessons: worth the appointment, not worth grinding. |
| Questions come from lessons finished since the Monday before this week's Monday, so the pool only grows during the week: on Monday it is last week's work, by Sunday it spans two. | Retrieval practice at a useful spacing, and a boss whose hearts can always be finished. |
| The boss stands on the island where the learner most recently finished a lesson. | It is where they will next open the map, so they meet it. |
| It appears once that pool holds five questions a machine can judge, and leaves at the end of Sunday, beaten or not; the fight's card says how many days are left. | A fixed weekly appointment with a visible deadline, and no nagging. |
| It is the gate boss's model 20% larger, gilded (eyes and teeth keep their colour, accents turn gold, the body keeps its own colour under a gold wash), and it roams: out from where it came ashore and back, resting between legs, clear of stones, trees, tents and chests. A crown chip over its head, a DOM button, opens the fight; it stops and faces the learner while one is on. When the last heart falls it runs, and its chest drops where it was. (Owner, 2026-09-28: 「平时游荡」「偏金色」「大 20%」, 「凸显它不一样」.) | Movement and gold catch the eye on an island where everything else stands still; the same size and gold for every future species keeps "the week's boss" one recognisable kind of thing. |

Later, not in this task (recorded so the long-term half is not lost): the boss
changes species week by week from a crowned roster; every beaten week leaves
its crown on a small plinth where it stood, so the island becomes a record of
weeks shown up; and the growth page counts bosses beaten and weeks in a row.
All three derive from the `weekly-boss:<week>` XP events, so none needs new
storage.

## 3 What "done" looks like

- The boss appears on the course island where the learner most recently
  finished a lesson, on free ground at the edge, never on a path.
- Five hearts, questions only from lessons the learner finished in the window
  of 2a; if fewer than five exist, the boss does not appear (never pad with
  unlearned content).
- Each right answer takes a heart that stays taken; the last heart plays the
  star throw ×3 and opens a purple chest (gold when flawless); a wrong answer
  costs nothing and a new round can start at once; the boss leaves on Sunday
  night whether beaten or not.

## 4 Out of scope

- Limited-time events and limited monsters.
- Any model-graded open question.

## 5 How it is judged

| Gate | Command | Baseline 2026-09-27 at `65d49313` | Floor |
| --- | --- | --- | --- |
| fast | `pnpm verify` | green | green |
| complete | `pnpm e2e:all` (pre-push) | default 407 passed, timing 31 passed, 0 failed | green; counts may not fall |

- Unit tests: week boundaries, question selection only from this week's
  finished lessons, the under-five rule.
- Browser spec: a learner with a week of finished lessons sees the boss, beats
  it and receives the chest.

## 6 Delivery discipline

One task, one commit, one push; stop if the complete gate cannot go green;
never force-push or rewrite history.

## 7 Report back

Gate numbers verbatim, captures, anything noticed but not done.

## 8 Delivery receipt (2026-09-28)

- The rules of §2a are core (`packages/core/src/progress/weekly-boss.ts`): the
  window from the Monday before this week's, the island of the latest finished
  lesson, hearts as `weekly-boss:<week>:hit:<question>` XP events (10 XP each), the
  win as `weekly-boss:<week>` (50 XP), rounds, flawless, days left. Ten unit tests
  cover the week boundaries, the growing pool, the under-five rule, a heart that
  stays taken on every device, one question per heart, flawless, the win lasting
  the week, and a boss two devices left at no hearts.
- The fight is one DOM card low over the island (`WeeklyBossFight`), asking with
  the skip test's own question card, now shared (`QuestionStep`; the skip test
  uses it too, its classes renamed `question-step__*`). A miss names the lesson and
  offers it; a round with hearts left offers another at once.
- On the island (Owner's second round, 2026-09-28): the gate boss's model 20%
  larger, gilded, roaming its planned legs and stopping to face the learner in a
  fight; a crown chip over its head opens the fight for keyboard, screen reader
  and touch. Each right answer throws a star and the boss ducks; a miss, it shakes
  its head; the last heart takes three stars, it runs, and its purple chest drops
  where it was (gold when flawless), opened by the lesson chest's own flow
  (`useChestOpening().beginWeekly`). The drop has a six-second deadline for a scene
  that cannot report.
- Browser spec `e2e/weekly-boss.spec.ts`: a learner who finished a unit's lessons
  today finds the chip, takes five hearts with the lessons' own questions, opens the
  chest, and the boss is gone for the week after a reload; five hit events and one
  win event are in the record. Captures (not committed) of the island, the intro,
  a question, a hit, the last heart and the chest.
- ADR-0008 V7-07 updated. Not done here: the long-term half of §2a (a species per
  week, crowns left on plinths, counts on the growth page); a crown on the world
  map's island label; card packs in the chest (task 06).
