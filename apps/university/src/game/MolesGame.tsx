import type { SpotRound } from "@pieai/university-core";
import type { AvatarRecipe } from "@pieai/university-world/avatar.js";
import { MolesScene, MolesSession } from "@pieai/university-world/game-kit.js";
import { useI18n } from "@pieai/university-ui/i18n.js";
import { useMemo, useState, useSyncExternalStore } from "react";

import { RoundGameShell } from "./RoundGameShell.js";

/**
 * 打地鼠, assembled (ADR-0011, assembly layer): sentences to check against a
 * source, held up by moles; the shell around them. The map's challenge node
 * and the play lab both render this; neither keeps a copy.
 */
export interface MolesGameProps {
  readonly rounds: readonly SpotRound[];
  readonly recipe?: AvatarRecipe | null;
  readonly onClose?: () => void;
  readonly onOpenLesson?: (lessonId: string) => void;
  readonly onUnavailable?: () => void;
  readonly onPlain?: () => void;
  readonly onWon?: () => void;
}

export function MolesGame(props: MolesGameProps) {
  const [run, setRun] = useState(0);
  return (
    <MolesRun key={run} {...props} seed={1 + run * 7919} onAgain={() => setRun((n) => n + 1)} />
  );
}

function MolesRun({
  rounds,
  recipe,
  seed,
  onAgain,
  ...host
}: MolesGameProps & { seed: number; onAgain: () => void }) {
  const { t } = useI18n();
  const session = useMemo(() => new MolesSession(rounds, seed), [rounds, seed]);
  const s = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const round = s.rounds[s.roundIndex]?.round ?? null;
  const whackHole = (hole: number) => {
    const mole = session
      .getState()
      .moles.find((candidate) => candidate.hole === hole && MolesSession.reachable(candidate));
    if (mole) session.act({ type: "whack", moleId: mole.id });
  };

  return (
    <RoundGameShell
      session={session}
      name="moles"
      copy={{
        title: t("moles.title"),
        intro: t("moles.intro"),
        calm: t("moles.calm"),
      }}
      onAgain={onAgain}
      {...host}
      briefing={(source) => {
        const text = (source as SpotRound).source;
        return text ? { note: t("moles.source", { source: text }) } : {};
      }}
      resultLine={(source, itemId) => {
        const item = (source as SpotRound).items.find((candidate) => candidate.id === itemId);
        if (!item) return null;
        return {
          text: item.text,
          bin: item.target ? t("moles.targetTag") : t("moles.leaveTag"),
          binIndex: item.target ? 2 : 0,
          why: item.why,
        };
      }}
      noticeReason={(notice) => {
        const item = session.sentenceOf(notice.itemId);
        return item ? t("moles.reason", { text: item.text, why: notice.reason }) : notice.reason;
      }}
      bannerExtra={
        round?.source ? (
          <p
            className="game-frame__hint game-frame__hint--source"
            data-testid="moles-source"
            data-guide="moles-source"
          >
            {t("moles.source", { source: round.source })}
          </p>
        ) : null
      }
      onKey={(event) => {
        const hole = Number(event.key) - 1;
        if (!Number.isInteger(hole) || hole < 0 || hole > 5) return false;
        whackHole(hole);
        return true;
      }}
      guide={[
        ...(round?.source ? [{ target: "moles-source", say: t("guide.moles.source") }] : []),
        { target: "question", say: t("guide.moles.question") },
        { target: "stage", say: t("guide.moles.whack") },
      ]}
      scene={(slot) => (
        <MolesScene
          session={session}
          snapshot={s}
          recipe={recipe ?? null}
          {...slot}
          describeMole={(text) => t("moles.mole", { text })}
          onWhack={(moleId) => {
            if (!slot.blocked) session.act({ type: "whack", moleId });
          }}
        />
      )}
    />
  );
}
