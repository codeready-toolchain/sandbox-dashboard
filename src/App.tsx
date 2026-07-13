import { BrowserRouter, Route, Routes } from "react-router";
import { ActivitiesPage } from "./components/Activities/ActivitiesPage";
import { CatalogPage } from "./components/Catalog/CatalogPage";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Layout } from "./components/Layout/Layout";
import { UserProvider } from "./hooks/UserProvider";
import { NotificationProvider } from "./notifications/NotificationProvider";
import { UIConfigurationProvider } from "./hooks/UIConfigurationProvider";
import { AnalyticsProvider } from "./hooks/AnalyticsProvider";

export function App() {
  return (
    <UIConfigurationProvider>
      <AnalyticsProvider>
        <UserProvider>
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
        </UserProvider>
      </AnalyticsProvider>
    </UIConfigurationProvider>
  );
}
