import type { ReactNode } from "react";

import type { ShellCounter } from "./AppShell.js";

/**
 * The four-stat row. One DOM node at every breakpoint; AppShell's grid moves
 * it. A muted counter is still rendered — Duolingo greys a zero streak
 * instead of hiding it, so a missing number cannot be mistaken for a missing
 * slot.
 *
 * The aside collapse sits on the left of this capsule rather than as a
 * sibling floating in the sea. The row itself stays when the aside hides, so
 * the same control can bring the aside back without a second handle.
 */

function counterName(counter: ShellCounter): string {
  return counter.value != null ? `${counter.label} ${counter.value}` : counter.label;
}

export function CounterRow({
  counters,
  collapse,
}: {
  readonly counters: readonly ShellCounter[];
  readonly collapse?: ReactNode;
}) {
  return (
    <div className="counter-row">
      {collapse}
      {counters.map((counter) => {
        const className = counter.muted
          ? "counter-row__item counter-row__item--muted"
          : "counter-row__item";
        const name = counterName(counter);
        if (counter.control) {
          return (
            <div key={counter.id} className="counter-row__slot">
              {counter.control}
            </div>
          );
        }
        const body = (
          <>
            <span className="counter-row__icon">{counter.icon}</span>
            {counter.value != null ? (
              <span className="counter-row__value">{counter.value}</span>
            ) : null}
          </>
        );
        if (counter.href) {
          return (
            <a key={counter.id} href={counter.href} className={className} aria-label={name}>
              {body}
            </a>
          );
        }
        return (
          <span key={counter.id} className={className} role="img" aria-label={name}>
            {body}
          </span>
        );
      })}
    </div>
  );
}
