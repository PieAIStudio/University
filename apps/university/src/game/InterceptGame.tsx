import type { GameRound } from "@pieai/university-core";
import type { AvatarRecipe } from "@pieai/university-world/avatar.js";
import { InterceptScene, InterceptSession } from "@pieai/university-world/game-kit.js";
import { AnswerButtons } from "@pieai/university-ui/game-frame/index.js";
import { useI18n } from "@pieai/university-ui/i18n.js";
import { useMemo, useState, useSyncExternalStore } from "react";

import { RoundGameShell } from "./RoundGameShell.js";

/**
 * 庭院拦截, assembled (ADR-0011, assembly layer): content in, the shared
 * shell around, scene inside, session underneath. The map's challenge node and
 * the play lab both render this; neither keeps a copy.
 */
export interface InterceptGameProps {
  readonly rounds: readonly GameRound[];
  readonly recipe?: AvatarRecipe | null;
  /** Leave the game (the node dialog closes). */
  readonly onClose?: () => void;
  readonly onOpenLesson?: (lessonId: string) => void;
  /** WebGL is not available: the host offers its 2D game instead. */
  readonly onUnavailable?: () => void;
  /** The host's 2D game, offered from the intro to anyone who prefers it. */
  readonly onPlain?: () => void;
  /** A genuine completed run; the host, not the renderer, owns rewards. */
  readonly onWon?: () => void;
}

export function InterceptGame(props: InterceptGameProps) {
  const [run, setRun] = useState(0);
  return (
    <InterceptRun key={run} {...props} seed={1 + run * 7919} onAgain={() => setRun((n) => n + 1)} />
  );
}

function InterceptRun({
  rounds,
  recipe,
  seed,
  onAgain,
  ...host
}: InterceptGameProps & { seed: number; onAgain: () => void }) {
  const { t } = useI18n();
  const session = useMemo(() => new InterceptSession(rounds, seed), [rounds, seed]);
  const s = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const round = s.rounds[s.roundIndex]?.round ?? null;
  const bins = round?.bins ?? [];
  const itemText = (itemId: string) => round?.items.find((item) => item.id === itemId)?.text ?? "";
  const newestBoat = s.boats.filter((boat) => boat.state === "sailing").at(-1);

  return (
    <RoundGameShell
      session={session}
      name="intercept"
      copy={{
        title: t("intercept.title"),
        intro: t("intercept.intro"),
        calm: t("intercept.calm"),
      }}
      onAgain={onAgain}
      {...host}
      briefing={(source) => ({ bins: (source as GameRound).bins })}
      resultLine={(source, itemId) => {
        const sort = source as GameRound;
        const item = sort.items.find((candidate) => candidate.id === itemId);
        if (!item) return null;
        const binIndex = sort.bins.findIndex((bin) => bin.id === item.binId);
        return {
          text: item.text,
          bin: sort.bins[binIndex]?.label ?? "",
          binIndex: Math.max(0, binIndex),
          why: item.why,
        };
      }}
      noticeReason={(notice) =>
        t("intercept.reason", { text: itemText(notice.itemId), why: notice.reason })
      }
      {...(newestBoat
        ? { idleLive: t("intercept.newBoat", { text: itemText(newestBoat.itemId) }) }
        : {})}
      onKey={(event) => {
        const index = Number(event.key) - 1;
        if (!Number.isInteger(index) || !bins[index]) return false;
        session.act({ type: "throw", binId: bins[index].id });
        return true;
      }}
      actions={(playing) =>
        bins.length ? (
          <AnswerButtons
            bins={bins}
            disabled={!playing}
            onAnswer={(binId) => session.act({ type: "throw", binId })}
          />
        ) : null
      }
      guide={[
        { target: "question", say: t("guide.intercept.question") },
        { target: "stage", say: t("guide.intercept.boats") },
        { target: "answers", say: t("guide.intercept.throw") },
      ]}
      scene={(slot) => (
        <InterceptScene
          session={session}
          snapshot={s}
          recipe={recipe ?? null}
          frozen={slot.frozen}
          booting={slot.booting}
          hud={slot.hud}
          onReady={slot.onReady}
          onFailure={slot.onFailure}
          describeBoat={(text, bin) =>
            bin ? t("intercept.boatRevealed", { text, bin }) : t("intercept.boat", { text })
          }
          onTarget={(boatId) => {
            if (!slot.blocked) session.act({ type: "target", boatId });
          }}
        />
      )}
    />
  );
}
