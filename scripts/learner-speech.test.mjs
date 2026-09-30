import assert from "node:assert/strict";
import { test } from "node:test";
import { assertLearnerSpeech, learnerSpeechViolations } from "./learner-speech.mjs";

test("the publication gate turns red for an injected author note", () => {
  assert.throws(
    () => assertLearnerSpeech({ "product.title": "原型验收备注：让用户先点选" }, "fixture"),
    /author-note/,
  );
  assert.throws(
    () =>
      assertLearnerSpeech({ "product.title": "[AUTHOR NOTE] This layout is temporary" }, "fixture"),
    /author-note/,
  );
});
test("implementation names and layout explanations cannot become learner copy", () => {
  for (const text of [
    "这几门课没有先后，所以平铺列出。",
    "className=course-banner",
    "Open LessonMarkerField",
    "These courses have no set order, so they are listed flat.",
  ])
    assert.throws(() => assertLearnerSpeech({ label: text }), /rejected/);
});
test("canonical nouns are checked without editing ICU lookup keys", () => {
  assert.throws(() => assertLearnerSpeech({ label: "已完成 {done} / {total} 节" }), /lesson-name/);
  assert.throws(() => assertLearnerSpeech({ label: "第 1 节" }), /lesson-name/);
  assert.throws(() => assertLearnerSpeech({ label: "还没学完一节 —— 从这里开始" }), /lesson-name/);
  assert.throws(() => assertLearnerSpeech({ label: "帐户" }), /account-name/);
  assert.doesNotThrow(() => assertLearnerSpeech({ "old.copy.帐户.第1节": "账号 · 第 1 关" }));
});
test("real teaching language, code quotations and separate author tools are not blanket banned", () => {
  const values = {
    a: "对比两个回答，再作决定",
    b: "观察现象，注意细节和节奏",
    c: "字节与章节",
    "app.authoring.note": "作者备注",
    d: "第 {number} 关",
  };
  assert.deepEqual(learnerSpeechViolations(values), []);
  assert.doesNotThrow(() =>
    assertLearnerSpeech({
      "play.aiQuality.eval.schedule.information.absent": "想约一节课，但没有日期",
    }),
  );
  assert.throws(
    () => assertLearnerSpeech({ "play.aiQuality.eval.schedule.information.absent": "第 1 节课" }),
    /lesson-name/,
  );
});
