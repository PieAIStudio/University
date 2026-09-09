import { describe, expect, it } from "vitest";
import {
  evaluateContextPack,
  evaluateContextService,
  visitContextProduct,
  setContextDocument,
  toggleContextParagraph,
  type ContextActivity,
} from "./ai-context.js";

const activity: ContextActivity = {
  id: "packing",
  kind: "ai-context",
  title: "Packing",
  brief: "",
  goal: "",
  takeaway: "",
  hint: "",
  source: { label: "Source", url: "https://example.com" },
  capacity: 10,
  authorityNote: "Owner specifies service; signed policy specifies price.",
  workTitle: "Product plan",
  slots: [
    {
      id: "service",
      label: "Service",
      expectedValueId: "pickup",
      authorityDocumentIds: ["owner", "copy"],
    },
    { id: "price", label: "Price", expectedValueId: "12", authorityDocumentIds: ["policy"] },
  ],
  documents: [
    {
      id: "owner",
      title: "Owner",
      provenance: "Owner",
      date: "2026-09-01",
      paragraphs: [
        {
          id: "service",
          text: "Pickup only",
          units: 3,
          facts: [{ slotId: "service", valueId: "pickup", text: "Pickup only" }],
        },
        { id: "story", text: "A useful customer story", units: 2, facts: [] },
      ],
    },
    {
      id: "policy",
      title: "Signed policy",
      provenance: "Signed",
      date: "2026-08-01",
      paragraphs: [
        {
          id: "price",
          text: "Price 12",
          units: 3,
          facts: [{ slotId: "price", valueId: "12", text: "12" }],
        },
      ],
    },
    {
      id: "copy",
      title: "Owner-approved handout",
      provenance: "Owner-approved copy",
      date: "2026-08-30",
      paragraphs: [
        {
          id: "copy-service",
          text: "Pickup only",
          units: 2,
          facts: [{ slotId: "service", valueId: "pickup", text: "Pickup only" }],
        },
      ],
    },
    {
      id: "draft",
      title: "New brainstorm",
      provenance: "Unapproved",
      date: "2026-09-07",
      paragraphs: [
        {
          id: "wrong-price",
          text: "Maybe 20",
          units: 1,
          facts: [{ slotId: "price", valueId: "20", text: "20" }],
        },
        {
          id: "unsourced-service",
          text: "Pickup only",
          units: 1,
          facts: [{ slotId: "service", valueId: "pickup", text: "Pickup only" }],
        },
      ],
    },
  ],
};

describe("AI context packing", () => {
  it("customers expose a flawed pack; packing alone does not prove the rebuilt page works", () => {
    const shop = {
      ...activity,
      visitors: [
        { id: "customer-service", name: "A", question: "Where?", slotId: "service" },
        { id: "customer-price", name: "B", question: "How much?", slotId: "price" },
      ],
    };
    const wrong = visitContextProduct(shop, ["service", "wrong-price"], "customer-price")!;
    expect(wrong).toMatchObject({ passed: false, status: "unsupported", value: null });
    const fixed = ["service", "price"];
    expect(evaluateContextService(shop, fixed, []).passed).toBe(false);
    const visits = shop.visitors.map((visitor) => visitContextProduct(shop, fixed, visitor.id)!);
    expect(evaluateContextService(shop, fixed, visits).passed).toBe(true);
    expect(evaluateContextService(shop, ["price", "service"], visits).passed).toBe(true);
    expect(evaluateContextService(shop, [...fixed, "story"], visits).passed).toBe(false);
    expect(
      evaluateContextService(shop, fixed, [{ ...wrong, paragraphIds: fixed, passed: true }]).passed,
    ).toBe(false);
    expect(visitContextProduct(shop, fixed, "unknown")).toBeUndefined();
  });
  it("shows missing result fields instead of inventing a product plan", () => {
    const result = evaluateContextPack(activity, []);
    expect(result.passed).toBe(false);
    expect(result.rows.map((row) => [row.status, row.value])).toEqual([
      ["missing", null],
      ["missing", null],
    ]);
  });
  it("accepts whole documents and smaller excerpts with identical sourced results", () => {
    const whole = setContextDocument(
      activity,
      setContextDocument(activity, [], "owner", true),
      "policy",
      true,
    );
    const fullResult = evaluateContextPack(activity, whole);
    const excerpt = evaluateContextPack(activity, ["service", "price"]);
    expect(fullResult.passed).toBe(true);
    expect(excerpt.passed).toBe(true);
    expect(fullResult.rows).toEqual(excerpt.rows);
    expect(fullResult.units).toBe(8);
    expect(excerpt.units).toBe(6);
  });
  it("accepts an authorized alternate source and harmless additional context", () => {
    const result = evaluateContextPack(activity, ["copy-service", "price", "story"]);
    expect(result.passed).toBe(true);
    expect(result.rows[0]?.evidence[0]).toMatchObject({
      documentId: "copy",
      paragraphId: "copy-service",
      authoritative: true,
    });
  });
  it("does not make the newest date authoritative, and exposes contradictory content", () => {
    const newest = evaluateContextPack(activity, ["service", "wrong-price"]);
    expect(newest.rows[1]?.status).toBe("unsupported");
    const conflict = evaluateContextPack(activity, ["service", "price", "wrong-price"]);
    expect(conflict.rows[1]?.status).toBe("conflict");
    expect(conflict.rows[1]?.value).toBeNull();
    expect(conflict.rows[1]?.evidence.map((item) => item.text)).toEqual(["12", "20"]);
    const repaired = evaluateContextPack(
      activity,
      toggleContextParagraph(activity, conflict.selectedParagraphIds, "wrong-price"),
    );
    expect(repaired.passed).toBe(true);
    expect(conflict.selectedParagraphIds).toContain("wrong-price");
  });
  it("needs provenance even when an unsupported note happens to quote the correct fact", () => {
    expect(evaluateContextPack(activity, ["unsourced-service", "price"]).rows[0]?.status).toBe(
      "unsupported",
    );
    expect(evaluateContextPack(activity, ["service", "unsourced-service", "price"]).passed).toBe(
      true,
    );
  });
  it("rejects excess capacity, unknown material and invalid capacity units", () => {
    expect(
      evaluateContextPack({ ...activity, capacity: 5 }, ["service", "price"]).overCapacity,
    ).toBe(true);
    expect(evaluateContextPack(activity, ["service", "price", "fabricated"]).passed).toBe(false);
    expect(
      evaluateContextPack(activity, ["service", "price", "fabricated"]).invalidParagraphIds,
    ).toEqual(["fabricated"]);
    expect(
      evaluateContextPack({ ...activity, capacity: Number.NaN }, ["service", "price"]).passed,
    ).toBe(false);
    const invalid = {
      ...activity,
      documents: [
        {
          ...activity.documents[0]!,
          paragraphs: [{ ...activity.documents[0]!.paragraphs[0]!, units: -1 }],
        },
      ],
    };
    expect(evaluateContextPack(invalid, ["service"]).overCapacity).toBe(true);
  });
  it("deduplicates material and ignores invalid editor operations", () => {
    const selected = ["service", "price"];
    expect(evaluateContextPack(activity, [...selected, "service"]).units).toBe(6);
    expect(toggleContextParagraph(activity, selected, "unknown")).toBe(selected);
    expect(setContextDocument(activity, selected, "unknown", true)).toBe(selected);
    expect(setContextDocument(activity, selected, "owner", false)).toEqual(["price"]);
  });
});
