// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InterfaceLanguageProvider } from "../i18n/react.js";
import { PlayCatalog } from "./PlayCatalog.js";

function render(learner: boolean) {
  history.replaceState(null, "", learner ? "/library/courseware" : "/play-lab/catalog");
  const node = document.createElement("div");
  node.innerHTML = renderToStaticMarkup(
    <InterfaceLanguageProvider locale="en">
      <PlayCatalog learner={learner} />
    </InterfaceLanguageProvider>,
  );
  return node;
}
describe("one courseware catalogue, with author diagnostics only in the lab", () => {
  it("the learner's Library keeps the actual activities but no lab links, code identifiers or layout rationale", () => {
    const node = render(true);
    expect(node.querySelectorAll("[data-entry-id]")).toHaveLength(25);
    expect(node.querySelector(".learning-activity")).not.toBeNull();
    expect(node.querySelector('a[href^="/play-lab"]')).toBeNull();
    expect(node.querySelector(".play-catalog__rationale")).toBeNull();
    expect(node.textContent).not.toContain("native:connect");
  });
  it("the laboratory keeps its diagnostic links and entry identities", () => {
    const node = render(false);
    expect(node.querySelectorAll("[data-entry-id]")).toHaveLength(25);
    expect(node.querySelector('a[href="/play-lab"]')).not.toBeNull();
    expect(node.querySelector(".play-catalog__rationale")).not.toBeNull();
    expect(node.textContent).toContain("native:connect");
  });
});
