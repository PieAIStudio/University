import { withInterfaceLocale } from "../../../test-support/interface-locale.js";
// @vitest-environment jsdom

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  XP_EXERCISE_FIRST_TRY,
  XP_READ_LESSON,
  createIdentityPort,
  createMemoryIdentityPort,
  levelOf,
} from "@pieai/university-core";
import type { AuthPort } from "@pieaistudio/swimmer-auth-kit";

import {
  ACCOUNT_PENDING_LABEL,
  ACCOUNT_SIGN_OUT,
  ACCOUNT_UNCONFIGURED_ACTION,
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
import { NextStepEmpty } from "./NextStepEmpty.js";
import { ProfileScreen } from "./ProfileScreen.js";
import { LevelProgress } from "../screens/LevelProgress.js";
import {
  QuestsEmpty,
  QUESTS_EMPTY_ACTION,
  QUESTS_EMPTY_DESCRIPTION,
  QUESTS_EMPTY_TITLE,
} from "./QuestsEmpty.js";
import { SettingsScreen, SettingsSubnav } from "./SettingsScreen.js";

describe("empty destinations", () => {
  it("keeps the league copy verbatim", () => {
    const markup = renderToStaticMarkup(
      withInterfaceLocale(<LeagueEmpty onNavigate={() => undefined} />),
    );
    expect(markup).toContain(LEAGUE_EMPTY_TITLE);
    expect(markup).toContain(LEAGUE_EMPTY_DESCRIPTION);
    expect(markup).toContain(LEAGUE_EMPTY_ACTION);
    expect(markup).not.toContain("等账号上线");
  });

  it("keeps the quests copy verbatim", () => {
    const markup = renderToStaticMarkup(
      withInterfaceLocale(<QuestsEmpty onNavigate={() => undefined} />),
    );
    expect(markup).toContain(QUESTS_EMPTY_TITLE);
    expect(markup).toContain(QUESTS_EMPTY_DESCRIPTION);
    expect(markup).toContain(QUESTS_EMPTY_ACTION);
  });

  it("renders an empty-state action only when the shell supplies navigation", () => {
    const withNavigation = renderToStaticMarkup(
      withInterfaceLocale(
        <NextStepEmpty
          title="还没有内容"
          description="先回到学习页。"
          onNavigate={() => undefined}
        />,
      ),
    );
    const withoutNavigation = renderToStaticMarkup(
      withInterfaceLocale(<NextStepEmpty title="还没有内容" description="暂时没有可看的内容。" />),
    );
    expect(withNavigation).toContain("回到学习");
    expect(withoutNavigation).not.toContain("回到学习");
  });

  it("renders settings as a real page with theme, sound and language controls", () => {
    const markup = renderToStaticMarkup(withInterfaceLocale(<SettingsScreen />));
    expect(markup).toContain("偏好设置");
    expect(markup).toContain("外观");
    expect(markup).toContain("浅色");
    expect(markup).toContain("深色");
    expect(markup).toContain("跟随系统");
    expect(markup).toContain("声音");
    expect(markup).toContain("自动");
    expect(markup).toContain("本机");
    expect(markup).toContain("在线");
    expect(markup).toContain("高品质");
    expect(markup).toContain("钱包和付费权益尚未接入");
    expect(markup).toContain("disabled");
    expect(markup).toContain("阅读辅助设置");
    expect(renderToStaticMarkup(withInterfaceLocale(<SettingsSubnav />))).toContain("个人档案");
  });

  it("renders the two real numbers on the profile page", () => {
    const markup = renderToStaticMarkup(
      withInterfaceLocale(
        <ProfileScreen passagesRead={4} lessonsCompleted={2} avatar={<span>头像</span>} />,
      ),
    );
    expect(markup).toContain("头像");
    expect(markup).toContain("4");
    expect(markup).toContain("2");
    expect(markup).toContain("读过真实代码");
    expect(markup).toContain("成长");
    expect(markup).toContain("/league");
    expect(markup).toContain("/plans");
    expect(markup).toContain("profile-feedback-host");
  });

  it("turns a zero into an invitation that points at the next lesson", () => {
    const markup = renderToStaticMarkup(
      withInterfaceLocale(
        <ProfileScreen
          passagesRead={0}
          lessonsCompleted={0}
          nextHref="/turing-pact/foundations-before-zero"
          avatar={<span>头像</span>}
        />,
      ),
    );
    expect(markup).toContain("头像");
    expect(markup).toContain("复习卡");
    expect(markup).not.toMatch(/第一[节关]里就有/);
    expect(markup).toContain("还没学完一关 —— 从这里开始");
    expect(markup).toContain("/turing-pact/foundations-before-zero");
    // V7 moves the actual wall to Growth, never promises a missing wall.
    expect(markup).toContain("/league");
    expect(markup).not.toContain("徽章长在投放端");
    expect(markup).not.toContain("<span>段</span>");
    expect(markup).not.toContain("<span>节</span>");
  });

  it("renders a passed-in account slot on the profile page", () => {
    const markup = renderToStaticMarkup(
      withInterfaceLocale(
        <ProfileScreen passagesRead={0} lessonsCompleted={0} account={<p>登录入口</p>} />,
      ),
    );
    expect(markup).toContain("登录入口");
  });

  it("keeps the shared level badge and linear XP bar used by the Growth detail", () => {
    const totalXp = XP_READ_LESSON + XP_EXERCISE_FIRST_TRY;
    const markup = renderToStaticMarkup(withInterfaceLocale(<LevelProgress totalXp={totalXp} />));
    expect(markup).toContain(`Lv. ${levelOf(totalXp).level}`);
    expect(markup).toContain("XP");
    expect(markup).toContain('role="progressbar"');
    expect(markup).not.toContain("progress-ring");
  });
});

const idleAuth: AuthPort = {
  getSession: async () => null,
  getCurrentUser: async () => null,
  onAuthStateChange: () => ({ unsubscribe() {} }),
  execute: async () => ({ status: "email-requested" }),
};

describe("AccountPanel", () => {
  it("explains why login is unavailable when the backend is not configured", () => {
    const markup = renderToStaticMarkup(
      withInterfaceLocale(<AccountPanel identity={createIdentityPort(null)} />),
    );
    expect(markup).toContain(ACCOUNT_UNSIGNED_TITLE);
    expect(markup).not.toContain(ACCOUNT_UNCONFIGURED_DESCRIPTION);
    expect(markup).toContain(ACCOUNT_UNCONFIGURED_ACTION);
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
    const markup = renderToStaticMarkup(
      withInterfaceLocale(<AccountPanel identity={createMemoryIdentityPort()} auth={idleAuth} />),
    );
    expect(markup).toContain(ACCOUNT_UNSIGNED_TITLE);
    expect(markup).toContain(ACCOUNT_UNSIGNED_DESCRIPTION);
    expect(markup).toContain("跨设备同步需要对应会员权益");
    expect(markup).toContain("swimmer-auth");
    expect(markup).toContain('type="password"');
    expect(markup).toContain("game-ui-input");
    expect(markup).toContain("game-ui-field");
    expect(markup).not.toContain('role="tablist"');
    expect(markup).not.toContain("免密码登录");
  });

  it("has a real pending state", () => {
    const identity = createMemoryIdentityPort();
    identity.status = () => ({ kind: "pending" });
    const markup = renderToStaticMarkup(withInterfaceLocale(<AccountPanel identity={identity} />));
    expect(markup).toContain(ACCOUNT_PENDING_LABEL);
  });

  it("shows who is signed in and a way out", () => {
    const markup = renderToStaticMarkup(
      withInterfaceLocale(
        <AccountPanel
          identity={createMemoryIdentityPort({
            id: "memory:ada@example.com",
            email: "ada@example.com",
          })}
        />,
      ),
    );
    expect(markup).toContain("account-panel__signed-in");
    expect(markup).toContain("ada@example.com");
    expect(markup).toContain(ACCOUNT_SIGN_OUT);
    expect(markup).not.toContain('type="password"');
  });

  it("has a real error state that still leaves the form up", () => {
    const identity = createMemoryIdentityPort();
    identity.status = () => ({
      kind: "error",
      code: "sign-in-failed",
      message: "provider debug response must not reach the learner",
    });
    const markup = renderToStaticMarkup(
      withInterfaceLocale(<AccountPanel identity={identity} auth={idleAuth} />),
    );
    expect(markup).toContain("登录没有完成，请核对输入或网络后重试。");
    expect(markup).not.toContain("provider debug response");
    expect(markup).toContain('type="password"');
    expect(markup).toContain("没登上");
  });
});
