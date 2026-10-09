import { BrowserRouter, Route, Routes } from "react-router";

import { ActivitiesPage } from "./components/Activities/ActivitiesPage";
import { CatalogPage } from "./components/Catalog/CatalogPage";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Layout } from "./components/Layout/Layout";
import { ReadyGuard } from "./components/ReadyGuard";
import { SupportPage } from "./components/Support/SupportPage";
import { AnalyticsProvider } from "./hooks/AnalyticsProvider";
import { NotificationProvider } from "./hooks/NotificationProvider";
import { PublicConfigurationProvider } from "./hooks/PublicConfigurationProvider";
import { UserProvider } from "./hooks/UserProvider";
import type { BootstrapData } from "./types/main";

export function App({ bootstrapData }: { bootstrapData: BootstrapData }) {
  return (
    <NotificationProvider>
      <ErrorBoundary>
        <PublicConfigurationProvider bootstrapData={bootstrapData}>
          <UserProvider bootstrapData={bootstrapData}>
            <AnalyticsProvider>
              <BrowserRouter>
                <Routes>
                  <Route element={<ReadyGuard />}>
                    <Route element={<Layout />}>
                      <Route index element={<CatalogPage />} />
                      <Route path="activities" element={<ActivitiesPage />} />
                      <Route path="support" element={<SupportPage />} />
                    </Route>
                  </Route>
                </Routes>
              </BrowserRouter>
            </AnalyticsProvider>
          </UserProvider>
        </PublicConfigurationProvider>
      </ErrorBoundary>
    </NotificationProvider>
  );
}
