import { describe, expect, it } from "vitest";
import {
  actOnBrief,
  BRIEF_UNLOCK,
  briefAxes,
  briefBlocked,
  briefOutcomeText,
  createBriefPreview,
  evaluateBrief,
  evaluateBriefRounds,
  isValidBriefActivity,
  resolveBrief,
  type BriefActivity,
  type BriefConfiguration,
  type BriefObservation,
} from "./ai-brief.js";

/*
  Deliberately not a sign-up sheet.

  This engine was written around one product — a login, a confirmation and a
  member list — and the three axes were a module constant, so every lesson that
  reached for 「turn a vague request into something you can check」 got that
  product whether or not it had anything to do with the lesson. Sharing a file
  exercises the same shape with none of the same words, which is the only way to
  show the words are gone rather than renamed.
*/
const target: BriefConfiguration = { who: "anyone-with-link", what: "read-only", until: "a-week" };

const activity: BriefActivity = {
  kind: "ai-brief",
  id: "share-a-file",
  title: "「发给他看一下」是什么意思",
  brief: "先照现在的约定试一次，再去把没说清的地方问明白。",
  goal: "说得出这句话有几种做法都算对，以及你要的是哪一种。",
  hint: "先问：他打开之后，能做什么？",
  takeaway: "一句话里没说的事，产品会替你决定——所以要先替它决定。",
  source: { label: "分享设置", url: "https://example.org/sharing" },
  productName: "共享盘",
  productDescription: "把一份文件发给别人看。",
  visitorName: "小周",
  request: "把这份稿子发给他看一下。",
  actions: [
    {
      id: "open",
      label: "打开链接",
      decidedBy: "who",
      outcomes: {
        "anyone-with-link": "文件打开了。",
        "only-invited": "文件打开了。",
        "asked-to-sign-in": "先让他登录。",
      },
    },
    {
      id: "edit",
      label: "试着改一个字",
      decidedBy: "what",
      outcomes: {
        "read-only": "改不动，只能看。",
        "can-edit": "改动保存了，你这边也变了。",
        "asked-to-sign-in": "先让他登录。",
      },
    },
  ],
  gate: {
    axis: "who",
    requiresUnlock: "only-invited",
    unlockLabel: "用受邀的账号登录",
    blockedOutcome: "asked-to-sign-in",
  },
  questions: [
    {
      axis: "who",
      label: "谁能打开",
      question: "拿到链接的人都能打开，还是只有你请到的人？",
      answer: "拿到链接就能打开。",
      options: [
        { value: "anyone-with-link", label: "拿到链接就能打开", clause: "不必登录。" },
        { value: "only-invited", label: "只有受邀的人", clause: "先登录才看得到。" },
      ],
    },
    {
      axis: "what",
      label: "他能做什么",
      question: "只能看，还是也能改？",
      answer: "只能看。",
      options: [
        { value: "read-only", label: "只能看", clause: "改不了。" },
        { value: "can-edit", label: "也能改", clause: "他改了你这边也会变。" },
      ],
    },
    {
      axis: "until",
      label: "什么时候失效",
      question: "一直有效，还是过一阵就打不开了？",
      answer: "一周后失效。",
      options: [
        { value: "forever", label: "一直有效", clause: "不会过期。" },
        { value: "a-week", label: "一周后失效", clause: "到期自动打不开。" },
      ],
    },
  ],
  target,
  interpretations: [
    { who: "anyone-with-link", what: "can-edit", until: "forever" },
    { who: "only-invited", what: "read-only", until: "a-week" },
  ],
};

const observe = (configuration: BriefConfiguration, actions: readonly string[]) => {
  let state = createBriefPreview();
  const events: BriefObservation[] = [];
  for (const action of actions) {
    const next = actOnBrief(activity, configuration, state, action, 0);
    state = next.state;
    if (next.observation) events.push(next.observation);
  }
  return { state, events };
};

describe("the agreements a request left open", () => {
  it("reads its axes off its own questions rather than a fixed list", () => {
    expect(briefAxes(activity)).toEqual(["who", "what", "until"]);
  });

  it("gives an action the outcome its own axis was agreed to", () => {
    const { events } = observe(target, ["open", "edit"]);
    expect(events.map((event) => event.result)).toEqual(["anyone-with-link", "read-only"]);
  });

  it("passes once every action has been tried under the agreed rules", () => {
    const { events } = observe(target, ["open", "edit"]);
    const verdict = evaluateBrief(activity, target, events);
    expect(verdict.passed).toBe(true);
    expect(verdict.missing).toEqual([]);
    expect(verdict.mismatches).toEqual([]);
  });

  /*
    Choosing the right clauses is not evidence. Two readings of one sentence are
    identical on paper and different only when somebody uses the product, which
    is the whole reason this game exists.
  */
  it("refuses agreement without use", () => {
    const verdict = evaluateBrief(activity, target, []);
    expect(verdict.passed).toBe(false);
    expect(verdict.tried.every((row) => !row.ok)).toBe(true);
  });

  it("refuses when one action was never tried", () => {
    const { events } = observe(target, ["open"]);
    const verdict = evaluateBrief(activity, target, events);
    expect(verdict.passed).toBe(false);
    expect(verdict.tried).toEqual([
      { id: "open", ok: true },
      { id: "edit", ok: false },
    ]);
  });

  it("names the axes still unanswered, and the ones answered differently", () => {
    const partial = evaluateBrief(activity, { who: "anyone-with-link" }, []);
    expect(partial.missing).toEqual(["what", "until"]);
    const wrong = evaluateBrief(activity, { ...target, what: "can-edit" }, []);
    expect(wrong.mismatches).toEqual(["what"]);
  });
});

describe("the agreement that stops a visitor first", () => {
  const gated: BriefConfiguration = { ...target, who: "only-invited" };

  it("blocks every action until the visitor identifies themselves", () => {
    expect(briefBlocked(activity, gated, false)).toBe(true);
    const { events } = observe(gated, ["open", BRIEF_UNLOCK, "open"]);
    expect(events.map((event) => event.result)).toEqual(["asked-to-sign-in", "only-invited"]);
  });

  /*
    The gate has to be met, not merely satisfied. A session that happened to be
    signed in throughout cannot tell 「anyone with the link」 from 「only the
    people I invited」 — which is exactly the confusion the lesson is about.
  */
  it("requires the learner to have actually met the gate", () => {
    const straightThrough = observe(gated, [BRIEF_UNLOCK, "open", "edit"]);
    const gatedActivity = { ...activity, target: gated };
    const without = evaluateBrief(gatedActivity, gated, straightThrough.events);
    expect(without.gateChecked).toBe(false);
    expect(without.passed).toBe(false);

    const met = observe(gated, ["open", BRIEF_UNLOCK, "open", "edit"]);
    const with_ = evaluateBrief(gatedActivity, gated, met.events);
    expect(with_.gateChecked).toBe(true);
    expect(with_.passed).toBe(true);
  });

  it("does not ask for a gate that the agreed rules do not raise", () => {
    const { events } = observe(target, ["open", "edit"]);
    expect(evaluateBrief(activity, target, events).gateChecked).toBe(true);
  });
});

describe("a changed request, after the first agreement held", () => {
  const followUp: BriefConfiguration = { ...target, what: "can-edit" };
  const withFollowUp: BriefActivity = {
    ...activity,
    followUp: { request: "他说想直接在上面改。", target: followUp },
  };

  it("keeps what was already agreed and collects fresh use of what changed", () => {
    const first = observe(target, ["open", "edit"]);
    const second = observe(followUp, ["open", "edit"]);
    const verdict = evaluateBriefRounds(withFollowUp, [
      { choices: target, observations: first.events },
      { choices: followUp, observations: second.events },
    ]);
    expect(verdict.passed).toBe(true);
    expect(verdict.passedRounds).toEqual([true, true]);
  });

  it("does not let the first round's use stand in for the second", () => {
    const first = observe(target, ["open", "edit"]);
    const verdict = evaluateBriefRounds(withFollowUp, [
      { choices: target, observations: first.events },
      { choices: followUp, observations: first.events },
    ]);
    expect(verdict.passed).toBe(false);
    expect(verdict.passedRounds).toEqual([true, false]);
  });
});

describe("resolving what the two readings actually are", () => {
  it("lets an agreed clause override the reading it came from", () => {
    expect(resolveBrief(activity, { what: "read-only" }, 0)).toEqual({
      who: "anyone-with-link",
      what: "read-only",
      until: "forever",
    });
  });
});

describe("whether a brief can be agreed and then observed", () => {
  it("accepts the authored activity", () => {
    expect(isValidBriefActivity(activity)).toBe(true);
  });

  /*
    The joins are the whole validator. An action decided by an axis nobody is
    asked about, or a gate on one, renders as a product that does not respond to
    the agreements the learner just made — which reads as a broken game, not as
    a payload mistake.
  */
  it("refuses an action decided by an agreement nobody is asked about", () => {
    expect(
      isValidBriefActivity({
        ...activity,
        actions: [{ id: "open", label: "打开", decidedBy: "colour", outcomes: {} }],
      }),
    ).toBe(false);
  });

  it("refuses a gate on an agreement nobody is asked about", () => {
    expect(
      isValidBriefActivity({
        ...activity,
        gate: { ...activity.gate!, axis: "colour" },
      }),
    ).toBe(false);
  });

  it("refuses a target that settles on a value the questions never offer", () => {
    expect(isValidBriefActivity({ ...activity, target: { ...target, what: "can-delete" } })).toBe(
      false,
    );
  });

  it("refuses no questions, no actions, and an action named like the unlock step", () => {
    expect(isValidBriefActivity({ ...activity, questions: [] })).toBe(false);
    expect(isValidBriefActivity({ ...activity, actions: [] })).toBe(false);
    expect(
      isValidBriefActivity({
        ...activity,
        actions: [{ id: BRIEF_UNLOCK, label: "登录", decidedBy: "who", outcomes: {} }],
      }),
    ).toBe(false);
  });

  it("refuses an action with nothing to show for an outcome it can reach", () => {
    const [open_, edit] = activity.actions;
    expect(
      isValidBriefActivity({
        ...activity,
        actions: [{ ...open_!, outcomes: { "anyone-with-link": "文件打开了。" } }, edit!],
      }),
    ).toBe(false);
  });
});

/*
  A product accumulates: what an action shows can depend on what the visitor has
  already done. This was a hardcoded branch — 「the roster is public AND you have
  joined」 — which is the kind of detail that quietly disappears when a game is
  made generic, and it is the sentence that turns 「公开」 from a word into a
  consequence.
*/
describe("what a second action shows once the first has happened", () => {
  const shelf = {
    id: "list",
    label: "看看名单",
    decidedBy: "what",
    outcomes: { "read-only": "名单：小安、小禾。" },
    after: {
      action: "open",
      outcome: "anyone-with-link",
      outcomes: { "read-only": "名单：小安、小禾。也包括你。" },
    },
  };

  it("shows the plain outcome until its precondition has happened", () => {
    expect(briefOutcomeText(shelf, "read-only", createBriefPreview())).toBe("名单：小安、小禾。");
  });

  it("shows the fuller one once it has", () => {
    const after = { unlocked: false, done: { open: "anyone-with-link" } };
    expect(briefOutcomeText(shelf, "read-only", after)).toBe("名单：小安、小禾。也包括你。");
  });

  it("falls back to the outcome id rather than rendering a blank", () => {
    expect(briefOutcomeText(shelf, "can-edit", createBriefPreview())).toBe("can-edit");
  });
});
