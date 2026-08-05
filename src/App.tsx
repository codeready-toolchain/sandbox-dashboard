import { BrowserRouter, Route, Routes } from "react-router";

import { ActivitiesPage } from "./components/Activities/ActivitiesPage";
import { CatalogPage } from "./components/Catalog/CatalogPage";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Layout } from "./components/Layout/Layout";
import { AnalyticsProvider } from "./hooks/AnalyticsProvider";
import { NotificationProvider } from "./hooks/NotificationProvider";
import { PhoneVerificationProvider } from "./hooks/PhoneVerificationProvider";
import { UIConfigurationProvider } from "./hooks/UIConfigurationProvider";
import { UserProvider } from "./hooks/UserProvider";

export function App() {
  return (
    <NotificationProvider>
      <ErrorBoundary>
        <UIConfigurationProvider>
          <UserProvider>
            <AnalyticsProvider>
              <PhoneVerificationProvider>
                <BrowserRouter>
                  <Routes>
                    <Route element={<Layout />}>
                      <Route index element={<CatalogPage />} />
                      <Route path="activities" element={<ActivitiesPage />} />
                    </Route>
                  </Routes>
                </BrowserRouter>
              </PhoneVerificationProvider>
            </AnalyticsProvider>
          </UserProvider>
        </UIConfigurationProvider>
      </ErrorBoundary>
    </NotificationProvider>
  );
}
