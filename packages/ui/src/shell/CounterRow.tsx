import type { ShellCounter } from "./AppShell.js";

/**
 * The four-stat row. One DOM node at every breakpoint; AppShell's grid moves
 * it. A muted counter is still rendered — Duolingo greys a zero streak
 * instead of hiding it, so a missing number cannot be mistaken for a missing
 * slot.
 */

function counterName(counter: ShellCounter): string {
  return counter.value != null ? `${counter.label} ${counter.value}` : counter.label;
}

export function CounterRow({ counters }: { readonly counters: readonly ShellCounter[] }) {
  return (
    <div className="counter-row">
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
