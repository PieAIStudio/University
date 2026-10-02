/** A dialog, menu or phone drawer is open: the map's own keys stand down. */
function mapKeysCovered(): boolean {
  return Boolean(
    document.querySelector(
      'dialog[open],[aria-modal="true"],.nav-rail__flyout,[data-mobile-panel="rail"],[data-mobile-panel="aside"]',
    ),
  );
}

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
  if (mapKeysCovered()) return false;
  return target.matches("body") || Boolean(target.closest('[data-map-surface="true"]'));
}

/** Escape clears the map's pick unless a field, dialog or menu is the one being escaped. */
export function isMapEscape(event: KeyboardEvent): boolean {
  if (event.key !== "Escape" || event.defaultPrevented || event.isComposing) return false;
  if (
    event.target instanceof Element &&
    event.target.closest(
      'input,textarea,select,[contenteditable="true"],[role="dialog"],[role="menu"]',
    )
  )
    return false;
  return !mapKeysCovered();
}
