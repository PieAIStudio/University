/** Presence only, never proof that a time is correct. Accept ordinary Chinese
 * and English clock expressions instead of demanding one author's wording. */
export function containsClockTime(work: string): boolean {
  const text = work.normalize("NFKC");
  return (
    /(?:[01]?\d|2[0-3]):[0-5]\d\b/u.test(text) ||
    /\b(?:[01]?\d|2[0-3])h[0-5]\d\b/iu.test(text) ||
    /(?:[0-9零〇一二两三四五六七八九十廿]+)\s*(?:点|時|时)(?!间)/u.test(text) ||
    /\b(?:1[0-2]|0?[1-9])(?::[0-5]\d)?\s*(?:a\.?m\.?|p\.?m\.?)\b/iu.test(text) ||
    /\b(?:1[0-2]|0?[1-9]|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:o['’]?clock|in the (?:morning|afternoon|evening)|[ap]\.?m\.?)\b/iu.test(
      text,
    ) ||
    /\b(?:noon|midnight)\b/iu.test(text) ||
    /中午十二点|午夜|正午/u.test(text)
  );
}
