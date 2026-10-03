import type { ShelfStudy } from "../content/port.js";

const FIXTURE_PATHS = [
  ["ask-about-a-picture", "first-useful-step"],
  ["sound-words-and-meaning", "first-useful-step"],
  ["name-the-result", "first-useful-step"],
  ["edit-one-part", "first-useful-step"],
  ["answer-or-search", "first-useful-step"],
  ["follow-a-claim", "check-what-matters"],
] as const;

export function sampleShelf(count = 3): readonly ShelfStudy[] {
  return [
    {
      id: "ai-literacy",
      title: "Fixture study",
      courses: [
        {
          id: "understanding-ai",
          title: "Fixture course",
          description: "",
          audience: "",
          objectives: [],
          isDefault: true,
          isBeingRewritten: false,
          units: ["first-useful-step", "check-what-matters"].map((id) => ({
            id,
            title: "Fixture unit",
            objective: "",
            lessons: FIXTURE_PATHS.slice(0, count)
              .filter((path) => path[1] === id)
              .map(([id]) => ({
                id,
                title: "Fixture lesson",
                contentRevision: 1,
                cardCount: 0,
                exerciseCount: 0,
                exerciseIds: [],
                contentChars: 0,
                progress: null,
              })),
          })),
        },
      ],
    },
  ];
}
