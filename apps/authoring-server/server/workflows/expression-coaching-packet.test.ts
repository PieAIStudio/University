import { describe, expect, it } from "vitest";

import { exerciseContentKey } from "../learning/types.js";
import {
  buildExpressionCoachingPacket,
  type ExpressionPacketSample,
} from "./expression-coaching-packet.js";

function sample(answer: string, overrides: Partial<ExpressionPacketSample> = {}) {
  return {
    attempt: {
      attemptId: "attempt-1",
      exerciseKey: exerciseContentKey({
        courseId: "foundations-terrain",
        unitId: "what-a-project-is",
        lessonId: "scripts-are-the-doors",
        exerciseId: "dev-script-name",
      }),
      contentRevision: 1,
      answer,
      occurredAt: new Date("2026-08-06T00:00:00.000Z"),
    },
    lessonTitle: "scripts：项目所有能敲的门",
    prompt: "日常起本地开发服务器时，应敲的 script 名称是什么？",
    ...overrides,
  };
}

describe("buildExpressionCoachingPacket", () => {
  it("coaches expression without inventing material to coach", () => {
    expect(() =>
      buildExpressionCoachingPacket({ studyId: "turing-pact", samples: [], goal: null }),
    ).toThrow(/还没有可点评的作答/);
  });

  it("carries the learner's own words and the question they answered", () => {
    const packet = buildExpressionCoachingPacket({
      studyId: "turing-pact",
      samples: [sample("我觉得应该是 dev 吧，大概")],
      goal: null,
    });
    expect(packet).toContain("我觉得应该是 dev 吧，大概");
    expect(packet).toContain("scripts：项目所有能敲的门");
    expect(packet).toContain("日常起本地开发服务器时");
  });

  /**
   * Expression feedback on a factually wrong answer teaches someone to say a
   * wrong thing more smoothly. `teach-from-study` already orders these; the
   * packet has to restate it, because the host reading it has not read that.
   */
  it("keeps the coach off the question of whether the answer is right", () => {
    const packet = buildExpressionCoachingPacket({
      studyId: "turing-pact",
      samples: [sample("随便写的")],
      goal: null,
    });
    expect(packet).toContain("只评表达，不评对错");
    expect(packet).toContain("这是知识问题，不是表达问题");
  });

  it("refuses the scoreboard shape that makes feedback feel like a verdict", () => {
    const packet = buildExpressionCoachingPacket({
      studyId: "turing-pact",
      samples: [sample("一段回答")],
      goal: null,
    });
    expect(packet).toContain("不要给分数、百分比、雷达图");
    expect(packet).toContain("不要代笔重写全文");
  });

  it("asks for the audience when the learner has not said what they are practising", () => {
    const packet = buildExpressionCoachingPacket({
      studyId: "turing-pact",
      samples: [sample("一段回答")],
      goal: null,
    });
    expect(packet).toContain("这些话是写给谁看的");
  });

  it("aims the coaching at a goal the learner did give", () => {
    const packet = buildExpressionCoachingPacket({
      studyId: "turing-pact",
      samples: [sample("一段回答")],
      goal: "我想练把结论放前面",
    });
    expect(packet).toContain("我想练把结论放前面");
    expect(packet).not.toContain("这些话是写给谁看的");
  });

  /**
   * A coach that files reports on how you write is a coach you perform for.
   * Saving stays something the learner asks for.
   */
  it("leaves saving to the learner", () => {
    const packet = buildExpressionCoachingPacket({
      studyId: "turing-pact",
      samples: [sample("一段回答")],
      goal: null,
    });
    expect(packet).toContain("**不要自己去写盘。**");
    expect(packet).not.toContain("pnpm university");
  });

  it("survives content that was retired after the learner answered it", () => {
    const packet = buildExpressionCoachingPacket({
      studyId: "turing-pact",
      samples: [sample("写过的话还在", { lessonTitle: null, prompt: null })],
      goal: null,
    });
    expect(packet).toContain("写过的话还在");
  });
});
