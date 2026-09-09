import type { ActivityBase } from "./types.js";

export interface ContextFact {
  readonly slotId: string;
  readonly valueId: string;
  readonly text: string;
}

export interface ContextParagraph {
  readonly id: string;
  readonly text: string;
  /** Illustrative packing units, deliberately not a token or quality estimate. */
  readonly units: number;
  readonly facts: readonly ContextFact[];
}

export interface ContextDocument {
  readonly id: string;
  readonly title: string;
  readonly provenance: string;
  readonly date: string;
  readonly paragraphs: readonly ContextParagraph[];
}

export interface ContextActivity extends ActivityBase {
  readonly kind: "ai-context";
  readonly capacity: number;
  readonly authorityNote: string;
  readonly workTitle: string;
  readonly initialParagraphIds?: readonly string[];
  readonly visitors?: readonly {
    readonly id: string;
    readonly name: string;
    readonly question: string;
    readonly slotId: string;
  }[];
  readonly documents: readonly ContextDocument[];
  readonly slots: readonly {
    readonly id: string;
    readonly label: string;
    readonly expectedValueId: string;
    readonly authorityDocumentIds: readonly string[];
  }[];
}

export type ContextSlotStatus = "ready" | "missing" | "conflict" | "unsupported" | "mismatch";
export interface ContextEvidence extends ContextFact {
  readonly documentId: string;
  readonly paragraphId: string;
  readonly authoritative: boolean;
}
export interface ContextWorkRow {
  readonly slotId: string;
  readonly label: string;
  readonly status: ContextSlotStatus;
  readonly evidence: readonly ContextEvidence[];
  readonly value: string | null;
}
export interface ContextPackResult {
  readonly passed: boolean;
  readonly units: number;
  readonly overCapacity: boolean;
  readonly invalidParagraphIds: readonly string[];
  readonly selectedParagraphIds: readonly string[];
  readonly rows: readonly ContextWorkRow[];
}

export interface ContextVisit {
  readonly visitorId: string;
  readonly paragraphIds: readonly string[];
  readonly status: ContextSlotStatus;
  readonly value: string | null;
  readonly passed: boolean;
}

/** A customer's answer is obtained from the built material pack, never invented by the view. */
export function visitContextProduct(
  activity: ContextActivity,
  builtParagraphIds: readonly string[],
  visitorId: string,
): ContextVisit | undefined {
  const visitor = activity.visitors?.find((item) => item.id === visitorId);
  const pack = evaluateContextPack(activity, builtParagraphIds);
  const row = pack.rows.find((item) => item.slotId === visitor?.slotId);
  if (!visitor || !row) return undefined;
  return {
    visitorId,
    paragraphIds: pack.selectedParagraphIds,
    status: row.status,
    value: row.value,
    passed: row.status === "ready" && !pack.overCapacity && !pack.invalidParagraphIds.length,
  };
}

export function evaluateContextService(
  activity: ContextActivity,
  selection: readonly string[],
  visits: readonly ContextVisit[],
) {
  const pack = evaluateContextPack(activity, selection);
  const key = (ids: readonly string[]) => JSON.stringify([...new Set(ids)].sort());
  const currentKey = key(pack.selectedParagraphIds);
  const served = (activity.visitors ?? [])
    .filter((visitor) => {
      const expected = visitContextProduct(activity, selection, visitor.id);
      return (
        expected?.passed &&
        visits.some(
          (visit) =>
            visit.visitorId === visitor.id &&
            key(visit.paragraphIds) === currentKey &&
            visit.passed === expected.passed &&
            visit.status === expected.status &&
            visit.value === expected.value,
        )
      );
    })
    .map((visitor) => visitor.id);
  return {
    passed: pack.passed && served.length === (activity.visitors?.length ?? 0),
    pack,
    servedVisitorIds: served,
    missingVisitorIds: (activity.visitors ?? [])
      .filter((visitor) => !served.includes(visitor.id))
      .map((visitor) => visitor.id),
  };
}

export function toggleContextParagraph(
  activity: ContextActivity,
  selected: readonly string[],
  paragraphId: string,
): readonly string[] {
  if (!activity.documents.some((doc) => doc.paragraphs.some((p) => p.id === paragraphId))) {
    return selected;
  }
  return selected.includes(paragraphId)
    ? selected.filter((id) => id !== paragraphId)
    : [...selected, paragraphId];
}

export function setContextDocument(
  activity: ContextActivity,
  selected: readonly string[],
  documentId: string,
  included: boolean,
): readonly string[] {
  const document = activity.documents.find((doc) => doc.id === documentId);
  if (!document) return selected;
  const ids = document.paragraphs.map((paragraph) => paragraph.id);
  return included
    ? [...new Set([...selected, ...ids])]
    : selected.filter((id) => !ids.includes(id));
}

/** The fixed work result can only use packed facts, with their original provenance. */
export function evaluateContextPack(
  activity: ContextActivity,
  selection: readonly string[],
): ContextPackResult {
  const unique = [...new Set(selection)];
  const paragraphs = activity.documents.flatMap((document) =>
    document.paragraphs.map((paragraph) => ({ document, paragraph })),
  );
  const packed = paragraphs.filter(({ paragraph }) => unique.includes(paragraph.id));
  const invalidParagraphIds = unique.filter(
    (id) => !paragraphs.some(({ paragraph }) => paragraph.id === id),
  );
  const invalidUnits = packed.some(
    ({ paragraph }) => !Number.isFinite(paragraph.units) || paragraph.units < 0,
  );
  const units = packed.reduce((sum, { paragraph }) => sum + paragraph.units, 0);
  const overCapacity =
    invalidUnits ||
    !Number.isFinite(activity.capacity) ||
    activity.capacity < 0 ||
    units > activity.capacity;
  const rows = activity.slots.map((slot): ContextWorkRow => {
    const evidence = packed.flatMap(({ document, paragraph }) =>
      paragraph.facts
        .filter((fact) => fact.slotId === slot.id)
        .map((fact) => ({
          ...fact,
          documentId: document.id,
          paragraphId: paragraph.id,
          authoritative: slot.authorityDocumentIds.includes(document.id),
        })),
    );
    const values = new Set(evidence.map((item) => item.valueId));
    const authority = evidence.find((item) => item.authoritative);
    const status: ContextSlotStatus =
      evidence.length === 0
        ? "missing"
        : values.size > 1
          ? "conflict"
          : !authority
            ? "unsupported"
            : authority.valueId !== slot.expectedValueId
              ? "mismatch"
              : "ready";
    return {
      slotId: slot.id,
      label: slot.label,
      status,
      evidence,
      value: status === "ready" ? authority!.text : null,
    };
  });
  return {
    passed:
      !overCapacity &&
      invalidParagraphIds.length === 0 &&
      rows.every((row) => row.status === "ready"),
    units,
    overCapacity,
    invalidParagraphIds,
    selectedParagraphIds: unique.filter((id) => !invalidParagraphIds.includes(id)),
    rows,
  };
}
