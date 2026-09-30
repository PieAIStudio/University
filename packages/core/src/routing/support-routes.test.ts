import { describe, expect, it } from "vitest";
import { activeIdForView, fromPath, SUPPORT_PATHS, toPath, type SupportPage } from "./view.js";

describe("stable support addresses", () => {
  for (const [page, path] of Object.entries(SUPPORT_PATHS)) {
    it(`round trips ${path} without creating a fifth primary door`, () => {
      const view = { kind: "support", page: page as SupportPage } as const;
      expect(fromPath(path)).toEqual(view);
      expect(toPath(view)).toBe(path);
      expect(activeIdForView(view)).toBe("profile");
    });
  }
  it.each(["/help/unknown", "/about/unknown", "/about/privacy/extra", "/about%2Fprivacy"])(
    "does not treat %s as a course or a policy",
    (path) => {
      expect(fromPath(path)).toEqual({ kind: "world" });
    },
  );
});
