import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@pieai/swimmer-ui-kit/styles.css";

import { App } from "./App";
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
