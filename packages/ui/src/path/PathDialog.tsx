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
    return true;
  });
}

export function PathDialog({
  open,
  title,
  onClose,
  returnFocusTo,
  children,
}: {
  readonly open: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly returnFocusTo?: HTMLElement | null;
  readonly children: ReactNode;
}) {
  const headingId = useId();
  const layerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

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

  return createPortal(
    <div
      ref={layerRef}
      className="path-card-layer"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={cardRef}
        className="path-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
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
