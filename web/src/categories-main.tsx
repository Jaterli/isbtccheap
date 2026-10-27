import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CategoriesApp } from "./CategoriesApp";
import { redirectToPreferredLang } from "./i18n";
import "./styles.css";

// Entrada de la página de histórico de categorías (categorias/index.html); la principal es main.tsx
if (!redirectToPreferredLang()) {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <CategoriesApp />
    </StrictMode>,
  );
}
