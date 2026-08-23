import { describe, expect, it } from "vitest";

import { wheelIntent } from "./wheel-intent";

describe("wheelIntent", () => {
  it("treats a mouse-wheel notch as zoom", () => {
    expect(
      wheelIntent({
        ctrlKey: false,
        deltaX: 0,
        deltaY: 120,
        deltaMode: 0,
        wheelDeltaY: -120,
      }),
    ).toBe("zoom");
  });

  it("treats a constructed mouse-wheel event (e2e dispatch) as zoom", () => {
    expect(
      wheelIntent({
        ctrlKey: false,
        deltaX: 0,
        deltaY: 100,
        deltaMode: 0,
        wheelDeltaY: 100,
      }),
    ).toBe("zoom");
  });

  it("treats a two-finger trackpad pan as pan", () => {
    expect(
      wheelIntent({
        ctrlKey: false,
        deltaX: 6,
        deltaY: 14,
        deltaMode: 0,
        wheelDeltaY: 14,
      }),
    ).toBe("pan");
  });

  it("treats a vertical-only trackpad swipe as pan", () => {
    expect(
      wheelIntent({
        ctrlKey: false,
        deltaX: 0,
        deltaY: 8,
        deltaMode: 0,
        wheelDeltaY: -24,
      }),
    ).toBe("pan");
  });

  it("treats a pinch (ctrlKey) as zoom", () => {
    expect(
      wheelIntent({
        ctrlKey: true,
        deltaX: 0,
        deltaY: 1.2,
        deltaMode: 0,
        wheelDeltaY: 1,
      }),
    ).toBe("zoom");
  });

  it("treats a line-mode mouse wheel as zoom", () => {
    expect(
      wheelIntent({
        ctrlKey: false,
        deltaX: 0,
        deltaY: 3,
        deltaMode: 1,
      }),
    ).toBe("zoom");
  });
});
