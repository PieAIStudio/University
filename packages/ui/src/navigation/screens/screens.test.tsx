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
  it("states that content is open and only AI and sync are in scope", () => {
    const markup = renderToStaticMarkup(<PlansScreen />);
    expect(markup).toContain("课文不设付费墙");
    expect(markup).toContain("AI 和同步");
    expect(markup).toContain("免费");
  });

  it("keeps a purchase CTA visible while the price is still a product decision", () => {
    const markup = renderToStaticMarkup(<PlansScreen />);
    expect(markup).toContain("待产品确认");
    expect(markup).toContain("查看购买入口");
    expect(markup).not.toContain('disabled=""');
  });

  it("does not promise a price or a paid tier before configuration", () => {
    const markup = renderToStaticMarkup(<PlansScreen />);
    expect(markup).toContain("付费档位和价格尚未填入");
    expect(markup).not.toContain("按年");
    expect(markup).not.toContain("$95.99");
  });
});
