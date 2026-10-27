import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { VolatilityApp } from "./VolatilityApp";
import { redirectToPreferredLang } from "./i18n";
import "./styles.css";

// Entrada de la página de volatilidad (volatilidad/index.html); la principal es main.tsx
if (!redirectToPreferredLang()) {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <VolatilityApp />
    </StrictMode>,
  );
}
