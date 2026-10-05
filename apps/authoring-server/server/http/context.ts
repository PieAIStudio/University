import { randomBytes } from "node:crypto";
import { existsSync, statSync } from "node:fs";

import { HttpError } from "./errors.js";
import { SqliteLearningStore } from "../learning/sqlite-learning-store.js";
import { selectLexicon } from "../language/lexicon.js";
import {
  VocabularyStore,
  getVocabularyDatabasePath,
  type VocabularyState,
} from "../language/vocabulary-store.js";
import { getStudyPaths } from "../studies/paths.js";

interface OpenLearningStore {
  readonly store: SqliteLearningStore;
  /** `dev:ino` of the file this store opened, so a swapped file is detectable. */
  readonly fileId: string;
}

export interface ServerContext {
  readonly studiesRoot: string;
  readonly requestToken: string;
  readonly getStore: (studyId: string, create?: boolean) => SqliteLearningStore | null;
  readonly getVocabulary: () => VocabularyStore;
  readonly peekVocabularyStates: () => readonly VocabularyState[];
  readonly assertKnownSense: (senseId: string) => void;
}

type RunnableServerContext = ServerContext & {
  readonly close: () => void;
};

export function createServerContext(studiesRoot: string): RunnableServerContext {
  const requestToken = randomBytes(32).toString("base64url");
  const stores = new Map<string, OpenLearningStore>();

  /**
   * Identity of the file behind a path, not the path itself. `learner restore`
   * and `learner reset` install a database by renaming a new file over the old
   * one; on POSIX the old inode stays alive for anyone still holding it open.
   * Without this check the server kept serving — and writing to — a database
   * that had already been replaced, so everything the learner did after a
   * restore landed in an unlinked file nobody would ever read again.
   * `assertQuiescent` in the restore workflow cannot catch this: it looks for
   * active transactions, and an idle open connection has none.
   */
  const databaseIdentity = (path: string): string | null => {
    try {
      const stats = statSync(path);
      return `${stats.dev}:${stats.ino}`;
    } catch {
      return null;
    }
  };

  const getStore = (studyId: string, create = false): SqliteLearningStore | null => {
    const path = getStudyPaths(studiesRoot, studyId).learner.database;
    const identity = databaseIdentity(path);
    const open = stores.get(studyId);
    if (open) {
      if (identity !== null && identity === open.fileId) return open.store;
      try {
        open.store.close();
      } catch {
        // Already closed, or closed under us. Dropping the handle is the point.
      }
      stores.delete(studyId);
    }
    if (!create && identity === null) return null;
    const store = new SqliteLearningStore(path);
    const openedId = databaseIdentity(path);
    if (openedId !== null) stores.set(studyId, { store, fileId: openedId });
    return store;
  };

  // Opened on first use rather than at boot: a campus where nobody has turned
  // English mode on should not create a database to hold nothing.
  let vocabulary: VocabularyStore | null = null;
  const getVocabulary = (): VocabularyStore => {
    vocabulary ??= new VocabularyStore(getVocabularyDatabasePath(studiesRoot));
    return vocabulary;
  };

  /**
   * Learner word states for read-only use, without bringing the database into
   * existence. Opening a lesson must not create a vocabulary database: a
   * learner who has never turned the mode on has no states, and "no states" and
   * "empty database" have to stay distinguishable on disk.
   */
  const peekVocabularyStates = (): readonly VocabularyState[] => {
    if (!vocabulary && !existsSync(getVocabularyDatabasePath(studiesRoot))) return [];
    return getVocabulary().listStates();
  };

  /**
   * A sense id that is not in the lexicon cannot be scheduled, because nothing
   * could ever render it back to the learner — it would be an invisible row
   * accruing due dates for a word the campus cannot show.
   */
  const assertKnownSense = (senseId: string): void => {
    if (selectLexicon([senseId]).length === 0) {
      throw new HttpError(404, `Unknown vocabulary sense: ${senseId}`);
    }
  };

  const close = (): void => {
    for (const open of stores.values()) open.store.close();
    stores.clear();
  };

  return {
    studiesRoot,
    requestToken,
    getStore,
    getVocabulary,
    peekVocabularyStates,
    assertKnownSense,
    close,
  };
}
