const CONTENT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CONTENT_ID_MAX_LENGTH = 64;
function validateContentId(value, label) {
    if (value.length < 2 || value.length > CONTENT_ID_MAX_LENGTH || !CONTENT_ID_PATTERN.test(value)) {
        throw new Error(`${label} must be a stable lowercase kebab-case content ID`);
    }
}
function createScopedContentKey(parts) {
    for (const [value, label] of parts)
        validateContentId(value, label);
    return parts.map(([value]) => value).join("/");
}
function parseScopedContentKey(value, labels) {
    const parts = value.split("/");
    if (parts.length !== labels.length) {
        throw new Error(`Invalid scoped content key: expected ${labels.join("/")}`);
    }
    for (const [index, label] of labels.entries())
        validateContentId(parts[index] ?? "", label);
    return parts;
}
export function lessonContentKey(identity) {
    return createScopedContentKey([
        [identity.courseId, "Course ID"],
        [identity.unitId, "Unit ID"],
        [identity.lessonId, "Lesson ID"],
    ]);
}
export function cardContentKey(identity) {
    return createScopedContentKey([
        [identity.courseId, "Course ID"],
        [identity.unitId, "Unit ID"],
        [identity.lessonId, "Lesson ID"],
        [identity.cardId, "Card ID"],
    ]);
}
export function knowledgeCardContentKey(identity) {
    return createScopedContentKey([
        ["knowledge", "Knowledge scope"],
        [identity.noteId, "Knowledge note ID"],
        [identity.cardId, "Card ID"],
    ]);
}
export function exerciseContentKey(identity) {
    return createScopedContentKey([
        [identity.courseId, "Course ID"],
        [identity.unitId, "Unit ID"],
        [identity.lessonId, "Lesson ID"],
        [identity.exerciseId, "Exercise ID"],
    ]);
}
export function parseLessonContentKey(value) {
    const [courseId, unitId, lessonId] = parseScopedContentKey(value, [
        "Course ID",
        "Unit ID",
        "Lesson ID",
    ]);
    return { courseId: courseId, unitId: unitId, lessonId: lessonId };
}
function parseCardContentKey(value) {
    const [courseId, unitId, lessonId, cardId] = parseScopedContentKey(value, [
        "Course ID",
        "Unit ID",
        "Lesson ID",
        "Card ID",
    ]);
    return { courseId: courseId, unitId: unitId, lessonId: lessonId, cardId: cardId };
}
export function parseReviewContentKey(value) {
    const parts = value.split("/");
    if (parts.length === 4) {
        return { kind: "course-card", ...parseCardContentKey(value) };
    }
    if (parts.length === 3 && parts[0] === "knowledge") {
        const [, noteId, cardId] = parseScopedContentKey(value, [
            "Knowledge scope",
            "Knowledge note ID",
            "Card ID",
        ]);
        return { kind: "knowledge-card", noteId: noteId, cardId: cardId };
    }
    throw new Error("Invalid review content key: expected course/unit/lesson/card or knowledge/note/card");
}
export function reviewContentKey(value) {
    parseReviewContentKey(value);
    return value;
}
export function parseExerciseContentKey(value) {
    const [courseId, unitId, lessonId, exerciseId] = parseScopedContentKey(value, [
        "Course ID",
        "Unit ID",
        "Lesson ID",
        "Exercise ID",
    ]);
    return {
        courseId: courseId,
        unitId: unitId,
        lessonId: lessonId,
        exerciseId: exerciseId,
    };
}
//# sourceMappingURL=types.js.map