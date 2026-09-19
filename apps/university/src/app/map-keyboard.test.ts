// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { isMapSpace } from "./map-keyboard.js";

afterEach(() => document.body.replaceChildren());
function decision(element: HTMLElement, init: KeyboardEventInit = {}) {
  let accepted = false;
  element.addEventListener(
    "keydown",
    (e) => {
      accepted = isMapSpace(e);
    },
    { once: true },
  );
  element.dispatchEvent(
    new KeyboardEvent("keydown", {
      code: "Space",
      key: " ",
      bubbles: true,
      cancelable: true,
      ...init,
    }),
  );
  return accepted;
}
describe("map shortcut ownership", () => {
  it("opens for the map or unfocused body, not arbitrary page content", () => {
    const map = document.createElement("section");
    map.dataset.mapSurface = "true";
    const canvas = document.createElement("canvas");
    map.append(canvas);
    document.body.append(map);
    expect(decision(canvas)).toBe(true);
    expect(decision(document.body)).toBe(true);
    const p = document.createElement("p");
    document.body.append(p);
    expect(decision(p)).toBe(false);
  });
  it.each(["input", "textarea", "select", "button", "a", "summary"])(
    "preserves native Space on %s",
    (tag) => {
      const control = document.createElement(tag);
      document.body.append(control);
      expect(decision(control)).toBe(false);
    },
  );
  it("preserves editable ancestors, modifiers, composition and held key repeats", () => {
    const editor = document.createElement("div");
    editor.contentEditable = "true";
    editor.setAttribute("contenteditable", "true");
    const inner = document.createElement("span");
    editor.append(inner);
    document.body.append(editor);
    expect(decision(inner)).toBe(false);
    for (const flag of ["repeat", "isComposing", "ctrlKey", "metaKey", "altKey", "shiftKey"])
      expect(decision(document.body, { [flag]: true })).toBe(false);
  });
  it("does not overtake another dialog or mobile drawer", () => {
    const dialog = document.createElement("dialog");
    dialog.open = true;
    document.body.append(dialog);
    expect(decision(document.body)).toBe(false);
    dialog.remove();
    const panel = document.createElement("div");
    panel.dataset.mobilePanel = "aside";
    document.body.append(panel);
    expect(decision(document.body)).toBe(false);
  });
});
