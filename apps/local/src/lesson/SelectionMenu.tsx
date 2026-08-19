import { autoUpdate, flip, FloatingPortal, offset, shift, useFloating } from "@floating-ui/react";
import { useCallback, useEffect, useState } from "react";

import type { TextQuote } from "../domain/reader-marks.js";

/**
 * How much text on either side of the selection is kept.
 *
 * Enough to tell two occurrences of the same sentence apart and to find the
 * quote again after the lesson is edited around it; not so much that a mark
 * stores its own neighbourhood.
 */
const CONTEXT_CHARS = 60;

export interface SelectionTarget {
  readonly quote: TextQuote;
  readonly sectionTitle: string | undefined;
}

/**
 * Reads the current selection, with its surroundings and the heading above it.
 *
 * The prefix and suffix come from the *rendered* text of the containing block,
 * not from the Markdown source. That is deliberate: the reader selected what
 * they could see, and the quote has to be findable in what they can see. The
 * server never tries to map it back to source offsets.
 */
function readSelection(root: HTMLElement): SelectionTarget | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const exact = selection.toString().trim();
  if (exact.length === 0) return null;

  const range = selection.getRangeAt(0);
  const anchor = range.commonAncestorContainer;
  const element = anchor instanceof Element ? anchor : anchor.parentElement;
  if (!element || !root.contains(element)) return null;

  // The block the selection sits in, so context does not run across the whole
  // lesson when a selection happens to start at a paragraph boundary.
  const block = element.closest("p, li, h1, h2, h3, h4, blockquote, figcaption, td") ?? element;
  const blockText = block.textContent ?? "";
  const at = blockText.indexOf(exact);
  const prefix = at > 0 ? blockText.slice(Math.max(0, at - CONTEXT_CHARS), at) : "";
  const suffix =
    at >= 0 ? blockText.slice(at + exact.length, at + exact.length + CONTEXT_CHARS) : "";

  let heading: Element | null = block;
  while (heading && !/^H[1-4]$/.test(heading.tagName)) {
    heading =
      heading.previousElementSibling ?? heading.parentElement?.previousElementSibling ?? null;
  }

  return {
    quote: { exact, prefix, suffix },
    sectionTitle: heading?.textContent?.trim() || undefined,
  };
}

/**
 * The small bar of actions that appears over a selection in the lesson body.
 *
 * Positioned with Floating UI's virtual-element API — the same library already
 * carrying the vocabulary cards. A dedicated selection-popover package exists
 * but has not been published since 2022, predates React 19, and wraps exactly
 * the documented usage below; taking it on would be adding an unmaintained
 * dependency to avoid twenty lines.
 *
 * Nothing here writes anywhere on its own. Each button hands the selection up,
 * and the reader stays the one who decided the passage mattered.
 */
export function SelectionMenu({
  containerRef,
  onMark,
  onAsk,
  busy = false,
}: {
  readonly containerRef: React.RefObject<HTMLElement | null>;
  readonly onMark: (kind: "question" | "highlight", target: SelectionTarget) => void;
  readonly onAsk: (target: SelectionTarget) => void;
  readonly busy?: boolean;
}) {
  const [target, setTarget] = useState<SelectionTarget | null>(null);
  const [copied, setCopied] = useState(false);

  const { refs, floatingStyles } = useFloating({
    open: target !== null,
    placement: "top",
    middleware: [offset(8), flip({ padding: 12 }), shift({ padding: 12 })],
    whileElementsMounted: autoUpdate,
  });

  const close = useCallback(() => {
    setTarget(null);
    setCopied(false);
  }, []);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const sync = () => {
      const next = readSelection(root);
      if (!next) {
        close();
        return;
      }
      const range = window.getSelection()?.getRangeAt(0);
      if (!range) return;
      // A virtual element: Floating UI positions against any object that can
      // report a bounding rect, and a Range can. This is why no wrapper span
      // has to be injected into the reader's text.
      refs.setReference({
        getBoundingClientRect: () => range.getBoundingClientRect(),
        getClientRects: () => range.getClientRects(),
      });
      setTarget(next);
      setCopied(false);
    };

    // `selectionchange` fires continuously while dragging; acting on pointerup
    // and keyup means the bar appears once, when the selection is finished.
    const onPointerUp = () => setTimeout(sync, 0);
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        return;
      }
      if (event.shiftKey || event.key.startsWith("Arrow")) setTimeout(sync, 0);
    };
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("keyup", onKeyUp);
    // Scrolling does not change the selection, and autoUpdate already keeps the
    // bar glued to it, so scroll is deliberately not a dismiss trigger.
    return () => {
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("keyup", onKeyUp);
    };
  }, [containerRef, refs, close]);

  if (!target) return null;

  const act = (run: () => void) => () => {
    run();
    window.getSelection()?.removeAllRanges();
    close();
  };

  return (
    <FloatingPortal>
      <div
        ref={refs.setFloating}
        style={floatingStyles}
        className="selection-menu"
        role="toolbar"
        aria-label="对选中的文字"
        // Keeps the selection alive: a click on a button would otherwise blur
        // the range before the handler could read it.
        onMouseDown={(event) => event.preventDefault()}
      >
        <button
          type="button"
          className="selection-menu__action selection-menu__action--primary"
          disabled={busy}
          onClick={act(() => onMark("question", target))}
        >
          记录不懂
        </button>
        <button
          type="button"
          className="selection-menu__action"
          disabled={busy}
          onClick={act(() => onAsk(target))}
        >
          问 AI
        </button>
        <button
          type="button"
          className="selection-menu__action"
          onClick={() => {
            void navigator.clipboard?.writeText(target.quote.exact);
            setCopied(true);
          }}
        >
          {copied ? "已复制" : "复制"}
        </button>
        <button
          type="button"
          className="selection-menu__action"
          disabled={busy}
          onClick={act(() => onMark("highlight", target))}
        >
          高亮
        </button>
      </div>
    </FloatingPortal>
  );
}
