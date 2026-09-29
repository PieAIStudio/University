---
id: PLAN-V7-06-WISPS-AND-PACKS
title: "V7 · 06 Review wisps, card packs and cosmetics"
type: plan
status: active
canonical: true
owner: ai-assisted
created: 2026-09-27
last_reviewed: 2026-09-27
domain: learning-experience
tags:
  - v7
  - rewards
  - backend
related:
  - REF-WORK-QUEUE
  - ADR-0008
supersedes: []
superseded_by: null
---

# Task 06 · Review wisps, card packs and cosmetics

## Context the executor does not have

- Repository `/Users/yuanfei/PieAI/University`, branch `main`; queue rules in
  [the work queue](../../reference/execution/work-queue.md). Step over `00-`.
- Design authority: [V7](../../reference/player-journey/v7/index.html),
  "让人停不下来" mechanics 3 (card packs), 5 (wisps) and 10 (dressing up), the
  pack picture, and "还是不做的三件事".
- Wisp model: `glimmerwisp.glb` (159 KB, static, no clips) from the
  world-of-claudecraft donor described in task 01.
- Storage: cosmetics, fragments and pity counters are random outcomes and cannot
  be derived, so they must be stored — a University table in SwimmerBackend, per
  account, synced across devices; odds and pity counting run on the server,
  never in the browser. Writing the migration and its tests is in scope;
  applying it to the remote database needs the Owner's authority (see the
  [backend runbook](../../reference/execution/swimmer-backend-migration.md)).
  Stop before any remote apply and report.
- SwimmerAvatarKit already has colour, material and accessory options; this task
  adds an unlock table mapping cosmetic ids to them.
- Depends on `01-` (stones exist to host wisps) and `05-` (card faces and sets).
  If either was skipped, do the part that does not need it and record the rest.

## 1 Outcome

Cards that are about to be forgotten come back as wisps floating over lessons
already cleared, with a purple ring, and two minutes of review chases them away;
blue, purple and gold chests and a full streak week give card packs that contain
only cosmetics, with the odds and the pity rule printed on the pack page.

## 2 What the Owner said

> 「从玩家心理学出发，把手游让人上瘾的招数（包括抽卡）用在学习上……你不要介意上瘾……能增加就增加，不强求。」

Binding decisions (taken at the recommended options with the Owner's approval
of V7): O1 wisps yes; Q1 packs yes, cosmetics only.

## 3 What "done" looks like

- A wisp appears over a cleared stone when that lesson has review cards due;
  reviewing them removes it. The map's review count and the wisps agree.
- Packs hold three cosmetics each: card face, card back, avatar accessory, a
  small island ornament. Odds 70 / 22 / 7 / 1 (common / rare / epic / legendary)
  shown on the page; within ten packs at least one epic or better; within fifty
  at least one legendary; duplicates become fragments redeemable for a chosen
  item.
- Packs come only from learning: blue, purple and gold chests, the weekly boss
  (task 07) and a full streak week. There is no purchase path, no key, no paid
  currency anywhere.
- Cosmetics show on the avatar, on the island, on the avatar panel and on the
  completion card.

## 4 Out of scope

- Paid randomness of any kind, losing lives for wrong answers, guilt or fear in
  reminders — the three things V7 still refuses.
- Knowledge cards inside packs (Q3 was rejected): what you learned never
  depends on luck.
- Limited-time events (R1: later).

## 5 How it is judged

| Gate | Command | Baseline 2026-09-27 at `65d49313` | Floor |
| --- | --- | --- | --- |
| fast | `pnpm verify` | green | green |
| complete | `pnpm e2e:all` (pre-push) | default 407 passed, timing 31 passed, 0 failed | green; counts may not fall |

- Server-side tests for odds (statistical bounds over many draws), both pity
  rules, fragment exchange, and rejection of a client-supplied outcome.
- Browser spec: wisp present when cards are due, gone after review; pack page
  shows the odds text.
- Capture: island with wisps, a pack reveal, the pack page.

## 6 Delivery discipline

One task, one commit, one push; no remote migration without the Owner; stop if
the complete gate cannot go green; never force-push or rewrite history.

## 7 Report back

Gate numbers verbatim, the migration file and whether it was applied, captures.

## 8 Local candidate and remaining release boundary

The in-flight University implementation has been resumed, not replaced. It has
one strict cosmetics transport contract, a verified-account-scoped cached receipt
and durable operation outbox, a Supabase adapter, the existing UIKit pack cards,
a wardrobe at `/wardrobe`, and account-selected card/hat/island presentation.
A request deadline means the outcome is unknown; retry keeps the exact operation
id. Malformed or old-account receipts cannot spend another pack or enter the
current account. Timers are supplied by the host, keeping core platform-neutral.
The avatar editor still edits the base recipe, not an equipped overlay.

`COSMETICS_SERVICE_RELEASED` remains **false**. The actual product honestly shows
that packs are not open. Browser fixtures use fixed, memory-only transport
receipts; they prove interaction, not server randomness, RLS, remote migration,
real learning grants or cross-device acceptance. They never enable the product
switch, write a real account or consume a paid service.

The current continuation could not discover the owning SwimmerBackend project:
that plugin call was blocked by the tool safety layer. No alternative access path
was used to bypass it. A migration's presence or prior verification in that
repository is therefore **not established here**, and no remote apply occurred.
Do not count frontend mocks as the required server tests.

Before release, the Backend owner must verify its actual migration/RPC and run
server-side odds, 10/50-pack guarantees, duplicate exchange, client-outcome
rejection, owner isolation, atomic retries and concurrent-device tests. The same
review must bind the published course metadata to all approved reward amounts:
blue/purple one pack, gold three, first-try upgrades, purple avatar awards,
weekly/streak awards, completed sets and the extra all-shining-set reward.
`cosmetic-rewards.json` is registration input only, **not proof these grants work**.
The present metadata projection does not yet represent the extra all-shining
award; complete its contract with the real Backend implementation before enabling.
Owner approval is still separately required for remote migration/registration.

The missing explicit concept links in the currently published courses remain
with the [existing authoring request](../../reference/execution/knowledge-card-authoring-request.md).
No fabricated set is substituted for them and no course was edited or published.
Task 06 stays active until its backend acceptance is real; independent task 08
may proceed after the local candidate's ordinary gates and push are green.

Local candidate acceptance (2026-09-30, not backend acceptance):

- `pnpm verify`: `VERIFY_EXIT=0`, including all workspace types, unit suites,
  both builds, 64 shared stylesheets, content and documentation gates. Receipt:
  `SCRATCH/v7-execution/cosmetics-verify-r3.log`. The earlier attempts failed
  on two lint findings and the new CSS export, both corrected rather than waived.
- Actual closed product, both modes at 1440/390px, plus synthetic pack/account
  presentation and real due-card review: `7 passed (1.5m)`, `E2E_EXIT=0`,
  `cosmetics-browser-r2.log`. The real first lesson's three review cards were
  recalled through the existing UI and FSRS; its wisp disappeared on return.
- Final scene readiness and disposal checks: `2 passed (30.6s)`, `E2E_EXIT=0`,
  `cosmetics-browser-r3.log`. Switching accounts removed the actual equipped
  mesh and disposed both its geometry and material. A lost transport response
  recovered the identical operation rather than opening another pack.
- Screenshots inspected under `SCRATCH/e2e/cosmetics/`: closed phone wardrobe,
  ordered rarest reveal and the actual course renderer's grounded crystal.
  Synthetic filenames describe fixed fixture inventory, not earned items.
  The close-up changes only the inspector camera, never object positions.
- No migration/registration/release switch, real-account operation, paid call,
  course publication, production deployment or physical-device test occurred.

Ordinary pre-push acceptance is still the boundary for saving this candidate
remotely. Its terminal receipt is retained beside these logs; a local verify
alone must not be described as a successful push.
