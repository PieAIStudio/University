import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { View } from "@pieai/university-core";
import type { PlanetStudy } from "@pieai/university-world/planet.js";
import { mapDomainCatalog, studyForMapDomain } from "./map-domain-catalog";

interface PlanetChoiceOptions {
  readonly planetStudies: readonly PlanetStudy[];
  readonly focusedStudyId: string | null;
  readonly viewKind: View["kind"];
  readonly setNavigationFocus: (studyId: string) => void;
  readonly setView: (next: View) => void;
}

/**
 * What the learner is browsing on the planet. Browsing an empty domain changes
 * the planet focus, never the study/account selection. Both DOM and globe
 * consume this one transient selection owner.
 */
export function usePlanetChoice({
  planetStudies,
  focusedStudyId,
  viewKind,
  setNavigationFocus,
  setView,
}: PlanetChoiceOptions) {
  const catalog = useMemo(() => mapDomainCatalog(), []);
  const [domainId, setDomainId] = useState<string | null>(null);
  const [studyId, setStudyId] = useState<string | null>(null);
  const lastStudyByDomain = useRef(new Map<string, string>());
  const focusedDomainId =
    planetStudies.find((study) => study.id === focusedStudyId)?.domain?.id ??
    (focusedStudyId ? "unclassified" : "programming");
  useEffect(() => {
    if (focusedStudyId) lastStudyByDomain.current.set(focusedDomainId, focusedStudyId);
    if (viewKind !== "planet") {
      setDomainId(null);
      setStudyId(null);
    }
  }, [focusedDomainId, focusedStudyId, viewKind]);
  const selectDomain = useCallback(
    (next: string) => {
      if (
        !catalog.some((domain) => domain.id === next) &&
        !planetStudies.some((study) => (study.domain?.id ?? "unclassified") === next)
      )
        return;
      const restored = studyForMapDomain(
        next,
        planetStudies,
        focusedStudyId,
        lastStudyByDomain.current.get(next),
      );
      setDomainId(next);
      setStudyId(null);
      if (restored) setNavigationFocus(restored);
    },
    [focusedStudyId, catalog, planetStudies],
  );
  const selectStudy = useCallback(
    (next: string) => {
      const study = planetStudies.find((entry) => entry.id === next);
      if (!study) return;
      lastStudyByDomain.current.set(study.domain?.id ?? "unclassified", next);
      setDomainId(study.domain?.id ?? "unclassified");
      setStudyId(next);
      setNavigationFocus(next);
    },
    [planetStudies],
  );
  const clear = useCallback(() => {
    setDomainId(null);
    setStudyId(null);
  }, []);
  /** Only a study with lessons is a place to land. */
  const enterStudy = (next: string) => {
    if (!planetStudies.some((study) => study.id === next && study.lessonCount > 0)) return;
    setNavigationFocus(next);
    setView({ kind: "world" });
  };
  return {
    catalog,
    domainId,
    studyId,
    selectedDomain: catalog.find((domain) => domain.id === domainId),
    selectedStudy: planetStudies.find((study) => study.id === studyId),
    selectDomain,
    selectStudy,
    clear,
    enterStudy,
  };
}
