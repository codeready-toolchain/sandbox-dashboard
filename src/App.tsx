import { BrowserRouter, Route, Routes } from "react-router";
import { ActivitiesPage } from "./components/Activities/ActivitiesPage";
import { CatalogPage } from "./components/Catalog/CatalogPage";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Layout } from "./components/Layout/Layout";
import { SandboxProvider } from "./hooks/SandboxProvider";
import { NotificationProvider } from "./notifications/NotificationProvider";

export function App() {
  return (
    <SandboxProvider>
      <ErrorBoundary>
        <NotificationProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<CatalogPage />} />
                <Route path="activities" element={<ActivitiesPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </NotificationProvider>
      </ErrorBoundary>
    </SandboxProvider>
  );
}
