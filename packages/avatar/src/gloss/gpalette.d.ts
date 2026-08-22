export const PALETTES: readonly {
  id: string;
  label: string;
  colors: readonly string[];
}[];

export const PALETTE_IDS: readonly string[];
export const PALETTE_DEAL_IDS: readonly string[];
export const PALETTE_BY_ID: Record<string, { id: string; label: string; colors: readonly string[] }>;
