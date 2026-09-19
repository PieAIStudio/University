/** Space belongs to the map only while no text/control/dialog owns the key. */
export function isMapSpace(event: KeyboardEvent): boolean {
  if (
    event.defaultPrevented ||
    event.repeat ||
    event.isComposing ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey
  )
    return false;
  if (event.code !== "Space" && event.key !== " ") return false;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;
  if (
    target.closest(
      'input,textarea,select,button,a,summary,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="button"],[role="menu"],[role="dialog"]',
    )
  )
    return false;
  if (
    document.querySelector(
      'dialog[open],[aria-modal="true"],.nav-rail__flyout,[data-mobile-panel="rail"],[data-mobile-panel="aside"]',
    )
  )
    return false;
  return target.matches("body") || Boolean(target.closest('[data-map-surface="true"]'));
}
