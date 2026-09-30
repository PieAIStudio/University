import type { LinkRound } from "@pieai/university-core";
import type { AvatarRecipe } from "@pieai/university-world/avatar.js";
import { LinksScene, LinksSession } from "@pieai/university-world/game-kit.js";
import { ClockMeter } from "@pieai/university-ui/game-frame/index.js";
import { useI18n } from "@pieai/university-ui/i18n.js";
import { useMemo, useState, useSyncExternalStore } from "react";

import { RoundGameShell } from "./RoundGameShell.js";

/**
 * 连连看, assembled (ADR-0011, assembly layer): a lesson's `connect` links as
 * stepping stones, the shell around them. The map's challenge node and the
 * play lab both render this; neither keeps a copy.
 */
export interface LinksGameProps {
  readonly rounds: readonly LinkRound[];
  readonly recipe?: AvatarRecipe | null;
  readonly onClose?: () => void;
  readonly onOpenLesson?: (lessonId: string) => void;
  readonly onUnavailable?: () => void;
  readonly onPlain?: () => void;
  readonly onWon?: () => void;
}

export function LinksGame(props: LinksGameProps) {
  const [run, setRun] = useState(0);
  return (
    <LinksRun key={run} {...props} seed={1 + run * 7919} onAgain={() => setRun((n) => n + 1)} />
  );
}

function LinksRun({
  rounds,
  recipe,
  seed,
  onAgain,
  ...host
}: LinksGameProps & { seed: number; onAgain: () => void }) {
  const { t } = useI18n();
  const session = useMemo(() => new LinksSession(rounds, seed), [rounds, seed]);
  const s = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const round = s.rounds[s.roundIndex]?.round ?? null;
  const label = (source: LinkRound | null, nodeId: string) =>
    source?.nodes.find((node) => node.id === nodeId)?.label ?? "";
  const picked = s.picked ? label(round, s.picked) : null;

  return (
    <RoundGameShell
      session={session}
      name="links"
      copy={{
        title: t("links.title"),
        intro: t("links.intro"),
        calm: t("links.calm"),
      }}
      onAgain={onAgain}
      {...host}
      briefing={(source) => {
        const brief = (source as LinkRound).brief;
        return brief ? { note: brief } : {};
      }}
      resultLine={(source, itemId) => {
        const links = source as LinkRound;
        const edge = links.items.find((candidate) => candidate.id === itemId);
        if (!edge) return null;
        return {
          text: t("links.pair", { from: label(links, edge.from), to: label(links, edge.to) }),
          bin: "",
          binIndex: 0,
          why: edge.why,
        };
      }}
      noticeReason={(notice) => {
        const edge = session.edgeOf(notice.itemId);
        return edge
          ? t("links.reason", {
              from: label(round, edge.from),
              to: label(round, edge.to),
              why: notice.reason,
            })
          : notice.reason;
      }}
      bannerExtra={
        s.open.length ? (
          <>
            <div data-guide="links-tide">
              <ClockMeter fraction={s.window ? s.tide / s.window : 1} label={t("links.tide")} />
            </div>
            <p className="game-frame__hint" data-testid="links-picked" data-guide="links-hint">
              {picked ? t("links.picked", { label: picked }) : t("links.pickFirst")}
            </p>
          </>
        ) : null
      }
      {...(picked ? { idleLive: t("links.picked", { label: picked }) } : {})}
      guide={[
        { target: "question", say: t("guide.links.question") },
        { target: "links-stone", say: t("guide.links.pick"), act: true },
        { target: "links-hint", say: t("guide.links.pair") },
        { target: "links-tide", say: t("guide.links.tide") },
      ]}
      scene={(slot) => (
        <LinksScene
          session={session}
          snapshot={s}
          recipe={recipe ?? null}
          {...slot}
          describeStone={(text, isPicked, done) =>
            done
              ? t("links.stoneDone", { label: text })
              : isPicked
                ? t("links.stonePicked", { label: text })
                : t("links.stone", { label: text })
          }
          onPick={(nodeId) => {
            if (!slot.blocked) session.act({ type: "pick", nodeId });
          }}
        />
      )}
    />
  );
}
