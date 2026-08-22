export function mulberry32(seed: number): () => number;

export function makeRng(seed: number): {
  next: () => number;
  r: (a: number, b: number) => number;
  ri: (a: number, b: number) => number;
  pick: <T>(arr: readonly T[]) => T;
  chance: (p: number) => boolean;
};

export function hashStr(s: string): number;
