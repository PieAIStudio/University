/**
 * 跳级测验：证明过一节课，和学过一节课，是两件事。
 *
 * V5 §12 决定 B、D、E、G 的域逻辑都在这一份文件里，没有第二份。开场那几个自述题
 * 和单元入口的「我会了」不是两套东西，是同一个机制的两个入口：自述只负责缩小范围，
 * 解锁永远靠做对题。所以这里没有「自述结果」这种概念——它进不来。
 *
 * 三条决定，为什么写成现在这样：
 *
 * **题不另建。** 抽的就是这个单元自己的练习（决定 B）。另建一套题库意味着课改了
 * 而题没改时，学习者会因为一道过期的题被挡在外面，而没有任何检查会发现——两边本来
 * 就该长得不一样。题跟着课走，课一改题自动跟着改。
 *
 * **判分只用第 1 层。** `gradeDeterministically` 判得了的题才可能被抽中。这不是
 * 省钱的权宜：第 2 层要花学习者的钱或免费额度，而这场测验的目的是**少学几节课**——
 * 为了跳过内容而先付一笔钱，是把这条设计卖反了。代价是有些单元凑不齐三道，
 * 那就诚实地说凑不齐（`skipTestUnavailable`），而不是找一个判不准的判法凑数。
 *
 * **过了只写「证明过」。** 证明不调用 `advanceLesson`，不写 `exerciseAttempts`，
 * 因此不会让任何一节课变成 complete，因此不会 `dropCards`（决定 E）。卡片是给读过
 * 课文的人用的：一张三周后弹出来、而正文从没读过的卡片，只会制造一次挫败，并且教会
 * 学习者忽略复习提醒。这一条不是靠这里写一句话守住的，是靠这里**什么都不做**守住的。
 */

import { gradeDeterministically, isSelfGradable, type AnswerKey } from "../grading/answer-key.js";

/** 一道可以拿来当跳级题的练习。载荷来自课自己，不是另一套题库。 */
export interface SkipTestCandidate {
  readonly lessonId: string;
  readonly exerciseId: string;
  readonly prompt: string;
  readonly answerKey: AnswerKey;
  readonly options?: readonly { readonly id: string; readonly text: string }[];
}

/** 抽出来的一道题，附带它是从哪节课来的——答错时要打开的正是那一节。 */
export interface SkipTestQuestion extends SkipTestCandidate {
  readonly lessonTitle: string;
}

/** 一个单元要抽几道。设计写死是三道；写成常量是为了让读的人找得到它。 */
export const SKIP_TEST_SIZE = 3;

/**
 * 这个单元的练习里，哪些是机器判得了的。
 *
 * 输入是「这个单元每节课的练习」，输出保持课的顺序——洗牌是下一步的事，分开是因为
 * 抽样要可重放：测试给一个确定的 `pick`，产品给一个随机的。
 */
export function skipTestCandidates(
  lessons: readonly {
    readonly id: string;
    readonly exercises: readonly {
      readonly id: string;
      readonly prompt: string;
      readonly answerKey?: AnswerKey;
      readonly options?: readonly { readonly id: string; readonly text: string }[];
    }[];
  }[],
): readonly SkipTestCandidate[] {
  const candidates: SkipTestCandidate[] = [];
  for (const lesson of lessons) {
    for (const exercise of lesson.exercises) {
      if (!exercise.answerKey || !isSelfGradable(exercise.answerKey)) continue;
      if (!exercise.prompt.trim()) continue;
      candidates.push({
        lessonId: lesson.id,
        exerciseId: exercise.id,
        prompt: exercise.prompt,
        answerKey: exercise.answerKey,
        ...(exercise.options ? { options: exercise.options } : {}),
      });
    }
  }
  return candidates;
}

/**
 * 抽三道，尽量来自三节不同的课。
 *
 * 「尽量」是实话：一节课恰好一道练习是写作合同，但历史课时有一节多道的。三道全落在
 * 同一节课上，测的就是那一节而不是这个单元，所以先每节课取一道，不够再回头补。
 *
 * `pick` 注入而不是内建 `Math.random`，因为「随机抽」这件事本身要被测：一个总是抽
 * 第一道的实现和一个真的在抽的实现，在产品里长得一模一样。
 */
export function pickSkipTest(
  candidates: readonly SkipTestCandidate[],
  options: {
    readonly size?: number;
    /** 从 `length` 个里挑一个的下标。默认均匀随机。 */
    readonly pick?: (length: number) => number;
  } = {},
): readonly SkipTestCandidate[] {
  const size = options.size ?? SKIP_TEST_SIZE;
  const pick = options.pick ?? ((length: number) => Math.floor(Math.random() * length));
  const byLesson = new Map<string, SkipTestCandidate[]>();
  for (const candidate of candidates) {
    const bucket = byLesson.get(candidate.lessonId);
    if (bucket) bucket.push(candidate);
    else byLesson.set(candidate.lessonId, [candidate]);
  }

  const chosen: SkipTestCandidate[] = [];
  const remaining = [...byLesson.values()];
  // 第一轮：每节课最多一道，先把课铺开。
  while (chosen.length < size && remaining.length > 0) {
    const index = clampIndex(pick(remaining.length), remaining.length);
    const bucket = remaining.splice(index, 1)[0]!;
    const taken = clampIndex(pick(bucket.length), bucket.length);
    chosen.push(bucket.splice(taken, 1)[0]!);
    if (bucket.length > 0) byLesson.set(bucket[0]!.lessonId, bucket);
    else byLesson.delete(chosen[chosen.length - 1]!.lessonId);
  }
  // 第二轮：课不够多的时候才回头，用同一节课的第二道补满。
  const leftovers = [...byLesson.values()].flat();
  while (chosen.length < size && leftovers.length > 0) {
    const index = clampIndex(pick(leftovers.length), leftovers.length);
    chosen.push(leftovers.splice(index, 1)[0]!);
  }
  return chosen;
}

function clampIndex(value: number, length: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.trunc(value), 0), length - 1);
}

/** 一道跳级题的判定。`unanswered` 是「还没写」，不是「写错了」。 */
export type SkipTestVerdict = "correct" | "wrong" | "unanswered";

/**
 * 判一道跳级题。只有第 1 层能判「对」。
 *
 * `undecided` 一律不算对。它在这里只有两种来源：空答案，和一个不该被抽中的题——
 * 两种都不是「答对了」，所以两种都不能让人跳过一节课。
 */
export function judgeSkipAnswer(answer: string, key: AnswerKey): SkipTestVerdict {
  const verdict = gradeDeterministically(answer, key);
  if (verdict.outcome === "pass") return "correct";
  if (verdict.outcome === "fail") return "wrong";
  return "unanswered";
}

/**
 * 一场测验最多允许错几道，还算证明过这个单元。
 *
 * 设计只写了两种情形：全对，和错一道。三道全错要怎么办它没说，而按字面把「错一道
 * 只打开那一节」当成每道各管各的，六节的单元就会在**一道都没答对**的情况下跳过
 * 三节——那是把「近乎全对」的宽容当成了按比例的宽容。所以这里补一条下限：
 * 错两道及以上，什么都不证明。补的是下限，不是新规则，设计的两种情形一字未改。
 */
export const SKIP_TEST_ALLOWED_WRONG = 1;

/**
 * 一场测验结束之后，这个单元里哪几节算证明过了。
 *
 * 决定 D 的原话：「全对就把整个单元标记为已掌握；错一道，只打开错的那一节，
 * 其余仍然可跳。」所以答案不是「答对的那几节」，是「整个单元减去答错的那几节」——
 * 抽中三道的单元有六节课，另外三节也跳过去了，这是设计写明的交换，不是漏洞。
 *
 * 还没答的题不证明任何东西，但也不惩罚它所属的那一节：一场没做完的测验什么都不改。
 */
export function provenLessonIds(
  unitLessonIds: readonly string[],
  results: readonly { readonly lessonId: string; readonly verdict: SkipTestVerdict }[],
): readonly string[] {
  if (results.length === 0) return [];
  if (results.some((result) => result.verdict === "unanswered")) return [];
  const failed = new Set(
    results.filter((result) => result.verdict === "wrong").map((result) => result.lessonId),
  );
  if (failed.size > SKIP_TEST_ALLOWED_WRONG) return [];
  return unitLessonIds.filter((lessonId) => !failed.has(lessonId));
}

/** 答错的那几节——测验之后要被打开、正经读一遍的正是它们。 */
export function openedLessonIds(
  results: readonly { readonly lessonId: string; readonly verdict: SkipTestVerdict }[],
): readonly string[] {
  const seen = new Set<string>();
  const opened: string[] = [];
  for (const result of results) {
    if (result.verdict !== "wrong" || seen.has(result.lessonId)) continue;
    seen.add(result.lessonId);
    opened.push(result.lessonId);
  }
  return opened;
}

/** 一个单元的每一节都证明过了，这个单元才算证明过。 */
export function isUnitProven(
  unitLessonIds: readonly string[],
  proven: ReadonlySet<string>,
): boolean {
  return unitLessonIds.length > 0 && unitLessonIds.every((lessonId) => proven.has(lessonId));
}

/**
 * 这个单元里，哪几节已经证明过了——从学习者文档里读，不是从这一次测验里读。
 *
 * 写在这里而不是各自的界面里，是因为「我会了」和课程岛开场那一问都要问同一句话，
 * 而文档存的是三段 key、界面拿的是单元里的 lessonId：这个换算做两遍，就会有一遍
 * 忘记带 courseId，而两个入口显示不一致这种毛病，看起来只像其中一个「还没刷新」。
 */
export function provenIdsForUnit(
  provenLessonKeys: ReadonlySet<string>,
  location: { readonly studyId: string; readonly courseId: string },
  unitLessonIds: readonly string[],
): ReadonlySet<string> {
  return new Set(
    unitLessonIds.filter((lessonId) =>
      provenLessonKeys.has(`${location.studyId}/${location.courseId}/${lessonId}`),
    ),
  );
}
