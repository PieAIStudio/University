import type { GameRound } from "@pieai/university-core";
import type { AvatarRecipe } from "@pieai/university-world/avatar.js";
import { BlocksScene, BlocksSession } from "@pieai/university-world/game-kit.js";
import { GameButton } from "@pieai/swimmer-ui-kit";
import { useI18n } from "@pieai/university-ui/i18n.js";
import { useMemo, useState, useSyncExternalStore } from "react";

import { RoundGameShell } from "./RoundGameShell.js";

/**
 * 俄罗斯方块, assembled (ADR-0011, assembly layer): a lesson's sort as falling
 * blocks into bin columns; the shell around them. The map's challenge node and
 * the play lab both render this; neither keeps a copy.
 */
export interface BlocksGameProps {
  readonly rounds: readonly GameRound[];
  readonly recipe?: AvatarRecipe | null;
  readonly onClose?: () => void;
  readonly onOpenLesson?: (lessonId: string) => void;
  readonly onUnavailable?: () => void;
  readonly onPlain?: () => void;
  readonly onWon?: () => void;
}

export function BlocksGame(props: BlocksGameProps) {
  const [run, setRun] = useState(0);
  return (
    <BlocksRun key={run} {...props} seed={1 + run * 7919} onAgain={() => setRun((n) => n + 1)} />
  );
}

function BlocksRun({
  rounds,
  recipe,
  seed,
  onAgain,
  ...host
}: BlocksGameProps & { seed: number; onAgain: () => void }) {
  const { t } = useI18n();
  const session = useMemo(() => new BlocksSession(rounds, seed), [rounds, seed]);
  const s = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const round = s.rounds[s.roundIndex]?.round ?? null;
  const next = s.queue[0] ? round?.items.find((item) => item.id === s.queue[0]) : null;
  const move = (by: -1 | 1) => session.act({ type: "move", by });
  const drop = () => session.act({ type: "drop" });

  return (
    <RoundGameShell
      session={session}
      name="blocks"
      copy={{
        title: t("blocks.title"),
        intro: t("blocks.intro"),
        calm: t("blocks.calm"),
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
      noticeReason={(notice) => {
        const item = session.itemOf(notice.itemId);
        return item ? t("blocks.reason", { text: item.text, why: notice.reason }) : notice.reason;
      }}
      bannerExtra={
        next ? (
          <p className="game-frame__hint" data-testid="blocks-next" data-guide="blocks-next">
            {t("blocks.next", { text: next.text })}
          </p>
        ) : null
      }
      onKey={(event) => {
        if (event.key === "ArrowLeft" || event.key === "a") move(-1);
        else if (event.key === "ArrowRight" || event.key === "d") move(1);
        else if (event.key === "ArrowDown" || event.key === " " || event.key === "s") drop();
        else {
          const col = Number(event.key) - 1;
          if (!Number.isInteger(col) || col < 0 || col >= (round?.bins.length ?? 0)) return false;
          session.act({ type: "column", col });
        }
        return true;
      }}
      actions={(playing) => (
        <div
          className="game-frame__pad game-frame__pad--row"
          data-testid="blocks-pad"
          data-guide="pad"
        >
          <GameButton
            static
            sound={false}
            variant="secondary"
            disabled={!playing}
            aria-label={t("gameKit.dir.left")}
            onClick={() => move(-1)}
          >
            <span aria-hidden="true">←</span>
          </GameButton>
          <GameButton
            static
            sound={false}
            disabled={!playing}
            onClick={drop}
            data-testid="blocks-drop"
          >
            {t("blocks.drop")}
          </GameButton>
          <GameButton
            static
            sound={false}
            variant="secondary"
            disabled={!playing}
            aria-label={t("gameKit.dir.right")}
            onClick={() => move(1)}
          >
            <span aria-hidden="true">→</span>
          </GameButton>
        </div>
      )}
      guide={[
        { target: "blocks-column", say: t("guide.blocks.column") },
        { target: "pad", say: t("guide.blocks.move"), act: true },
        { target: "blocks-next", say: t("guide.blocks.next") },
      ]}
      scene={(slot) => (
        <BlocksScene
          session={session}
          snapshot={s}
          recipe={recipe ?? null}
          {...slot}
          describeColumn={(label, current) =>
            current ? t("blocks.columnCurrent", { label }) : t("blocks.column", { label })
          }
          onColumn={(col) => {
            if (!slot.blocked) session.act({ type: "column", col });
          }}
        />
      )}
    />
  );
}
