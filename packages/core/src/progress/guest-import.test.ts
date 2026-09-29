import { describe, expect, it, vi } from "vitest";
import { createMemoryPersistence } from "./memory.js";
import { createProgressPort } from "./port.js";
import type { ProgressDocument } from "../ports/progress.js";

describe("guest import local receipt", () => {
  it("reports the applied account before a held cloud pull finishes", async () => {
    const port = createProgressPort({ persistence: createMemoryPersistence() });
    port.addXp("guest-work", 20);
    let resolve!: (value: ProgressDocument | null) => void;
    const cloud = new Promise<ProgressDocument | null>((next) => {
      resolve = next;
    });
    const binding = port.bindAccount("anonymous", { load: () => cloud, save: async () => {} });
    const receipt = vi.fn();
    const importing = port.importGuestProgress!(receipt);
    expect(receipt).toHaveBeenCalledExactlyOnceWith("anonymous");
    expect(port.snapshot().xpEvents["guest-work"]).toBe(20);
    expect(port.syncState().status).toBe("syncing");
    resolve(null);
    await Promise.all([binding, importing]);
  });
  it("a scope changed by a merge observer cannot receive another user's local receipt", async () => {
    const port = createProgressPort({ persistence: createMemoryPersistence() });
    port.addXp("guest-work", 20);
    await port.bindAccount("a", null);
    const stop = port.subscribe(() => {
      if (port.syncState().userId === "a" && port.snapshot().xpEvents["guest-work"] === 20)
        void port.bindAccount("b", null);
    });
    const receipt = vi.fn();
    await port.importGuestProgress!(receipt);
    expect(receipt).not.toHaveBeenCalled();
    expect(port.syncState().userId).toBe("b");
    expect(port.snapshot().xpEvents["guest-work"]).toBeUndefined();
    stop();
  });
});
