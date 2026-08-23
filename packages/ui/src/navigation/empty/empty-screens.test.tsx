// @vitest-environment jsdom

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createIdentityPort, createMemoryIdentityPort } from "@pieai/university-core";

import {
  ACCOUNT_PENDING_LABEL,
  ACCOUNT_SIGNED_IN_TITLE,
  ACCOUNT_SIGN_IN,
  ACCOUNT_SIGN_OUT,
  ACCOUNT_UNCONFIGURED_DESCRIPTION,
  ACCOUNT_UNSIGNED_DESCRIPTION,
  ACCOUNT_UNSIGNED_TITLE,
  AccountPanel,
} from "./AccountPanel.js";
import {
  LeagueEmpty,
  LEAGUE_EMPTY_ACTION,
  LEAGUE_EMPTY_DESCRIPTION,
  LEAGUE_EMPTY_TITLE,
} from "./LeagueEmpty.js";
import {
  PlansEmpty,
  PLANS_EMPTY_ACTION,
  PLANS_EMPTY_DESCRIPTION,
  PLANS_EMPTY_TITLE,
} from "./PlansEmpty.js";
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

  /**
   * The copy is pinned here because the wrong sentence on this page is
   * expensive in a way no other empty state is. It once said the catalogue was
   * already complete and missing nothing, which reads as "this is all yours"
   * — and every future price is then measured against that. Nothing on this
   * page may describe what the free product includes until someone decides
   * what the paid one does.
   */
  it("promises transparency instead of describing what is included", () => {
    const markup = renderToStaticMarkup(<PlansEmpty />);
    expect(markup).toContain(PLANS_EMPTY_TITLE);
    expect(markup).toContain(PLANS_EMPTY_DESCRIPTION);
    expect(markup).toContain(PLANS_EMPTY_ACTION);
    for (const claim of ["全部内容", "不缺", "免费", "都是你的"]) {
      expect(PLANS_EMPTY_DESCRIPTION).not.toContain(claim);
    }
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
    /*
      The wall is a real screen now (navigation/screens/BadgeWall), and it needs
      the progress document. Both shells pass it in. This fallback is what a
      caller that has not still shows, and it points at the door rather than
      promising a feature that already exists elsewhere.
    */
    expect(markup).toContain("徽章长在投放端");
    expect(markup).not.toContain("<span>段</span>");
    expect(markup).not.toContain("<span>节</span>");
  });

  it("renders a passed-in account slot on the profile page", () => {
    const markup = renderToStaticMarkup(
      <ProfileScreen passagesRead={0} lessonsCompleted={0} account={<p>登录入口</p>} />,
    );
    expect(markup).toContain("登录入口");
  });
});

describe("AccountPanel", () => {
  it("stays a quiet sentence when the backend is not configured, with no form", () => {
    const markup = renderToStaticMarkup(<AccountPanel identity={createIdentityPort(null)} />);
    expect(markup).toContain(ACCOUNT_UNSIGNED_TITLE);
    expect(markup).toContain(ACCOUNT_UNCONFIGURED_DESCRIPTION);
    expect(markup).not.toContain('type="password"');
    /*
      No sign-in *machinery* — which is not the same as never saying the word.
      This used to search the whole markup for 「登录」, which forbade the
      sentence from explaining that there is nowhere to sign in yet — the one
      thing a reader on this screen actually wants to know. Structure cannot be
      confused with prose, so assert on that instead.
    */
    expect(markup).not.toContain("<form");
    expect(markup).not.toContain('type="submit"');
    expect(markup).not.toContain('role="tablist"');
  });

  it("offers a kit form when signed out, not a modal", () => {
    const markup = renderToStaticMarkup(<AccountPanel identity={createMemoryIdentityPort()} />);
    expect(markup).toContain(ACCOUNT_UNSIGNED_TITLE);
    expect(markup).toContain(ACCOUNT_UNSIGNED_DESCRIPTION);
    expect(markup).toContain(ACCOUNT_SIGN_IN);
    expect(markup).toContain('type="password"');
    expect(markup).toContain("game-ui-input");
    expect(markup).toContain("game-ui-field");
  });

  it("has a real pending state", () => {
    const identity = createMemoryIdentityPort();
    identity.status = () => ({ kind: "pending" });
    const markup = renderToStaticMarkup(<AccountPanel identity={identity} />);
    expect(markup).toContain(ACCOUNT_PENDING_LABEL);
  });

  it("shows who is signed in and a way out", () => {
    const markup = renderToStaticMarkup(
      <AccountPanel
        identity={createMemoryIdentityPort({
          id: "memory:ada@example.com",
          email: "ada@example.com",
        })}
      />,
    );
    expect(markup).toContain(ACCOUNT_SIGNED_IN_TITLE);
    expect(markup).toContain("ada@example.com");
    expect(markup).toContain(ACCOUNT_SIGN_OUT);
    expect(markup).not.toContain('type="password"');
  });

  it("has a real error state that still leaves the form up", () => {
    const identity = createMemoryIdentityPort();
    identity.status = () => ({ kind: "error", message: "登录没有成功，邮箱或密码不对。" });
    const markup = renderToStaticMarkup(<AccountPanel identity={identity} />);
    expect(markup).toContain("登录没有成功，邮箱或密码不对。");
    expect(markup).toContain('type="password"');
    expect(markup).toContain("没登上");
  });
});
