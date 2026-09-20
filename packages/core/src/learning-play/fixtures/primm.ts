import type { PrimmClassicActivity } from "../primm.js";

const strings: Record<string, string> = {};
const copy = (zh: string, en: string) => {
  strings[zh] = en;
  return zh;
};
const source = {
  label: copy("W3C 按钮模式", "W3C button pattern"),
  url: "https://www.w3.org/WAI/ARIA/apg/patterns/button/",
};

/** Bilingual contract fixture. No model output or grading success is pre-recorded. */
export const primmFixture: PrimmClassicActivity & { readonly role: "demonstrate" } = {
  id: "button-primm",
  kind: "primm",
  method: "PRIMM",
  role: "demonstrate",
  title: copy("请 AI 整理按钮说明", "Ask AI to organize button guidance"),
  brief: copy(
    "从已有说明写出可核对的操作提示。",
    "Turn existing guidance into instructions you can check.",
  ),
  goal: copy(
    "让请求说清用途和材料范围。",
    "State the purpose and material boundary in your request.",
  ),
  takeaway: copy(
    "生成的提示仍需对照材料检查。",
    "Check generated instructions against the material.",
  ),
  hint: copy("看说明有没有谈到这个操作。", "Check whether the guidance mentions the action."),
  source,
  intro: {
    situation: copy(
      "假设你在给社团报名页写操作提示。",
      "Imagine writing instructions for a club signup page.",
    ),
    need: copy(
      "你想请 AI 把按钮说明整理得更清楚。",
      "You want AI to make the button guidance clearer.",
    ),
    connection: copy(
      "下面使用 W3C 按钮模式的摘要；报名页是练习情境。",
      "We use a summary of the W3C button pattern; the signup page is an invented practice scenario.",
    ),
  },
  sources: [
    {
      id: "button-source",
      reference: source,
      note: copy("保留原始说明供核对。", "Keep the original guidance available for checking."),
      summary: copy(
        "按钮获得焦点后，可用 Enter 或空格触发。",
        "With focus on a button, Enter or Space activates it.",
      ),
      limitation: copy(
        "规范说明不能证明练习页面已经实现了这些行为。",
        "Guidance does not prove the practice page implements these behaviors.",
      ),
      date: copy("未注明发布日期", "Publication date not specified"),
    },
  ],
  materials: [
    {
      id: "button-note",
      sourceId: "button-source",
      kind: "source-summary",
      label: copy("键盘操作摘要", "Keyboard operation summary"),
      text: copy(
        "焦点在按钮上时，Enter 和空格可以触发按钮。",
        "When a button has focus, Enter and Space can activate it.",
      ),
    },
  ],
  starter: {
    prompt: copy(
      "把这份按钮说明整理成两条操作提示。",
      "Turn this button guide into two action tips.",
    ),
    operation: "text",
    materialIds: ["button-note"],
    assetIds: [],
  },
  predict: {
    question: copy("这份请求可能得到什么？", "What might this request produce?"),
    options: [
      { id: "two-tips", label: copy("两条键盘操作提示", "Two keyboard instructions") },
      {
        id: "broad-guide",
        label: copy("一段更宽泛的按钮介绍", "A broader introduction to buttons"),
      },
    ],
  },
  run: {
    title: copy("运行原请求", "Run the original request"),
    note: copy(
      "查看这一次的实际结果，再与材料比较。",
      "Read this execution's actual result and compare it with the material.",
    ),
  },
  investigate: {
    title: copy("把两种文字分开", "Separate two kinds of text"),
    brief: copy(
      "下面是教学用的两段文字，请按用途分类。",
      "Sort these two teaching examples by purpose.",
    ),
    explanation: copy(
      "介绍讲对象是什么，提示讲读者可以怎么做。",
      "An introduction describes the object; instructions describe what the reader can do.",
    ),
    more: [
      {
        question: copy("分类是在评判 AI 吗？", "Does this sorting grade AI?"),
        answer: copy(
          "不是，它练习区分文字用途；实际结果要另外核对。",
          "No. It practices distinguishing text purposes; check the actual result separately.",
        ),
      },
    ],
    game: {
      kind: "sort",
      buckets: [
        { id: "action", label: copy("操作提示", "Instructions") },
        { id: "description", label: copy("对象介绍", "Introduction") },
      ],
      cards: [
        {
          id: "press-key",
          text: copy("先聚焦按钮，再按 Enter。", "Focus the button, then press Enter."),
          bucketId: "action",
          why: copy("这句话指明了操作。", "This sentence names an action."),
        },
        {
          id: "button-name",
          text: copy("按钮是一种界面控件。", "A button is an interface control."),
          bucketId: "description",
          why: copy("这句话介绍了对象。", "This sentence describes the object."),
        },
      ],
    },
  },
  modify: {
    title: copy("改一处再运行", "Change something and run again"),
    brief: copy("编辑原请求，比较前后结果。", "Edit the original request and compare the results."),
    goal: copy(
      "让提示适合第一次使用键盘的人。",
      "Make the instructions useful to a first-time keyboard user.",
    ),
    suggestion: copy("可以补充读者是谁。", "You could specify the audience."),
  },
  make: {
    title: copy("写自己的提示", "Write your own instructions"),
    scenario: copy(
      "换成给图书馆预约页写键盘操作提示。",
      "Now write keyboard instructions for a library booking page.",
    ),
    goal: copy(
      "自己写请求、运行，并核对产物。",
      "Write your request, run it, and check the artifact.",
    ),
    materialIds: ["button-note"],
    assetIds: [],
    operation: "text",
    promptPlaceholder: copy("你想让 AI 帮你做什么？", "What would you like AI to help you do?"),
    checklist: [
      copy("有明确的使用场景", "Names the usage scenario"),
      copy("操作有材料依据", "Grounds the actions in the material"),
    ],
    exerciseId: "button-independent",
  },
  finish: {
    title: copy("保留你的作品", "Keep your artifact"),
    note: copy(
      "复制需要的内容，完成后返回地图。",
      "Copy what you need, then complete and return to the map.",
    ),
  },
  locales: { en: { strings } },
};

/** Minimal lesson envelope for UI/schema tests; rubric remains on the exercise. */
export const primmLessonFixture = {
  content: "按钮提示要对照材料核查。\n\n::play{#button-primm}",
  activities: [primmFixture],
  evidence: [{ sourceUrl: source.url }],
  assets: [],
  exercises: [
    {
      id: "button-independent",
      kind: "explain",
      prompt: "提交你的请求和产物，说明你核对了什么。",
      rubric: ["请求说明使用场景", "产物中的键盘操作可对照材料核查"],
      evidence: [{ sourceUrl: source.url }],
    },
  ],
};
