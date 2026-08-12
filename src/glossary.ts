/**
 * Plain-language explanations of the jargon this app puts on screen.
 *
 * Every entry is written for someone who has never shipped software. That is a
 * real constraint, not a tone preference: the terms below are the ones a
 * learner meets *before* the lesson that would explain them, so an explanation
 * that leans on other jargon simply moves the confusion one word to the left.
 *
 * Two rules for writing one:
 *
 * - `summary` answers "what is this thing" in one sentence, with no term the
 *   reader would also have to look up.
 * - `detail` answers "why do I care", and is optional. Leave it out rather than
 *   padding — a tip nobody finishes reading teaches nothing.
 */
interface GlossaryEntry {
  /** The heading shown in the tip. Usually the term itself, sometimes expanded. */
  readonly term: string;
  readonly summary: string;
  readonly detail?: string;
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  fsrs: {
    term: "FSRS · 间隔复习算法",
    summary:
      "决定这张卡片下次什么时候再问你的算法。答得越轻松，下次间隔越长；答得吃力，很快就会再见到它。",
    detail:
      "名字是 Free Spaced Repetition Scheduler。它的目标不是考你，而是尽量在你「快要忘掉」的那一刻出现——那个时刻复习，记得最牢。",
  },
  "due-cards": {
    term: "到期卡片",
    summary: "今天该复习的卡片数量。一次只出一张，评分之后下一张会自动补上。",
    detail: "数字会随着你的评分往下走。清零就是今天的复习做完了。",
  },
  "review-rating": {
    term: "重来 / 困难 / 良好 / 简单",
    summary:
      "回答之后，你自己说这次「想起来有多费劲」。这不是判对错，对错你自己看参考答案就知道了。",
    detail: "选「重来」不丢人，它只是让这张卡片更早回来找你。诚实评分，算法才能算准间隔。",
  },
  evidence: {
    term: "证据",
    summary: "这节课的说法出自被学项目里的哪个文件、哪几行。点开就能看到原文。",
    detail: "课程内容由 AI 生成，证据是它的凭据——没有证据的说法，你有理由不信。",
  },
  "lesson-vocabulary": {
    term: "生词",
    summary: "打开外语模式后，本课标出的英文词会汇总在这里，方便你扫一眼和标记状态。",
    detail: "点某个词会滚到正文里第一次出现的位置。状态会影响之后复习队列里是否再见到它。",
  },
  "lesson-related": {
    term: "哪些课用到这节",
    summary: "别的课在正文里链接到了这一节。点开可以直接跳过去，不必先回到目录。",
    detail:
      "这是反向引用，不是推荐算法。本课指向别处的链接不列在这里——它们本来就长在正文里对应的那句话上，那个位置比任何列表都更说明问题。没有课指向本节时，这一栏不会出现。",
  },
  "lesson-marks": {
    term: "我的标记",
    summary: "你在正文里选中一段话后记下的东西。「没看懂」会攒成一份清单，「高亮」只是留个记号。",
    detail:
      "点某一条会滚回正文里那段话并选中它。攒够了用「拷贝全部去问 AI」，拷出来的内容带上每段话的出处和小节名，这样对方知道你问的是哪里。标记只存在本机这个项目的学习库里。",
  },
  "content-revision": {
    term: "REV · 课文版本号",
    summary: "这节课文改过几次。第 1 版就是 REV 1。",
    detail:
      "你的「已完成」和复习进度记在具体某一版上。课文重写会生成新版本，所以旧的完成记录不会假装还有效。",
  },
  airlock: {
    term: "资料仅在本机",
    summary: "这个应用不联网。课程、答案、复习记录全部只存在这台电脑上。",
    detail: "朗读用的也是系统自带的语音，不会把单词发到任何服务器。",
  },
  study: {
    term: "学习项目 · study",
    summary: "一个被拿来研究的真实代码项目，比如「图灵密约」。课程都是从它的真实文件里长出来的。",
  },
  focus: {
    term: "主攻",
    summary: "你当前主要在学的那个项目。首页的「下一节课」只从它里面挑。",
    detail: "复习卡片不受影响——已经学过的东西，不管来自哪个项目，都该按时复习。",
  },
  "english-mode": {
    term: "外语模式",
    summary: "打开后，课文里的部分词会换成英文，鼠标停上去能看到中文释义、音标和朗读。",
    detail: "读技术文档迟早要面对英文。与其单独背单词，不如在看得懂的上下文里一点点认识它们。",
  },
  "retrieval-practice": {
    term: "先想，再看答案",
    summary: "必须先写下自己的答案，才能看参考答案。",
    detail:
      "这是故意的。「看一遍觉得懂了」和「能自己说出来」是两回事，而只有后者会留在长期记忆里。写错也有效——努力回想这个动作本身就在加固记忆。",
  },
  "host-grade": {
    term: "交给 AI 批改",
    summary: "把题目、你的答案和判分标准打包复制走，粘贴给任何 AI 助手，它来点评。",
    detail: "这个应用自己不联网，所以批改这一步由你和你的 AI 助手完成。",
  },
};
