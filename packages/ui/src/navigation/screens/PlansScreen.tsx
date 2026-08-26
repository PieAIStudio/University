import { GameButton, GameCallout, GamePanel } from "@pieai/swimmer-ui-kit";
import { PLANS, type Plan, type PlanPricing } from "@pieai/university-core";
import { useState } from "react";

/**
 * 会员 — this surface explains the entitlement boundary. Price and paid
 * tiers stay in the shared billing configuration until the product decision
 * exists.
 */
export const PLANS_TITLE = "会员";

function configuredPrice(pricing: PlanPricing, yearly: boolean): string | null {
  if (pricing.kind !== "configured") return null;
  const cents = yearly ? pricing.yearlyCents : pricing.monthlyCents;
  if (cents === null) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: pricing.currency,
  }).format(cents / 100);
}

function priceLabel(pricing: PlanPricing, yearly: boolean) {
  if (pricing.kind === "free") {
    return <span className="plan-card__amount">免费</span>;
  }

  const price = configuredPrice(pricing, yearly);
  if (price === null) {
    return <span className="plan-card__amount">价格待定</span>;
  }

  return (
    <>
      <span className="plan-card__amount">{price}</span>
      <span className="plan-card__period">{yearly ? " / 年" : " / 月"}</span>
    </>
  );
}

function planButtonLabel(pricing: PlanPricing): string {
  if (pricing.kind === "free") return "当前基线";
  if (pricing.kind === "pending") return "等待配置";
  return "支付接入后选择";
}

function PlanCard({ plan, yearly }: { plan: Plan; yearly: boolean }) {
  const available = plan.pricing.kind === "free";

  return (
    <li className="plan-card">
      <GamePanel>
        <div className="plan-card__head">
          <h2 className="plan-card__name">{plan.name}</h2>
        </div>

        <p className="plan-card__price">{priceLabel(plan.pricing, yearly)}</p>

        <ul className="plan-card__lines">
          {plan.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>

        <GameButton variant={available ? "secondary" : "ghost"} type="button" disabled={!available}>
          {planButtonLabel(plan.pricing)}
        </GameButton>
      </GamePanel>
    </li>
  );
}

export function PlansScreen() {
  const [yearly, setYearly] = useState(true);
  const hasConfiguredCycle = PLANS.some((plan) => plan.pricing.kind === "configured");

  return (
    <section className="shell-screen">
      <header className="shell-screen__head">
        <h1>{PLANS_TITLE}</h1>
        <p className="shell-screen__lede">
          课文不设付费墙，所有已发布课程都能学。权益只描述 AI 和同步；价格与具体档位等产品决定。
        </p>
      </header>

      {hasConfiguredCycle ? (
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
      ) : null}

      <ul className="plan-grid">
        {PLANS.map((plan) => (
          <PlanCard key={plan.id} plan={plan} yearly={yearly} />
        ))}
      </ul>

      <GameCallout tone="info" heading="当前权益基线">
        现在只配置了免费基线：确定性判题继续可用；登录并且有远端时同步进度；没有远端时继续本机学习。
        付费档位和价格尚未填入，所以这里不会先做购买承诺。
      </GameCallout>
    </section>
  );
}
