import { describe, expect, it } from "vitest";

import { CONCEPT_ENTRIES, CONCEPT_PROBLEMS } from "./catalogue.js";
import { parseEntrySection, STYLE_SKIN_IDS, type EntrySection } from "../domain/entry-section.js";

/*
  This gate imports the source catalogue, not `dist/`. A check against yesterday's
  build can say the skin is valid while the edited TypeScript is already broken;
  Vitest must inspect the same source that the author just changed.
*/
const STYLE_SAMPLES = CONCEPT_ENTRIES.flatMap((entry) => {
  const section = entry.sections.find(
    (candidate: EntrySection) => candidate.type === "style-sample",
  );
  return section?.type === "style-sample"
    ? [{ entryId: entry.head.id, payload: section.payload }]
    : [];
});

describe("concept style samples", () => {
  it("keeps the current sample entries on the shared skin list", () => {
    expect(CONCEPT_PROBLEMS).toEqual([]);
    expect(STYLE_SAMPLES.map(({ entryId }) => entryId)).toEqual(["style-apple", "style-brutalism"]);

    for (const { payload } of STYLE_SAMPLES) {
      expect(STYLE_SKIN_IDS).toContain(payload.skin);
      if (payload.contrastSkin !== undefined) {
        expect(STYLE_SKIN_IDS).toContain(payload.contrastSkin);
        expect(payload.contrastSkin).not.toBe(payload.skin);
      }
    }
  });

  it("rejects a comparison that points back to its own skin", () => {
    const parsed = parseEntrySection(
      {
        id: "same-style",
        type: "style-sample",
        payload: {
          alt: "同一个页面不能用同一种皮肤做对比。",
          skin: "apple",
          contrastSkin: "apple",
        },
      },
      0,
    );

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.problem.message).toContain("contrastSkin");
  });
});
