import type { WrittenAttempt } from "../learning/types.js";
import { fence, HOST_AGNOSTIC_NOTICE } from "./packet-format.js";

/**
 * A brief for coaching how the learner writes, built from what they actually
 * wrote.
 *
 * Deliberately not a grading packet. Grading asks "is this right"; this asks
 * "was this clear", and the two must not be run together — `teach-from-study`
 * already fixes that order, because expression feedback on an answer that is
 * factually wrong teaches someone to say a wrong thing more smoothly.
 *
 * Nothing here is written back. The exercise packet ends in a CLI command
 * because a grade changes what the learner may do next; a note about phrasing
 * changes nothing, and a coach that silently files a report on how you write is
 * a coach you start performing for. Saving stays an explicit `capture` the
 * learner asks for.
 */
export interface ExpressionPacketSample {
  readonly attempt: WrittenAttempt;
  readonly lessonTitle: string | null;
  readonly prompt: string | null;
}

interface BuildExpressionPacketInput {
  readonly studyId: string;
  readonly samples: readonly ExpressionPacketSample[];
  readonly goal: string | null;
}

export const EXPRESSION_PACKET_SAMPLE_LIMIT = 5;

function sampleSection(sample: ExpressionPacketSample, index: number): readonly string[] {
  const { attempt } = sample;
  return [
    `### 样本 ${index + 1} · ${sample.lessonTitle ?? attempt.exerciseKey}`,
    "",
    `- 写于：${attempt.occurredAt.toISOString()}`,
    ...(sample.prompt ? [`- 当时的题目：${sample.prompt}`] : []),
    "",
    ...fence("text", attempt.answer),
    "",
  ];
}

export function buildExpressionCoachingPacket(input: BuildExpressionPacketInput): string {
  if (input.samples.length === 0) {
    throw new Error("还没有可点评的作答。先做几道 explain 练习，再回来。");
  }
  return [
    "# UniversityLocal 表达点评包",
    "",
    "## 给 AI 助手的任务（请直接执行）",
    "",
    "你是表达教练。下面是学习者在做练习时**自己写下的**答案。",
    "",
    "请你：",
    "",
    "1. **只评表达，不评对错。** 如果你发现事实错误，单独指出来并说明「这是知识问题，不是表达问题」，然后继续评表达。",
    "2. **先说一个具体的优点**，要指出是哪一句、好在哪，不要说「写得不错」这种话。",
    "3. **只给 1～2 条最高杠杆的改进**。不要列清单，不要面面俱到。",
    "4. **示范**：把其中一句按你的建议改写一遍，让学习者看到差别。",
    "5. **让他重写**：给一个具体的、可以马上动手的下一步。",
    "",
    "不要做的事：",
    "",
    "- 不要给分数、百分比、雷达图或任何量化评级。表达没有绝对刻度。",
    "- 不要代笔重写全文。学习者要练的是自己写。",
    "- 不要点评这里没给你的东西。你只看到这几段，不要推测他平时怎么说话。",
    "",
    HOST_AGNOSTIC_NOTICE,
    "",
    ...(input.goal
      ? ["## 学习者说他想练的是", "", `> ${input.goal}`, "", "点评请围绕这个目标。", ""]
      : [
          "## 目标未指定",
          "",
          "学习者没说想练什么。先问他一句：这些话是写给谁看的、希望对方看完做什么？",
          "问清楚再评。",
          "",
        ]),
    `## 学习者写的（study：${input.studyId}）`,
    "",
    ...input.samples.flatMap(sampleSection),
    "## 想保存的话",
    "",
    "如果点评里出现了值得长期记住的原则，告诉学习者可以用 `capture` 把它存成一条笔记。",
    "**不要自己去写盘。**",
    "",
  ].join("\n");
}
