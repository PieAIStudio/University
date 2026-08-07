import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  safePolygon,
  shift,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useRole,
} from "@floating-ui/react";
import { useState, type ReactNode } from "react";

import { GLOSSARY } from "./glossary.js";

/**
 * How long the pointer rests before an explanation appears.
 *
 * Deliberately not instant — a tip that fires the moment the pointer crosses a
 * chip turns a page into a minefield. Deliberately not the two seconds that
 * feels safe on paper either: past roughly a second people have already decided
 * nothing is going to happen and moved on, so a long delay does not produce a
 * calm interface, it produces one that looks broken. Half a second is long
 * enough to read as intentional and short enough to still answer the question
 * the learner was asking when they stopped.
 */
const TIP_REST_MS = 500;
const TIP_CLOSE_MS = 140;

/**
 * A term that explains itself.
 *
 * The explanation lives in `glossary.ts` rather than at the call site, because
 * the same jargon shows up in several places and a learner who reads two
 * different definitions of FSRS has been taught that neither is trustworthy.
 */
export function Tip({
  term,
  children,
  as = "span",
}: {
  /** Key into the glossary. An unknown key renders the children unchanged. */
  readonly term: string;
  readonly children: ReactNode;
  readonly as?: "span" | "div";
}) {
  const [open, setOpen] = useState(false);
  const entry = GLOSSARY[term];

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: "bottom",
    middleware: [offset(8), flip({ padding: 12 }), shift({ padding: 12 })],
    whileElementsMounted: autoUpdate,
  });

  const hover = useHover(context, {
    mouseOnly: true,
    restMs: TIP_REST_MS,
    delay: { close: TIP_CLOSE_MS },
    // Tips carry no controls, but they can carry two lines of text worth
    // re-reading, so the pointer is allowed to travel into them.
    handleClose: safePolygon({ buffer: 4 }),
  });
  const focus = useFocus(context);
  const dismiss = useDismiss(context, { escapeKey: true, outsidePress: true });
  const role = useRole(context, { role: "tooltip" });
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, dismiss, role]);

  // An undefined term is an authoring mistake, not a reason to break the page.
  if (!entry) return <>{children}</>;

  const Trigger = as;
  return (
    <>
      <Trigger
        className="tip-trigger"
        // Focusable so the explanation is reachable without a pointer. `button`
        // would be a lie — there is nothing to activate — so this is a plain
        // element with an explicit tab stop.
        tabIndex={0}
        ref={refs.setReference}
        {...getReferenceProps()}
      >
        {children}
      </Trigger>
      {open ? (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            className="tip-panel"
            {...getFloatingProps()}
          >
            <p className="tip-panel__term">{entry.term}</p>
            <p className="tip-panel__summary">{entry.summary}</p>
            {entry.detail ? <p className="tip-panel__detail">{entry.detail}</p> : null}
          </div>
        </FloatingPortal>
      ) : null}
    </>
  );
}
