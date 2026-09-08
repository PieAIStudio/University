import type { ReactNode } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";

/** A prompt beside the real activity, never a second tutorial or completion gate. */
export function PlayGuide({
  title,
  children,
  action,
  onAction,
  disabled = false,
}: {
  readonly title: string;
  readonly children?: ReactNode;
  readonly action?: string;
  readonly onAction?: () => void;
  readonly disabled?: boolean;
}) {
  return (
    <aside className="play-guide" data-play-guide>
      <div>
        <strong>{title}</strong>
        {children ? <p>{children}</p> : null}
      </div>
      {action && onAction ? (
        <GameButton variant="primary" disabled={disabled} onClick={onAction}>
          {action}
        </GameButton>
      ) : null}
    </aside>
  );
}
