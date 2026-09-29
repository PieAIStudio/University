import { useEffect, useSyncExternalStore } from "react";
import { GameButton, GameToast } from "@pieai/swimmer-ui-kit";
import { EmblemCeremony, EmblemImage, usePrefersReducedMotion } from "@pieai/university-world";
import { useI18n } from "@pieai/university-ui/i18n.js";
import { leagueTierName } from "@pieai/university-ui/navigation/league-tier-name.js";
import type { withRankPromotion } from "./rank-promotion.js";

/** A non-modal receipt beside the identity rail; never steals the next answer's focus. */
export function RankPromotion({
  promotions,
  owner,
}: {
  readonly promotions: ReturnType<typeof withRankPromotion>["promotions"];
  readonly owner: string | null;
}) {
  const t = useI18n();
  const reduced = usePrefersReducedMotion();
  const receipt = useSyncExternalStore(promotions.subscribe, promotions.getSnapshot);
  const current = receipt?.owner === owner ? receipt : null;
  useEffect(() => {
    if (!current) return;
    const timer = window.setTimeout(() => promotions.dismiss(current.key), 5000);
    return () => window.clearTimeout(timer);
  }, [current?.key, promotions]);
  if (!current) return null;
  const label = t.t("album.promotion", { rank: leagueTierName(current.tier) });
  return (
    <aside className="rank-promotion" data-rank-promotion={current.tier.id}>
      <GameToast tone="success">
        <p role="status">{label}</p>
        {reduced ? (
          <EmblemImage kind="rank" id={current.tier.id} size={144} />
        ) : (
          <EmblemCeremony
            key={current.key}
            tierId={current.tier.id}
            play
            label={label}
            size={144}
          />
        )}
        <GameButton variant="ghost" static onClick={() => promotions.dismiss(current.key)}>
          {t.t("album.promotionClose")}
        </GameButton>
      </GameToast>
    </aside>
  );
}
