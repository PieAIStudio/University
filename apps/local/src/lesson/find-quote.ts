import { locateQuote, type TextQuote } from "../domain/reader-marks.js";

/**
 * Turns a stored quote back into a live range in the rendered lesson.
 *
 * The DOM half of `locateQuote`: flatten the text nodes into one string, ask
 * the platform-neutral matcher where the quote sits, then map that offset back
 * onto the node it came from. Splitting it this way keeps `src/domain` free of
 * DOM types, which the server compiles without.
 */
export function findQuote(root: HTMLElement, quote: TextQuote): Range | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const chunks: { readonly node: Text; readonly start: number }[] = [];
  let text = "";
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    chunks.push({ node: node as Text, start: text.length });
    text += node.textContent ?? "";
  }

  const found = locateQuote(text, quote);
  if (!found) return null;

  const locate = (offset: number) => {
    // Backwards: the last chunk starting at or before the offset is the one
    // containing it.
    for (let index = chunks.length - 1; index >= 0; index -= 1) {
      const chunk = chunks[index]!;
      if (chunk.start <= offset) return { node: chunk.node, offset: offset - chunk.start };
    }
    return null;
  };
  const from = locate(found.start);
  const to = locate(found.end);
  if (!from || !to) return null;

  const range = document.createRange();
  range.setStart(from.node, Math.min(from.offset, from.node.length));
  range.setEnd(to.node, Math.min(to.offset, to.node.length));
  return range;
}
