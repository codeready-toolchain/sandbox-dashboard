import { BrowserRouter, Route, Routes } from "react-router";
import { AuthProvider } from "./auth";
import { SandboxProvider } from "./hooks/useSandboxContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { NotificationProvider } from "./notifications/NotificationContext";
import { Layout } from "./components/Layout/Layout";
import { CatalogPage } from "./components/Catalog/CatalogPage";
import { ActivitiesPage } from "./components/Activities/ActivitiesPage";

export function App() {
  return (
    <AuthProvider>
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
    </AuthProvider>
  );
}
