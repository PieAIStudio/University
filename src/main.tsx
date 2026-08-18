import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Brand tokens first, product layout second: the kit defines the custom
// properties everything below reads.
import "@pieai/swimmer-ui-kit/styles.css";
import { App } from "./App";
import "./styles.css";

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root container in index.html");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
