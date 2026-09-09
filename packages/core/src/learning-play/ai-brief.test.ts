import { describe, expect, it } from "vitest";
import {
  actOnBrief,
  createBriefPreview,
  evaluateBrief,
  evaluateBriefRounds,
  resolveBrief,
  type BriefActivity,
  type BriefConfiguration,
  type BriefObservation,
} from "./ai-brief.js";

const target: BriefConfiguration = { access: "guest", confirmation: "review", roster: "private" };
const activity: BriefActivity = {
  kind: "ai-brief",
  id: "case",
  title: "",
  brief: "",
  goal: "",
  hint: "",
  takeaway: "",
  source: { label: "", url: "" },
  productName: "",
  productDescription: "",
  visitorName: "",
  actionLabel: "",
  request: "",
  questions: [],
  target,
  interpretations: [
    { access: "guest", confirmation: "instant", roster: "public" },
    { access: "account", confirmation: "review", roster: "private" },
  ],
};
const observe = (
  configuration: BriefConfiguration,
  actions: readonly ("submit" | "roster" | "login")[],
) => {
  let state = createBriefPreview();
  const events: BriefObservation[] = [];
  for (const action of actions) {
    const next = actOnBrief(configuration, state, action, 0);
    state = next.state;
    if (next.observation) events.push(next.observation);
  }
  return { state, events };
};

describe("AI brief product assumptions", () => {
  it("requires actual acceptance before and after a changed request, preserving unrelated boundaries", () => {
    const amended = { ...target, confirmation: "instant" } as const;
    const fixture = {
      ...activity,
      followUp: { request: "Confirm now; other rules remain", target: amended },
    };
    const initial = { choices: target, observations: observe(target, ["submit", "roster"]).events };
    const changed = {
      choices: amended,
      observations: observe(amended, ["submit", "roster"]).events,
    };
    expect(evaluateBriefRounds(fixture, [initial]).passed).toBe(false);
    expect(evaluateBriefRounds(fixture, [initial, initial]).passed).toBe(false);
    expect(evaluateBriefRounds(fixture, [initial, changed]).passed).toBe(true);
    expect(
      evaluateBriefRounds(fixture, [
        initial,
        { ...changed, choices: { ...amended, roster: "public" } },
      ]).passed,
    ).toBe(false);
  });
  it("keeps two possible implementations until the contract resolves their assumptions", () => {
    expect(resolveBrief(activity, {}, 0)).not.toEqual(resolveBrief(activity, {}, 1));
    expect(resolveBrief(activity, target, 0)).toEqual(resolveBrief(activity, target, 1));
    expect(evaluateBrief(activity, {}, [])).toMatchObject({
      passed: false,
      missing: ["access", "confirmation", "roster"],
    });
  });
  it("cannot pass by selecting clauses without operating the product", () => {
    expect(evaluateBrief(activity, target, []).passed).toBe(false);
    expect(evaluateBrief(activity, target, observe(target, ["submit"]).events).passed).toBe(false);
    expect(
      evaluateBrief(activity, target, observe(target, ["submit", "roster"]).events).passed,
    ).toBe(true);
    expect(
      evaluateBrief(activity, target, observe(target, ["roster", "submit"]).events).passed,
    ).toBe(true);
  });
  it("requires testing the signed-out gate and the useful signed-in action for a member product", () => {
    const member = { ...target, access: "account", confirmation: "instant" } as const;
    const fixture = { ...activity, target: member };
    expect(observe(member, ["submit"]).state.submission).toBe("login");
    expect(
      evaluateBrief(fixture, member, observe(member, ["login", "submit", "roster"]).events).passed,
    ).toBe(false);
    expect(
      evaluateBrief(
        fixture,
        member,
        observe(member, ["submit", "login", "submit", "roster"]).events,
      ).passed,
    ).toBe(true);
  });
  it("does not reuse evidence from an old or incorrect configuration", () => {
    const old = observe(activity.interpretations[0], ["submit", "roster"]).events;
    expect(evaluateBrief(activity, target, old).passed).toBe(false);
    expect(
      evaluateBrief(
        activity,
        { ...target, roster: "public" },
        observe(target, ["submit", "roster"]).events,
      ).passed,
    ).toBe(false);
  });
  it("keeps a member roster behind the same account gate and requires a signed-in roster probe", () => {
    const member = { access: "account", confirmation: "instant", roster: "public" } as const;
    const fixture = { ...activity, target: member };
    const blocked = observe(member, ["roster"]);
    expect(blocked.events[0]?.result).toBe("login");
    expect(blocked.state.submission).toBe("login");
    expect(
      evaluateBrief(
        fixture,
        member,
        observe(member, ["submit", "roster", "login", "submit"]).events,
      ).passed,
    ).toBe(false);
    expect(
      evaluateBrief(
        fixture,
        member,
        observe(member, ["submit", "roster", "login", "submit", "roster"]).events,
      ).passed,
    ).toBe(true);
  });
  it("guest acceptance is tested as a visitor; login is not silently assumed", () => {
    expect(
      evaluateBrief(activity, target, observe(target, ["login", "submit", "roster"]).events).passed,
    ).toBe(false);
  });
});
