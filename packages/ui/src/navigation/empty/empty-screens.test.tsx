// @vitest-environment jsdom

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  LeagueEmpty,
  LEAGUE_EMPTY_ACTION,
  LEAGUE_EMPTY_DESCRIPTION,
  LEAGUE_EMPTY_TITLE,
} from "./LeagueEmpty.js";
import { PlansEmpty, PLANS_EMPTY_DESCRIPTION, PLANS_EMPTY_TITLE } from "./PlansEmpty.js";
import { ProfileScreen } from "./ProfileScreen.js";
import {
  QuestsEmpty,
  QUESTS_EMPTY_ACTION,
  QUESTS_EMPTY_DESCRIPTION,
  QUESTS_EMPTY_TITLE,
} from "./QuestsEmpty.js";
import { SettingsScreen, SettingsSubnav } from "./SettingsScreen.js";

describe("empty destinations", () => {
  it("keeps the league copy verbatim", () => {
    const markup = renderToStaticMarkup(<LeagueEmpty />);
    expect(markup).toContain(LEAGUE_EMPTY_TITLE);
    expect(markup).toContain(LEAGUE_EMPTY_DESCRIPTION);
    expect(markup).toContain(LEAGUE_EMPTY_ACTION);
  });

  it("keeps the quests copy verbatim", () => {
    const markup = renderToStaticMarkup(<QuestsEmpty />);
    expect(markup).toContain(QUESTS_EMPTY_TITLE);
    expect(markup).toContain(QUESTS_EMPTY_DESCRIPTION);
    expect(markup).toContain(QUESTS_EMPTY_ACTION);
  });

  it("keeps the plans copy verbatim and has no action", () => {
    const markup = renderToStaticMarkup(<PlansEmpty />);
    expect(markup).toContain(PLANS_EMPTY_TITLE);
    expect(markup).toContain(PLANS_EMPTY_DESCRIPTION);
    expect(markup).not.toContain("<button");
  });

  it("renders settings as a real page with sound and language controls", () => {
    const markup = renderToStaticMarkup(<SettingsScreen />);
    expect(markup).toContain("偏好设置");
    expect(markup).toContain("声音");
    expect(markup).toContain("语言层");
    expect(renderToStaticMarkup(<SettingsSubnav />)).toContain("个人档案");
  });

  it("renders the two real numbers on the profile page", () => {
    const markup = renderToStaticMarkup(
      <ProfileScreen passagesRead={4} lessonsCompleted={2} avatar={<span>头像</span>} />,
    );
    expect(markup).toContain("头像");
    expect(markup).toContain("4");
    expect(markup).toContain("2");
    expect(markup).toContain("读过真实代码");
    expect(markup).toContain("徽章墙");
    expect(markup).toContain("#/practice");
    expect(markup).toContain("#/review");
  });

  it("turns a zero into an invitation that points at the next lesson", () => {
    const markup = renderToStaticMarkup(
      <ProfileScreen
        passagesRead={0}
        lessonsCompleted={0}
        nextHref="#/turing-pact/foundations-before-zero"
        avatar={<span>头像</span>}
      />,
    );
    expect(markup).toContain("头像");
    expect(markup).toContain("还没读过真实代码 —— 第一节里就有");
    expect(markup).toContain("还没学完一节 —— 从这里开始");
    expect(markup).toContain("#/turing-pact/foundations-before-zero");
    expect(markup).toContain("徽章还没开张");
    expect(markup).not.toContain("<span>段</span>");
    expect(markup).not.toContain("<span>节</span>");
  });
});
