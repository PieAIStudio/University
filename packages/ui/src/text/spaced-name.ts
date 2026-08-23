/**
 * A name with the space Chinese typography wants beside Latin, and none where
 * it does not.
 *
 * 「回到 TuringPact 地图」 reads correctly and 「回到 通用课 地图」 does not: a space
 * between Han characters is a gap inside a word. The rule has to be decided per
 * side, because a title can begin in Latin and end in Han — 「UniversityLocal
 * 自身」 does exactly that, and wants a space before it and none after.
 *
 * Kana are included because the same rule governs them, and because a name
 * arriving from a course title is not something this function gets to assume
 * the script of.
 */
const CJK = /\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}/u;

export function spacedName(title: string): string {
  const first = title.at(0) ?? "";
  const last = title.at(-1) ?? "";
  return `${CJK.test(first) ? "" : " "}${title}${CJK.test(last) ? "" : " "}`;
}
