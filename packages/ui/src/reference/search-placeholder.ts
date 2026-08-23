/**
 * How long a search placeholder may be before a phone eats the end of it.
 *
 * Measured, not chosen. On the concepts index at 375px the field's inner width
 * is 313px, and 「试试「点了没反应」「上线之后白屏」「怎么退回上一版」」 — 26
 * characters — needed 400px to render. That is roughly 15.4px per CJK glyph at
 * this field's size, so 313px buys about 20.
 *
 * A clipped placeholder is worse than a shorter one. It teaches nothing about
 * the example it cut in half, and a sentence that stops mid-character reads as
 * a rendering fault rather than as a hint.
 *
 * The three indexes each write their own examples — they are searching
 * different things — but they all live behind the same field at the same
 * width, so the budget is shared and `search-placeholder.test.ts` holds all
 * three to it at once.
 */
export const SEARCH_PLACEHOLDER_MAX_CHARS = 20;
