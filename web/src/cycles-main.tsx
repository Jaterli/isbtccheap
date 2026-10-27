import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CyclesApp } from "./CyclesApp";
import { redirectToPreferredLang } from "./i18n";
import "./styles.css";

// Entrada de la página de ciclos de halving (ciclos/index.html); la principal es main.tsx
if (!redirectToPreferredLang()) {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <CyclesApp />
    </StrictMode>,
  );
}
