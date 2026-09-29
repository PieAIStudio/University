import { describe, expect, it, vi } from "vitest";
import { emptyProgress, type CardProgress, type ProgressPort } from "@pieai/university-core";
import { withRankPromotion } from "./rank-promotion.js";

function fixture() {
  let owner: string | null = "a";
  let document = emptyProgress();
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const fn of listeners) fn();
  };
  const fill = (n: number) => {
    document = {
      ...document,
      cards: Object.fromEntries(
        Array.from({ length: n }, (_, index) => [
          String(index),
          { fsrs: { stability: 21 } } as CardProgress,
        ]),
      ),
    };
  };
  const grade = vi.fn(() => {
    fill(10);
    notify();
  });
  const source = {
    snapshot: () => document,
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    syncState: () => ({ userId: owner }),
    gradeCard: grade,
  } as unknown as ProgressPort;
  const wrapped = withRankPromotion(source);
  return {
    ...wrapped,
    grade,
    fill,
    notify,
    switchOwner: () => {
      owner = "b";
      document = emptyProgress();
      notify();
    },
  };
}
describe("rank promotion belongs to one real rating and one account", () => {
  it("leaves startup and cloud/import notifications quiet", () => {
    const f = fixture();
    f.fill(50);
    f.notify();
    expect(f.promotions.getSnapshot()).toBeNull();
    f.grade.mockImplementationOnce(() => {
      f.fill(50);
      f.notify();
    });
    f.progress.gradeCard("x", "good");
    expect(f.promotions.getSnapshot()).toBeNull();
    f.promotions.dispose();
  });
  it("presents once on crossing, without a second scheduler write or replay on rerender", () => {
    const f = fixture();
    f.fill(9);
    f.progress.gradeCard("x", "good");
    const first = f.promotions.getSnapshot()!;
    expect(first.tier.id).toBe("bronze");
    expect(f.grade).toHaveBeenCalledTimes(1);
    f.notify();
    expect(f.promotions.getSnapshot()).toBe(first);
    f.promotions.dismiss(first.key);
    expect(f.promotions.getSnapshot()).toBeNull();
    f.progress.gradeCard("x", "good");
    expect(f.promotions.getSnapshot()).toBeNull();
    f.fill(9);
    f.progress.gradeCard("x", "good");
    expect(f.promotions.getSnapshot()).toBeNull();
    f.promotions.dispose();
  });
  it("retires the old account and rejects a retained close callback on a new receipt", () => {
    const f = fixture();
    f.fill(9);
    f.progress.gradeCard("x", "good");
    const first = f.promotions.getSnapshot()!;
    f.switchOwner();
    expect(f.promotions.getSnapshot()).toBeNull();
    f.fill(9);
    f.progress.gradeCard("x", "good");
    const second = f.promotions.getSnapshot()!;
    expect(second.owner).toBe("b");
    f.promotions.dismiss(first.key);
    expect(f.promotions.getSnapshot()).toBe(second);
    f.promotions.dispose();
  });
  it("keeps the current notification audience stable while listeners subscribe", () => {
    const f = fixture();
    const late = vi.fn();
    f.promotions.subscribe(() => f.promotions.subscribe(late));
    f.fill(9);
    f.progress.gradeCard("x", "good");
    expect(late).not.toHaveBeenCalled();
    f.promotions.dismiss(f.promotions.getSnapshot()!.key);
    expect(late).toHaveBeenCalledTimes(1);
    f.promotions.dispose();
  });
  it("cannot turn an observer error into a failed learning action", () => {
    const f = fixture();
    f.promotions.subscribe(() => {
      throw new Error("view departed");
    });
    f.fill(9);
    expect(() => f.progress.gradeCard("x", "good")).not.toThrow();
    expect(f.grade).toHaveBeenCalledTimes(1);
    f.promotions.dispose();
  });
});
