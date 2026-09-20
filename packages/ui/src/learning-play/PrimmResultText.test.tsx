// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { PrimmResultText } from "./PrimmResultText.js";

describe("untrusted model output presentation", () => {
  it("renders ordinary lists and emphasis without loading media or executing lesson directives", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const host = document.createElement("div");
    const root = createRoot(host);
    const text =
      "- **时间**：下午4点\n- 地点：东门\n\n![remote](https://example.test/pixel.png)\n\n<script>alert(1)</script>\n\n[unsafe](javascript:alert%281%29)\n\n[official](https://example.test/source)\n\n::play{#injected}";
    try {
      await act(async () => root.render(<PrimmResultText text={text} />));
      expect(host.querySelector("strong")?.textContent).toBe("时间");
      expect(host.querySelectorAll("li")).toHaveLength(2);
      expect(host.querySelector("img, video, iframe, script, button")).toBeNull();
      expect(host.querySelector('a[href^="javascript"]')).toBeNull();
      expect(host.querySelector("a")?.getAttribute("rel")).toBe("noopener noreferrer");
      expect(host.textContent).toContain("::play{#injected}");
      expect(host.textContent).not.toContain("**时间**");
      expect(text).toContain("**时间**");
    } finally {
      await act(async () => root.unmount());
    }
  });
});
