import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Brand tokens first, product layout second: the kit defines the custom
// properties everything below reads.
import "@pieai/swimmer-ui-kit/styles.css";
import "@pieai/university-ui/catalog/catalog.css";
import { App } from "./app/App";
import { CAMPUS_NAME } from "./mode";
/*
  Every stylesheet `packages/ui` ships, in both shells, always.

  Three of them were reaching neither: `choice-block.css` and `practice.css`
  were not even in the exports map, and `loading-trivia.css` was exported and
  imported by nobody. The answer options on the practice screen were therefore
  raw `<button>` elements wearing the user agent's 1px padding and centred
  text — on the screen where the learning actually happens, in both shells,
  with the correct stylesheet sitting in the repository the whole time.

  So the rule is not "import what you need". A shell either wears the shared
  package's look or that look does not exist, and a few kilobytes of unused
  CSS is a much smaller cost than one more screen that is styled in one shell
  and bare in the other. `check-shared-styles.mjs` enforces it.
*/
import "@pieai/university-ui/entry/entry-page.css";
import "@pieai/university-ui/entry/style-sample.css";
import "@pieai/university-ui/evidence/evidence.css";
import "@pieai/university-ui/evidence/evidence-item.css";
import "@pieai/university-ui/evidence/evidence-inline-source.css";
import "@pieai/university-ui/evidence/source-sheet.css";
import "@pieai/university-ui/feedback/feedback-note.css";
import { FeedbackNote } from "@pieai/university-ui/feedback/FeedbackNote.js";
import "@pieai/university-ui/favourites/favourites.css";
import "@pieai/university-ui/language/word-layer.css";
import "@pieai/university-ui/lesson/lesson-reader.css";
import "@pieai/university-ui/lesson/lesson-toolbar.css";
import "@pieai/university-ui/lesson/word-list.css";
import "@pieai/university-ui/loading/loading-trivia.css";
import "@pieai/university-ui/markdown/markdown-content.css";
import "@pieai/university-ui/navigation/university-shell.css";
import "@pieai/university-ui/path/course-route-quiz.css";
import "@pieai/university-ui/path/path-cards.css";
import "@pieai/university-ui/practice/practice.css";
import "@pieai/university-ui/practice/mistakes.css";
import "@pieai/university-ui/presence/presence.css";
import "@pieai/university-ui/reference/knowledge-notes.css";
import "@pieai/university-ui/reference/reference-panel.css";
import "@pieai/university-ui/reference/term-index.css";
import "@pieai/university-ui/review/choice-block.css";
import "@pieai/university-ui/shell/app-shell.css";
import "@pieai/university-ui/sound/sound-toggle.css";
import "@pieai/university-ui/today/today.css";
import "@pieai/university-ui/markdown/markdown-body.css";
import "@pieai/university-world/overlay.css";
import "./styles.css";

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root container in index.html");

createRoot(container).render(
  <StrictMode>
    <App />
    {/*
      Review scaffolding, not a product surface. `import.meta.env.DEV`
      keeps it out of a build; see FeedbackNote.tsx for why that matters.
    */}
    {import.meta.env.DEV ? <FeedbackNote shell={CAMPUS_NAME} /> : null}
  </StrictMode>,
);
