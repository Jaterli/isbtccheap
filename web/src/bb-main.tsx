import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BollingerApp } from "./BollingerApp";
import { redirectToPreferredLang } from "./i18n";
import "./styles.css";

// Entrada de la página de Bollinger %B (bollinger/index.html); la principal es main.tsx
if (!redirectToPreferredLang()) {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <BollingerApp />
    </StrictMode>,
  );
}
