import { useEffect, useState } from "react";

import { GameButton, LiquidGroup, type GameButtonProps } from "@pieai/swimmer-ui-kit";

export interface LiquidCtaButtonProps extends Omit<GameButtonProps, "variant"> {
  /** Classes for the real button; its accessible name and hit target stay native. */
  readonly className?: string;
  /** Classes for the visual wrapper, not the button. */
  readonly wrapperClassName?: string;
  /** `full` keeps the same block-sized target used by mobile cards. */
  readonly width?: "auto" | "full";
}

/**
 * Read the platform motion preference without assuming that `window.matchMedia`
 * exists in jsdom or during server rendering.
 */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    setReduced(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

/**
 * The one shared primary-action surface.
 *
 * The real GameButton stays at its normal size above a non-interactive liquid
 * silhouette. Only that silhouette changes shape while the control is pressed;
 * the button itself never scales, so its hit target, focus ring and crisp DOM
 * text do not shrink with the visual feedback.
 */
export function LiquidCtaButton({
  children,
  className,
  wrapperClassName,
  width = "auto",
  disabled = false,
  ...buttonProps
}: LiquidCtaButtonProps) {
  const [pressed, setPressed] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const visualPressed = pressed && !disabled && !reducedMotion;
  const buttonClassName = ["liquid-cta__button", className].filter(Boolean).join(" ");
  const groupClassName = ["liquid-cta", wrapperClassName].filter(Boolean).join(" ");

  const {
    onBlur,
    onKeyDown,
    onKeyUp,
    onPointerCancel,
    onPointerDown,
    onPointerLeave,
    onPointerUp,
    onLostPointerCapture,
    ...restButtonProps
  } = buttonProps;

  useEffect(() => {
    if (disabled) setPressed(false);
  }, [disabled]);

  return (
    <div
      className={groupClassName}
      data-liquid-cta="primary"
      data-liquid-cta-state={visualPressed ? "pressed" : "rest"}
      data-liquid-cta-width={width}
      data-liquid-cta-disabled={disabled ? "true" : "false"}
    >
      <LiquidGroup
        aria-hidden="true"
        className="liquid-cta__surface"
        fill={disabled ? "var(--game-ui-text-muted)" : "var(--liquid-cta-fill)"}
        stroke={
          disabled
            ? "1px solid color-mix(in srgb, var(--game-ui-text-muted) 72%, transparent)"
            : "1px solid var(--game-ui-accent-bright)"
        }
        shadow={disabled ? "none" : "var(--game-ui-shadow-button)"}
        blur={4}
        contrast={24}
        filterPadding={10}
        motion={disabled || reducedMotion ? "reduced" : "auto"}
        waviness={0}
      >
        <LiquidGroup.Item
          className="liquid-cta__surface-item"
          effect="morph"
          morph={{ shape: true, speed: 1, bounce: 0.35, contentBlur: 0 }}
          radius={999}
          scale={visualPressed ? 0.95 : 1}
          transition="bouncy"
          y={visualPressed ? 1.5 : 0}
        >
          <span className="liquid-cta__shape" />
        </LiquidGroup.Item>
      </LiquidGroup>
      <GameButton
        {...restButtonProps}
        className={buttonClassName}
        disabled={disabled}
        onBlur={(event) => {
          setPressed(false);
          onBlur?.(event);
        }}
        onKeyDown={(event) => {
          if (!event.repeat && (event.key === "Enter" || event.key === " ")) setPressed(true);
          onKeyDown?.(event);
        }}
        onKeyUp={(event) => {
          if (event.key === "Enter" || event.key === " ") setPressed(false);
          onKeyUp?.(event);
        }}
        onLostPointerCapture={(event) => {
          setPressed(false);
          onLostPointerCapture?.(event);
        }}
        onPointerCancel={(event) => {
          setPressed(false);
          onPointerCancel?.(event);
        }}
        onPointerDown={(event) => {
          if (event.button === 0) setPressed(true);
          onPointerDown?.(event);
        }}
        onPointerLeave={(event) => {
          setPressed(false);
          onPointerLeave?.(event);
        }}
        onPointerUp={(event) => {
          setPressed(false);
          onPointerUp?.(event);
        }}
        static
        variant="primary"
      >
        {children}
      </GameButton>
    </div>
  );
}
