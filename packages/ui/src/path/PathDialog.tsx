import { arrow, autoUpdate, flip, offset, shift, useFloating } from "@floating-ui/react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Shared chrome for the path cards: a DOM dialog over the 3D path.
 *
 * Readable text is DOM, never geometry — Web3D baseline rule 7, and the
 * reason these cards must not be drawn inside the canvas. The trap, Escape,
 * and restoring focus onto the node button that opened the card are the
 * acceptance tests for screen 02; both cards use this one implementation.
 */

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])';

function focusableIn(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => {
    if (element.hasAttribute("disabled")) return false;
    if (element.getAttribute("aria-hidden") === "true") return false;
    if (element.tabIndex < 0) return false;
    return true;
  });
}

export function PathDialog({
  open,
  title,
  onClose,
  returnFocusTo,
  anchorTo,
  children,
}: {
  readonly open: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly returnFocusTo?: HTMLElement | null;
  /**
   * The thing this card is about, so it can grow a tail pointing at it.
   *
   * Frame C5 is the difference between "this stone" and "a dialog": the bubble
   * hangs off the node it belongs to, and the path stays visible around it.
   * A card floating in the middle of the screen has lost which node you tapped
   * by the time it finishes animating in.
   *
   * Kept separate from `returnFocusTo` even though every caller passes the same
   * element today. They answer different questions — where focus goes on close,
   * and what this is about — and a card opened from a menu would have the first
   * without the second.
   */
  readonly anchorTo?: HTMLElement | null;
  readonly children: ReactNode;
}) {
  const headingId = useId();
  const layerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const anchor = anchorTo ?? returnFocusTo ?? null;
  const anchored = anchor !== null;
  const { refs, floatingStyles, middlewareData, placement } = useFloating({
    open: open && anchored,
    placement: "bottom",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(14),
      // The node can sit anywhere on a winding path, including hard against an
      // edge, so the card flips above it and slides along rather than hanging
      // off screen.
      flip({ padding: 16 }),
      shift({ padding: 16 }),
      arrow({ element: arrowRef, padding: 12 }),
    ],
  });

  useEffect(() => {
    refs.setReference(anchor);
  }, [anchor, refs]);

  useEffect(() => {
    if (!open) return;
    const card = cardRef.current;
    const layer = layerRef.current;
    if (!card) return;

    const first = focusableIn(card)[0] ?? card;
    first.focus();

    const blocked: HTMLElement[] = [];
    for (const child of document.body.children) {
      if (!(child instanceof HTMLElement) || child === layer) continue;
      child.setAttribute("inert", "");
      blocked.push(child);
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusableIn(card);
      if (items.length === 0) {
        event.preventDefault();
        card.focus();
        return;
      }
      const firstItem = items[0]!;
      const lastItem = items[items.length - 1]!;
      const active = document.activeElement;
      if (event.shiftKey) {
        if (active === firstItem || !card.contains(active)) {
          event.preventDefault();
          lastItem.focus();
        }
      } else if (active === lastItem || !card.contains(active)) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    document.addEventListener("keydown", onKey, true);
    const restore = returnFocusTo ?? null;
    return () => {
      document.removeEventListener("keydown", onKey, true);
      for (const child of blocked) child.removeAttribute("inert");
      restore?.focus();
    };
  }, [open, returnFocusTo]);

  if (!open || typeof document === "undefined") return null;

  const arrowData = middlewareData.arrow;
  const arrowSide = ({ top: "bottom", bottom: "top", left: "right", right: "left" } as const)[
    placement.split("-")[0] as "top" | "bottom" | "left" | "right"
  ];

  return createPortal(
    <div
      ref={layerRef}
      className={anchored ? "path-card-layer path-card-layer--anchored" : "path-card-layer"}
    >
      <div className="path-card__scrim" onClick={onClose} />
      <div
        ref={(node) => {
          cardRef.current = node;
          if (anchored) refs.setFloating(node);
        }}
        className="path-card"
        style={anchored ? floatingStyles : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
      >
        {anchored ? (
          <div
            ref={arrowRef}
            className="path-card__arrow"
            style={{
              left: arrowData?.x === undefined ? undefined : `${arrowData.x}px`,
              top: arrowData?.y === undefined ? undefined : `${arrowData.y}px`,
              [arrowSide]: "-7px",
            }}
          />
        ) : null}
        <header className="path-card__header">
          <h2 id={headingId} className="path-card__title">
            {title}
          </h2>
          <button
            type="button"
            className="path-card__close"
            aria-label="关闭"
            title="关闭（也可按 Esc）"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="path-card__body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
