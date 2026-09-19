// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import {
  DEFAULT_ACCOUNT_PREFERENCES,
  emptyAccountData,
  type AccountPreferences,
} from "@pieai/university-core";
import {
  bindWorldStylePreference,
  readWorldStyle,
  subscribeWorldStyle,
  writeWorldStyle,
  WorldStyleControl,
} from "./world-style.js";
let cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups.reverse().forEach((f) => f());
  cleanups = [];
  writeWorldStyle("classic");
});
function port() {
  let preferences = { ...DEFAULT_ACCOUNT_PREFERENCES };
  const listeners = new Set<() => void>();
  const changed = () => listeners.forEach((f) => f());
  return {
    accountData: () => ({ ...emptyAccountData(), preferences }),
    setAccountPreferences: vi.fn((value: AccountPreferences) => {
      preferences = value;
      changed();
    }),
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    switchIdentity: () => {
      preferences = { ...DEFAULT_ACCOUNT_PREFERENCES };
      changed();
    },
  };
}
describe("one shared world style across canvases", () => {
  it("works without storage and notifies subscribers", () => {
    const changed = vi.fn();
    cleanups.push(subscribeWorldStyle(changed));
    writeWorldStyle("clay");
    expect(readWorldStyle()).toBe("clay");
    expect(changed).toHaveBeenCalledTimes(1);
    writeWorldStyle("clay");
    expect(changed).toHaveBeenCalledTimes(1);
    expect(() => writeWorldStyle("unknown" as never)).toThrow(TypeError);
  });
  it("writes through the real preference owner and clears a changed identity", () => {
    const source = port();
    cleanups.push(bindWorldStylePreference(source));
    writeWorldStyle("clay");
    expect(source.setAccountPreferences).toHaveBeenCalledTimes(1);
    expect(source.accountData().preferences.avatarRecipe).toBeNull();
    expect(source.accountData().preferences.theme).toBe("system");
    source.switchIdentity();
    expect(readWorldStyle()).toBe("classic");
  });
  it("does not let stale unmounts detach a newer owner", () => {
    const old = bindWorldStylePreference(port());
    const current = port();
    cleanups.push(bindWorldStylePreference(current));
    old();
    writeWorldStyle("clay");
    expect(current.accountData().preferences.worldStyle).toBe("clay");
  });
  it("renders accessible choices server-side without browser storage", () => {
    const html = renderToString(<WorldStyleControl />);
    expect(html).toContain('role="group"');
    expect(html).toContain('data-world-style-choice="clay"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-pressed="false"');
  });
});
