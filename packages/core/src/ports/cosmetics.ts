import { z } from "zod";

/** Display/transport contract only. Randomness, pity, inventory and spending
 * belong to SwimmerBackend; there is no local random fallback. */
export const COSMETIC_SLOTS = ["face", "back", "avatar", "island"] as const;
export const COSMETIC_PACK_RULES = Object.freeze({
  items: 3,
  baseOdds: [70, 22, 7, 1] as const,
  epicWithin: 10,
  legendaryWithin: 50,
});
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const itemId = z.string().regex(/^[a-z][a-z0-9-]{0,79}$/);
const slot = z.enum(COSMETIC_SLOTS);
export const CosmeticItemSchema = z.strictObject({
  id: itemId,
  slot,
  rarity: z.number().int().min(0).max(3),
  duplicateFragments: integer.positive(),
  redeemCost: integer.positive(),
  inPacks: z.boolean(),
});
export type CosmeticItem = z.infer<typeof CosmeticItemSchema>;
export type CosmeticSlot = (typeof COSMETIC_SLOTS)[number];
export const CosmeticStateSchema = z
  .strictObject({
    version: z.literal(1),
    userId: z.uuid(),
    revision: integer,
    availablePacks: integer,
    openedPacks: integer,
    sinceEpic: integer.max(9),
    sinceLegendary: integer.max(49),
    fragments: integer,
    inventory: z.record(itemId, z.literal(true)),
    equipped: z.partialRecord(slot, itemId),
    catalog: z.array(CosmeticItemSchema).min(1).max(256),
    rulesReady: z.boolean(),
  })
  .superRefine((state, context) => {
    const items = new Map(state.catalog.map((item) => [item.id, item]));
    if (
      items.size !== state.catalog.length ||
      state.catalog.some((item) => item.redeemCost <= item.duplicateFragments)
    )
      context.addIssue({ code: "custom", message: "invalid cosmetic catalog" });
    for (const id of Object.keys(state.inventory))
      if (!items.has(id)) context.addIssue({ code: "custom", message: "unknown inventory item" });
    for (const [at, id] of Object.entries(state.equipped))
      if (!id || !Object.hasOwn(state.inventory, id) || items.get(id)?.slot !== at)
        context.addIssue({ code: "custom", message: "invalid equipped item" });
  });
export type CosmeticState = z.infer<typeof CosmeticStateSchema>;
export const CosmeticDropSchema = z.strictObject({
  id: itemId,
  rarity: z.number().int().min(0).max(3),
  duplicate: z.boolean(),
  fragments: integer,
});
export type CosmeticDrop = z.infer<typeof CosmeticDropSchema>;
export const CosmeticResultSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("claim"), packs: integer, items: z.array(itemId) }),
  z.strictObject({
    kind: z.literal("open"),
    packNumber: integer.positive(),
    items: z.array(CosmeticDropSchema).length(3),
  }),
  z.strictObject({ kind: z.literal("redeem"), itemId, spent: integer.positive() }),
  z.strictObject({ kind: z.literal("equip"), slot, itemId: itemId.nullable() }),
]);
export type CosmeticResult = z.infer<typeof CosmeticResultSchema>;
export const CosmeticReceiptSchema = z.strictObject({
  state: CosmeticStateSchema,
  result: CosmeticResultSchema.nullable(),
});
export type CosmeticReceipt = z.infer<typeof CosmeticReceiptSchema>;
export const CosmeticActionSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("claim") }),
  z.strictObject({ kind: z.literal("open") }),
  z.strictObject({ kind: z.literal("redeem"), itemId }),
  z.strictObject({ kind: z.literal("equip"), slot, itemId: itemId.nullable() }),
]);
export type CosmeticAction = z.infer<typeof CosmeticActionSchema>;
export const CosmeticCommandSchema = z.strictObject({
  version: z.literal(1),
  owner: z.uuid(),
  operationId: z.uuid(),
  action: CosmeticActionSchema,
});
export type CosmeticCommand = z.infer<typeof CosmeticCommandSchema>;
export type CosmeticFailureKind =
  | "network"
  | "unavailable"
  | "identity"
  | "request"
  | "no-pack"
  | "fragments"
  | "capacity"
  | "storage"
  | "save-first"
  | "invalid-response";
export class CosmeticFailure extends Error {
  constructor(
    readonly kind: CosmeticFailureKind,
    readonly definitive = false,
  ) {
    super(kind);
  }
}
export interface CosmeticsRemote {
  read(owner: string): Promise<unknown>;
  execute(command: CosmeticCommand): Promise<unknown>;
}
/** Validate before painting or clearing the pending command. A broken response
 * is still an uncertain mutation, never permission to consume another pack. */
export function readCosmeticReceipt(
  value: unknown,
  owner: string,
  action?: CosmeticAction,
): CosmeticReceipt {
  const parsed = CosmeticReceiptSchema.safeParse(value);
  if (!parsed.success) throw new CosmeticFailure("invalid-response");
  const receipt = parsed.data;
  if (receipt.state.userId !== owner) throw new CosmeticFailure("identity");
  if (action && receipt.result?.kind !== action.kind) throw new CosmeticFailure("invalid-response");
  if (!action && receipt.result !== null) throw new CosmeticFailure("invalid-response");
  if (
    action?.kind === "redeem" &&
    receipt.result?.kind === "redeem" &&
    (receipt.result.itemId !== action.itemId ||
      receipt.result.spent !==
        receipt.state.catalog.find((item) => item.id === action.itemId)?.redeemCost)
  )
    throw new CosmeticFailure("invalid-response");
  if (
    action?.kind === "equip" &&
    receipt.result?.kind === "equip" &&
    (receipt.result.itemId !== action.itemId || receipt.result.slot !== action.slot)
  )
    throw new CosmeticFailure("invalid-response");
  if (receipt.result?.kind === "open") {
    if (receipt.result.packNumber > receipt.state.openedPacks)
      throw new CosmeticFailure("invalid-response");
    for (const drop of receipt.result.items) {
      const item = receipt.state.catalog.find((entry) => entry.id === drop.id);
      if (
        !item?.inPacks ||
        item.rarity !== drop.rarity ||
        !Object.hasOwn(receipt.state.inventory, drop.id) ||
        drop.fragments !== (drop.duplicate ? item.duplicateFragments : 0)
      )
        throw new CosmeticFailure("invalid-response");
    }
  }
  if (
    receipt.result?.kind === "claim" &&
    receipt.result.items.some((id) => !Object.hasOwn(receipt.state.inventory, id))
  )
    throw new CosmeticFailure("invalid-response");
  return receipt;
}
