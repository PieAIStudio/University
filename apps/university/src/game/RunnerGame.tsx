import type { ChoiceRound } from "@pieai/university-core";
import type { AvatarRecipe } from "@pieai/university-world/avatar.js";
import { RunnerScene, RunnerSession } from "@pieai/university-world/game-kit.js";
import { AnswerButtons } from "@pieai/university-ui/game-frame/index.js";
import { useI18n } from "@pieai/university-ui/i18n.js";
import { useMemo, useState, useSyncExternalStore } from "react";

import { RoundGameShell } from "./RoundGameShell.js";

/**
 * 三岔路, assembled (ADR-0011, assembly layer): situations from a lesson's
 * weigh boards and decision steps, a fork of arches for each; the shell around
 * them. The map's challenge node and the play lab both render this.
 */
export interface RunnerGameProps {
  readonly rounds: readonly ChoiceRound[];
  readonly recipe?: AvatarRecipe | null;
  readonly onClose?: () => void;
  readonly onOpenLesson?: (lessonId: string) => void;
  readonly onUnavailable?: () => void;
  readonly onPlain?: () => void;
  readonly onWon?: () => void;
}

export function RunnerGame(props: RunnerGameProps) {
  const [run, setRun] = useState(0);
  return (
    <RunnerRun key={run} {...props} seed={1 + run * 7919} onAgain={() => setRun((n) => n + 1)} />
  );
}

function RunnerRun({
  rounds,
  recipe,
  seed,
  onAgain,
  ...host
}: RunnerGameProps & { seed: number; onAgain: () => void }) {
  const { t } = useI18n();
  const session = useMemo(() => new RunnerSession(rounds, seed), [rounds, seed]);
  const s = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const round = s.rounds[s.roundIndex]?.round ?? null;
  const fork = s.fork;
  const item = fork ? round?.items.find((candidate) => candidate.id === fork.itemId) : null;
  const label = (source: ChoiceRound, itemId: string, optionId: string) =>
    source.items
      .find((candidate) => candidate.id === itemId)
      ?.options.find((option) => option.id === optionId)?.label ?? "";
  const bins =
    fork && item
      ? fork.lanes.map((optionId) => ({ id: optionId, label: label(round!, item.id, optionId) }))
      : [];

  return (
    <RoundGameShell
      session={session}
      name="runner"
      copy={{
        title: t("runner.title"),
        intro: t("runner.intro"),
        controls: t("runner.controls"),
        calm: t("runner.calm"),
      }}
      onAgain={onAgain}
      {...host}
      briefing={() => ({})}
      resultLine={(source, itemId) => {
        const choice = (source as ChoiceRound).items.find((candidate) => candidate.id === itemId);
        if (!choice) return null;
        return {
          text: choice.text,
          bin: label(source as ChoiceRound, choice.id, choice.bestId),
          binIndex: 0,
          why: choice.why,
        };
      }}
      noticeReason={(notice) => notice.reason}
      bannerExtra={
        item && fork?.taken === null ? (
          <p className="game-frame__hint game-frame__hint--source" data-testid="runner-situation">
            {item.text}
          </p>
        ) : null
      }
      {...(item && fork?.taken === null
        ? { idleLive: t("runner.situation", { text: item.text }) }
        : {})}
      onKey={(event) => {
        if (event.key === "ArrowLeft" || event.key === "a") {
          session.act({ type: "steer", by: -1 });
          return true;
        }
        if (event.key === "ArrowRight" || event.key === "d") {
          session.act({ type: "steer", by: 1 });
          return true;
        }
        const lane = Number(event.key) - 1;
        if (!Number.isInteger(lane) || lane < 0 || lane >= bins.length) return false;
        session.act({ type: "lane", lane });
        return true;
      }}
      actions={(playing) =>
        bins.length ? (
          <AnswerButtons
            bins={bins}
            disabled={!playing || fork?.taken !== null}
            describe={(text) => t("runner.take", { text })}
            onAnswer={(optionId) =>
              session.act({ type: "lane", lane: fork!.lanes.indexOf(optionId) })
            }
          />
        ) : null
      }
      scene={(slot) => (
        <RunnerScene
          session={session}
          snapshot={s}
          recipe={recipe ?? null}
          {...slot}
          describeArch={(text, lane, current) =>
            current
              ? t("runner.archCurrent", { text, lane: lane + 1 })
              : t("runner.arch", { text, lane: lane + 1 })
          }
          onLane={(lane) => {
            if (!slot.frozen) session.act({ type: "lane", lane });
          }}
        />
      )}
    />
  );
}
