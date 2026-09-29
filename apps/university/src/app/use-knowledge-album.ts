import { useCallback, useMemo } from "react";
import {
  CONCEPT_HEADS,
  knowledgeAlbum,
  type AlbumCourse,
  type ProgressDocument,
  type ProgressPort,
  type ProgressSource,
} from "@pieai/university-core";
import type { Shelf } from "@pieai/university-ui/content/port.js";
import { mapDomainForStudy } from "./map-domain-catalog.js";

/** Both shelves already carry the links; no catalogue-wide lesson fetch. */
export function useKnowledgeAlbum(
  shelf: Shelf | null,
  progress: ProgressPort,
  source: ProgressSource,
  document: ProgressDocument,
) {
  const courses = useMemo<readonly AlbumCourse[]>(
    () =>
      (shelf?.studies ?? []).flatMap((study) =>
        study.courses.map((course) => ({
          ...course,
          studyId: study.id,
          domainId: mapDomainForStudy(study.id).id,
        })),
      ),
    [shelf],
  );
  const read = useCallback(
    () => (shelf ? knowledgeAlbum(CONCEPT_HEADS, courses, source, progress.snapshot()) : null),
    [shelf, courses, source, progress],
  );
  const album = useMemo(
    () => read() ?? knowledgeAlbum(CONCEPT_HEADS, [], source, document),
    [read, document, source],
  );
  return { album, read };
}
