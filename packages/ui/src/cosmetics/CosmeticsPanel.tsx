import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  GameButton,
  GameCollectibleCard,
  GameModal,
  GamePanel,
  type GameCollectibleCardRarity,
} from "@pieai/swimmer-ui-kit";
import {
  COSMETIC_SLOTS,
  COSMETIC_PACK_RULES,
  type CosmeticAction,
  type CosmeticDrop,
  type CosmeticItem,
  type CosmeticResult,
  type CosmeticSlot,
  type CosmeticsStore,
} from "@pieai/university-core";
import { useI18n } from "../i18n/index.js";
import { COSMETIC_NAMES, cosmeticArt, knownCosmetic } from "./appearance.js";
import "./cosmetics.css";

const rarityName = [
  "cosmetics.common",
  "cosmetics.rare",
  "cosmetics.epic",
  "cosmetics.legendary",
] as const;
const frame = (rarity: number): GameCollectibleCardRarity =>
  rarity === 3 ? "legendary" : rarity > 0 ? "rare" : "common";
function PackReveal({
  items,
  sound,
  onClose,
}: {
  readonly items: readonly CosmeticDrop[];
  readonly sound: boolean;
  readonly onClose: () => void;
}) {
  const t = useI18n();
  const ordered = useMemo(() => [...items].sort((a, b) => a.rarity - b.rarity), [items]);
  const [index, setIndex] = useState(0);
  const [down, setDown] = useState(true);
  const item = ordered[index]!;
  const title = knownCosmetic(item.id) ? t.t(COSMETIC_NAMES[item.id]) : item.id;
  return (
    <GameModal open title={t.t("cosmetics.revealTitle")} onClose={onClose}>
      <div className="cosmetic-reveal" data-cosmetic-reveal={index}>
        <p role="status">
          {t.t("cosmetics.revealPosition", { number: index + 1, total: ordered.length })}
        </p>
        <GameCollectibleCard
          key={index}
          rarity={frame(item.rarity)}
          title={title}
          rarityLabel={t.t(rarityName[item.rarity]!)}
          setLabel={t.t("cosmetics.cosmeticOnly")}
          art={<img className="cosmetic-art" src={cosmeticArt(item.id)} alt="" draggable={false} />}
          label={t.t("cosmetics.flip", { title })}
          faceDown={down}
          onFlip={setDown}
          spotlight={!down && index === ordered.length - 1 && item.rarity >= 2}
          sound={sound}
        />
        {down ? (
          <p>{t.t("cosmetics.tapCard")}</p>
        ) : (
          <>
            <p>
              {item.duplicate
                ? t.t("cosmetics.duplicate", { count: item.fragments })
                : t.t("cosmetics.newItem")}
            </p>
            <GameButton
              static
              onClick={() => {
                if (index + 1 === ordered.length) onClose();
                else {
                  setIndex(index + 1);
                  setDown(true);
                }
              }}
            >
              {t.t(index + 1 === ordered.length ? "cosmetics.keep" : "cosmetics.next")}
            </GameButton>
          </>
        )}
      </div>
    </GameModal>
  );
}
function ResultNote({ result }: { readonly result: CosmeticResult | null }) {
  const t = useI18n();
  if (!result || result.kind === "open") return null;
  return (
    <p role="status" data-cosmetic-receipt>
      {result.kind === "claim"
        ? t.t("cosmetics.claimed", { count: result.packs, items: result.items.length })
        : result.kind === "equip"
          ? t.t("cosmetics.equippedSaved")
          : t.t("cosmetics.redeemed")}
    </p>
  );
}
/** The inventory is server-owned; this surface has no reward/RNG implementation. */
export function CosmeticsPanel({
  store,
  owner,
  onSignIn,
  onBack,
  avatar,
  sound = false,
}: {
  readonly store: CosmeticsStore;
  readonly owner: string | null;
  readonly onSignIn: () => void;
  readonly onBack: () => void;
  readonly avatar?: ReactNode;
  readonly sound?: boolean;
}) {
  const t = useI18n();
  const snapshot = useSyncExternalStore(store.subscribe, store.snapshot);
  const [filter, setFilter] = useState<CosmeticSlot | "all">("all");
  const own = snapshot.owner === owner;
  const data = own ? snapshot.data : null;
  const ready = own && owner !== null && snapshot.phase !== "closed" && data !== null;
  const disabled =
    !ready || snapshot.busy || snapshot.pending !== null || snapshot.error === "storage";
  // An event held across logout must not act on the replacement account.
  const currentOwner = () => owner !== null && store.snapshot().owner === owner;
  const act = (action: CosmeticAction) => {
    if (currentOwner()) void store.act(action);
  };
  const retry = () => {
    if (currentOwner()) void store.retry();
  };
  const closeResult = () => {
    if (currentOwner() && store.snapshot().result === snapshot.result) store.dismissResult();
  };
  const titleOf = (item: CosmeticItem) =>
    knownCosmetic(item.id) ? t.t(COSMETIC_NAMES[item.id]) : item.id;
  return (
    <section className="cosmetics-panel" data-cosmetics-phase={snapshot.phase}>
      <GameButton variant="ghost" static onClick={onBack}>
        {t.t("cosmetics.back")}
      </GameButton>
      <header>
        <h1>{t.t("cosmetics.title")}</h1>
        <p>{t.t("cosmetics.intro")}</p>
      </header>
      {avatar && ready ? (
        <div className="cosmetics-avatar">
          {avatar}
          <p>{t.t("cosmetics.avatarExplanation")}</p>
        </div>
      ) : null}
      <GamePanel>
        <h2>{t.t("cosmetics.packs")}</h2>
        {snapshot.phase === "closed" ? (
          <p role="status">{t.t("cosmetics.closed")}</p>
        ) : !owner ? (
          <>
            <p>{t.t("cosmetics.signInReason")}</p>
            <GameButton static onClick={onSignIn}>
              {t.t("cosmetics.signIn")}
            </GameButton>
          </>
        ) : data ? (
          <>
            <p data-cosmetic-balance>
              {t.t("cosmetics.balance", { count: data.availablePacks, fragments: data.fragments })}
            </p>
            {snapshot.cached ? <p>{t.t("cosmetics.cached")}</p> : null}
            {!data.rulesReady ? <p>{t.t("cosmetics.rulesNotReady")}</p> : null}
            <p>
              {t.t("cosmetics.pity", {
                epic: COSMETIC_PACK_RULES.epicWithin - data.sinceEpic,
                legendary: COSMETIC_PACK_RULES.legendaryWithin - data.sinceLegendary,
              })}
            </p>
            <div className="cosmetics-actions">
              <GameButton
                static
                disabled={disabled || data.availablePacks === 0}
                onClick={() => act({ kind: "open" })}
                data-cosmetic-open
              >
                {t.t("cosmetics.open")}
              </GameButton>
              <GameButton
                variant="secondary"
                static
                disabled={disabled}
                onClick={() => act({ kind: "claim" })}
                data-cosmetic-claim
              >
                {t.t("cosmetics.claim")}
              </GameButton>
            </div>
          </>
        ) : (
          <p role="status">{t.t("cosmetics.loading")}</p>
        )}
        <p>{t.t("cosmetics.sources")}</p>
        {own && snapshot.error ? (
          <p role="alert" data-cosmetic-error={snapshot.error}>
            {t.t(`cosmetics.error.${snapshot.error}`)}
          </p>
        ) : null}
        {own && snapshot.pending ? <p>{t.t("cosmetics.pending")}</p> : null}
        {owner && snapshot.phase !== "closed" ? (
          <GameButton
            variant="ghost"
            static
            disabled={snapshot.busy}
            onClick={retry}
            data-cosmetic-retry
          >
            {t.t(snapshot.pending ? "cosmetics.retryOperation" : "cosmetics.refresh")}
          </GameButton>
        ) : null}
        <ResultNote result={own ? snapshot.result : null} />
      </GamePanel>
      <GamePanel>
        <h2>{t.t("cosmetics.oddsTitle")}</h2>
        <p>{t.t("cosmetics.odds", { count: COSMETIC_PACK_RULES.items })}</p>
        <dl className="cosmetic-odds">
          {COSMETIC_PACK_RULES.baseOdds.map((value, index) => (
            <div key={index}>
              <dt>{t.t(rarityName[index]!)}</dt>
              <dd>{t.number(value / 100, { style: "percent" })}</dd>
            </div>
          ))}
        </dl>
        <p>{t.t("cosmetics.oddsDetail")}</p>
        <p>{t.t("cosmetics.guarantees")}</p>
        <p>{t.t("cosmetics.noPurchase")}</p>
      </GamePanel>
      {ready && data ? (
        <section aria-label={t.t("cosmetics.collection")}>
          <h2>{t.t("cosmetics.collection")}</h2>
          <div className="cosmetics-actions" role="group" aria-label={t.t("cosmetics.filter")}>
            {(["all", ...COSMETIC_SLOTS] as const).map((id) => (
              <GameButton
                key={id}
                variant="ghost"
                static
                aria-pressed={filter === id}
                onClick={() => setFilter(id)}
              >
                {t.t(`cosmetics.slot.${id}`)}
              </GameButton>
            ))}
          </div>
          <ul className="cosmetic-grid">
            {data.catalog
              .filter((item) => filter === "all" || filter === item.slot)
              .map((item) => {
                const owned = Object.hasOwn(data.inventory, item.id);
                const worn = data.equipped[item.slot] === item.id;
                const title = titleOf(item);
                return (
                  <li
                    key={item.id}
                    data-cosmetic-item={item.id}
                    data-cosmetic-owned={owned}
                    data-cosmetic-equipped={worn}
                  >
                    <GamePanel>
                      <img
                        className="cosmetic-art"
                        src={cosmeticArt(item.id)}
                        alt=""
                        loading="lazy"
                      />
                      <h3>{title}</h3>
                      <p>
                        {t.t(`cosmetics.slot.${item.slot}`)} · {t.t(rarityName[item.rarity]!)}
                      </p>
                      {owned ? (
                        <GameButton
                          static
                          disabled={disabled || !knownCosmetic(item.id)}
                          onClick={() =>
                            act({ kind: "equip", slot: item.slot, itemId: worn ? null : item.id })
                          }
                        >
                          {t.t(worn ? "cosmetics.takeOff" : "cosmetics.wear")}
                        </GameButton>
                      ) : item.inPacks ? (
                        <GameButton
                          variant="secondary"
                          static
                          disabled={
                            disabled || data.fragments < item.redeemCost || !knownCosmetic(item.id)
                          }
                          onClick={() => act({ kind: "redeem", itemId: item.id })}
                        >
                          {t.t("cosmetics.exchange", { count: item.redeemCost })}
                        </GameButton>
                      ) : (
                        <p>
                          {t.t(
                            item.id === "back-set-crown"
                              ? "cosmetics.shiningSetReward"
                              : "cosmetics.setReward",
                          )}
                        </p>
                      )}
                    </GamePanel>
                  </li>
                );
              })}
          </ul>
        </section>
      ) : null}
      {own && snapshot.result?.kind === "open" ? (
        <PackReveal
          key={snapshot.result.packNumber}
          items={snapshot.result.items}
          sound={sound}
          onClose={closeResult}
        />
      ) : null}
    </section>
  );
}
