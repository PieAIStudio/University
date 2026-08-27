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
abuse is already bounded twice — an account is only created after a lesson is
finished, and each account has a hard daily cap. Being *more* generous than
instinct suggests is the correct default; the scarce resource is attention,
not money.

## Pricing

**Status: not decided.** `packages/core/src/billing/plans.ts` carries the paid
plan's rights with `pricing: { kind: "pending" }`, and a test forbids any plan
from carrying a price the product has not named. Nothing in the code depends
on a number.

A reasoned starting point is **¥39/month or ¥299/year**: comfortably above the
¥6.26 heavy-user cost, inside the range Chinese consumers treat as an
unremarkable monthly digital subscription, and under the ¥300 threshold for
the annual option. This is reasoning, not research — attempts to confirm
competitor pricing returned contradictory figures, so the number must be
checked against live prices before launch.

The more useful conclusion is structural: at this cost base the gross margin
is high enough that **price is not the lever — conversion and retention are.**
A 20% price rise is worth less than moving conversion from 2% to 3%.

## The Funnel, and Where Each Part Lives

| Step | Mechanism | State |
| --- | --- | --- |
| Acquisition | Addressable lesson URLs, sitemap, share cards | In progress |
| Activation | One click from landing to the first lesson | Done |
| Value demonstration | Daily free AI grading allowance | Done |
| Durability | Anonymous account created on first completion | In progress |
| Conversion | Email linked at a moment worth protecting | Next |
| Retention | FSRS review plus opt-in reminders | Client done, sender is a backend gap |
| Revenue | Wallet, orders, entitlement | Browser side done, money-in is a backend gap |
| Measurement | PostHog, fourteen events, property allowlist | Done |

## Acquisition Is The Largest Untapped Channel

579 lessons of original Chinese teaching material are currently unreachable by
search. The application used hash routing, and Googlebot discards everything
after `#` before it makes a request, so every lesson collapsed into one URL.
Baidu is worse: its ordinary spider receives an empty shell for a client
rendered application, and pre-rendering remains the recommendation.

The immediate loss is not search, though — it is sharing. Every lesson shared
into a chat showed the same title and the same description, because the
document had one of each.

## Decisions Still Owned By The Owner

- **Payment channel.** Domestic channels need a company entity, a merchant
  account and an ICP filing; Stripe needs an account. Neither is an
  engineering decision. See [Payment Backend Gap](./payment-backend-gap.md).
- **Where learner feedback goes.** The feedback control copies a note to the
  clipboard, which is right for the authoring shell and a dead end that looks
  like success in delivery. A destination has to be named before this can be
  fixed honestly.
- **A domain.** Search authority accrues to a hostname. Accruing it on one the
  product does not own means starting over later.
- **The price.** See above.
