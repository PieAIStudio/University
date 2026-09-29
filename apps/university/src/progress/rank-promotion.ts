import { leagueStanding, type LeagueTier, type ProgressPort } from "@pieai/university-core";

export interface RankPromotionReceipt {
  readonly key: number;
  readonly owner: string | null;
  readonly tier: LeagueTier;
}

/** Presentation receipts for an actual local rating, not a rank database.
 * Loading, cloud merging and importing an old card cannot trigger a ceremony.
 * The shared progress port still performs the sole scheduler write. */
export function withRankPromotion(source: ProgressPort) {
  let owner = source.syncState().userId;
  let highest = leagueStanding(source.snapshot(), Date.now()).tier.at;
  let receipt: RankPromotionReceipt | null = null;
  let serial = 0;
  const listeners = new Set<() => void>();
  const publish = () => {
    // A listener may subscribe/unsubscribe while handling a receipt. Deliver
    // to the original audience only, not a live Set that can grow mid-pass.
    const recipients = [...listeners];
    for (const listener of recipients) {
      try {
        listener();
      } catch {
        /* A presentation observer cannot break a rating. */
      }
    }
  };
  const resetScope = () => {
    const next = source.syncState().userId;
    if (owner === next) return;
    owner = next;
    highest = leagueStanding(source.snapshot(), Date.now()).tier.at;
    receipt = null;
    publish();
  };
  const stop = source.subscribe(resetScope);
  const progress: ProgressPort = {
    ...source,
    resetAll() {
      source.resetAll();
      highest = leagueStanding(source.snapshot(), Date.now()).tier.at;
      receipt = null;
      publish();
    },
    gradeCard(key, rating) {
      resetScope();
      const startedFor = owner;
      const before = leagueStanding(source.snapshot(), Date.now()).tier;
      source.gradeCard(key, rating);
      if (source.syncState().userId !== startedFor) {
        resetScope();
        return;
      }
      const after = leagueStanding(source.snapshot(), Date.now()).tier;
      highest = Math.max(highest, before.at);
      if (after.at <= highest) return;
      highest = after.at;
      receipt = Object.freeze({ key: ++serial, owner, tier: after });
      publish();
    },
  };
  return {
    progress,
    promotions: {
      getSnapshot: () => receipt,
      subscribe(listener: () => void) {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      dismiss(key: number) {
        if (receipt?.key !== key || receipt.owner !== source.syncState().userId) return;
        receipt = null;
        publish();
      },
      dispose() {
        stop();
        receipt = null;
        listeners.clear();
      },
    },
  };
}
