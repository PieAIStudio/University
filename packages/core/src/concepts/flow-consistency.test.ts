import { describe, expect, it } from "vitest";

import { CONCEPT_ENTRIES } from "./catalogue.js";
import type { EntrySection } from "../domain/entry-section.js";

/*
  The two rules that keep a shared路径 shared, checked against the source.

  This began as `scripts/check-concept-flows.mjs`, which imported the *built*
  catalogue. That version failed open in the one direction that matters: an
  author edits a description, runs the gate, and it prints "passed" for wording
  it never read, because `dist/` still held yesterday's build. Measured — a
  45-character description carrying 「打个比方」 was injected into `git.ts` and
  the script exited 0.

  A test has no such gap. Vitest transpiles the source, so what is checked is
  what is on disk, and `pnpm test` runs before `pnpm build` rather than after.
*/

const MAX_DESCRIPTION = 40;
const FORBIDDEN = ["；", "打个比方"];

interface FlowStep {
  readonly label: string;
  readonly description: string;
  readonly current: boolean;
}

function flowOf(entry: (typeof CONCEPT_ENTRIES)[number]) {
  const section = entry.sections.find((candidate: EntrySection) => candidate.type === "flow");
  return section?.type === "flow" ? section.payload : undefined;
}

const withFlow = CONCEPT_ENTRIES.map((entry) => ({
  id: entry.head.id,
  flow: flowOf(entry),
})).filter(
  (row): row is { id: string; flow: NonNullable<ReturnType<typeof flowOf>> } => row.flow != null,
);

describe("concept flow maps", () => {
  it("has flows to check", () => {
    // A silently empty corpus would make every assertion below vacuous.
    expect(withFlow.length).toBeGreaterThan(0);
  });

  it("keeps every step to one scannable line", () => {
    /*
      A path is a map, not a lesson. Its whole job is to let a reader find their
      own step at a glance, and the first draft made every step two dense lines
      with three unrelated analogies across five steps — ten steps of that is a
      wall. The analogies belong in the entry's prose sections, which have room
      for one and are not read ten at a time.
    */
    const offenders = withFlow.flatMap(({ id, flow }) =>
      flow.steps.flatMap((step: FlowStep, index: number) => {
        const length = [...step.description].length;
        const forbidden = FORBIDDEN.filter((text) => step.description.includes(text));
        if (length <= MAX_DESCRIPTION && forbidden.length === 0) return [];
        return [
          `${id} step ${index + 1}: ${length} chars${
            forbidden.length > 0 ? `, contains ${forbidden.join(" and ")}` : ""
          } — ${step.description}`,
        ];
      }),
    );
    expect(offenders).toEqual([]);
  });

  it("gives every entry on one path the identical steps, differing only in the highlight", () => {
    /*
      `FlowPayloadSchema` says steps live on the entry rather than in a shared
      catalogue — "copy the steps and flip the flags". That is only true while
      the copies stay identical, and nothing in the type system keeps them so.
    */
    const byTitle = new Map<string, { id: string; steps: unknown }[]>();
    for (const { id, flow } of withFlow) {
      const steps = flow.steps.map(({ current: _current, ...rest }: FlowStep) => rest);
      byTitle.set(flow.title, [...(byTitle.get(flow.title) ?? []), { id, steps }]);
    }

    const drift = [...byTitle.entries()].flatMap(([title, rows]) => {
      const [first, ...rest] = rows;
      if (!first) return [];
      return rest
        .filter((row) => JSON.stringify(row.steps) !== JSON.stringify(first.steps))
        .map((row) => `「${title}」: ${row.id} differs from ${first.id}`);
    });
    expect(drift).toEqual([]);
  });

  it("marks exactly the entry's own step as current", () => {
    const wrong = withFlow.flatMap(({ id, flow }) => {
      const highlighted = flow.steps.filter((step: FlowStep) => step.current).length;
      return highlighted === 1 ? [] : [`${id}: ${highlighted} steps marked current`];
    });
    expect(wrong).toEqual([]);
  });
});
