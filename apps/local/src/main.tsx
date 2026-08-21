import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@pieai/swimmer-ui-kit/styles.css";

import { App } from "./App";
// The word layer's rules travel with the component that emits its class names,
// so both shells render it the same way.
import "@pieai/university-ui/language/word-layer.css";
import "@pieai/university-ui/reference/reference-panel.css";
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
