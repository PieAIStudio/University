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

An earlier continuation could not discover the owning SwimmerBackend project:
that plugin call was blocked by the tool safety layer and no alternate access
path was used. After the connection recovered, the existing backend candidate
was inspected and verified through its normal project route. Migration
`20260929010000_university_cosmetics.sql` and its tests are now committed and
normally pushed at `5c003fd9b8479a032718947f60d0d18e476b83f1`, with the exact
remote SHA independently checked. No remote migration or registration occurred.
Frontend mocks still do not count as server acceptance.

Before release, the Backend owner must verify its actual migration/RPC and run
server-side odds, 10/50-pack guarantees, duplicate exchange, client-outcome
rejection, owner isolation, atomic retries and concurrent-device tests. The same
review must bind the published course metadata to all approved reward amounts:
blue/purple one pack, gold three, first-try upgrades, purple avatar awards,
weekly/streak awards, completed sets and the extra all-shining-set reward.
`cosmetic-rewards.json` is registration input only, **not proof these grants work**.
The resumed metadata projection now represents the extra all-shining award,
using the same authored-set membership as the album and each review card's own
revision. An unlinked starter gift supplies no evidence of memory. Complete
this contract with the real Backend implementation before enabling.
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

### Reduced-motion integration repair

The inherited `3559448e` push ended with **1 failed / 444 passed (22.5m)**,
`PUSH_EXIT=1`, before the timing lane. The reduced-motion chest could commit
`data-chest-stage="rewards"` with an empty list, then fill it from a passive
effect. A focused unmodified rerun passed (**1 passed (50.2s)**), but three
effect-free render controls reproduced the missing rewards deterministically.
The complete list and its available action now derive in the same render;
the ordinary timed reveal and an already-running throw retain their lifecycle.
Closed/opening chests still show no premature completion. No browser assertion,
timeout or count floor was relaxed. The repaired chest/album unit subset passed
**20 tests**. The original failed push and both controls remain under
`SCRATCH/v7-execution/cosmetics-*`; final verification and normal push are still
required for this repair.

The repaired actual-browser chest/wardrobe subset passed **10 tests (2.2m)**,
`E2E_EXIT=0`; the reduced-motion screenshot was inspected at
`SCRATCH/e2e/cosmetics/reduced-motion-chest.png`. The first full verify then
stopped at the existing `/league` full-App jsdom test's 5-second execution
timeout (**6.7s** under the full app suite). Its unchanged standalone file
passed **6 tests**, with that case taking **1.9s**. This functional integration
case now uses the same **15-second** execution allowance as its two neighboring
full-profile cases. All its DOM assertions remain, and no browser action,
timing threshold or visual budget was changed. This allowance is recorded
explicitly rather than presented as a product performance improvement.

### Resumed reward-contract acceptance

The inherited reward-contract changes share learning-domain and set membership
between the album and registration producer, record real challenge wins, and
retain a zero-XP witness for a flawless weekly boss before its one win event.
Late fight and chest-drop callbacks are scoped to their account, island and week.
These records support later server acceptance; the closed service is unchanged.

The previous contract browser run was **18 passed / 1 failed (3.3m)**: its
weekly-win counter incorrectly counted the new flawless witness as another win.
The corrected test requires exactly one date-shaped win worth 50 XP, five hit
events, a zero-XP flawless witness and exactly 100 XP in total; no reward or
duplicate-win assertion is relaxed. After connection recovery, that exact
weekly scenario passed **1 passed (56.9s)**, `E2E_EXIT=0`, in
`SCRATCH/v7-execution/cosmetics-contract-weekly-final.log`.
The final University `pnpm verify` returned `VERIFY_EXIT=0` in
`cosmetics-resumed-verify.log`. Backend's actual local SQL returned **14 passed,
0 failed**, its six independent-connection PostgreSQL cases passed, and the
shared native harness retained all six YaZu cases. Backend's full source-only
verify, static migration and documentation checks each returned
`COMMAND_EXIT=0`; exact `resumed-*` receipts remain in its
`.devspace-reports/university-v7-cosmetics/` directory. Hosted target/database
and environment-file inputs were blank, and no provider, account or production
data was used. The normal University push remains the next delivery gate.

Task 06's local source implementation is ready for that gate; its remaining
work is the separately approved remote rollout, real Data API/account checks
and only then service activation. Keep this task active as the owner of that
boundary, and proceed to independent 08 after the ordinary push passes.

### Full-gate settling repair

The ordinary push of `bd610a59` returned **2 failed / 443 passed (23.3m)**,
`PUSH_EXIT=1`, before the timing lane. The failures were an island comparison
captured during re-projection and the English authoring PRIMM second verdict.
Both passed in isolation (**2 passed (42.6s)**); that does not replace the gate.

The comparison now re-reads the same visibility-checking target registry for
at most 1.5 seconds after layout, publishing promptly once two are available.
It still refuses covered/missing targets and cancels on scope exit. Four
controlled tests cover delayed projection, immediate admission, an honestly
insufficient map and cancellation. There is no idle polling loop.

A separate PRIMM negative control reproduced a fresh content-array response
stealing the evaluation button's focus and scrolling back to the heading.
Focus now follows the actual step, while progress still follows current
content. The old behavior failed; all seven step tests passed after the fix.
The browser's second press additionally waits for native enabled state and
requires exactly two grading calls, preserving fail, repaired pass and the
original completion assertions. The original intermittent verdict failure's
exact scheduling is not claimed reproduced by the focus test.

Before the final focus adjustment, repeated real-browser guide/PRIMM checks
were **12 passed (1.4m)**, `E2E_EXIT=0`. Final verification and a new ordinary
push are required for the resulting code; the previous failed log is retained.

### Source delivery and the remaining gate

The source candidate and settling repairs are now on University `main`; the
subsequent ordinary push through `cf6a1f62` passed **465 default tests (24.2m)**
and **39 timing tests (5.5m)**, native push exit **0**, and an independent remote
read matched that SHA. This records source delivery only, not a service rollout.

Backend's follow-up commit `e2db9b52aa3ab1ac3c71da4a6bf75baf1389d17c` is also on
its independently checked remote `main`. Its forward migration
`20260930183000_university_cosmetics_rehearsal_boundary.sql` prevents optional
practice attempts from granting official chest eligibility or changing a real
first-try upgrade. Three failing SQL counterexamples preceded the fix; **17 SQL
cases**, **six independent PostgreSQL connection cases**, complete source
verification and static/document checks passed. The original migration was not
rewritten. Backend's existing `docs/reference/university-cosmetics.md` owns the
exact source/rollout evidence; unrelated in-flight Backend changes were not touched.

`COSMETICS_SERVICE_RELEASED` remains false. The only remaining task-06 work is
separately authorized remote migration/manifest registration, real own-account
Data API checks and reviewed activation. Do not rerun local random draws as a
substitute or mark this active record completed because source was pushed.
