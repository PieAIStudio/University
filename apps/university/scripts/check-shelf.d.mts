export interface ShelfStats {
  readonly studies: number;
  readonly courses: number;
  readonly lessons: number;
}

export function checkShelfData(manifest: unknown, shelf: unknown): ShelfStats;
export function checkShelfFiles(options?: {
  readonly manifestPath?: string;
  readonly shelfPath?: string;
}): ShelfStats;
