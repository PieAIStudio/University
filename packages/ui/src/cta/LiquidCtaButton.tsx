import { GameButton, type GameButtonProps } from "@pieai/swimmer-ui-kit";
import type { ButtonHTMLAttributes, MouseEventHandler } from "react";
import { beginLiquidCtaTransition } from "./LiquidCtaTransition.js";

export interface LiquidCtaButtonProps
  extends
    Omit<
      ButtonHTMLAttributes<HTMLButtonElement>,
      "children" | "onClick" | "href" | "target" | "rel" | "download"
    >,
    Pick<GameButtonProps, "children" | "fullWidth" | "hue" | "sound" | "static" | "size"> {
  /** A product destination, not a second button skin or a kit-owned route. */
  readonly destination?: string;
  readonly onClick?: MouseEventHandler<HTMLButtonElement>;
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
