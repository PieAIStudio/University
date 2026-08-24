import {
  GameBadge,
  GameButton,
  GameCallout,
  GamePanel,
  LiquidMetalButton,
} from "@pieai/swimmer-ui-kit";
import { groupPerSeatMonthly, PLANS, yearlySaving, type Plan } from "@pieai/university-core";
import { useState } from "react";

/**
 * 会员 — four plans, priced against Duolingo. Numbers live in
 * `@pieai/university-core` billing/plans.ts so the paywall and this page can
 * never quote different prices.
 */
export const PLANS_TITLE = "会员";

const money = (value: number) => `$${value.toFixed(2)}`;

function PlanCard({ plan, yearly }: { plan: Plan; yearly: boolean }) {
  const price = yearly ? plan.yearly : plan.monthly;
  const saving = yearlySaving(plan);
  const isGroup = plan.id === "study-group";

  return (
    <li className={`plan-card${plan.id === "apprentice" ? " plan-card--featured" : ""}`}>
      <GamePanel tone={plan.id === "apprentice" ? "strong" : "default"}>
        <div className="plan-card__head">
          <h2 className="plan-card__name">{plan.name}</h2>
          {plan.id === "apprentice" ? <GameBadge tone="success">最多人选</GameBadge> : null}
          {isGroup ? <GameBadge tone="neutral">3 个座位</GameBadge> : null}
        </div>

        <p className="plan-card__price">
          {price === null ? (
            <span className="plan-card__amount">免费</span>
          ) : (
            <>
              <span className="plan-card__amount">{money(price)}</span>
              <span className="plan-card__period">{yearly ? " / 年" : " / 月"}</span>
            </>
          )}
        </p>

        {/*
          The group plan's yearly price is larger than the apprentice's and
          buys three seats, so the raw number reads as more expensive until you
          do the division. Doing it for them is the difference between a plan
          that looks overpriced and one that looks obvious.
        */}
        {isGroup && yearly ? (
          <p className="plan-card__note">合每人每月 {money(groupPerSeatMonthly())}</p>
        ) : null}
        {!isGroup && yearly && saving !== null ? (
          <p className="plan-card__note">比按月付省 {Math.round(saving * 100)}%</p>
        ) : null}

        <ul className="plan-card__lines">
          {plan.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>

        {/*
          One liquid-metal button on this page, and only this one.

          The kit's own note says checkout and unlock, and warns that more than
          two on a page means the page is the wrong place. Three of the four
          cards take money, so painting all three would have been the literal
          reading and the wrong one: a decoration every option wears is not a
          recommendation, it is wallpaper, and the effect stops carrying
          meaning at exactly the moment it is meant to carry the most.

          So it marks the plan the page is actually recommending — the one
          already carrying 「最多人选」 — and the other two stay quiet secondary
          buttons that still say 「选这个」 just as plainly. Nothing about the
          other plans is harder to choose; they are simply not being pushed.
        */}
        {plan.id === "apprentice" ? (
          <LiquidMetalButton className="plan-card__cta" type="button">
            选这个
          </LiquidMetalButton>
        ) : (
          <GameButton variant="secondary" type="button">
            {price === null ? "你正在用这个" : "选这个"}
          </GameButton>
        )}
      </GamePanel>
    </li>
  );
}

export function PlansScreen() {
  const [yearly, setYearly] = useState(true);

  return (
    <section className="shell-screen">
      <header className="shell-screen__head">
        <h1>{PLANS_TITLE}</h1>
        <p className="shell-screen__lede">
          课不收钱，全部都能学。收钱的是 AI 和同步——这两样每多一个人就多一份真实成本，
          所以它们按人算。
        </p>
      </header>

      <div className="plan-toggle" role="group" aria-label="计费周期">
        <GameButton
          variant={yearly ? "primary" : "secondary"}
          type="button"
          onClick={() => setYearly(true)}
          aria-pressed={yearly}
        >
          按年
        </GameButton>
        <GameButton
          variant={yearly ? "secondary" : "primary"}
          type="button"
          onClick={() => setYearly(false)}
          aria-pressed={!yearly}
        >
          按月
        </GameButton>
      </div>

      <ul className="plan-grid">
        {PLANS.map((plan) => (
          <PlanCard key={plan.id} plan={plan} yearly={yearly} />
        ))}
      </ul>

      <GameCallout tone="info" heading="免费版为什么不锁课">
        锁着课的试用版没法判断——你付钱之前根本看不出这课讲得好不好。所以课全开，
        你自己看。真正花钱的是每次 AI 讲解背后的账单。
      </GameCallout>
    </section>
  );
}
