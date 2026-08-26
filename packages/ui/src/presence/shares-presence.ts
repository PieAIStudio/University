/**
 * The "be seen" preference, remembered on this machine.
 *
 * Default on: a shared study group needs a visible presence. The switch still
 * has to work without a backend — refusing to be watched cannot wait on a
 * migration. The database column `study_group_members.shares_presence` is the
 * cloud copy of this same bit, and RLS only lets you change your own row;
 * until that table is deployed, localStorage is the whole store.
 *
 * Turning it off must stop sending, not just hide chips on this screen.
 * The port owns that; this file only remembers the choice across reloads.
 */
const SHARES_KEY = "university.shares-presence";

export function readSharesPresence(): boolean {
  try {
    return window.localStorage.getItem(SHARES_KEY) !== "off";
  } catch {
    return true;
  }
}

export function writeSharesPresence(next: boolean): void {
  try {
    window.localStorage.setItem(SHARES_KEY, next ? "on" : "off");
  } catch {
    // Storage disabled still gets the toggle, just not the memory.
  }
}
