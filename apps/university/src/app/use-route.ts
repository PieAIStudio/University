import { useCallback, useEffect, useState } from "react";

import { fromHash, fromPath, toPath, WORLD, type View } from "@pieai/university-core";

import { AUTHORING } from "../mode";

/**
 * A destination this build can actually answer.
 *
 * `/studio` belongs to the shared address space because the workbench is a
 * mode of one product, not a second one — but the workbench needs an authoring
 * pipeline on the other end of the address, and a delivery build has none. So
 * there the path lands on the map, which is where it landed before the two
 * campuses shared a parser and `studio` read as a study nobody has.
 *
 * One address space is not one set of screens, and this is the whole list of
 * places the two disagree. It is one line long on purpose: a second entry
 * would be a second difference, and V4 allows one.
 */
function routable(view: View): View {
  return view.kind === "studio" && !AUTHORING ? WORLD : view;
}

function canonicalLocation(view: View): string {
  // Authentication owns its callback parameters. Never race the SDK by
  // removing a still-unconsumed fragment while the learner changes screens.
  const fragment = new URLSearchParams(location.hash.slice(1));
  const authFragment = ["access_token", "refresh_token", "error", "error_code", "type"].some(
    (key) => fragment.has(key),
  )
    ? location.hash
    : "";
  return `${toPath(view)}${location.search}${authFragment}`;
}

function readLocation(): View {
  if (location.hash.startsWith("#/")) {
    const view = routable(fromHash(location.hash));
    // Fragments never reach the server, so this migration belongs here. Replace
    // rather than push: opening a saved hash link should not add a dead history
    // entry that the Back button immediately revisits.
    history.replaceState(null, "", canonicalLocation(view));
    return view;
  }
  return routable(fromPath(location.pathname));
}

export function useRoute() {
  // The address bar is the source of truth for where the learner is, so a
  // reload lands where they were and a lesson can be sent to someone.
  const [view, setViewState] = useState<View>(readLocation);
  const setView = useCallback((next: View) => {
    const nextLocation = canonicalLocation(next);
    if (`${location.pathname}${location.search}${location.hash}` !== nextLocation) {
      history.pushState(null, "", nextLocation);
    }
    setViewState(next);
  }, []);
  useEffect(() => {
    const onLocation = () => setViewState(readLocation());
    addEventListener("popstate", onLocation);
    addEventListener("hashchange", onLocation);
    return () => {
      removeEventListener("popstate", onLocation);
      removeEventListener("hashchange", onLocation);
    };
  }, []);

  return { view, setView };
}
