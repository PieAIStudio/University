import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { assembleLessonIndex } from "@pieai/university-core/marks/references.js";
import { getStudyPaths } from "../studies/paths.js";
export { parseLessonLinks, resolveLessonLinks, backlinksOf, } from "@pieai/university-core/marks/references.js";
/** The only function here that touches disk. */
export function buildLessonIndex(studiesRoot, studyId) {
    return assembleLessonIndex(readLessons(studiesRoot, studyId));
}
function readLessons(studiesRoot, studyId) {
    const coursesRoot = join(getStudyPaths(studiesRoot, studyId).root, "courses");
    if (!existsSync(coursesRoot))
        return [];
    const lessons = [];
    for (const courseId of readdirSync(coursesRoot)) {
        const unitsRoot = join(coursesRoot, courseId, "units");
        if (!existsSync(unitsRoot))
            continue;
        for (const unitId of readdirSync(unitsRoot)) {
            const lessonsRoot = join(unitsRoot, unitId, "lessons");
            if (!existsSync(lessonsRoot))
                continue;
            for (const lessonId of readdirSync(lessonsRoot)) {
                const found = readLatestRevision(join(lessonsRoot, lessonId));
                if (found)
                    lessons.push({ courseId, unitId, lessonId, ...found });
            }
        }
    }
    return lessons;
}
function readLatestRevision(lessonRoot) {
    const revisionsRoot = join(lessonRoot, "revisions");
    if (!existsSync(revisionsRoot))
        return null;
    const latest = readdirSync(revisionsRoot)
        .map(Number)
        .filter((value) => Number.isInteger(value))
        .sort((left, right) => right - left)[0];
    if (latest === undefined)
        return null;
    const manifestPath = join(revisionsRoot, String(latest), "manifest.json");
    const contentPath = join(revisionsRoot, String(latest), "content.md");
    if (!existsSync(manifestPath) || !existsSync(contentPath))
        return null;
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    return {
        title: typeof manifest.title === "string" ? manifest.title : "",
        content: readFileSync(contentPath, "utf8"),
        sections: manifest.sections ?? [],
    };
}
//# sourceMappingURL=lesson-links.js.map