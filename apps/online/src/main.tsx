import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Brand tokens first, product layout second: the kit defines the custom
// properties everything below reads.
import "@pieai/swimmer-ui-kit/styles.css";
import { App } from "./app/App";
// The word layer's rules travel with the component that emits its class names,
// so both shells render it the same way.
import "@pieai/university-ui/language/word-layer.css";
import "@pieai/university-ui/reference/reference-panel.css";
import "@pieai/university-ui/evidence/evidence.css";
import "@pieai/university-ui/sound/sound-toggle.css";
import "@pieai/university-ui/reference/term-index.css";
import "@pieai/university-ui/favourites/favourites.css";
import "@pieai/university-ui/entry/entry-page.css";
import "@pieai/university-ui/path/path-cards.css";
import "@pieai/university-ui/lesson/lesson-toolbar.css";
import "@pieai/university-ui/markdown/markdown-content.css";
import "@pieai/university-ui/shell/app-shell.css";
import "@pieai/university-ui/navigation/university-shell.css";
import "./styles.css";

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root container in index.html");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
