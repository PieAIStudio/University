import { isSafeId } from "@pieai/university-core";

/** Tab-local UI context, not account preferences or learning progress. */
export const NAVIGATION_FOCUS_KEY = "university.navigation.study";

export function readNavigationFocus(): string | undefined {
  try {
    const value = sessionStorage.getItem(NAVIGATION_FOCUS_KEY);
    return value !== null && isSafeId(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function writeNavigationFocus(studyId: string | undefined): void {
  try {
    if (studyId === undefined) sessionStorage.removeItem(NAVIGATION_FOCUS_KEY);
    else if (isSafeId(studyId)) sessionStorage.setItem(NAVIGATION_FOCUS_KEY, studyId);
  } catch {
    // Blocked browser storage must not prevent ordinary navigation.
  }
}
