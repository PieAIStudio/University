import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createOnlinePresencePort, presenceAdapterIsWired } from "./presence";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../..");

describe("createOnlinePresencePort", () => {
  it("is not wired while university.study_groups is undeployed", () => {
    expect(presenceAdapterIsWired()).toBe(false);
    const port = createOnlinePresencePort(
      {
        VITE_SWIMMER_CORE_SUPABASE_URL: "https://example.supabase.co",
        VITE_SWIMMER_CORE_PUBLISHABLE_KEY: "sb_publishable_test",
      },
      {
        self: { userId: "ada", displayName: "Ada" },
        groupId: "group-1",
        seeAs: () => "group",
      },
    );
    port.publishLocation({
      studyId: "turing-pact",
      courseId: "foundations-before-zero",
      lessonId: "you-already-know-apps",
    });
    port.publishCursor({ x: 0.2, y: 0.3, viewKey: "world" });
    expect(port.snapshot().peers).toEqual([]);
    expect(port.snapshot().self).toBeNull();
  });

  it("is not imported by the running app", () => {
    const app = readFileSync(join(root, "src/app/App.tsx"), "utf8");
    expect(app).not.toMatch(/createOnlinePresencePort/);
    expect(app).not.toMatch(/from ["'].*account\/presence["']/);
  });
});
