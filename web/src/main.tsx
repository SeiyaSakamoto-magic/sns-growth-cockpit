import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";
import "./styles/global.css";
import "./styles/sidebar.css";
import App, { HomeRedirect } from "./App";
import AccountDetail from "./pages/AccountDetail";
import AccountAnalysis from "./pages/AccountAnalysis";
import WeeklyInsight from "./pages/WeeklyInsight";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<HomeRedirect />} />
          <Route path="account/:handle" element={<AccountDetail />} />
          <Route path="account/:handle/analysis" element={<AccountAnalysis />} />
          <Route path="weekly" element={<WeeklyInsight />} />
        </Route>
      </Routes>
    </HashRouter>
  </StrictMode>,
);
