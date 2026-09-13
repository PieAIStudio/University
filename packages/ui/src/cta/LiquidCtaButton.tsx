import { GameButton, type GameButtonProps } from "@pieai/swimmer-ui-kit";
import { beginLiquidCtaTransition } from "./LiquidCtaTransition.js";

export interface LiquidCtaButtonProps extends Omit<
  GameButtonProps,
  "variant" | "surface" | "liquidFinish"
> {
  /** A product destination, not a second button skin or a kit-owned route. */
  readonly destination?: string;
}

/**
 * Only the product's destination handoff lives here. UIKit owns the liquid
 * silhouette, press lifecycle, reduced motion, focus and stable native target.
 * Capture the source before the caller changes the route or unmounts it.
 * Ordinary CTAs use GameButton directly instead of passing through this adapter.
 */
export function LiquidCtaButton({
  children,
  className,
  destination,
  disabled = false,
  onClick,
  ...buttonProps
}: LiquidCtaButtonProps) {
  return (
    <GameButton
      {...buttonProps}
      className={["university-cta", className].filter(Boolean).join(" ")}
      disabled={disabled}
      variant="primary"
      surface="liquid"
      liquidFinish="glossy"
      onClick={(event) => {
        if (!event.defaultPrevented && !disabled && destination) {
          beginLiquidCtaTransition(event.currentTarget, destination);
        }
        onClick?.(event);
      }}
    >
      {children}
    </GameButton>
  );
}
