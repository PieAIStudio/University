import { describe, expect, it } from "vitest";
import type { GradingPort, ProgressPort } from "@pieai/university-core";
import { withPrimmPreview } from "./primm-preview.js";

const create = (url: string) =>
  withPrimmPreview({} as GradingPort, { url, progress: {} as ProgressPort });

describe("explicit isolated preview endpoints", () => {
  it("permits separately configured non-privileged loopback ports", () => {
    expect(() => create("http://127.0.0.1:23651")).not.toThrow();
    expect(() => create("http://127.0.0.1:23151")).not.toThrow();
  });
  it.each([
    "https://example.com:23651",
    "http://192.168.1.10:23651",
    "http://127.0.0.1:80",
    "http://127.0.0.1:23651/other",
    "http://user:password@127.0.0.1:23651",
    "http://127.0.0.1:23651/?mode=public",
    "http://127.0.0.1:23651/#other",
  ])("still rejects %s", (url) => expect(() => create(url)).toThrow());
});
