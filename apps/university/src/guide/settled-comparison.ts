/** The answer panel first closes, then map labels are projected around its
 * new bounds. A cold/contended frame can leave fewer than two locatable
 * islands temporarily. Re-read the same registry for a bounded settling
 * window; never admit a hidden target or keep an ambient polling loop. */
export function settledComparison<T>(options: {
  readonly read: () => readonly T[];
  readonly publish: (items: readonly T[]) => void;
  readonly afterLayout: (read: () => void) => () => void;
  readonly now?: () => number;
  readonly schedule?: (read: () => void, delay: number) => () => void;
}): () => void {
  const now = options.now ?? Date.now;
  const schedule =
    options.schedule ??
    ((run, delay) => {
      const timer = window.setTimeout(run, delay);
      return () => window.clearTimeout(timer);
    });
  const deadline = now() + 1500;
  let active = true;
  let cancel = () => {};
  const sample = () => {
    if (!active) return;
    const items = options.read();
    if (items.length >= 2 || now() >= deadline) {
      active = false;
      options.publish(items);
      return;
    }
    cancel = schedule(sample, 50);
  };
  cancel = options.afterLayout(sample);
  return () => {
    active = false;
    cancel();
  };
}
