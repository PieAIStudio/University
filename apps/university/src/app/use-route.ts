import { useCallback, useEffect, useState } from "react";

import { fromHash, toHash, WORLD, type View } from "@pieai/university-core";

import { AUTHORING } from "../mode";

/**
 * A destination this build can actually answer.
 *
 * `#/studio` belongs to the shared address space because the workbench is a
 * mode of one product, not a second one — but the workbench needs an authoring
 * pipeline on the other end of the address, and a delivery build has none. So
 * there the hash lands on the map, which is where it landed before the two
 * campuses shared a parser and `studio` read as a study nobody has.
 *
 * One address space is not one set of screens, and this is the whole list of
 * places the two disagree. It is one line long on purpose: a second entry
 * would be a second difference, and V4 allows one.
 */
function routable(view: View): View {
  return view.kind === "studio" && !AUTHORING ? WORLD : view;
}

export function useRoute() {
  // The address bar is the source of truth for where the learner is, so a
  // reload lands where they were and a lesson can be sent to someone.
  const [view, setViewState] = useState<View>(() => routable(fromHash(location.hash)));
  const setView = useCallback((next: View) => {
    if (toHash(next) !== location.hash) history.pushState(null, "", toHash(next));
    setViewState(next);
  }, []);
  useEffect(() => {
    const onHash = () => setViewState(routable(fromHash(location.hash)));
    addEventListener("popstate", onHash);
    addEventListener("hashchange", onHash);
    return () => {
      removeEventListener("popstate", onHash);
      removeEventListener("hashchange", onHash);
    };
  }, []);

  return { view, setView };
}
