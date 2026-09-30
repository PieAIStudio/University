import { withInterfaceLocale } from "../../../test-support/interface-locale.js";
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
      renderToStaticMarkup(withInterfaceLocale(<QuestsScreen document={document} now={NOW} />)),
      renderToStaticMarkup(withInterfaceLocale(<BadgeWall document={document} />)),
      renderToStaticMarkup(withInterfaceLocale(<LeagueScreen document={document} now={NOW} />)),
      renderToStaticMarkup(withInterfaceLocale(<PlansScreen />)),
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
    const markup = renderToStaticMarkup(
      withInterfaceLocale(<QuestsScreen document={emptyProgress()} now={NOW} />),
    );
    expect(markup).toContain("每天 1 关");
    expect(markup).toContain("接上学习的日子");
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
      withInterfaceLocale(<QuestsScreen document={docWith({ cards: { k: due } })} now={NOW} />),
    );
    expect(markup).toContain("0 / 3");
    expect(markup).not.toContain("不计分");
  });

  it("marks a lesson finished today as done", () => {
    const document = docWith({
      lessons: { a: { progress: 1, completedAt: NOW - 3600_000, attempts: 1 } },
    });
    const markup = renderToStaticMarkup(
      withInterfaceLocale(<QuestsScreen document={document} now={NOW} />),
    );
    expect(markup).toContain("完成");
  });
});

describe("BadgeWall", () => {
  /*
    A locked badge shows its rule. A wall of question marks is a puzzle, and
    this is not a game about guessing what the game wants.
  */
  it("shows every rule, including the locked ones", () => {
    const markup = renderToStaticMarkup(
      withInterfaceLocale(<BadgeWall document={emptyProgress()} />),
    );
    expect(markup).toContain("连续学习达到 7 天");
    expect(markup).toContain("连续学习达到 100 天");
    expect(markup).toContain("0 / 17");
  });
});

describe("LeagueScreen", () => {
  it("shows the ladder and where you stand on it", () => {
    const markup = renderToStaticMarkup(
      withInterfaceLocale(<LeagueScreen document={emptyProgress()} now={NOW} />),
    );
    expect(markup).toContain("石阶");
    expect(markup).toContain("黑曜阶");
  });

  /*
    No invented opponents, ever. A leaderboard the learner later finds out was
    fictional discredits every real number sitting next to it.
  */
  it("describes personal growth without an empty leaderboard disclaimer", () => {
    const markup = renderToStaticMarkup(
      withInterfaceLocale(<LeagueScreen document={emptyProgress()} now={NOW} />),
    );
    expect(markup).toContain("这里记录你自己的积累");
    expect(markup).toContain("data-growth-details");
  });

  it("does not invent a real leaderboard after sign-in", () => {
    const markup = renderToStaticMarkup(
      withInterfaceLocale(<LeagueScreen document={emptyProgress()} now={NOW} signedIn />),
    );
    expect(markup).not.toContain("还没有别人可以比");
    expect(markup).toContain("这里记录你自己的积累");
  });
});

describe("PlansScreen", () => {
  it("states in plain language that courses stay free while AI is gated by plan and quota", () => {
    const markup = renderToStaticMarkup(withInterfaceLocale(<PlansScreen />));
    expect(markup).toContain("全部课程免费学");
    expect(markup).toContain("绑定邮箱，每天体验 AI 批改");
    expect(markup).toContain("AI 批改按次另计");
    // Sync remains a benefit, not the V7 headline. The card must also disclose
    // the separate wallet cost rather than promising included AI usage.
    expect(markup).toContain("学习进度、复习卡同步");
    expect(markup).toContain("免费");
    expect(markup).not.toContain("当前基线");
    expect(markup).not.toContain("当前权益基线");
    expect(markup).not.toContain("远端");
    expect(markup).not.toContain("服务端权益");
  });

  it("foregrounds grading but never sells wallet usage as included unlimited service", () => {
    // The current service meters a member's grading through the wallet.
    // Foreground its useful feedback without claiming the intended future
    // included/unlimited offer. Availability remains the port's decision.
    const markup = renderToStaticMarkup(withInterfaceLocale(<PlansScreen />));
    expect(markup).toContain("开放题 AI 批改与讲解");
    expect(markup).toContain("AI 批改按次另计");
    expect(markup).not.toContain("开放式辅导按用量计费");
    expect(markup).not.toContain("尚未开放");
    expect(markup).toContain("手机、电脑、平板接着学");
    expect(markup).toContain("3 台设备");
    // Still not claimed: a wording that promises a shape of feedback the
    // service does not guarantee.
    expect(markup).not.toContain("中文评语");
    expect(markup).not.toContain("最多三条补充建议");
  });

  it("shows the configured member prices and keeps the purchase CTA visible", () => {
    const markup = renderToStaticMarkup(withInterfaceLocale(<PlansScreen />));
    expect(markup).toContain("$149.00");
    expect(markup).toContain("$12.42");
    // The Owner retained the upgrade action without a permanent sale-status
    // banner. The unavailable port must explain an attempt without charging.
    expect(markup).not.toContain("会员尚未开售");
    expect(markup).toContain("升级会员");
    expect(markup).not.toContain("待产品确认");
    expect(markup).not.toContain('disabled=""');
  });

  it("shows the billing-cycle choice once a paid price is configured", () => {
    const markup = renderToStaticMarkup(withInterfaceLocale(<PlansScreen />));
    expect(markup).toContain("按年");
    expect(markup).toContain("按月");
    expect(markup).not.toContain("付费档位和价格尚未填入");
  });
});
