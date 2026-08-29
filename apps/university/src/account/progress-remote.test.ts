import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createMemoryPersistence,
  createProgressPort,
  emptyProgress,
  lessonKeyOf,
  lessonRefKey,
  progressSourceOf,
  recapCardKeyOf,
  type LessonRef,
} from "@pieai/university-core";
import { describe, expect, it } from "vitest";

import { createSupabaseProgressRemoteStore } from "./progress-remote";

type QueryBuilder = {
  select(columns: string): QueryBuilder;
  eq(column: string, value: string): QueryBuilder;
  maybeSingle<T>(): Promise<{ data: T | null; error: Error | null }>;
  update(values: unknown): QueryBuilder;
  insert(values: unknown): Promise<{ error: Error | null }>;
};

function fakeClient(rows: unknown[]) {
  const calls: Array<Record<string, unknown>> = [];
  const builder: QueryBuilder = {
    select(columns) {
      calls.push({ kind: "select", columns });
      return builder;
    },
    eq(column, value) {
      calls.push({ kind: "eq", column, value });
      return builder;
    },
    maybeSingle() {
      calls.push({ kind: "maybeSingle" });
      return Promise.resolve({ data: (rows.shift() ?? null) as never, error: null });
    },
    update(values) {
      calls.push({ kind: "update", values });
      return builder;
    },
    insert(values) {
      calls.push({ kind: "insert", values });
      return Promise.resolve({ error: null });
    },
  };
  const client = {
    schema(schema: string) {
      calls.push({ kind: "schema", schema });
      return {
        from(table: string) {
          calls.push({ kind: "from", table });
          return builder;
        },
      };
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

function statefulFakeClient() {
  let row: { document: unknown; revision: number } | null = null;
  const client = {
    schema() {
      return {
        from() {
          let selected = "";
          let updateValues: { document?: unknown; revision?: number } | null = null;
          const filters = new Map<string, unknown>();
          const builder = {
            select(columns: string) {
              selected = columns;
              return builder;
            },
            eq(column: string, value: unknown) {
              filters.set(column, value);
              return builder;
            },
            update(values: { document?: unknown; revision?: number }) {
              updateValues = values;
              return builder;
            },
            async insert(values: { document: unknown; revision: number }) {
              if (row) {
                return { error: Object.assign(new Error("duplicate"), { code: "23505" }) };
              }
              row = { document: values.document, revision: values.revision };
              return { error: null };
            },
            async maybeSingle() {
              const matches =
                row !== null &&
                filters.get("user_id") === "user-1" &&
                (filters.get("revision") === undefined || filters.get("revision") === row.revision);
              if (updateValues) {
                if (!matches || row === null) return { data: null, error: null };
                row = {
                  document: updateValues.document ?? row.document,
                  revision: updateValues.revision ?? row.revision,
                };
                return { data: { revision: row.revision }, error: null };
              }
              if (!matches || row === null) return { data: null, error: null };
              return {
                data:
                  selected === "document"
                    ? { document: row.document }
                    : { document: row.document, revision: row.revision },
                error: null,
              };
            },
          };
          return builder;
        },
      };
    },
  } as unknown as SupabaseClient;
  return { client, row: () => row };
}

const COLLISION_FIRST: LessonRef = {
  studyId: "study",
  courseId: "course",
  unitId: "unit-first",
  lessonId: "shared-lesson",
};
const COLLISION_SECOND: LessonRef = { ...COLLISION_FIRST, unitId: "unit-second" };
const EMPTY_LESSON = { contentRevision: 1, exerciseIds: [] } as const;

function courseCardKeyOf(ref: LessonRef): string {
  return `${ref.studyId}/${ref.courseId}/${ref.lessonId}/shared-card`;
}

describe("createSupabaseProgressRemoteStore", () => {
  it("loads and parses the document through the University schema", async () => {
    const document = emptyProgress();
    document.streak = { days: 3, lastDay: "2026-08-24" };
    const { client, calls } = fakeClient([{ document }]);
    const remote = createSupabaseProgressRemoteStore(client);

    await expect(remote.load("user-1")).resolves.toEqual(document);
    expect(calls).toEqual([
      { kind: "schema", schema: "university" },
      { kind: "from", table: "progress" },
      { kind: "select", columns: "document" },
      { kind: "eq", column: "user_id", value: "user-1" },
      { kind: "maybeSingle" },
    ]);
  });

  it("increments the server revision before saving the merged document", async () => {
    const document = emptyProgress();
    const { client, calls } = fakeClient([
      { document: emptyProgress(), revision: "4" },
      { revision: 5 },
    ]);
    const remote = createSupabaseProgressRemoteStore(client);

    await remote.save("user-1", document);

    expect(calls).toContainEqual({
      kind: "update",
      values: { document, revision: 5 },
    });
    expect(calls).toContainEqual({ kind: "eq", column: "revision", value: 4 });
  });

  it("executes the real row adapter without restoring unit identity", async () => {
    const { client, row } = statefulFakeClient();
    const remote = createSupabaseProgressRemoteStore(client);
    const firstKey = lessonKeyOf(COLLISION_FIRST);
    const secondKey = lessonKeyOf(COLLISION_SECOND);
    const firstCardKey = courseCardKeyOf(COLLISION_FIRST);

    expect(firstKey).toBe(secondKey);

    const writer = createProgressPort({ persistence: createMemoryPersistence() });
    writer.advanceLesson(firstKey, 1);
    writer.confirmLessonRead(firstKey, EMPTY_LESSON.contentRevision);
    writer.saveReaderMark({
      markId: "remote-first-mark",
      lessonKey: lessonRefKey(COLLISION_FIRST),
      contentRevision: EMPTY_LESSON.contentRevision,
      kind: "question",
      quote: { exact: "first unit", prefix: "", suffix: "" },
      sectionTitle: null,
      note: null,
      createdAt: "2026-08-24T08:00:00.000Z",
      resolvedAt: null,
    });
    writer.createRecapCard({
      locator: COLLISION_FIRST,
      contentRevision: EMPTY_LESSON.contentRevision,
      commandId: "remote-first-recap",
      answer: "first remote answer",
    });
    writer.dropCards(COLLISION_FIRST.studyId, COLLISION_FIRST.courseId, COLLISION_FIRST.lessonId, [
      "shared-card",
    ]);
    writer.gradeCard(firstCardKey, "good");

    await remote.save("user-1", writer.snapshot());
    const loaded = await remote.load("user-1");
    expect(loaded).not.toBeNull();
    if (!loaded) throw new Error("expected the fake cloud row to load");

    expect(row()?.revision).toBe(1);
    const storedDocument = row()?.document as { lessons?: Record<string, unknown> } | undefined;
    expect(Object.keys(storedDocument?.lessons ?? {})).toEqual([firstKey]);
    const reader = createProgressPort({
      persistence: createMemoryPersistence(JSON.stringify(loaded)),
    });
    expect(progressSourceOf(reader).completionOf(COLLISION_SECOND, EMPTY_LESSON)).toEqual({
      exercisesPassed: true,
      readConfirmed: true,
    });
    expect(reader.readerMarks(COLLISION_FIRST.studyId)).toHaveLength(1);
    expect(reader.readerMarks(COLLISION_FIRST.studyId)[0]?.lessonKey).toBe(
      lessonRefKey(COLLISION_FIRST),
    );
    expect(reader.recapCard(COLLISION_SECOND)).toBeNull();
    expect(reader.snapshot().cards[firstCardKey]?.fsrs.reps).toBe(1);
    expect(reader.snapshot().cards[recapCardKeyOf(COLLISION_FIRST)]).toBeDefined();
  });
});
