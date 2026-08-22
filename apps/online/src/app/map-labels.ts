/**
 * What an island says under its name.
 *
 * Not how big it is. 「31 门课 · 362 节」 measured the mountain at the exact
 * moment a learner is choosing which one to climb — the same mistake the
 * 「今天」 card made, and the top bar before it. v3 screen 05 answers this slot
 * with a progress bar, and the principle behind the bar is the point: where am
 * I, not how much is left.
 *
 * Before you start, the course count stays, because a chooser genuinely needs
 * to know that Buzz is small and TuringPact is not. The lesson total is the
 * intimidating half of that pair and tells them nothing the course count did
 * not already tell them.
 */
export function studySub(courses: number, done: number): string {
  return done > 0 ? `已学 ${done} 关` : `${courses} 门课`;
}
