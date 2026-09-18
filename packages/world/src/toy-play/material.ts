/** Shared, bounded material for the three local arcade experiments. */
export type ToyMode = "stack" | "invaders" | "cloze-tetris";
export type ToyLocale = "zh-CN" | "en";
export type Words = readonly [zh: string, en: string];
export const word = (text: Words, locale: ToyLocale): string => text[locale === "en" ? 1 : 0];
export const TOY_MODES: readonly ToyMode[] = ["stack", "invaders", "cloze-tetris"];
export const SOURCE = {
  url: "https://www.nasa.gov/image-article/apollo-8-astronaut-bill-anders-captures-earthrise/",
  image: "/content/assets/2a09a810bfd6ec6965bc817f2a2f64dee1bf90cf12caa3936fbeb89825086025.jpg",
  title: "Apollo 8 Astronaut Bill Anders Captures Earthrise",
  credit: "NASA / Bill Anders",
};
export const CATEGORIES: readonly Words[] = [
  ["看画面", "Look at photo"],
  ["查记录", "Read record"],
  ["材料没说", "Not established"],
];
export interface Claim {
  id: string;
  prompt: Words;
  answer: number;
  explanation: Words;
}
const claim = (id: string, prompt: Words, answer: number, explanation: Words): Claim => ({
  id,
  prompt,
  answer,
  explanation,
});
// These are claims to classify, including unverified examples, not a list of
// asserted NASA facts. Explanations scope unknowns to the provided sources.
export const CLAIMS: readonly Claim[] = [
  claim("horizon", ["地球出现在月面上方。", "Earth appears above the lunar surface."], 0, [
    "这是画面里的位置关系，可以直接对照照片。",
    "This is a visible spatial relationship in the photograph.",
  ]),
  claim(
    "date",
    ["照片拍于 1968 年 12 月 24 日。", "The photo was taken on December 24, 1968."],
    1,
    [
      "拍摄日期来自 NASA 记录，不是从景物里看出来的。",
      "The capture date comes from NASA's record, not the scenery.",
    ],
  ),
  claim("feelings", ["按快门时，他很紧张。", "He was nervous when he pressed the shutter."], 2, [
    "这张照片和这里的 NASA 记录都没有说明他的心情。先留作未知。",
    "Neither this photo nor the provided record establishes his feelings. Leave this unknown.",
  ]),
  claim("cloud", ["地球上能看到白色云层。", "White cloud patterns are visible on Earth."], 0, [
    "可以在照片中的地球表面找到白色云层。",
    "Inspect the white cloud patterns on Earth in the photo.",
  ]),
  claim("author", ["摄影者是 Bill Anders。", "The photographer was Bill Anders."], 1, [
    "姓名要查图像说明；画面本身不会告诉我们是谁按的快门。",
    "Check the image record for the name. The scene alone does not identify the photographer.",
  ]),
  claim("favorite", ["这是他最喜欢的一张照片。", "This was his favorite photograph."], 2, [
    "现有记录没有比较他的喜好。照片著名，也不能证明他最喜欢它。",
    "The provided record does not compare his preferences. Fame does not establish a personal favorite.",
  ]),
  claim("dark", ["地球周围的背景很暗。", "The background around Earth is dark."], 0, [
    "这是照片里可见的明暗关系，不用推测拍摄者的想法。",
    "This is a visible contrast, not a guess about someone's thoughts.",
  ]),
  claim(
    "mission",
    ["这张照片来自阿波罗 8 号任务。", "This photo comes from the Apollo 8 mission."],
    1,
    [
      "任务名称是 NASA 记录提供的背景信息。",
      "The mission name is background supplied by NASA's record.",
    ],
  ),
  claim(
    "promise",
    ["AI 描述这张图一定不会出错。", "AI will always describe this image correctly."],
    2,
    [
      "照片和拍摄记录都不能保证 AI 的每一次回答。仍然要检查。",
      "Neither the photo nor its record guarantees every AI response. Check the result.",
    ],
  ),
  claim("surface", ["画面下方是灰色的月面。", "A gray lunar surface fills the lower frame."], 0, [
    "颜色和位置都可以对照照片。",
    "Both color and position can be checked against the photo.",
  ]),
  claim(
    "orbit",
    [
      "拍摄时，阿波罗 8 号正在绕月飞行。",
      "Apollo 8 was orbiting the Moon when the photo was taken.",
    ],
    1,
    [
      "单张照片不提供完整飞行状态；这里由 NASA 记录说明。",
      "A still photo does not give the full flight context. NASA's record supplies it.",
    ],
  ),
  claim(
    "last",
    ["这是这次任务拍的最后一张照片。", "This was the last photograph of the mission."],
    2,
    [
      "现有材料没有给出全部照片的时间顺序。不能补成“最后一张”。",
      "The provided material does not list every photograph in sequence; 'the last one' is unverified.",
    ],
  ),
];
