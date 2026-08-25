import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { CatalogSurface } from "@pieai/university-ui";
import type { Shelf } from "@pieai/university-ui/content/port.js";
import { progressSourceOf, toHash, WORLD, type View } from "@pieai/university-core";

import { contentPort } from "../ports";
import { progressPort, snapshot, subscribe } from "../progress/store";
import { assembleCatalogListingFromShelf } from "./listing";

/** The content port supplies the shelf; the shared catalog surface supplies the UI. */
export function CourseCatalog({ onOpen }: { onOpen: (view: View) => void }) {
  const progress = useSyncExternalStore(subscribe, snapshot);
  const [shelf, setShelf] = useState<Shelf | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const next = await contentPort.shelf();
        if (alive) setShelf(next);
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const listing = useMemo(
    () => (shelf ? assembleCatalogListingFromShelf(shelf, progressSourceOf(progressPort)) : null),
    [shelf, progress],
  );

  if (failed) {
    return (
      <div className="catalog">
        <div className="catalog__inner">
          <h1>目录</h1>
          <p>课程目录读不出来。刷新这一页再试。</p>
          <button type="button" className="linkish" onClick={() => onOpen(WORLD)}>
            在地图上看
          </button>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="catalog" aria-busy="true">
        <div className="catalog__inner">
          <h1>目录</h1>
          <p>正在读入课程目录。</p>
        </div>
      </div>
    );
  }

  return (
    <CatalogSurface
      listing={listing}
      onBack={() => onOpen(WORLD)}
      onOpenLesson={(lesson) => onOpen({ kind: "lesson", ...lesson })}
      lessonHref={(lesson) => toHash({ kind: "lesson", ...lesson })}
    />
  );
}
