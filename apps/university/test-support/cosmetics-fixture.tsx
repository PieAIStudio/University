import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { GameButton } from "@pieai/swimmer-ui-kit";
import {
  CONCEPT_HEADS,
  CosmeticFailure,
  createCosmeticsStore,
  type CosmeticCommand,
  type CosmeticItem,
  type CosmeticReceipt,
  type CosmeticState,
} from "@pieai/university-core";
import {
  CosmeticsPanel,
  CosmeticAppearanceProvider,
  KnowledgeCardTile,
} from "@pieai/university-ui";
import { InterfaceLanguageProvider } from "@pieai/university-ui/i18n.js";
import { CourseScene, placeCourse, Stage } from "@pieai/university-world";
import {
  AvatarChip,
  cosmeticAvatarRecipe,
  guestAvatarRecipe,
} from "@pieai/university-world/avatar.js";
import "@pieai/swimmer-ui-kit/styles.css";
import "@pieai/university-ui/reference/term-index.css";
import "./cosmetics-fixture.css";

// A fixed transport double, never a lottery or a replacement server. This entry
// is absent from the production entry graph and sends no network/account writes.
const A = "00000000-0000-4000-8000-000000000011";
const B = "00000000-0000-4000-8000-000000000012";
const catalog: CosmeticItem[] = [
  {
    id: "avatar-flower",
    slot: "avatar",
    rarity: 0,
    duplicateFragments: 5,
    redeemCost: 50,
    inPacks: true,
  },
  {
    id: "face-harbour",
    slot: "face",
    rarity: 1,
    duplicateFragments: 15,
    redeemCost: 150,
    inPacks: true,
  },
  {
    id: "island-crystal",
    slot: "island",
    rarity: 2,
    duplicateFragments: 60,
    redeemCost: 600,
    inPacks: true,
  },
  {
    id: "back-crown",
    slot: "back",
    rarity: 3,
    duplicateFragments: 200,
    redeemCost: 2000,
    inPacks: true,
  },
];
const initial = (owner: string): CosmeticState => ({
  version: 1,
  userId: owner,
  revision: 0,
  availablePacks: owner === A ? 1 : 0,
  openedPacks: 0,
  sinceEpic: 0,
  sinceLegendary: 0,
  fragments: owner === A ? 700 : 0,
  inventory: owner === A ? { "avatar-flower": true } : {},
  equipped: {},
  catalog,
  rulesReady: true,
});
const documents = new Map<string, CosmeticState>([
  [A, initial(A)],
  [B, initial(B)],
]);
const receipts = new Map<string, CosmeticReceipt>();
const operations: CosmeticCommand[] = [];
let owner = A;
let loseResponse = new URL(location.href).searchParams.has("lost");
const pending = new Map<string, string>();
const store = createCosmeticsStore({
  currentOwner: () => owner,
  uuid: () => crypto.randomUUID(),
  schedule: (callback, delayMs) => {
    const timer = window.setTimeout(callback, delayMs);
    return () => window.clearTimeout(timer);
  },
  beforeClaim: async () => {},
  persistence: {
    read: (id, kind) => pending.get(`${id}:${kind}`) ?? null,
    write: (id, kind, value) => {
      pending.set(`${id}:${kind}`, value);
    },
    removePending: (id) => {
      pending.delete(`${id}:pending`);
    },
  },
  remote: {
    async read(id) {
      return { state: structuredClone(documents.get(id)!), result: null };
    },
    async execute(command) {
      operations.push(structuredClone(command));
      const key = `${command.owner}:${command.operationId}`;
      const saved = receipts.get(key);
      if (saved) return structuredClone(saved);
      const state = structuredClone(documents.get(command.owner)!);
      let result: CosmeticReceipt["result"];
      const action = command.action;
      if (action.kind === "open") {
        if (state.availablePacks < 1) throw new CosmeticFailure("no-pack", true);
        state.availablePacks--;
        state.openedPacks++;
        state.fragments += 5;
        state.inventory["face-harbour"] = true;
        state.inventory["back-crown"] = true;
        result = {
          kind: "open",
          packNumber: state.openedPacks,
          items: [
            { id: "back-crown", rarity: 3, duplicate: false, fragments: 0 },
            { id: "avatar-flower", rarity: 0, duplicate: true, fragments: 5 },
            { id: "face-harbour", rarity: 1, duplicate: false, fragments: 0 },
          ],
        };
      } else if (action.kind === "equip") {
        if (action.itemId === null) delete state.equipped[action.slot];
        else {
          if (
            !state.inventory[action.itemId] ||
            catalog.find((item) => item.id === action.itemId)?.slot !== action.slot
          )
            throw new CosmeticFailure("request", true);
          state.equipped[action.slot] = action.itemId;
        }
        result = { ...action };
      } else if (action.kind === "redeem") {
        const item = catalog.find((item) => item.id === action.itemId);
        if (!item || state.fragments < item.redeemCost)
          throw new CosmeticFailure("fragments", true);
        state.fragments -= item.redeemCost;
        state.inventory[item.id] = true;
        result = { ...action, spent: item.redeemCost };
      } else result = { kind: "claim", packs: 0, items: [] };
      state.revision++;
      const receipt: CosmeticReceipt = { state, result };
      documents.set(command.owner, state);
      receipts.set(key, structuredClone(receipt));
      if (action.kind === "open" && loseResponse) {
        loseResponse = false;
        throw new CosmeticFailure("network");
      }
      return structuredClone(receipt);
    },
  },
});
Object.assign(window, { __cosmeticsFixture: { operations, snapshot: store.snapshot } });
const source = { completionOf: () => ({ readConfirmed: true, exercisesPassed: true }) };
const course: Parameters<typeof placeCourse>[1] = {
  id: "run-a-real-project-with-ai",
  units: [
    {
      id: "sample",
      title: "Synthetic segment",
      lessons: Array.from({ length: 6 }, (_, index) => ({
        id: `sample-${index}`,
        title: `Synthetic level ${index + 1}`,
        content: "Synthetic layout only",
        contentRevision: 1,
        exerciseIds: [],
        exercises: [],
        cards: [],
      })),
    },
  ],
};
const lessons = placeCourse("browser-ai", course, source);
const at = lessons[0]!.position;
const head = CONCEPT_HEADS.find((head) => head.id === "prompt")!;
const card = {
  head,
  collected: true,
  starter: true,
  tier: "new" as const,
  lessons: [],
  reviewKeys: [],
  domainIds: ["ai-foundations"],
};
const base = guestAvatarRecipe();
function Fixture() {
  const [identity, setIdentity] = useState(owner);
  const [scene, setScene] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const onSceneReady = useCallback(() => setSceneReady(true), []);
  const onSceneBusy = useCallback(() => setSceneReady(false), []);
  const snapshot = useSyncExternalStore(store.subscribe, store.snapshot);
  useEffect(() => {
    store.bind(identity);
  }, [identity]);
  const data = snapshot.owner === identity ? snapshot.data : null;
  const avatar = useMemo(
    () => cosmeticAvatarRecipe(base, data?.equipped.avatar)!,
    [data?.equipped.avatar],
  );
  return (
    <main className="cosmetic-fixture">
      <p className="cosmetic-fixture__notice">
        Synthetic transport acceptance. Inventory and outcomes below are fixed test receipts, not a
        real account, server draw, learning award or production release.
      </p>
      <div className="cosmetic-fixture__controls">
        <GameButton
          static
          data-fixture-switch
          onClick={() => {
            owner = owner === A ? B : A;
            setIdentity(owner);
            store.bind(owner);
          }}
        >
          Switch synthetic account
        </GameButton>
        <GameButton static data-fixture-scene onClick={() => setScene(!scene)}>
          Toggle actual course renderer
        </GameButton>
      </div>
      <CosmeticAppearanceProvider equipped={data?.equipped}>
        <div className="cosmetic-fixture__previews">
          <AvatarChip recipe={avatar} signedIn size={128} />
          <KnowledgeCardTile card={card} onOpen={() => {}} />
        </div>
        {scene ? (
          <div className="cosmetic-fixture__scene" data-scene-ready={sceneReady}>
            <Stage
              cameraFrom={[at.x + 8, at.y + 10, at.z + 12]}
              lookAt={[at.x, at.y, at.z]}
              onSceneReady={onSceneReady}
              onSceneBusy={onSceneBusy}
            >
              <CourseScene
                lessons={lessons}
                avatarRecipe={avatar}
                avatarSignedIn
                cosmeticOrnamentId={data?.equipped.island}
                reviewDue={[]}
                onPick={() => {}}
                onHover={() => {}}
              />
            </Stage>
          </div>
        ) : null}
        <CosmeticsPanel store={store} owner={identity} onBack={() => {}} onSignIn={() => {}} />
      </CosmeticAppearanceProvider>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <InterfaceLanguageProvider locale="en">
    <Fixture />
  </InterfaceLanguageProvider>,
);
