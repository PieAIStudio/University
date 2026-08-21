import {
  FloatingFocusManager,
  FloatingPortal,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from "@floating-ui/react";
import { useEffect, useState, type ReactNode } from "react";

export type ReferenceKind = "lesson" | "term" | "evidence";

/**
 * The shared chrome for an in-prose reference: lesson, term, or evidence.
 *
 * Content differs by kind and is passed as children. The shell — slide-over,
 * close, Escape, and 「查看完整页」 — is the same, so a third kind later is a
 * body, not a second drawer.
 *
 * Focus management copies `WordPopover`: `modal={false}` and `initialFocus={-1}`
 * so opening this from a click does not trap the reader or steal the caret.
 * `aria-modal="false"` is the same sentence in ARIA: the lesson stays readable
 * and the panel does not claim to be the only thing on the page.
 */
export function ReferencePanel({
  open,
  title,
  kind,
  trigger,
  onClose,
  onOpenFull,
  children,
}: {
  readonly open: boolean;
  readonly title: string;
  readonly kind: ReferenceKind;
  readonly trigger: HTMLElement | null;
  readonly onClose: () => void;
  readonly onOpenFull?: (() => void) | undefined;
  readonly children: ReactNode;
}) {
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  const { refs, context } = useFloating({
    open,
    onOpenChange: (next) => {
      if (!next) onClose();
    },
  });

  useEffect(() => {
    if (trigger) refs.setReference(trigger);
  }, [refs, trigger]);

  const dismiss = useDismiss(context, { escapeKey: true, outsidePress: true });

  /**
   * Escape, for a panel that deliberately never takes focus.
   *
   * `initialFocus={-1}` is the right call — the reader's place in the lesson is
   * worth more than the panel's — but it means nothing in the floating tree
   * ever holds focus, and `useDismiss`'s own escape handling needs focus to be
   * somewhere it can see. With focus left on `body`, the key did nothing and
   * the only way out was the mouse. Non-modal by design, so this listens at the
   * document and does not stop the event: another open layer may want it too.
   */
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  const role = useRole(context, { role: "dialog" });
  const { getFloatingProps } = useInteractions([dismiss, role]);

  if (!mounted) return null;

  return (
    <FloatingPortal>
      <FloatingFocusManager context={context} modal={false} initialFocus={-1}>
        <div
          ref={refs.setFloating}
          className="reference-panel"
          data-open={open ? "true" : undefined}
          data-kind={kind}
          role="dialog"
          aria-modal="false"
          aria-label={title}
          onTransitionEnd={(event) => {
            if (event.target !== event.currentTarget) return;
            if (!open) setMounted(false);
          }}
          {...getFloatingProps()}
        >
          <header className="reference-panel__header">
            <p className="reference-panel__kind">{kindLabel(kind)}</p>
            <h2 className="reference-panel__title">{title}</h2>
            <button
              type="button"
              className="reference-panel__close"
              onClick={onClose}
              aria-label="关闭引用"
              title="关闭（也可按 Esc）"
            >
              ×
            </button>
          </header>
          <div className="reference-panel__body">{children}</div>
          {onOpenFull ? (
            <footer className="reference-panel__footer">
              <button type="button" className="reference-panel__full" onClick={onOpenFull}>
                查看完整页 ↗
              </button>
            </footer>
          ) : null}
        </div>
      </FloatingFocusManager>
    </FloatingPortal>
  );
}

function kindLabel(kind: ReferenceKind): string {
  if (kind === "lesson") return "课文";
  if (kind === "term") return "词义";
  return "证据";
}
