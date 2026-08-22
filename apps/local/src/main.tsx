import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@pieai/swimmer-ui-kit/styles.css";

import { App } from "./App";
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
import "@pieai/university-ui/evidence/evidence.css";
import "@pieai/university-ui/favourites/favourites.css";
import "@pieai/university-ui/language/word-layer.css";
import "@pieai/university-ui/lesson/lesson-toolbar.css";
import "@pieai/university-ui/loading/loading-trivia.css";
import "@pieai/university-ui/markdown/markdown-content.css";
import "@pieai/university-ui/navigation/university-shell.css";
import "@pieai/university-ui/path/path-cards.css";
import "@pieai/university-ui/practice/practice.css";
import "@pieai/university-ui/reference/reference-panel.css";
import "@pieai/university-ui/reference/term-index.css";
import "@pieai/university-ui/review/choice-block.css";
import "@pieai/university-ui/shell/app-shell.css";
import "@pieai/university-ui/sound/sound-toggle.css";
import "@pieai/university-world/overlay.css";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("UniversityLocal root element is missing.");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
