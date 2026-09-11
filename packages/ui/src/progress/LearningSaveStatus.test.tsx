import { describe, expect, it } from "vitest";
import {
  createMemoryPersistence,
  createMemoryRemoteStore,
  createProgressPort,
  lessonKey,
} from "@pieai/university-core";
import { saveMessageKey } from "./LearningSaveStatus.js";

describe("learning save status", () => {
  it("S2 separates a local save, an account, a cloud receipt, and offline work", async () => {
    const progress = createProgressPort({ persistence: createMemoryPersistence() });
    expect(saveMessageKey(progress)).toBe("product.save.initial");
    progress.advanceLesson(lessonKey("s", "c", "l"), 0.5);
    expect(saveMessageKey(progress)).toBe("product.save.local");
    await progress.bindAccount("learner", null);
    expect(saveMessageKey(progress)).toBe("product.save.local");
    const remote = createMemoryRemoteStore();
    await progress.bindAccount("learner", remote);
    expect(saveMessageKey(progress)).toBe("product.save.synced");
    remote.goOffline();
    progress.advanceLesson(lessonKey("s", "c", "l"), 1);
    await progress.flush();
    expect(saveMessageKey(progress)).toBe("product.save.offline");
  });
  it("S3 a failed write is never a successful-save message and retry restores it", () => {
    let blocked = true;
    const progress = createProgressPort({
      persistence: {
        read: () => null,
        write: () => {
          if (blocked) throw new Error("full");
        },
      },
    });
    progress.advanceLesson(lessonKey("s", "c", "l"), 0.5);
    expect(saveMessageKey(progress)).toBe("product.save.failed");
    blocked = false;
    expect(progress.retryLocalSave?.()).toBe(true);
    expect(saveMessageKey(progress)).toBe("product.save.local");
  });
});
