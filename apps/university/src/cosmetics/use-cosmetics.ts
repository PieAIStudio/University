import { useEffect, useSyncExternalStore } from "react";
import { cosmeticOwner, cosmeticsStore } from "./store.js";

/** Identity/progress changes are rendered by App; stale-owned state is never
 * returned even during the render before the binding effect runs. */
export function useCosmetics() {
  const owner = cosmeticOwner();
  const snapshot = useSyncExternalStore(cosmeticsStore.subscribe, cosmeticsStore.snapshot);
  useEffect(() => {
    cosmeticsStore.bind(owner);
  }, [owner]);
  useEffect(() => {
    if (!owner) return;
    const refresh = () => {
      if (!document.hidden) void cosmeticsStore.refresh();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [owner]);
  return snapshot.owner === owner && snapshot.phase !== "closed" ? snapshot.data : null;
}
