/** Pure local research-game rules. No course progress, model or rendering side effects. */
export type ToyMode = "stack" | "invaders" | "cloze-tetris";
export type ToyLocale = "zh-CN" | "en";
export type Words = readonly [zh: string, en: string];
export const word = (text: Words, locale: ToyLocale): string => text[locale === "en" ? 1 : 0];
export const TOY_MODES: readonly ToyMode[] = ["stack", "invaders", "cloze-tetris"];
export const TITLES: Record<ToyMode, Words> = {
  stack: ["分类落块", "Parcel sorter"],
  invaders: ["双路拦截", "Evidence gates"],
  "cloze-tetris": ["填词消行", "Word workshop"],
};
export const ACTIONS: Record<ToyMode, Words> = {
  stack: [
    "读一句话，把小货箱送到合适的地方。",
    "Read a claim. Deliver its parcel to the right place.",
  ],
  invaders: [
    "选好核对工具，再放行抵达的小船。",
    "Choose a checking tool, then let the arriving boat through.",
  ],
  "cloze-tetris": [
    "选一块词语，嵌进句子的缺口。",
    "Pick a word tile and fit it into the sentence.",
  ],
};
export const SOURCE = {
  url: "https://www.nasa.gov/image-article/apollo-8-astronaut-bill-anders-captures-earthrise/",
  image: "/content/assets/2a09a810bfd6ec6965bc817f2a2f64dee1bf90cf12caa3936fbeb89825086025.jpg",
  title: "Apollo 8 Astronaut Bill Anders Captures Earthrise",
  credit: "NASA / Bill Anders",
  summary: [
    "NASA 记录：1968 年 12 月 24 日，阿波罗 8 号绕月飞行期间，Bill Anders 拍下《地出》。这份简短记录没有说明他当时的心情，也没有说这是不是他最喜欢的一张。",
    "NASA records that Bill Anders took Earthrise on December 24, 1968, during Apollo 8's lunar orbit. This short record does not establish his feelings or whether this was his favorite photograph.",
  ] as Words,
};

export const CATEGORIES: readonly Words[] = [
  ["看画面", "Look at photo"],
  ["查记录", "Read record"],
  ["材料没说", "Not established"],
];

export interface ToyCard {
  readonly id: string;
  readonly prompt: Words;
  readonly answer: number;
  readonly explanation: Words;
  readonly options?: readonly Words[];
}

// Deliberately bounded to the displayed photo and the cited record. Unknown
// feelings are not declared universally unknowable. The props are not evidence.
const claims: readonly ToyCard[] = [
  {
    id: "horizon",
    prompt: ["地球出现在月面上方。", "Earth appears above the lunar surface."],
    answer: 0,
    explanation: [
      "这是画面里的位置关系，可以直接对照照片。",
      "This is a visible spatial relationship in the photograph.",
    ],
  },
  {
    id: "date",
    prompt: ["照片拍于 1968 年 12 月 24 日。", "The photo was taken on December 24, 1968."],
    answer: 1,
    explanation: [
      "拍摄日期来自 NASA 记录，不是从景物里看出来的。",
      "The capture date comes from NASA's record, not the scenery.",
    ],
  },
  {
    id: "feelings",
    prompt: ["按快门时，他很紧张。", "He was nervous when he pressed the shutter."],
    answer: 2,
    explanation: [
      "这张照片和这里的 NASA 记录都没有说明他的心情。先留作未知。",
      "Neither this photo nor the provided NASA record establishes his feelings. Leave this unknown.",
    ],
  },
  {
    id: "cloud",
    prompt: ["地球上能看到白色云层。", "White cloud patterns are visible on Earth."],
    answer: 0,
    explanation: [
      "可以在照片中的地球表面找到白色云层。",
      "You can inspect the white cloud patterns on Earth in the photo.",
    ],
  },
  {
    id: "author",
    prompt: ["摄影者是 Bill Anders。", "The photographer was Bill Anders."],
    answer: 1,
    explanation: [
      "姓名要查图像说明；画面本身不会告诉我们是谁按的快门。",
      "Check the image record for the name. The scene alone does not identify the photographer.",
    ],
  },
  {
    id: "favorite",
    prompt: ["这是他最喜欢的一张照片。", "This was his favorite photograph."],
    answer: 2,
    explanation: [
      "现有记录没有比较他的喜好。照片著名，也不能证明他最喜欢它。",
      "The provided record does not compare his preferences. Fame does not establish a personal favorite.",
    ],
  },
  {
    id: "dark",
    prompt: ["地球周围的背景很暗。", "The background around Earth is dark."],
    answer: 0,
    explanation: [
      "这是照片里可见的明暗关系，不用推测拍摄者的想法。",
      "This is a visible contrast in the photo, not a guess about someone's thoughts.",
    ],
  },
  {
    id: "mission",
    prompt: ["这张照片来自阿波罗 8 号任务。", "This photo comes from the Apollo 8 mission."],
    answer: 1,
    explanation: [
      "任务名称是 NASA 记录提供的背景信息。",
      "The mission name is background information supplied by NASA's record.",
    ],
  },
  {
    id: "promise",
    prompt: ["AI 描述这张图一定不会出错。", "AI will always describe this image correctly."],
    answer: 2,
    explanation: [
      "照片和拍摄记录都不能保证 AI 的每一次回答。仍然要检查。",
      "Neither the photograph nor its record guarantees every AI response. Check the result.",
    ],
  },
  {
    id: "surface",
    prompt: ["画面下方是灰色的月面。", "A gray lunar surface fills the lower part of the frame."],
    answer: 0,
    explanation: [
      "颜色和位置都可以对照照片。",
      "Both the color and position can be checked against the photo.",
    ],
  },
  {
    id: "orbit",
    prompt: [
      "拍摄时，阿波罗 8 号正在绕月飞行。",
      "Apollo 8 was orbiting the Moon when the photo was taken.",
    ],
    answer: 1,
    explanation: [
      "单张照片不提供完整飞行状态；这里由 NASA 记录说明。",
      "A still photo does not give the full flight context. NASA's record supplies it here.",
    ],
  },
  {
    id: "last",
    prompt: ["这是这次任务拍的最后一张照片。", "This was the last photograph of the mission."],
    answer: 2,
    explanation: [
      "现有材料没有给出全部照片的时间顺序。不能补成“最后一张”。",
      "The provided material does not list the sequence of every photo. It does not establish 'the last one'.",
    ],
  },
];

const cloze: readonly ToyCard[] = [
  {
    id: "cl-horizon",
    prompt: [
      "要核对地球在画面中的位置，先 ____。",
      "To check Earth's position in the frame, first ____.",
    ],
    answer: 0,
    options: [
      ["看照片", "look at the photo"],
      ["猜想法", "guess a feeling"],
      ["查拍摄日期", "check the date"],
    ],
    explanation: claims[0]!.explanation,
  },
  {
    id: "cl-year",
    prompt: ["NASA 记录中的拍摄年份是 ____。", "NASA records the year as ____."],
    answer: 1,
    options: [
      ["1969", "1969"],
      ["1968", "1968"],
      ["1972", "1972"],
    ],
    explanation: claims[1]!.explanation,
  },
  {
    id: "cl-unknown",
    prompt: [
      "材料没说明他的心情，应该先 ____。",
      "When the material does not establish his feelings, ____.",
    ],
    answer: 2,
    options: [
      ["编得生动", "make it vivid"],
      ["写成事实", "state it as fact"],
      ["保留未知", "leave it unknown"],
    ],
    explanation: claims[2]!.explanation,
  },
  {
    id: "cl-who",
    prompt: ["这张《地出》的摄影者是 ____。", "This Earthrise photograph was taken by ____."],
    answer: 0,
    options: [
      ["Bill Anders", "Bill Anders"],
      ["Jim Lovell", "Jim Lovell"],
      ["Frank Borman", "Frank Borman"],
    ],
    explanation: claims[4]!.explanation,
  },
  {
    id: "cl-record",
    prompt: ["核对摄影者姓名，需要打开 ____。", "To verify the photographer's name, open ____."],
    answer: 1,
    options: [
      ["更大的照片", "a larger photo"],
      ["图像记录", "the image record"],
      ["调色面板", "a color panel"],
    ],
    explanation: claims[4]!.explanation,
  },
  {
    id: "cl-mission",
    prompt: ["《地出》拍摄于 ____ 任务期间。", "Earthrise was photographed during ____."],
    answer: 2,
    options: [
      ["阿波罗 11 号", "Apollo 11"],
      ["阿波罗 13 号", "Apollo 13"],
      ["阿波罗 8 号", "Apollo 8"],
    ],
    explanation: claims[7]!.explanation,
  },
  {
    id: "cl-check",
    prompt: [
      "AI 说出了一个日期，还需要 ____。",
      "After AI supplies a date, you still need to ____.",
    ],
    answer: 0,
    options: [
      ["对照记录", "check the record"],
      ["直接相信", "trust it directly"],
      ["多加形容词", "add adjectives"],
    ],
    explanation: claims[8]!.explanation,
  },
  {
    id: "cl-favorite",
    prompt: [
      "照片很著名，____ 它是摄影者的最爱。",
      "Being famous ____ that it was the photographer's favorite.",
    ],
    answer: 1,
    options: [
      ["足以证明", "proves"],
      ["不能证明", "does not prove"],
      ["基本确定", "almost proves"],
    ],
    explanation: claims[5]!.explanation,
  },
  {
    id: "cl-color",
    prompt: [
      "检查 AI 有没有说对月面的颜色，可以 ____。",
      "To check AI's description of the lunar surface's color, ____.",
    ],
    answer: 2,
    options: [
      ["看语气", "judge its tone"],
      ["数回答字数", "count its words"],
      ["对照照片", "compare the photo"],
    ],
    explanation: claims[9]!.explanation,
  },
  {
    id: "cl-separate",
    prompt: [
      "画面描述和背景资料，最好 ____。",
      "Visual description and background information are best ____.",
    ],
    answer: 0,
    options: [
      ["分别核对", "checked separately"],
      ["混在一起猜", "guessed together"],
      ["都不检查", "left unchecked"],
    ],
    explanation: [
      "位置、颜色对照片；日期、任务名称对记录。不同说法要找对应依据。",
      "Check position and color against the photo; date and mission against the record. Match each claim to its evidence.",
    ],
  },
  {
    id: "cl-day",
    prompt: ["NASA 记录中的拍摄日是 12 月 ____ 日。", "NASA records the day as December ____."],
    answer: 1,
    options: [
      ["23", "23"],
      ["24", "24"],
      ["25", "25"],
    ],
    explanation: [
      "记录中的拍摄日是 1968 年 12 月 24 日。别把网页发布日期当作拍摄日期。",
      "The photograph was taken on December 24, 1968. Do not confuse the article publication date with the capture date.",
    ],
  },
  {
    id: "cl-final",
    prompt: [
      "现有资料没列出全部照片，因此“最后一张”要 ____。",
      "Without a complete sequence, 'the last photo' should be ____.",
    ],
    answer: 2,
    options: [
      ["继续沿用", "kept as fact"],
      ["加粗强调", "emphasized"],
      ["标作未证实", "marked unverified"],
    ],
    explanation: claims[11]!.explanation,
  },
];

export function toyDeck(mode: ToyMode): readonly ToyCard[] {
  return mode === "cloze-tetris"
    ? cloze
    : mode === "invaders"
      ? claims.filter((c) => c.answer !== 2)
      : claims;
}
export interface ToyState {
  readonly mode: ToyMode;
  readonly cursor: number;
  readonly phase: "playing" | "feedback" | "complete";
  readonly selected: number | null;
  readonly lastChoice: number | null;
  readonly correct: boolean;
  readonly attempts: number;
  readonly firstTry: number;
  readonly mistakes: number;
  readonly seconds: number;
  readonly missed: readonly string[];
  readonly history: readonly number[];
}
export type ToyEvent =
  | { readonly type: "select"; readonly index: number }
  | { readonly type: "submit"; readonly index: number }
  | { readonly type: "retry" }
  | { readonly type: "next" }
  | { readonly type: "tick"; readonly active: boolean }
  | { readonly type: "reset"; readonly mode: ToyMode };
export function newToyGame(mode: ToyMode): ToyState {
  return {
    mode,
    cursor: 0,
    phase: "playing",
    selected: null,
    lastChoice: null,
    correct: false,
    attempts: 0,
    firstTry: 0,
    mistakes: 0,
    seconds: 25,
    missed: [],
    history: [],
  };
}
export function toyReducer(state: ToyState, event: ToyEvent): ToyState {
  if (event.type === "reset") return newToyGame(event.mode);
  const card = toyDeck(state.mode)[state.cursor];
  if (!card || state.phase === "complete") return state;
  if (event.type === "select") {
    const count = card.options?.length ?? (state.mode === "invaders" ? 2 : 3);
    return state.phase === "playing" &&
      Number.isInteger(event.index) &&
      event.index >= 0 &&
      event.index < count
      ? { ...state, selected: event.index }
      : state;
  }
  if (event.type === "tick") {
    if (!event.active || state.phase !== "playing") return state;
    if (state.seconds > 1) return { ...state, seconds: state.seconds - 1 };
    return {
      ...state,
      phase: "feedback",
      correct: false,
      lastChoice: null,
      seconds: 0,
      attempts: state.attempts + 1,
      mistakes: state.mistakes + 1,
      missed: [...new Set([...state.missed, card.id])],
    };
  }
  if (event.type === "submit" && state.phase === "playing") {
    const count = card.options?.length ?? (state.mode === "invaders" ? 2 : 3);
    if (!Number.isInteger(event.index) || event.index < 0 || event.index >= count) return state;
    const correct = event.index === card.answer;
    return {
      ...state,
      phase: "feedback",
      selected: event.index,
      lastChoice: event.index,
      correct,
      attempts: state.attempts + 1,
      firstTry: state.firstTry + Number(correct && state.attempts === 0),
      mistakes: state.mistakes + Number(!correct),
      missed: correct ? state.missed : [...new Set([...state.missed, card.id])],
    };
  }
  if (event.type === "retry" && state.phase === "feedback" && !state.correct)
    return { ...state, phase: "playing", selected: null, seconds: 25 };
  if (event.type === "next" && state.phase === "feedback" && state.correct) {
    const cursor = state.cursor + 1;
    return {
      ...state,
      cursor,
      history: [...state.history, card.answer],
      selected: null,
      lastChoice: null,
      correct: false,
      attempts: 0,
      seconds: 25,
      phase: cursor === toyDeck(state.mode).length ? "complete" : "playing",
    };
  }
  return state;
}
