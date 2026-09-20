import type { PrimmStepsActivity } from "../primm.js";

const strings: Record<string, string> = {};
const copy = (zh: string, en: string) => {
  strings[zh] = en;
  return zh;
};

/**
 * Lesson one as a version-3 step lesson, authored by hand from the Owner-approved
 * prototype (journey v5, "micro-step"). Predict asks how to use AI, not what it
 * will say; every teacher line that follows a live run depends only on the
 * learner's own choice or action. No model output is pre-recorded here.
 */
export const primmStepsFixture: PrimmStepsActivity & { readonly role: "apply" } = {
  id: "ask-about-a-picture-v2",
  kind: "primm",
  method: "PRIMM",
  experienceVersion: 3,
  role: "apply",
  difficulty: "intro",
  title: copy("想知道照片里的一处，怎么问 AI？", "How do you ask AI about one part of a photo?"),
  brief: copy("学会只问你想知道的那一处。", "Learn to ask about just the part you want to know."),
  goal: copy(
    "想知道照片里的哪一处，就问到哪一处。",
    "Whatever part of a photo you want to know about, ask about that part.",
  ),
  takeaway: copy(
    "想知道哪一处，就直接问那一处。它答完，对着照片看一眼。",
    "Ask directly about the part you want to know. When it answers, check the photo yourself.",
  ),
  hint: copy("问一处，它就答一处。", "Ask about one part, and it answers about that part."),
  source: {
    label: copy(
      "Be My Eyes：有人怎样用 AI 看照片",
      "Be My Eyes: How some people use AI to look at photos",
    ),
    url: "https://www.bemyeyes.com/blog/introducing-be-my-ai/",
  },
  intro: {
    situation: copy(
      "你拍了一张照片，想知道其中的一处。",
      "You took a photo and want to know about one part of it.",
    ),
    need: copy(
      "这张咖啡照片你看得清，拿来练手：AI 答得对不对，你能自己判断。以后看不清菜单、路牌上的小字，就能这样问。",
      "You can see this coffee photo clearly, so it is good practice: you can judge for yourself whether the AI is right. Later, when you cannot read small print on a menu or a sign, you can ask the same way.",
    ),
    connection: copy(
      "真实用法：Be My Eyes 让看不清的人拍张照片，请 AI 说给他听。",
      "A real use: Be My Eyes lets people who cannot see well take a photo and have AI describe it to them.",
    ),
    sourceIds: ["lib-aa55209d"],
  },
  sources: [
    {
      id: "lib-aa55209d",
      reference: {
        label: "Be My Eyes：有人怎样用 AI 看照片",
        url: "https://www.bemyeyes.com/blog/introducing-be-my-ai/",
      },
      note: copy(
        "这篇介绍说：用户可以发照片、看描述、继续追问；想核对时还能找真人志愿者。",
        "This introduction says: users can send photos, read descriptions, and ask follow-up questions; when they want to double-check, they can also find a human volunteer.",
      ),
      summary: copy(
        "2023年的公告描述了拍摄照片、获取描述并提出进一步问题的过程。当描述不够充分或需要核查时，仍有人类志愿者可供协助。",
        "The 2023 announcement describes the process of taking photos, obtaining descriptions, and asking follow-up questions. When descriptions are insufficient or need verification, human volunteers are still available to assist.",
      ),
      limitation: copy(
        "这是一份面向盲人及低视力用户的历史厂商公告；它既非独立的准确性证据，也不构成对当前可用性的承诺。并未查验真实的用户记录。",
        "This is a historical vendor announcement for blind and low-vision users; it is neither independent evidence of accuracy nor a commitment to current availability. Real user records were not examined.",
      ),
    },
    {
      id: "lib-6fbda01e",
      reference: {
        label: copy(
          "scikit-image：coffee 和 chelsea 照片",
          "scikit-image: The coffee and chelsea photos",
        ),
        url: "https://scikit-image.org/docs/stable/api/skimage.data.html",
      },
      note: copy(
        "这里列出了摄影者并标为 CC0；它不能证明照片里的地点、味道、年龄等看不出的事。",
        "The photographer is listed here and marked as CC0; it cannot prove things you cannot see, such as the location, taste, or age in the photo.",
      ),
      summary: copy(
        "coffee 照片为 Rachel Michetti 拍摄，courtesy Pikolo Espresso Bar；chelsea 照片为 Stefan van der Walt 拍摄。两个条目均标为 CC0。",
        "The coffee photo was taken by Rachel Michetti, courtesy of Pikolo Espresso Bar; the chelsea photo was taken by Stefan van der Walt. Both entries are marked as CC0.",
      ),
      limitation: copy(
        "图片许可不代表拍摄地点、价格、味道或猫的个人信息都能从图像确定。",
        "The image license does not mean that the shooting location, price, taste, or the cat's personal information can be determined from the images.",
      ),
    },
  ],
  materials: [
    {
      id: "coffee-photo",
      label: copy("咖啡照片（练习）", "Coffee photo (practice)"),
      kind: "practice",
      assetId: "everyday-coffee",
      sourceId: "lib-6fbda01e",
      text: copy("请以附带的图片为准。", "Please refer to the attached image."),
    },
    {
      id: "cat-photo",
      label: copy("猫照片（练习）", "Cat photo (practice)"),
      kind: "practice",
      assetId: "everyday-cat",
      sourceId: "lib-6fbda01e",
      text: "请以附带的图片为准。",
    },
  ],
  starter: {
    prompt: copy("说说这张照片里有什么。", "Tell me what is in this photo."),
    materialIds: ["coffee-photo"],
    assetIds: ["everyday-coffee"],
    operation: "vision",
  },
  requests: [
    {
      id: "ask-spoon",
      prompt: copy("勺子在杯子的哪一边？", "Which side of the cup is the spoon on?"),
    },
    { id: "ask-look", prompt: copy("帮我看看这张照片。", "Help me look at this photo.") },
  ],
  steps: [
    {
      kind: "choose",
      id: "guess-how",
      phase: "predict",
      title: copy(
        "你想知道勺子在杯子哪一边。哪句最能问到？",
        "You want to know which side of the cup the spoon is on. Which one asks best?",
      ),
      options: [
        { id: "vague", label: "说说这张照片里有什么。", requestId: "starter" },
        { id: "spoon", label: "勺子在杯子的哪一边？", requestId: "ask-spoon" },
        { id: "look", label: "帮我看看这张照片。", requestId: "ask-look" },
      ],
      after: copy(
        "记住你选的这句。马上发出去试试。",
        "Remember the one you chose. Let's send it and see.",
      ),
    },
    {
      kind: "send",
      id: "send-choice",
      phase: "run",
      title: copy(
        "把照片拖进对话框，发出你选的那句",
        "Drag the photo into the chat and send the one you chose",
      ),
      request: "chosen",
      attachmentLabel: copy("咖啡照片", "Coffee photo"),
      debriefs: [
        {
          requestId: "starter",
          text: copy(
            "你问的是整张照片。看看它有没有说勺子在哪边。",
            "You asked about the whole photo. See whether it said where the spoon is.",
          ),
        },
        {
          requestId: "ask-spoon",
          text: copy(
            "你只问了勺子。看看它是不是直接答了。",
            "You asked only about the spoon. See whether it answered directly.",
          ),
        },
        {
          requestId: "ask-look",
          text: copy(
            "你只说了“看看”，它只能自己决定说什么。",
            "You only said “look”, so it had to decide for itself what to say.",
          ),
        },
      ],
    },
    {
      kind: "find",
      id: "find-spoon",
      phase: "run",
      title: copy("点出它说勺子的那一句", "Tap the sentence where it mentions the spoon"),
      terms: [copy("勺", "spoon")],
      found: copy("这句说没说是哪一边？", "Does it say which side?"),
      absent: copy(
        "这次它没提勺子。你想知道的，它没答。",
        "This time it did not mention the spoon. It did not answer what you wanted to know.",
      ),
    },
    {
      kind: "match",
      id: "match-asks",
      phase: "investigate",
      title: copy(
        "三句问法，各得到哪个回答？",
        "Three ways of asking: which answer came from which?",
      ),
      requestIds: ["starter", "ask-spoon", "ask-look"],
      after: copy(
        "问整张图，它就说整张图。问一处，它就答那一处。",
        "Ask about the whole photo, and it talks about the whole photo. Ask about one part, and it answers about that part.",
      ),
    },
    {
      kind: "sort",
      id: "can-photo-answer",
      phase: "investigate",
      title: copy("光看照片，答得出来吗？", "From the photo alone, can it be answered?"),
      buckets: [
        { id: "yes", label: copy("答得出", "Can answer") },
        { id: "no", label: copy("答不出", "Cannot answer") },
      ],
      cards: [
        {
          id: "cup-colour",
          text: copy("杯子是什么颜色？", "What colour is the cup?"),
          bucketId: "yes",
          why: copy("颜色看得到。", "You can see the colour."),
        },
        {
          id: "sweet",
          text: copy("咖啡甜不甜？", "Is the coffee sweet?"),
          bucketId: "no",
          why: copy("味道看不到。", "You cannot see taste."),
        },
        {
          id: "spoon-side",
          text: copy("勺子在哪一边？", "Which side is the spoon on?"),
          bucketId: "yes",
          why: copy("勺子看得到。", "You can see the spoon."),
        },
        {
          id: "which-shop",
          text: copy("这是哪家店？", "Which café is this?"),
          bucketId: "no",
          why: copy("照片里没有店名。", "There is no shop name in the photo."),
        },
        {
          id: "saucer-colour",
          text: copy("碟子是什么颜色？", "What colour is the saucer?"),
          bucketId: "yes",
          why: copy("碟子看得到。", "You can see the saucer."),
        },
        {
          id: "price",
          text: copy("咖啡多少钱？", "How much is the coffee?"),
          bucketId: "no",
          why: copy("照片里没有价钱。", "There is no price in the photo."),
        },
      ],
      after: copy(
        "看得见的，才问得准。看不见的，它只能说不知道，或者猜。",
        "Ask about what can be seen, and you get a clear answer. For what cannot be seen, it can only say it does not know, or guess.",
      ),
    },
    {
      kind: "build",
      id: "build-ask",
      phase: "modify",
      title: copy(
        "现在想知道：杯子里有没有泡沫。拼一句只问这一处",
        "Now you want to know: is there foam in the cup? Build a request about just that",
      ),
      context: copy(
        "原来那句：说说这张照片里有什么。",
        "The original: Tell me what is in this photo.",
      ),
      pieces: [
        { id: "p-look", text: copy("看这张照片，", "Look at this photo:") },
        { id: "p-cup", text: copy("杯子里", "Is there foam") },
        { id: "p-foam", text: copy("有没有泡沫？", "in the cup?") },
        {
          id: "p-all",
          text: copy("说说整张照片", "Describe the whole photo"),
          why: copy("这块又变成问整张图了。", "This piece asks about the whole photo again."),
        },
        {
          id: "p-long",
          text: copy("写得越长越好", "Write as much as possible"),
          why: copy("这块会让它说一大段。", "This piece makes it write a long answer."),
        },
      ],
      answers: [
        ["p-look", "p-cup", "p-foam"],
        ["p-cup", "p-foam"],
      ],
      after: copy("这次只问一处。", "This time it asks about one part."),
    },
    {
      kind: "send",
      id: "send-built",
      phase: "modify",
      title: copy("发出去看看", "Send it and see"),
      request: "built",
      attachmentLabel: "咖啡照片",
      after: copy("去照片上亲眼对一对。", "Now check the photo yourself."),
    },
    {
      kind: "point",
      id: "point-foam",
      phase: "modify",
      title: copy("在照片上点出泡沫", "Tap the foam in the photo"),
      assetId: "everyday-coffee",
      regions: [
        {
          id: "foam",
          label: copy("杯子中间", "Middle of the cup"),
          x: 0.36,
          y: 0.22,
          width: 0.25,
          height: 0.25,
        },
        {
          id: "spoon",
          label: copy("杯子右下", "Lower right of the cup"),
          x: 0.53,
          y: 0.56,
          width: 0.17,
          height: 0.26,
        },
        {
          id: "saucer",
          label: copy("碟子左边", "Left of the saucer"),
          x: 0.14,
          y: 0.46,
          width: 0.18,
          height: 0.34,
        },
        {
          id: "table",
          label: copy("右上角", "Top right corner"),
          x: 0.74,
          y: 0.02,
          width: 0.24,
          height: 0.3,
        },
      ],
      targetId: "foam",
      miss: copy("这里不是。再看看杯子里面。", "Not here. Look inside the cup."),
      after: copy(
        "这是你亲眼看到的。以后它说什么，都这样对一对。",
        "You saw it with your own eyes. Whatever it says, check it like this.",
      ),
    },
    {
      kind: "make",
      id: "make-own",
      phase: "make",
      title: copy(
        "换张猫照片。你想知道它哪一处？",
        "Now a cat photo. Which part of it do you want to know about?",
      ),
    },
    {
      kind: "choose",
      id: "self-check",
      phase: "make",
      title: copy("它答的，照片里看得到吗？", "Can you see what it said in the photo?"),
      options: [
        {
          id: "seen",
          label: copy("看得到，对上了", "Yes, it matches"),
          after: copy(
            "好。问得准，你还亲眼对过。",
            "Good. You asked clearly and checked it yourself.",
          ),
        },
        {
          id: "differs",
          label: copy(
            "和照片不一样，或者照片里没有",
            "It differs from the photo, or it is not in the photo",
          ),
          after: copy(
            "那就先别当真。换个看得见的地方再问，或者问知道的人。",
            "Then do not rely on it. Ask about something you can see, or ask someone who knows.",
          ),
        },
        {
          id: "cannot",
          label: copy("它说看不出来", "It said it cannot tell"),
          after: copy(
            "这是老实话。照片里没有的，AI 也看不出。",
            "That is honest. What is not in the photo, AI cannot see either.",
          ),
        },
      ],
    },
  ],
  make: {
    title: copy("换张猫照片，自己问", "A cat photo: ask it yourself"),
    scenario: copy(
      "这是一张猫的照片。你最想知道它哪一处？",
      "This is a photo of a cat. Which part of it do you most want to know about?",
    ),
    goal: copy(
      "只问一处，把答案记成一句备注。",
      "Ask about one part, and keep the answer as a one-line note.",
    ),
    materialIds: ["cat-photo"],
    assetIds: ["everyday-cat"],
    operation: "vision",
    promptPlaceholder: copy("写一句，只问一处", "Write one request about one part"),
    checklist: [
      copy(
        "只问猫的一处，比如眼睛、鼻子或毛色。",
        "Ask about one part of the cat, such as its eyes, nose or fur colour.",
      ),
      copy(
        "备注里的话，对着照片看得到；没有编名字、年龄。",
        "What the note says can be seen in the photo; no made-up name or age.",
      ),
      copy("留下一句自己以后看得懂的备注。", "Keep one line you will understand later."),
    ],
    exerciseId: "ask-about-a-picture-exercise",
    artifactLabel: copy("猫照片的一句备注", "A one-line note for the cat photo"),
  },
  finish: {
    title: copy("学会了！", "You've got it!"),
    note: copy(
      "下次看不清菜单、路牌上的小字，就这样问：只问你想知道的那一处。",
      "Next time you cannot read small print on a menu or a sign, ask the same way: only about the part you want to know.",
    ),
  },
  locales: { en: { strings } },
};
