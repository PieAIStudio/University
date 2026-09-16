import type { interactionLessonIssues } from "@pieai/university-core/domain/schemas.js";

export interface LessonSpineIssue {
  readonly item: number;
  readonly message: string;
}

export const LESSON_VARIANTS: Readonly<
  Record<
    "现象" | "对比" | "溯源" | "决策" | "术语",
    {
      readonly openCount: number;
      readonly middleCount: number;
      readonly boundary?: string;
    }
  >
>;

export function lessonProseWithoutLinkDestinations(text: string): string;
export function stripLessonCode(text: string): string;
export function checkLessonSpine(
  content: string | undefined,
  variant: string | null | undefined,
  options?: {
    readonly allowLegacyGuessLine?: boolean;
    readonly interactionLesson?: Parameters<typeof interactionLessonIssues>[0];
  },
): LessonSpineIssue[];
export function checkLessonUrlEvidence(
  content: string,
  evidence: readonly { readonly sourceUrl?: string }[],
): LessonSpineIssue[];
