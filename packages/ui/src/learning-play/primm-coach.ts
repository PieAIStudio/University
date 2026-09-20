/**
 * Step-lesson interaction helpers that live outside React state: a pointer drag
 * that works for mouse, pen and touch (HTML5 drag-and-drop does not on phones),
 * and the demonstration hand that shows a new gesture once.
 */

export interface PointerDragOptions {
  /** Current drop targets, marked with `data-drop`. */
  readonly targets: () => readonly HTMLElement[];
  readonly onDrop: (target: HTMLElement) => void;
  readonly onStart?: () => void;
}

/** Drag `element` with any pointer. A press without movement stays a click. */
export function pointerDrag(element: HTMLElement, options: PointerDragOptions): () => void {
  let start: { x: number; y: number; ox: number; oy: number } | null = null;
  let ghost: HTMLElement | null = null;
  let over: HTMLElement | null = null;
  let moved = false;
  const hit = (x: number, y: number) => {
    const target = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-drop]");
    return target && options.targets().includes(target) ? target : null;
  };
  const down = (event: PointerEvent) => {
    if (event.button > 0) return;
    const box = element.getBoundingClientRect();
    start = {
      x: event.clientX,
      y: event.clientY,
      ox: event.clientX - box.left,
      oy: event.clientY - box.top,
    };
    moved = false;
    element.setPointerCapture?.(event.pointerId);
  };
  const move = (event: PointerEvent) => {
    if (!start) return;
    if (!moved && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 6) return;
    if (!moved) {
      moved = true;
      options.onStart?.();
      const box = element.getBoundingClientRect();
      ghost = element.cloneNode(true) as HTMLElement;
      ghost.classList.add("primm-steps__ghost");
      ghost.removeAttribute("id");
      Object.assign(ghost.style, {
        left: `${box.left}px`,
        top: `${box.top}px`,
        width: `${box.width}px`,
      });
      document.body.append(ghost);
      element.classList.add("is-lifted");
    }
    if (ghost) {
      ghost.style.left = `${event.clientX - start.ox}px`;
      ghost.style.top = `${event.clientY - start.oy}px`;
    }
    const target = hit(event.clientX, event.clientY);
    if (target !== over) {
      over?.classList.remove("is-hot");
      over = target;
      over?.classList.add("is-hot");
    }
  };
  const end = () => {
    if (!start) return;
    start = null;
    if (!moved) return;
    element.classList.remove("is-lifted");
    over?.classList.remove("is-hot");
    ghost?.remove();
    ghost = null;
    const target = over;
    over = null;
    if (target) options.onDrop(target);
  };
  // A drag ends in pointerup, which the browser follows with a click on the
  // element; swallow that click so a finished drag is not also a selection.
  const click = (event: MouseEvent) => {
    if (moved) {
      event.preventDefault();
      event.stopImmediatePropagation();
      moved = false;
    }
  };
  element.addEventListener("pointerdown", down);
  element.addEventListener("pointermove", move);
  element.addEventListener("pointerup", end);
  element.addEventListener("pointercancel", end);
  element.addEventListener("click", click, true);
  return () => {
    element.removeEventListener("pointerdown", down);
    element.removeEventListener("pointermove", move);
    element.removeEventListener("pointerup", end);
    element.removeEventListener("pointercancel", end);
    element.removeEventListener("click", click, true);
    ghost?.remove();
  };
}

export type CoachGesture = "tap" | "drag" | "swipe";
export interface CoachDemo {
  readonly from: HTMLElement;
  readonly to?: HTMLElement;
  readonly gesture: CoachGesture;
  readonly caption: string;
}

const HAND =
  '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8 3v19.5l5-4.6 3.4 8.1 3.6-1.5-3.4-8H23z" fill="#fff" stroke="#17202d" stroke-width="2" stroke-linejoin="round"/></svg>';
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let token = 0;
let layer: HTMLElement | null = null;

/** Stop any demonstration; a learner's own pointer always wins. */
export function stopCoach() {
  token++;
  layer?.replaceChildren();
  document.querySelectorAll(".primm-steps__ghost.is-demo").forEach((node) => node.remove());
}

/** Show a gesture once with a pointing hand and a one-line caption. Reduced
 * motion shows the caption beside the control instead of moving anything. */
export async function playCoach(demo: CoachDemo): Promise<void> {
  stopCoach();
  const mine = token;
  if (!layer || !document.body.contains(layer)) {
    layer = document.createElement("div");
    layer.className = "primm-steps__coach";
    layer.setAttribute("aria-hidden", "true");
    document.body.append(layer);
  }
  const reduce = matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  demo.from.scrollIntoView?.({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  await wait(reduce ? 0 : 260);
  if (mine !== token) return;
  const centre = (element: HTMLElement) => {
    const box = element.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  };
  const a = centre(demo.from);
  const hand = document.createElement("div");
  hand.className = "primm-steps__hand";
  hand.innerHTML = HAND;
  hand.style.left = `${a.x}px`;
  hand.style.top = `${a.y}px`;
  const caption = document.createElement("div");
  caption.className = "primm-steps__caption";
  caption.textContent = demo.caption;
  layer.append(hand, caption);
  const place = (x: number, y: number) => {
    const width = caption.offsetWidth;
    caption.style.left = `${Math.max(12, Math.min(innerWidth - width - 12, x - 18))}px`;
    caption.style.top = `${Math.max(8, y - 64)}px`;
  };
  place(a.x, a.y);
  if (reduce || typeof hand.animate !== "function") {
    await wait(2600);
    if (mine === token) stopCoach();
    return;
  }
  const press = async (x: number, y: number) => {
    const ripple = document.createElement("div");
    ripple.className = "primm-steps__ripple";
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    layer?.append(ripple);
    await ripple
      .animate(
        [
          { transform: "scale(.4)", opacity: 1 },
          { transform: "scale(1.5)", opacity: 0 },
        ],
        { duration: 520, easing: "ease-out" },
      )
      .finished.catch(() => undefined);
    ripple.remove();
  };
  if (demo.gesture === "tap") {
    await wait(300);
    await press(a.x, a.y);
    await wait(250);
    if (mine === token) await press(a.x, a.y);
  }
  if (demo.gesture === "drag" && demo.to) {
    const b = centre(demo.to);
    await press(a.x, a.y);
    if (mine !== token) return;
    const box = demo.from.getBoundingClientRect();
    const ghost = demo.from.cloneNode(true) as HTMLElement;
    ghost.classList.add("primm-steps__ghost", "is-demo");
    ghost.removeAttribute("id");
    Object.assign(ghost.style, {
      left: `${box.left}px`,
      top: `${box.top}px`,
      width: `${box.width}px`,
    });
    document.body.append(ghost);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const timing = {
      duration: 1100,
      easing: "cubic-bezier(.45,0,.25,1)",
      fill: "forwards" as const,
    };
    const started = performance.now();
    const follow = () => {
      if (mine !== token) return;
      const k = Math.min(1, (performance.now() - started) / 1100);
      place(a.x + dx * k, a.y + dy * k);
      if (k < 1) requestAnimationFrame(follow);
    };
    follow();
    await Promise.all([
      hand.animate([{ transform: "none" }, { transform: `translate(${dx}px,${dy}px)` }], timing)
        .finished,
      ghost.animate(
        [{ transform: "scale(.92)" }, { transform: `translate(${dx}px,${dy}px) scale(.8)` }],
        timing,
      ).finished,
    ]).catch(() => undefined);
    if (mine !== token) return;
    await press(b.x, b.y);
    ghost.remove();
  }
  if (demo.gesture === "swipe") {
    await press(a.x, a.y);
    for (const [x, r] of [
      [90, 8],
      [-90, -8],
    ] as const) {
      if (mine !== token) return;
      await Promise.all([
        hand.animate(
          [{ transform: "none" }, { transform: `translateX(${x}px)` }, { transform: "none" }],
          { duration: 1000, easing: "ease-in-out" },
        ).finished,
        demo.from.animate(
          [
            { transform: "none" },
            { transform: `translateX(${x}px) rotate(${r}deg)` },
            { transform: "none" },
          ],
          { duration: 1000, easing: "ease-in-out" },
        ).finished,
      ]).catch(() => undefined);
    }
  }
  await wait(500);
  if (mine === token) stopCoach();
}

const SEEN_KEY = "university.primm.coach";
/** Each gesture is demonstrated automatically once per browser; "Show me" replays it. */
export function coachSeen(gesture: string): boolean {
  try {
    return (JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[]).includes(gesture);
  } catch {
    return true;
  }
}
export function markCoachSeen(gesture: string) {
  try {
    const seen = new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[]);
    seen.add(gesture);
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  } catch {
    // Storage may be unavailable; the demo then simply does not repeat itself.
  }
}
