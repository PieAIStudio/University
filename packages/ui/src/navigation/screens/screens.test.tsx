import { emptyProgress, type ProgressDocument } from "@pieai/university-core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BadgeWall } from "./BadgeWall.js";
import { LeagueScreen } from "./LeagueScreen.js";
import { PlansScreen } from "./PlansScreen.js";
import { QuestsScreen } from "./QuestsScreen.js";

const NOW = new Date(2026, 7, 23, 10, 0).getTime();

function docWith(patch: Partial<ProgressDocument>): ProgressDocument {
  return { ...emptyProgress(), ...patch };
}

/*
  The four screens that used to say 「还没开张」. The assertion that matters on
  every one of them is the same: nothing on the page is a placeholder, and no
  number on it was invented.
*/
describe("the four screens are open", () => {
  it("none of them still says it has not opened", () => {
    const document = emptyProgress();
    const pages = [
      renderToStaticMarkup(<QuestsScreen document={document} now={NOW} />),
      renderToStaticMarkup(<BadgeWall document={document} />),
      renderToStaticMarkup(<LeagueScreen document={document} now={NOW} />),
      renderToStaticMarkup(<PlansScreen />),
    ];
    for (const markup of pages) {
      expect(markup).not.toContain("还没开");
      expect(markup).not.toContain("还没开张");
    }
  });
});

describe("QuestsScreen", () => {
  /*
    A brand-new learner has no cards, so nothing is due, so the review quest is
    satisfied before they touch anything. Counting it would open the app on
    "1/3 done" — a third of the day handed over for free, which is exactly the
    kind of number that makes every other number on the screen suspect.
  */
  it("does not score a quest the scheduler has nothing for", () => {
    const markup = renderToStaticMarkup(<QuestsScreen document={emptyProgress()} now={NOW} />);
    expect(markup).toContain("学一节新课");
    expect(markup).toContain("把连击接上");
    expect(markup).toContain("0 / 2");
    expect(markup).toContain("不计分");
  });

  it("scores all three once cards are actually due", () => {
    const due = {
      cardKey: "k",
      studyId: "s",
      courseId: "c",
      lessonId: "l",
      dueAt: NOW - 1000,
      fsrs: {
        due: new Date(NOW - 1000).toISOString(),
        stability: 1,
        difficulty: 5,
        elapsed_days: 0,
        scheduled_days: 1,
        learning_steps: 0,
        reps: 1,
        lapses: 0,
        state: 1,
      },
    } as ProgressDocument["cards"][string];
    const markup = renderToStaticMarkup(
      <QuestsScreen document={docWith({ cards: { k: due } })} now={NOW} />,
    );
    expect(markup).toContain("0 / 3");
    expect(markup).not.toContain("不计分");
  });

  it("marks a lesson finished today as done", () => {
    const document = docWith({
      lessons: { a: { progress: 1, completedAt: NOW - 3600_000, attempts: 1 } },
    });
    const markup = renderToStaticMarkup(<QuestsScreen document={document} now={NOW} />);
    expect(markup).toContain("完成");
  });
});

describe("BadgeWall", () => {
  /*
    A locked badge shows its rule. A wall of question marks is a puzzle, and
    this is not a game about guessing what the game wants.
  */
  it("shows every rule, including the locked ones", () => {
    const markup = renderToStaticMarkup(<BadgeWall document={emptyProgress()} />);
    expect(markup).toContain("连续 7 天来学");
    expect(markup).toContain("连续 100 天来学");
    expect(markup).toContain("0 / 10");
  });
});

describe("LeagueScreen", () => {
  it("shows the ladder and where you stand on it", () => {
    const markup = renderToStaticMarkup(<LeagueScreen document={emptyProgress()} now={NOW} />);
    expect(markup).toContain("石阶");
    expect(markup).toContain("黑曜阶");
  });

  /*
    No invented opponents, ever. A leaderboard the learner later finds out was
    fictional discredits every real number sitting next to it.
  */
  it("says plainly that there is nobody to rank against yet", () => {
    const markup = renderToStaticMarkup(<LeagueScreen document={emptyProgress()} now={NOW} />);
    expect(markup).toContain("还没有别人可以比");
  });

  it("drops that notice once there is an account", () => {
    const markup = renderToStaticMarkup(
      <LeagueScreen document={emptyProgress()} now={NOW} signedIn />,
    );
    expect(markup).not.toContain("还没有别人可以比");
  });
});

describe("PlansScreen", () => {
  it("states in plain language that courses stay free while AI is gated by plan and quota", () => {
    const markup = renderToStaticMarkup(<PlansScreen />);
    expect(markup).toContain("所有已发布课程都能免费学");
    expect(markup).toContain("每天有少量 AI 批改尝鲜额度");
    expect(markup).toContain("用完今天停止，明天恢复");
    // The lede describes what the account layer actually delivers today. The
    // paid grading right is deliberately absent here as well as on the card;
    // see the guard below for why.
    expect(markup).toContain("会员买的是账号那一半");
    expect(markup).toContain("免费");
    expect(markup).not.toContain("当前基线");
    expect(markup).not.toContain("当前权益基线");
    expect(markup).not.toContain("远端");
    expect(markup).not.toContain("服务端权益");
  });

  it("sells structured grading now that all three layers can keep the promise", () => {
    // This claim was held back while production could not answer "is this
    // account a member". Three things had to be true at once, and on
    // 2026-08-31 they were: the plan-grant read is live in production,
    // `createSupabasePaymentRemote` calls it, and the grading service that
    // consults the plan before quota or wallet is the code actually deployed.
    // The first landed days before the other two, which is why the condition
    // was written as all three rather than as "the migration shipped".
    //
    // The page still does not claim you can buy this today. No payment
    // provider is connected, and the purchase control says so itself rather
    // than letting the reader find out by clicking.
    const markup = renderToStaticMarkup(<PlansScreen />);
    expect(markup).toContain("不受每日免费尝鲜额度封顶");
    expect(markup).toContain("开放式辅导按用量计费");
    expect(markup).toContain("换手机也不用从头来");
    expect(markup).toContain("三台设备");
    // Still not claimed: a wording that promises a shape of feedback the
    // service does not guarantee.
    expect(markup).not.toContain("中文评语");
    expect(markup).not.toContain("最多三条补充建议");
  });

  it("shows the configured member prices and keeps the purchase CTA visible", () => {
    const markup = renderToStaticMarkup(<PlansScreen />);
    expect(markup).toContain("$149.00");
    expect(markup).toContain("$12.42");
    expect(markup).toContain("购买");
    expect(markup).not.toContain("待产品确认");
    expect(markup).not.toContain('disabled=""');
  });

  it("shows the billing-cycle choice once a paid price is configured", () => {
    const markup = renderToStaticMarkup(<PlansScreen />);
    expect(markup).toContain("按年");
    expect(markup).toContain("按月");
    expect(markup).not.toContain("付费档位和价格尚未填入");
  });
});
