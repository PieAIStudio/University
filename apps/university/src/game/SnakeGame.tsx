import type { SequenceRound } from "@pieai/university-core";
import type { AvatarRecipe } from "@pieai/university-world/avatar.js";
import { SnakeScene, SnakeSession, type Direction } from "@pieai/university-world/game-kit.js";
import { ClockMeter, DirectionPad } from "@pieai/university-ui/game-frame/index.js";
import { useI18n } from "@pieai/university-ui/i18n.js";
import { useMemo, useState, useSyncExternalStore } from "react";

import { RoundGameShell } from "./RoundGameShell.js";

/**
 * 贪吃蛇, assembled (ADR-0011, assembly layer): an order the lesson teaches as
 * crates on the lawn, the shell around them. The map's challenge node and the
 * play lab both render this; neither keeps a copy.
 */
export interface SnakeGameProps {
  readonly rounds: readonly SequenceRound[];
  readonly recipe?: AvatarRecipe | null;
  readonly onClose?: () => void;
  readonly onOpenLesson?: (lessonId: string) => void;
  readonly onUnavailable?: () => void;
  readonly onPlain?: () => void;
  readonly onWon?: () => void;
}

const KEYS: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};

export function SnakeGame(props: SnakeGameProps) {
  const [run, setRun] = useState(0);
  return (
    <SnakeRun key={run} {...props} seed={1 + run * 7919} onAgain={() => setRun((n) => n + 1)} />
  );
}

function SnakeRun({
  rounds,
  recipe,
  seed,
  onAgain,
  ...host
}: SnakeGameProps & { seed: number; onAgain: () => void }) {
  const { t } = useI18n();
  const session = useMemo(() => new SnakeSession(rounds, seed), [rounds, seed]);
  const s = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const round = s.rounds[s.roundIndex]?.round ?? null;
  const text = (source: SequenceRound | null, pieceId: string) =>
    source?.items.find((piece) => piece.id === pieceId)?.text ?? "";
  const sentence = s.eaten.map((id) => text(round, id)).join(" ");

  return (
    <RoundGameShell
      session={session}
      name="snake"
      copy={{
        title: t("snake.title"),
        intro: t("snake.intro"),
        controls: t("snake.controls"),
        calm: t("snake.calm"),
      }}
      onAgain={onAgain}
      {...host}
      briefing={(source) => {
        const context = (source as SequenceRound).context;
        return context ? { note: context } : {};
      }}
      resultLine={(source, itemId) => {
        const order = source as SequenceRound;
        const piece = order.items.find((candidate) => candidate.id === itemId);
        if (!piece) return null;
        const decoy = !order.answers.some((answer) => answer.includes(piece.id));
        return {
          text: piece.text,
          bin: decoy ? t("snake.decoy") : "",
          binIndex: 2,
          why: piece.why ?? piece.reason ?? "",
        };
      }}
      noticeReason={(notice) => {
        const piece = session.pieceOf(notice.itemId);
        if (!piece) return notice.reason;
        if (session.isDecoy(piece.id))
          return notice.reason
            ? t("snake.decoyReason", { text: piece.text, why: notice.reason })
            : t("snake.offOrder", { text: piece.text });
        return t("snake.nextReason", { text: piece.text, why: notice.reason });
      }}
      bannerExtra={
        s.crates.length ? (
          <>
            <ClockMeter fraction={s.window ? s.hunger / s.window : 1} label={t("snake.hunger")} />
            <p className="game-frame__hint" data-testid="snake-sentence">
              {sentence ? t("snake.sentence", { sentence }) : t("snake.startHint")}
            </p>
          </>
        ) : null
      }
      onKey={(event) => {
        const dir = KEYS[event.key];
        if (!dir) return false;
        session.act({ type: "turn", dir });
        return true;
      }}
      actions={(playing) => (
        <DirectionPad disabled={!playing} onTurn={(dir) => session.act({ type: "turn", dir })} />
      )}
      scene={(slot) => (
        <SnakeScene
          session={session}
          snapshot={s}
          recipe={recipe ?? null}
          {...slot}
          describeCrate={(label, next, aimed) =>
            next
              ? t("snake.crateNext", { text: label })
              : aimed
                ? t("snake.crateAimed", { text: label })
                : t("snake.crate", { text: label })
          }
          onAim={(pieceId) => {
            if (!slot.frozen) session.act({ type: "aim", pieceId });
          }}
        />
      )}
    />
  );
}
