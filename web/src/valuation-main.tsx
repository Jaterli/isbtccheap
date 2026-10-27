import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ValuationApp } from "./ValuationApp";
import { redirectToPreferredLang } from "./i18n";
import "./styles.css";

// Entrada de la página de bandas de valoración (valoracion/index.html); la principal es main.tsx
if (!redirectToPreferredLang()) {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ValuationApp />
    </StrictMode>,
  );
}
