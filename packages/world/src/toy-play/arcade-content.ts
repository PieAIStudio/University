import type { Words } from "./material.js";
export { CLAIMS } from "./material.js";

/** Authored practice, not model output. Sources stay visible in the player.
 * Mechanics adapted from retained arcade.html (c3c4f62f); absolute claims about
 * feelings and "official therefore not AI" were deliberately not copied. */
export const FLIGHT_CARDS = [
  ["地球的位置", "Earth's position", 0],
  ["拍摄日期", "Capture date", 1],
  ["月面的颜色", "Lunar surface color", 0],
  ["摄影者是谁", "Photographer's name", 1],
  ["画面里的云层", "Clouds in the photo", 0],
  ["哪次任务", "Mission name", 1],
  ["背景的明暗", "Light or dark background", 0],
  ["拍摄时的飞行状态", "Flight context", 1],
] as const;

export interface Sentence {
  id: string;
  topic: number;
  text: Words;
  answer: Words;
  why: Words;
}
const sentence = (id: string, topic: number, text: Words, answer: Words, why: Words): Sentence => ({
  id,
  topic,
  text,
  answer,
  why,
});
export const SENTENCES: readonly Sentence[] = [
  sentence(
    "photo-position",
    0,
    ["核对地球在画面里的位置，先 ____。", "To check Earth's position, ____ first."],
    ["看照片", "look at the photo"],
    ["位置在画面上就能看见。", "The position is visible in the photograph."],
  ),
  sentence(
    "photo-author",
    0,
    ["要知道谁拍了这张照片，需要 ____。", "To find the photographer, ____."],
    ["查记录", "read the record"],
    [
      "景物不会告诉我们是谁按下快门，姓名来自图像记录。",
      "The scene does not identify the photographer; the image record does.",
    ],
  ),
  sentence(
    "photo-feeling",
    0,
    [
      "这里的材料没有说明他的心情，应该 ____。",
      "The material does not establish his feelings. ____.",
    ],
    ["保留未知", "leave it unknown"],
    [
      "仅凭这张图和这份记录，不能补出他的心情。",
      "This photo and this record do not establish his feelings.",
    ],
  ),
  sentence(
    "photo-year",
    0,
    ["NASA 记录的拍摄年份是 ____。", "NASA records the capture year as ____."],
    ["1968", "1968"],
    [
      "拍摄日期是 1968 年 12 月 24 日，不是网页的发布日期。",
      "The capture date is December 24, 1968, not the webpage publication date.",
    ],
  ),
  sentence(
    "photo-name",
    0,
    ["这张《地出》的摄影者是 ____。", "This Earthrise photograph was taken by ____."],
    ["Bill Anders", "Bill Anders"],
    ["姓名来自 NASA 的图像说明。", "The name is supplied by NASA's image record."],
  ),
  sentence(
    "photo-mission",
    0,
    ["《地出》拍摄于 ____ 任务期间。", "Earthrise was taken during ____."],
    ["阿波罗 8 号", "Apollo 8"],
    ["任务名称由 NASA 记录提供。", "NASA's record supplies the mission name."],
  ),
  sentence(
    "photo-output",
    0,
    ["AI 给出拍摄日期后，还要 ____。", "After AI gives a capture date, ____."],
    ["对照记录", "check the record"],
    [
      "AI 回答很肯定，也不能替代查原始记录。",
      "A confident AI response does not replace checking the original record.",
    ],
  ),
  sentence(
    "photo-favorite",
    0,
    ["照片很出名，____ 它是摄影者的最爱。", "Fame ____ it was the photographer's favorite."],
    ["不能证明", "does not prove"],
    [
      "现有材料没有比较摄影者的喜好。",
      "The provided material does not establish the photographer's preferences.",
    ],
  ),
  sentence(
    "voice-cn",
    1,
    ["中文讲话写成中文字，叫作 ____。", "Writing Chinese speech as Chinese text is ____."],
    ["转写", "transcription"],
    ["语言没有变，只是声音变成了文字。", "The language stays the same; speech becomes text."],
  ),
  sentence(
    "voice-en",
    1,
    ["中文讲话变成英文，叫作 ____。", "Changing Chinese speech into English is ____."],
    ["翻译", "translation"],
    [
      "输出换了一种语言，需要检查意思。",
      "The output changes language, so check that the meaning is preserved.",
    ],
  ),
  sentence(
    "voice-jp",
    1,
    [
      "日语讲话写成日语文字，仍然是 ____。",
      "Writing Japanese speech as Japanese text is still ____.",
    ],
    ["转写", "transcription"],
    [
      "判断是否翻译，要看输入和输出的语言有没有变化。",
      "Compare input and output languages to tell whether translation occurred.",
    ],
  ),
  sentence(
    "voice-reader",
    1,
    [
      "让只懂英文的朋友读法语讲话，需要 ____。",
      "For an English-only reader to understand French speech, use ____.",
    ],
    ["翻译", "translation"],
    [
      "读者不懂原语言，单纯把声音写成法语字还不够。",
      "Writing the speech in French is not enough for this reader.",
    ],
  ),
  sentence(
    "voice-original",
    1,
    [
      "想保留原语言，可以要求：只转写，____。",
      "To keep the original language, ask: transcribe, ____.",
    ],
    ["不要翻译", "do not translate"],
    [
      "把需要的语言说清楚，之后仍然要检查结果。",
      "State the intended language, then check the output.",
    ],
  ),
  sentence(
    "voice-check",
    1,
    [
      "检查转写有没有听错，要对照 ____。",
      "To check a transcript for misheard words, compare it with ____.",
    ],
    ["原录音", "the recording"],
    [
      "排版整齐不能证明听写准确，要回到声音。",
      "Neat formatting does not prove accuracy. Return to the audio.",
    ],
  ),
  sentence(
    "voice-meaning",
    1,
    ["检查翻译，重点要看有没有保留 ____。", "When checking a translation, check the ____."],
    ["原意", "original meaning"],
    ["句子流畅，不代表意思没有被改变。", "Fluent wording does not guarantee unchanged meaning."],
  ),
  sentence(
    "voice-layout",
    1,
    ["文字排得整齐，____ 每个字都听对了。", "Neat text ____ every word was heard correctly."],
    ["不能证明", "does not prove"],
    ["外观和准确性是两回事。", "Appearance and accuracy are different things."],
  ),
  sentence(
    "task-topic",
    2,
    [
      "只说“介绍这次观月活动”，说清的只是 ____。",
      "'Introduce this Moon event' only names the ____.",
    ],
    ["主题", "topic"],
    [
      "还没有说是要短消息、清单，还是别的结果。",
      "It does not specify a message, a checklist or another output.",
    ],
  ),
  sentence(
    "task-result",
    2,
    ["“写一条短消息”，点名的是 ____。", "'Write a short message' names the ____."],
    ["成品", "deliverable"],
    ["同一份资料可以做成不同结果。", "The same material can produce different outputs."],
  ),
  sentence(
    "task-constraints",
    2,
    [
      "“保留时间、地点和报名要求”，列出的是 ____。",
      "'Keep the time, place and registration details' specifies ____.",
    ],
    ["条件", "requirements"],
    ["有明确条件，才能逐项检查结果。", "Explicit requirements make the result checkable."],
  ),
  sentence(
    "task-time",
    2,
    [
      "这份 2023 年 NASA 公告里的活动时间是 ____。",
      "The hours in this 2023 NASA event notice are ____.",
    ],
    ["晚 6 点到 9 点", "6–9 p.m."],
    [
      "这是那次历史活动的时间，不是今天的安排。",
      "These are the hours of that historical event, not today's schedule.",
    ],
  ),
  sentence(
    "task-register",
    2,
    ["这份公告说，这次活动 ____。", "The notice says the event ____."],
    ["不用报名", "needs no registration"],
    [
      "整理历史公告时，不能凭空增加报名要求。",
      "Do not invent a registration requirement when summarizing the notice.",
    ],
  ),
  sentence(
    "task-past",
    2,
    [
      "这场活动发生在 2023 年，现在整理时要写成 ____。",
      "This event happened in 2023. Present it as ____.",
    ],
    ["历史活动", "a past event"],
    ["旧公告不能直接变成今天的邀请。", "An old notice is not a current invitation."],
  ),
  sentence(
    "task-next",
    2,
    [
      "还没决定要做成什么，可以先要两种短方案来 ____。",
      "Before choosing an output, ask for two brief options to ____.",
    ],
    ["比较选择", "compare and choose"],
    [
      "先比较用途，再确定成品和检查条件。",
      "Compare uses before choosing the output and its requirements.",
    ],
  ),
  sentence(
    "task-check",
    2,
    ["AI 说“已经保留时间”，你还需要 ____。", "AI says it kept the time. You still need to ____."],
    ["检查成品", "check the output"],
    [
      "承诺不是结果，要在实际成品里找到该信息。",
      "A promise is not the result. Find the information in the actual output.",
    ],
  ),
];
export const VOCABULARY: readonly Words[] = [
  ...new Map(SENTENCES.map((s) => [s.answer[0], s.answer])).values(),
];
export function wordIndex(card: number): number {
  return VOCABULARY.findIndex((w) => w[0] === SENTENCES[card]!.answer[0]);
}
export const ARCADE_SOURCES = [
  {
    title: "NASA · Earthrise",
    url: "https://www.nasa.gov/image-article/apollo-8-astronaut-bill-anders-captures-earthrise/",
    text: [
      "1968 年 12 月 24 日，Bill Anders 在阿波罗 8 号绕月飞行期间拍下《地出》。",
      "Bill Anders photographed Earthrise on December 24, 1968, during Apollo 8's lunar orbit.",
    ] as Words,
  },
  {
    title: "OpenAI · Introducing Whisper (2022)",
    url: "https://openai.com/index/whisper/",
    text: [
      "这份介绍区分原语言转写与翻译成英文。下面的语句是用于练习的例子，不是现场生成的转写结果。",
      "The introduction distinguishes original-language transcription from translation into English. The practice sentences are teaching examples, not live transcription results.",
    ] as Words,
  },
  {
    title: "NASA · Observe the Moon Night (2023)",
    url: "https://www.nasa.gov/news-release/celebrate-international-observe-the-moon-night-at-nasas-goddard-space-flight-center/",
    text: [
      "2023 年 10 月 21 日，活动在格林贝尔特的戈达德访客中心举行，晚 6 点至 9 点，不用报名。这里只练习整理历史公告，不是发出现在的邀请。",
      "The event was held on October 21, 2023, from 6 to 9 p.m. at Goddard Visitor Center in Greenbelt, with no registration required. This practice summarizes a historical notice, not a current invitation.",
    ] as Words,
  },
] as const;
