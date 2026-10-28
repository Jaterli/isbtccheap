import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { VolatilityApp } from "./VolatilityApp";
import { redirectToPreferredLang } from "./i18n";
import "./styles.css";

if (!redirectToPreferredLang()) {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <VolatilityApp />
    </StrictMode>,
  );
}
