import { randomBytes } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { HttpError } from "./errors.js";
import { SqliteLearningStore } from "../learning/sqlite-learning-store.js";
import { selectLexicon } from "../language/lexicon.js";
import { VocabularyStore, getVocabularyDatabasePath, } from "../language/vocabulary-store.js";
import { getStudyPaths } from "../studies/paths.js";
export function createServerContext(studiesRoot) {
    const requestToken = randomBytes(32).toString("base64url");
    const stores = new Map();
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
    const databaseIdentity = (path) => {
        try {
            const stats = statSync(path);
            return `${stats.dev}:${stats.ino}`;
        }
        catch {
            return null;
        }
    };
    const getStore = (studyId, create = false) => {
        const path = getStudyPaths(studiesRoot, studyId).learner.database;
        const identity = databaseIdentity(path);
        const open = stores.get(studyId);
        if (open) {
            if (identity !== null && identity === open.fileId)
                return open.store;
            try {
                open.store.close();
            }
            catch {
                // Already closed, or closed under us. Dropping the handle is the point.
            }
            stores.delete(studyId);
        }
        if (!create && identity === null)
            return null;
        const store = new SqliteLearningStore(path);
        const openedId = databaseIdentity(path);
        if (openedId !== null)
            stores.set(studyId, { store, fileId: openedId });
        return store;
    };
    // Opened on first use rather than at boot: a campus where nobody has turned
    // English mode on should not create a database to hold nothing.
    let vocabulary = null;
    const getVocabulary = () => {
        vocabulary ??= new VocabularyStore(getVocabularyDatabasePath(studiesRoot));
        return vocabulary;
    };
    /**
     * Learner word states for read-only use, without bringing the database into
     * existence. Opening a lesson must not create a vocabulary database: a
     * learner who has never turned the mode on has no states, and "no states" and
     * "empty database" have to stay distinguishable on disk.
     */
    const peekVocabularyStates = () => {
        if (!vocabulary && !existsSync(getVocabularyDatabasePath(studiesRoot)))
            return [];
        return getVocabulary().listStates();
    };
    /**
     * A sense id that is not in the lexicon cannot be scheduled, because nothing
     * could ever render it back to the learner — it would be an invisible row
     * accruing due dates for a word the campus cannot show.
     */
    const assertKnownSense = (senseId) => {
        if (selectLexicon([senseId]).length === 0) {
            throw new HttpError(404, `Unknown vocabulary sense: ${senseId}`);
        }
    };
    const close = () => {
        for (const open of stores.values())
            open.store.close();
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
//# sourceMappingURL=context.js.map