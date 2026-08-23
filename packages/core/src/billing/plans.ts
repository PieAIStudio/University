/**
 * What the plans cost, in one place.
 *
 * Priced against Duolingo, not against a Chinese subscription market. This
 * product sells in dollars to people who already pay for Super or Max, and the
 * number they compare against is the one on that page — a price set for a
 * different market reads as either suspiciously cheap or unexplained, and both
 * cost the sale.
 *
 * Duolingo, August 2026: Super $12.99/mo and $95.99/yr, Max $29.99/mo, Family
 * $119.99/yr for six seats. The two individual tiers map one to one.
 *
 * The study-group plan is the one that deliberately does not copy them.
 * Six seats is a household; people learning to code together are colleagues or
 * classmates, and three is that group. And the discount is shallower on
 * purpose: Duolingo's marginal cost per extra seat is close to zero, ours is a
 * real AI bill per seat, so a plan discounted to their depth would be sold at
 * a loss by exactly the customers who use it most.
 *
 * Which is the reason for `dailyAiTurns` and for the test beside this file.
 * Every AI turn on a paid plan costs real money, so a daily cap is not a
 * product decision dressed as a limit — it is the only thing bounding what one
 * subscriber can cost. The first draft of these numbers (60/day apprentice,
 * 300/day craftsman) would have cost $120 and $1,204 a year at the cap against
 * $95.99 and $239.99 of revenue. Both were sold at a loss to their heaviest
 * users, and nothing in the code would have said so.
 *
 * `plans.test.ts` now prices every plan at its own cap and fails if the year
 * costs more than it sells for. Typical use is nearer a tenth of the cap, so
 * these are worst cases, not forecasts — but a worst case that loses money is a
 * plan whose most engaged customers are the ones who hurt.
 */

/** Rough cost of one tutoring turn, in dollars: ~2.5k tokens in, ~600 out. */
export const TURN_TOKENS = { input: 2500, output: 600 } as const;

/** Anthropic list prices, August 2026, dollars per million tokens. */
export const MODEL_PRICES = {
  haiku: { input: 1.0, output: 5.0 },
  sonnet: { input: 2.0, output: 10.0 },
} as const;

export type ModelTier = keyof typeof MODEL_PRICES;

export function costPerTurn(model: ModelTier): number {
  const price = MODEL_PRICES[model];
  return (TURN_TOKENS.input / 1e6) * price.input + (TURN_TOKENS.output / 1e6) * price.output;
}

/** What one seat costs us in a year if it is used to the cap every single day. */
export function worstCaseYearlyCost(plan: Plan): number {
  if (plan.dailyAiTurns === null) return 0;
  return costPerTurn(plan.model) * plan.dailyAiTurns * 365 * plan.seats;
}

export type PlanId = "free" | "apprentice" | "craftsman" | "study-group";

export interface Plan {
  readonly id: PlanId;
  readonly name: string;
  /** US dollars per month, billed monthly. `null` for the free tier. */
  readonly monthly: number | null;
  /** US dollars for a year, billed once. */
  readonly yearly: number | null;
  readonly seats: number;
  /** AI turns per day, per seat. `null` means the earn-as-you-learn rule applies. */
  readonly dailyAiTurns: number | null;
  /** Which model answers on this plan. It is most of the cost difference. */
  readonly model: ModelTier;
  readonly lines: readonly string[];
}

export const PLANS: readonly Plan[] = [
  {
    id: "free",
    name: "免费",
    monthly: null,
    yearly: null,
    seats: 1,
    dailyAiTurns: null,
    model: "haiku",
    lines: [
      "全部课程，全部关卡，不锁课",
      "记忆曲线复习，进度存在这台设备上",
      "AI 每天 1 次，每学完一节再挣 1 次，当天最多 4 次",
    ],
  },
  {
    id: "apprentice",
    name: "学徒",
    monthly: 12.99,
    yearly: 95.99,
    seats: 1,
    dailyAiTurns: 30,
    model: "haiku",
    lines: [
      "免费版的一切",
      "AI 讲解每天 30 次，够一整天连着问",
      "进度跨设备同步，换电脑接着学",
      "没有广告打断",
    ],
  },
  {
    id: "craftsman",
    name: "匠人",
    monthly: 29.99,
    yearly: 239.99,
    seats: 1,
    dailyAiTurns: 50,
    model: "sonnet",
    lines: [
      "学徒版的一切",
      "换更强的模型答题、改你的代码，每天 50 次",
      "把课钉在真实软件的某个版本上，跟着一起跑",
      "新课先给你",
    ],
  },
  {
    id: "study-group",
    name: "学习小组",
    /*
      Three apprentice seats bought separately are $287.97 a year. This is 25%
      off that, not the 84% Duolingo's family plan takes off six — their extra
      seat costs them nothing and ours costs a real AI bill. At 30 turns a day
      per seat the worst case is about $180 of model spend against $215.99, the
      same margin the individual plans carry. The earlier $179.99 was under
      that floor: the plan would have lost money on any group that used it.
    */
    monthly: 22.99,
    yearly: 215.99,
    seats: 3,
    dailyAiTurns: 30,
    model: "haiku",
    lines: ["3 个人，每人一份学徒版", "看得见同伴学到哪一关，在线时看得见对方的光标", "一份账单"],
  },
];

export const planById = (id: PlanId) => PLANS.find((plan) => plan.id === id);

/** What a year costs versus twelve months of the same plan, as a fraction saved. */
export function yearlySaving(plan: Plan): number | null {
  if (plan.monthly === null || plan.yearly === null) return null;
  return 1 - plan.yearly / (plan.monthly * 12);
}

/**
 * What one seat of the group plan costs per month, billed yearly.
 *
 * Exported because it is the only number that makes the group plan legible: on
 * its own $179.99 looks like more than $95.99, and it is — for three people.
 */
export function groupPerSeatMonthly(): number {
  const group = planById("study-group")!;
  return group.yearly! / 12 / group.seats;
}
