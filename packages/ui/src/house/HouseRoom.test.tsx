import { withInterfaceLocale } from "../../test-support/interface-locale.js";
// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  answerUsed,
  courseKeepsakes,
  placeItem,
  type HouseState,
  type KeepsakeCourse,
} from "@pieai/university-core";
import { InterfaceLanguageProvider } from "../i18n/index.js";
import {
  HouseRoom,
  defaultPlacement,
  type HouseKeepsake,
  type HouseRoomProps,
} from "./HouseRoom.js";

let root: Root, container: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  // jsdom has no modal dialog; the kit's GameModal calls it.
  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
    this.open = false;
  };
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const course: KeepsakeCourse = {
  studyId: "ai-literacy",
  id: "understanding-ai",
  units: [
    {
      id: "first-useful-step",
      title: "先让它帮上一点忙",
      lessons: ["l1", "l2", "l3", "l4", "l5", "l6"].map((id) => ({ id })),
    },
  ],
};
const held: HouseKeepsake[] = courseKeepsakes(course)
  .slice(0, 2)
  .map((keepsake) => ({ keepsake, unitTitle: "先让它帮上一点忙", courseTitle: "认识 AI" }));

async function render(extra: Partial<HouseRoomProps> = {}) {
  const props: HouseRoomProps = {
    keepsakes: held,
    house: undefined,
    today: "2026-10-15",
    onPlace: vi.fn(),
    onMarkStyle: vi.fn(),
    onOpenWardrobe: vi.fn(),
    onOpenSegment: vi.fn(),
    ...extra,
  };
  await act(async () =>
    root.render(
      withInterfaceLocale(
        <InterfaceLanguageProvider locale="zh-CN">
          <HouseRoom {...props} />
        </InterfaceLanguageProvider>,
      ),
    ),
  );
  return props;
}
const keepsake = (art: string) =>
  [...container.querySelectorAll<HTMLButtonElement>("[data-keepsake]")].find((b) =>
    b.dataset.keepsake!.includes(art),
  )!;
const press = async (selector: string) =>
  act(async () => container.querySelector<HTMLButtonElement>(selector)!.click());

describe("the house", () => {
  it("is honest when empty, and keeps every fixture a real control", async () => {
    await render({ keepsakes: [] });
    expect(container.querySelector("[data-house-welcome]")?.textContent).toBe("欢迎回家");
    expect(container.textContent).toContain("还没有纪念品");
    for (const fixture of ["window", "calendar", "rack", "packs"])
      expect(container.querySelector(`button[data-house-${fixture}]`), fixture).not.toBeNull();
  });

  it("stands keepsakes on the shelf until moved, then where the learner put them", async () => {
    const id = held[0]!.keepsake.id;
    await render({ house: placeItem(undefined, id, 0.6, 0.9, "2026-10-01T00:00:00.000Z") });
    const first = container.querySelector<HTMLElement>(`[data-keepsake="${id}"]`)!;
    expect(first.style.insetInlineStart).toBe("60%");
    expect(first.style.top).toBe("90%");
    const second = container.querySelector<HTMLElement>(
      `[data-keepsake="${held[1]!.keepsake.id}"]`,
    )!;
    expect(second.style.insetInlineStart).toBe(`${defaultPlacement(1).x * 100}%`);
  });

  it("moves with the arrow keys as well as by dragging", async () => {
    const props = await render();
    const plane = keepsake("checkpoint");
    await act(async () =>
      plane.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })),
    );
    const start = defaultPlacement(0);
    expect(props.onPlace).toHaveBeenCalledWith(held[0]!.keepsake.id, start.x + 0.02, start.y);
  });

  it("drops a dragged keepsake where the pointer let go, without opening it", async () => {
    const props = await render();
    const stage = container.querySelector<HTMLElement>(".house-room__stage")!;
    stage.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 500 }) as DOMRect;
    const plane = keepsake("checkpoint");
    const fire = (type: string, x: number, y: number) =>
      plane.dispatchEvent(
        new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 }) as PointerEvent,
      );
    await act(async () => {
      fire("pointerdown", 80, 125);
      fire("pointermove", 400, 300);
      fire("pointerup", 400, 300);
      plane.click();
    });
    expect(props.onPlace).toHaveBeenCalledWith(held[0]!.keepsake.id, 0.5, 0.6);
    expect(container.querySelector("[data-keepsake-detail]")).toBeNull();
  });

  it("says what a keepsake stands for and leads back to its stretch", async () => {
    const props = await render();
    await act(async () => keepsake("checkpoint").click());
    const detail = document.querySelector("[data-keepsake-detail]")!;
    expect(detail.textContent).toContain("发出去之前由你自己定稿");
    expect(detail.textContent).toContain("先让它帮上一点忙 · 检查站");
    const back = [...detail.querySelectorAll("button")].find(
      (b) => b.textContent === "回到那一段",
    )!;
    await act(async () => back.click());
    expect(props.onOpenSegment).toHaveBeenCalledWith(held[0]!.keepsake);
  });

  it("marks only the days the learner said 用了, in the style they chose", async () => {
    let house: HouseState = answerUsed(
      undefined,
      "a",
      "used",
      "2026-10-03",
      "2026-10-03T08:00:00Z",
    );
    house = answerUsed(house, "b", "not-yet", "2026-10-04", "2026-10-04T08:00:00Z");
    const props = await render({ house });
    await press("[data-house-calendar]");
    const used = [...document.querySelectorAll("[data-used]")].map((d) =>
      d.getAttribute("data-day"),
    );
    expect(used).toEqual(["2026-10-03"]);
    const tally = [...document.querySelectorAll('[role="radio"]')].find(
      (b) => b.textContent === "画正字",
    ) as HTMLButtonElement;
    await act(async () => tally.click());
    expect(props.onMarkStyle).toHaveBeenCalledWith("tally");
  });

  it("opens the wardrobe from the coat rack and the pack box", async () => {
    const props = await render();
    await press("[data-house-rack]");
    await press("[data-house-packs]");
    expect(props.onOpenWardrobe).toHaveBeenNthCalledWith(1, "rack");
    expect(props.onOpenWardrobe).toHaveBeenNthCalledWith(2, "packs");
  });
});
