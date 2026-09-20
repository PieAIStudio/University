import { useSyncExternalStore } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";
import type { ProgressPort, WorldStyle } from "@pieai/university-core";
import { translate, useI18n } from "./i18n/index.js";

type StyleProgress = Pick<ProgressPort, "accountData" | "setAccountPreferences" | "subscribe">;
let binding: { port: StyleProgress; unsubscribe: () => void } | null = null;
let unboundStyle: WorldStyle = "classic";
const listeners = new Set<() => void>();
const emit = () => {
  for (const listener of listeners) listener();
};
const normalized = (value: unknown): WorldStyle => (value === "clay" ? "clay" : "classic");

/** Account data owns persistence and identity isolation; no second localStorage document. */
export function readWorldStyle(): WorldStyle {
  return binding ? normalized(binding.port.accountData().preferences.worldStyle) : unboundStyle;
}
export function subscribeWorldStyle(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function writeWorldStyle(style: WorldStyle): void {
  if (style !== "classic" && style !== "clay") throw new TypeError("Unknown world style");
  if (readWorldStyle() === style) return;
  if (binding) {
    const current = binding.port.accountData().preferences;
    binding.port.setAccountPreferences({ ...current, worldStyle: style });
  } else unboundStyle = style;
  emit();
}
export function bindWorldStylePreference(port: StyleProgress): () => void {
  binding?.unsubscribe();
  const owner = { port, unsubscribe: port.subscribe(emit) };
  binding = owner;
  unboundStyle = "classic";
  emit();
  return () => {
    owner.unsubscribe();
    if (binding !== owner) return;
    binding = null;
    unboundStyle = "classic";
    emit();
  };
}
export function useWorldStyle(): WorldStyle {
  return useSyncExternalStore(subscribeWorldStyle, readWorldStyle, () => "classic");
}

/** Same account choice on the map, in settings, and in isolated avatar previews. */
export function WorldStyleControl({ compact = false }: { readonly compact?: boolean }) {
  useI18n();
  const style = useWorldStyle();
  const label = translate("product.worldStyle.label");
  return (
    <div className={`world-style-control${compact ? " world-style-control--compact" : ""}`}>
      {!compact ? <h2 className="settings-screen__heading">{label}</h2> : null}
      <div className="world-style-control__options" role="group" aria-label={label}>
        {(["classic", "clay"] as const).map((option) => (
          <GameButton
            key={option}
            type="button"
            variant={style === option ? "primary" : "secondary"}
            aria-pressed={style === option}
            data-world-style-choice={option}
            onClick={() => writeWorldStyle(option)}
          >
            {translate(
              option === "classic" ? "product.worldStyle.classic" : "product.worldStyle.clay",
            )}
          </GameButton>
        ))}
      </div>
    </div>
  );
}
