import { useEffect, useState } from "react";

/** One local calendar clock for the always-mounted journey. A sleeping tab
 * catches up on focus; a day change renders presentation, never progress. */
export function useLocalDay(): number {
  const [, setNow] = useState(Date.now);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      const time = Date.now();
      setNow(time);
      const next = new Date(time);
      next.setHours(24, 0, 0, 0);
      clearTimeout(timer);
      timer = setTimeout(update, Math.max(1, next.getTime() - time + 1));
    };
    const visible = () => {
      if (document.visibilityState === "visible") update();
    };
    update();
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  // Ordinary progress renders must also see lessons finished after mount.
  return Date.now();
}
