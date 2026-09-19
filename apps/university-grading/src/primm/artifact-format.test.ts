import { describe, expect, it } from "vitest";
import { containsClockTime } from "./artifact-format.js";

describe("explicit-time structural check", () => {
  it.each([
    "周日14点到公园",
    "星期日下午两点见",
    "下午2点30分",
    "１４：００",
    "At 2 pm",
    "two in the afternoon",
    "Sunday at 2 in the afternoon, in the park; bring water.",
    "Sunday at 2 o’clock in the park, bring water.",
    "Meet at 14h00 in the park.",
    "At noon",
  ])("accepts %s", (value) => {
    expect(containsClockTime(value)).toBe(true);
  });
  it.each([
    "星期日下午在公园，带水",
    "Sunday afternoon in the park",
    "带2瓶水",
    "时间尚未确定",
    "Please add a meeting time",
    "Bring 2 bottles in the afternoon",
    "Walk for two hours in the park",
  ])("does not mistake %s for a clock time", (value) => {
    expect(containsClockTime(value)).toBe(false);
  });
  it("does not claim to verify the value or a negated statement", () => {
    expect(containsClockTime("不是下午三点，是下午两点")).toBe(true);
  });
});
