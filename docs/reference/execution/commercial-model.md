---
id: REF-COMMERCIAL-MODEL
title: Commercial Model
type: reference
status: active
canonical: true
owner: human
created: 2026-08-27
last_reviewed: 2026-08-27
domain: execution
tags:
  - pricing
  - funnel
  - unit-economics
  - acquisition
---

# Commercial Model

What a learner costs, what the product must charge, where learners come from,
and which decisions are still the owner's to make. Numbers here are computed
from this repository's own configuration, not from memory; each one names its
source so it can be recomputed when the source changes.

## Unit Economics

Model prices come from `apps/university-grading/src/config.ts`
(`gemini-2.5-flash`, input `$0.3`/M tokens, output `$2.5`/M). One structured
grading call is costed conservatively at 1,500 input + 400 output tokens.

| | per month | note |
| --- | ---: | --- |
| One grading call | ¥0.0104 | the unit everything below multiplies |
| Free learner at the daily cap (4 answers/day, every day) | **¥1.25** | `FREE_TIER_STRUCTURED_GRADING_QUOTA_POWER_UNITS_PER_DAY = 400` |
| Free learner, typical (1 answer/day) | ¥0.31 | |
| Paid learner, heavy (20 answers/day) | ¥6.26 | excludes tier-three tutoring, which is not built |

Supabase adds ¥0.023 per monthly active user beyond the included allowance;
the free tier covers 50,000 MAU and two active projects, and a free project
pauses after a week of inactivity. Anonymous sign-ins count as MAU, and a
learner who clears local storage returns as a new one.

**The conclusion is counter-intuitive and load-bearing: the free tier is
almost free.** A maximally active free learner costs about ¥1.25 a month. The
binding constraint on the free allowance is therefore abuse, not cost, and
being *more* generous than instinct suggests is the correct default; the
scarce resource is attention, not money.

**Correction, 2026-08-27.** That paragraph used to claim abuse was "bounded
twice — an account is only created after a lesson is finished, and each
account has a hard daily cap". The second bound did not hold. The cap is per
account per UTC day, an anonymous account's only credential lives in
localStorage, and clearing browser data is a button on every device — so the
cap reset for free, and each reset also left a Supabase auth row that nothing
cleans up. The grading service had `isAnonymous` on the verified identity and
never read it.

This matters beyond the leak: a generosity argument that rests on a bound
which does not exist is not a generosity argument, it is an unpriced
liability. The bound is being made real — the daily allowance now requires an
email-bound account, decided in
[player journey v5 §10](../player-journey/v5/index.html). With that in place
the original conclusion stands, and only then.

## Pricing

**Decided 2026-08-27, for the overseas launch. This is a hypothesis with a
number on it, not a finding — it is meant to be revised against real
conversion data, and raising a price is far easier than lowering one.**

| | Price | Effective monthly |
| --- | ---: | ---: |
| Member, monthly | **US$19** | $19 |
| Member, yearly | **US$149** | $12.42 (35% off) |

### Why $19 and not $20

The whole assistant market has converged on $20/month — ChatGPT Plus, Claude
Pro, Cursor all sit there, and every buyer now reads $20 as "one AI
subscription". Developer education sits in the same band: Codecademy Pro near
$20, Boot.dev $24 ($144/year), Frontend Masters $39 ($390/year).

This product is a **supplement to** an assistant subscription, not a
replacement for one. A learner deciding whether to add it is doing the
comparison consciously, and at $20 the answer is "as much as ChatGPT". One
dollar lower moves it to "less than ChatGPT", which is the side of that
sentence a supplement has to land on. The dollar is not the point; which
sentence the buyer says to themselves is.

### Why the annual plan matters more than the discount suggests

The merchant of record fee is **per transaction**, not per dollar: 5% + $0.50.

| | Gross/year | Fees | Effective rate |
| --- | ---: | ---: | ---: |
| Twelve monthly charges | $228 | $17.40 | 7.6% |
| One annual charge | $149 | $7.95 | 5.3% |

The annual plan is worth 2.3 points of margin, and it removes eleven separate
occasions for a card to fail or a learner to reconsider. The 35% discount is
not a concession; it is buying retention and margin at the same time. (Boot.dev
discounts 50%, Frontend Masters 17%; 35% is unremarkable in this market.)

### The two layers, and the one that must not be built

The owner's instinct — a monthly subscription plus a usage cap, the shape
ChatGPT and Claude Code use — is already what is built: a plan grants rights,
a per-account daily allowance covers ordinary use, and the wallet covers
overflow. Nothing new is needed for it.

What must not be built is a **second currency the learner has to convert in
their head**. That is already law (v4/v5 refuse the gem-shop pattern), and the
product is currently breaking it in a small but real way: eight learner-facing
strings in `packages/ui/src/review/ExerciseBlock.tsx` and
`apps/university/src/ports/online/grading.ts` quote cost and balance in
**"power units"**. A beginner reading Chinese prose cannot price a thing in an
invented unit, and a paying customer should never have to.

**Decision: the learner-facing unit is 「次」 — one AI grading. Power units
stay an internal accounting unit and never reach a screen.** The conversion is
fixed and known, so this is a presentation change, not a billing change.

### Domestic pricing is not a conversion of this one

¥ pricing for the mainland launch must be set against Chinese willingness to
pay for education subscriptions, which is materially lower than a straight FX
conversion of $19 would suggest. Do not derive it arithmetically. It is a
second decision, taken when the domestic channel actually exists (below).

### The launch blocker is not the price, it is what the price buys

**Checked 2026-08-27, and this is the finding that matters most on this page.**
The member plan advertises three lines. Against what the code actually grants:

| Member plan says | Reality |
| --- | --- |
| 「AI 读得懂你用中文写的答案，告诉你哪一步想岔了」 | A signed-in free learner already gets this, four times a day |
| 「卡住时可以一直追问，直到这件事真的弄明白」 | **Not built.** `openTutoring` exists as an entitlement flag with no implementation behind it — no endpoint, no surface |
| 「换手机、换电脑接着学，进度和复习计划都跟着走」 | The free plan already carries `sync: { included: true }`. The real difference is seats, 1 versus 3 |

So two of the three selling lines describe something the free tier already
does, and the third describes something that does not exist. **Turning on
charging in that state is selling nothing**, and the third line as written is
close to misleading, because cross-device sync is not what the money buys.

Two consequences, and neither is about the number:

1. **Do not flip the switch that actually charges until the member plan has
   something the free plan does not.** The honest candidate is already in the
   cost ladder: open tutoring, metered, the tier that lets a learner keep
   asking until the thing is understood. That is the line worth $19; the other
   two are not.
2. **The plan card's copy has to stop advertising what free already includes.**
   Sync comes off the paid card. Seats can stay, described as seats.

This also answers a question that looks like a pricing question and is not:
whether four free gradings a day is too generous. It is not too generous —
it costs ¥1.25 a month and it is the value demonstration. The problem was
never that free gives too much; it is that paid, today, adds too little.

### What does not change

Gross margin at this cost base is high in every scenario — a heavy paying
learner costs about ¥6.26/month against $19 of revenue. **Price is still not
the lever; conversion and retention are.** A 20% price rise is worth less than
moving conversion from 2% to 3%.

## Payment Channel

**Decided 2026-08-27: overseas first, through a merchant of record, and the
merchant of record is Paddle.** Domestic is a second track on its own
timetable.

### Why a merchant of record at all

Selling a $19 subscription to a developer in Berlin, one in Tokyo and one in
New York means owing three tax authorities their cut. A merchant of record
becomes the legal seller: it calculates, collects and remits VAT/GST/sales tax
across its supported jurisdictions, and it owns chargebacks. For a one-person
company that is not a convenience, it is the difference between shipping and
spending the quarter on registrations and filings.

The premium is real and worth naming: roughly 2 points over a bare payment
processor.

| | Model | Headline fee | Who owns tax |
| --- | --- | --- | --- |
| Stripe (plain) | Processor | 2.9% + $0.30 (+~1% international, +0.5% Stripe Tax, +0.7% Billing) | You |
| **Paddle** | Merchant of record | **5% + $0.50** | Paddle |
| Lemon Squeezy | Merchant of record | 5% + $0.50, plus add-ons | Lemon Squeezy |
| Stripe Managed Payments | MoR bolt-on | Stripe base **+3.5%**, ≈6.4–8% all in | Stripe |

### Why Paddle and not Lemon Squeezy

Lemon Squeezy prices identically and is the more obvious pick for a solo
founder — that was the owner's own inclination, and on features it is
defensible. The reason to decline it is ownership: **Stripe acquired Lemon
Squeezy in July 2024**, and through 2025–2026 has been steering merchants
toward Stripe Managed Payments, its own merchant-of-record product. Lemon
Squeezy still operates, still takes signups, and has no announced shutdown —
but building a billing integration on a platform whose parent sells its
successor buys a migration at an unknown date, for no price advantage. Same
5% + $0.50, more platform risk. That is the whole argument.

Stripe Managed Payments is the same trade at a higher price (roughly 6.4–8%
effective, charged on the tax-inclusive amount). Plain Stripe is genuinely
cheaper — and hands back every tax registration, which is the thing being paid
to avoid.

### The constraint that actually decides this, and why it is not settled here

Stripe does not support mainland-China businesses or individuals; using it
requires an overseas entity — a US LLC (Stripe Atlas is roughly $500 once plus
$100/year for the registered agent), or a Hong Kong / Singapore / UK company.
Paddle's published position is that it works with software businesses anywhere
outside its sanctioned list, and Chinese indie developers do integrate it,
which is precisely why it is the recommendation for a first channel.

**But onboarding, KYC and payout for a specific seller depend on the legal
entity that exists**, and only the owner knows what that is. This is the one
input the engineering side cannot supply. It is listed as an open decision
below and it does not block any code: nothing in the repository names a
provider yet.

### Domestic is a separate track, and the filing is the long pole

WeChat Pay and Alipay need a business licence and a merchant account, and a
public web service needs an ICP filing. On top of that, a public-facing
generative-AI service in China must complete 生成式人工智能服务备案 or
应用登记 with the 网信 authorities, and a filed application must display the
model name and filing number in a prominent place. Individuals generally
cannot file; a company entity is required.

The cheaper path, when the time comes, is to serve the domestic build through
a Chinese provider whose model is **already filed**, which turns full model
filing into the lighter application registration. That is a decision for the
domestic launch, not for now.

**The owner's instinct to ship overseas first is correct, and the filing
timeline is the reason.** Overseas revenue can start in weeks; the domestic
channel cannot.

## The Funnel, and Where Each Part Lives

| Step | Mechanism | State |
| --- | --- | --- |
| Acquisition | Addressable lesson URLs, sitemap, share cards | Live on university.pieaistudio.com, 579 URLs in the sitemap |
| Activation | One click from landing to the first lesson | Done |
| Value demonstration | Daily free AI grading allowance | Done |
| Durability | Anonymous account created on first completion | Done |
| Conversion | Email linked at a moment worth protecting | Magic link shipped; the daily AI allowance is now the moment (v5 §10) |
| Retention | FSRS review plus opt-in reminders | Client done, sender is a backend gap |
| Revenue | Wallet, orders, entitlement | Browser side done; provider chosen (Paddle), account not yet opened |
| Measurement | PostHog, sixteen events, property allowlist | Done |

## Acquisition Is The Largest Untapped Channel

579 lessons of original Chinese teaching material were unreachable by search
until 2026-08-27. The application used hash routing, and Googlebot discards
everything after `#` before it makes a request, so every lesson collapsed into
one URL. Baidu is worse: its ordinary spider receives an empty shell for a
client rendered application, and pre-rendering remains the recommendation.

The immediate loss was not search, though — it was sharing. Every lesson shared
into a chat showed the same title and the same description, because the
document had one of each.

**Both are now fixed and live.** Every lesson has a path address, the sitemap
carries all 579 of them, `robots.txt` points at
`https://university.pieaistudio.com/sitemap.xml` and disallows `/studio`, and
per-page titles and descriptions come from the lesson.

What remains is time, and one decision that costs nothing today and everything
later: **authority accrues to a hostname.** The product is on
`university.pieaistudio.com`, which it owns — so accrual has started and is
not being wasted. Moving to a different apex domain later means redirects and
a partial reset, so the sooner the permanent hostname is settled, the more of
this compounding is kept.

## Decisions Still Owned By The Owner

- **The selling entity.** Which legal entity opens the Paddle account — the
  provider is decided, the seller is not, and KYC and payout depend on it.
  This is the only open input blocking money-in. See
  [Payment Backend Gap](./payment-backend-gap.md).
- **The permanent hostname.** `university.pieaistudio.com` is live and
  accruing authority. If a different apex domain is intended for launch,
  moving earlier keeps more of it.
- **The domestic launch date**, which is really the 备案 start date, since the
  filing is the long pole and needs a company entity.
- **Whether $19 / $149 survives first contact.** It is a hypothesis; the
  measurement to revise it (PostHog conversion events) is already in place.
- **When to build open tutoring**, which is the real gate on charging at all —
  see "The launch blocker is not the price" above.
