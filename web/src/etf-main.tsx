import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { EtfApp } from "./EtfApp";
import { redirectToPreferredLang } from "./i18n";
import "./styles.css";

// Entrada de la página de flujos de ETF (etf/index.html); la principal es main.tsx
if (!redirectToPreferredLang()) {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <EtfApp />
    </StrictMode>,
  );
}
