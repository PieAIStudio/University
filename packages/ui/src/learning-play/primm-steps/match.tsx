import type { PrimmStepOf } from "@pieai/university-core";
import { playSound } from "../../sound/index.js";
import { MatchStep } from "./MatchStep.js";
import type { StepContext, StepView } from "./context.js";

/** Match: each answer under the request that produced it. */
export function matchStep(current: PrimmStepOf<"match">, ctx: StepContext): StepView {
  const { t, session, update, finishStep, miss, activity, busy, error, cancel, execute, setDemo } =
    ctx;

  const body = (
    <MatchStep
      step={current}
      activity={activity}
      runs={session.runs}
      placed={session.matched[current.id] ?? {}}
      busy={busy === "run"}
      error={error}
      done={session.done.includes(current.id)}
      run={(id, prompt) => execute(id, "run", prompt)}
      onCancel={cancel}
      onPlace={(answer, question) => {
        if (answer !== question) return miss(current.miss ?? t("primm.steps.wrongMatch"));
        playSound("answer.correct");
        const placed = { ...session.matched[current.id], [answer]: question };
        update({ matched: { ...session.matched, [current.id]: placed } });
        if (current.requestIds.every((id) => placed[id] === id))
          finishStep(current.id, {
            tone: "good",
            title: t("primm.steps.seen"),
            text: current.after,
          });
      }}
      setDemo={setDemo}
    />
  );
  return { body };
}
