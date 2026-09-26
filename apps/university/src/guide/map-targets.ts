import type { TargetRegistry } from "@pieai/swimmer-nerve-kit/targets";
import { registerElementTarget } from "@pieai/swimmer-nerve-kit/targets-dom";

/**
 * The places 涟 may point at, registered by identity (ADR-0012).
 *
 * Each place is the element the map or the navigation already renders — a
 * scene label, a rail entry — bound once through SwimmerNerveKit's DOM
 * adapter, which reads its rectangle only when asked and refuses one that is
 * hidden, off screen or covered. Nothing here stores a coordinate. A scene
 * label adds one more condition: the engine has to have placed it this frame
 * (`is-visible`, written by the label projector). Projection and occlusion
 * stay the engine's; this module only says which object is which.
 */
export interface ElementTargetSpec {
  readonly id: string;
  readonly element: Element;
  readonly label: string;
  readonly description?: string;
  /** A host condition read at the same moment as the rectangle. */
  readonly available?: (element: Element) => boolean;
}

export interface RegisteredTarget {
  readonly element: Element;
  readonly label: string;
  readonly description: string | undefined;
  readonly release: () => void;
}

/** A scene label is on the map only while the projector has placed it. */
export function placedByEngine(element: Element): boolean {
  return element.classList.contains("is-visible");
}

/**
 * Bring the registry in line with the places on screen now.
 *
 * An unchanged place keeps its registration, so a gesture already flying to
 * it survives an ordinary re-render. A place whose element, name or facts
 * changed is registered again — deliberately a new object: anything captured
 * from the old one (a gesture, a comparison) expires rather than following a
 * same-named replacement. Returns the ids that were replaced or removed.
 */
export function reconcileTargets(
  registry: TargetRegistry,
  registered: Map<string, RegisteredTarget>,
  next: readonly ElementTargetSpec[],
): ReadonlySet<string> {
  const changed = new Set<string>();
  const wanted = new Map(next.map((spec) => [spec.id, spec]));
  for (const [id, current] of registered) {
    const spec = wanted.get(id);
    if (
      spec &&
      spec.element === current.element &&
      spec.label === current.label &&
      spec.description === current.description
    )
      continue;
    current.release();
    registered.delete(id);
    changed.add(id);
  }
  for (const spec of next) {
    if (registered.has(spec.id)) continue;
    const { element, available } = spec;
    const label = spec.label.slice(0, 240);
    const description = spec.description?.slice(0, 500) || undefined;
    try {
      const release = registerElementTarget(registry, element, {
        id: spec.id,
        label,
        ...(description ? { description } : {}),
        ...(available ? { isAvailable: () => available(element) } : {}),
      });
      registered.set(spec.id, {
        element,
        label: spec.label,
        description: spec.description,
        release,
      });
    } catch {
      // An id the registry refuses (shape, duplicate, the per-view cap) is
      // simply not a place the guide can name; the map itself is unaffected.
    }
  }
  return changed;
}

export function releaseTargets(registered: Map<string, RegisteredTarget>): void {
  for (const target of registered.values()) target.release();
  registered.clear();
}
