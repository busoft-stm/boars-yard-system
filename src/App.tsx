import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { RequireAuth } from './auth/RequireAuth'
import { AppShell } from './AppShell'
import { CommandCenter } from './pages/CommandCenter'
import { YardMapPage } from './pages/YardMapPage'
import { TrailersPage } from './pages/TrailersPage'
import { TemperaturePage } from './pages/TemperaturePage'
import { GatePage } from './pages/GatePage'
import { MovementsPage } from './pages/MovementsPage'
import { AlertsPage } from './pages/AlertsPage'
import { TrailerDetail } from './pages/TrailerDetail'
import { LoginPage } from './pages/LoginPage'
import { UsersPage } from './pages/UsersPage'
import { DockPage } from './pages/DockPage'
import { DevicesPage } from './pages/DevicesPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { ReportsPage } from './pages/ReportsPage'
import { InsightsPage } from './pages/InsightsPage'
import { IntegrationsPage } from './pages/IntegrationsPage'
import { YardInfrastructurePage } from './pages/YardInfrastructurePage'
import { YardInfrastructureV2Page } from './pages/YardInfrastructureV2Page'
import { ArchitecturePage } from './pages/ArchitecturePage'
import { YardProvider } from './yard/YardContext'
import { UsersProvider } from './users/UsersContext'
import { DevicesProvider } from './devices/DevicesContext'
import { SmartYardProvider } from './smart/SmartYardContext'
import { ExceptionsProvider } from './exceptions/ExceptionsContext'
import { GeofenceProvider } from './geofence/GeofenceContext'
import { NotificationsProvider } from './notifications/NotificationsContext'
import { MobileShell } from './mobile/MobileShell'
import { MobileHome } from './mobile/MobileHome'
import { MobileScan } from './mobile/MobileScan'
import { MobileInspect } from './mobile/MobileInspect'
import { MobileAlerts } from './mobile/MobileAlerts'
import { MobileMap } from './mobile/MobileMap'
import { DbBoot } from './db/DbBoot'
import { SnackbarProvider } from './components/Snackbar'
import { LiveOpsToasts } from './components/LiveOpsToasts'
import { GlobalActionTooltips } from './components/GlobalActionTooltips'

export default function App() {
  return (
    <BrowserRouter>
      <DbBoot>
        <SnackbarProvider>
          <GlobalActionTooltips />
          <UsersProvider>
            <DevicesProvider>
              <AuthProvider>
                <YardProvider>
                  <SmartYardProvider>
                  <ExceptionsProvider>
                  <NotificationsProvider>
                  <GeofenceProvider>
                  <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route element={<RequireAuth />}>
                      <Route
                        element={
                          <>
                            <LiveOpsToasts />
                            <Outlet />
                          </>
                        }
                      >
                      <Route path="m" element={<MobileShell />}>
                        <Route index element={<MobileHome />} />
                        <Route path="scan" element={<MobileScan />} />
                        <Route path="inspect" element={<MobileInspect />} />
                        <Route path="alerts" element={<MobileAlerts />} />
                        <Route path="map" element={<MobileMap />} />
                      </Route>
                      <Route element={<AppShell />}>
                        <Route index element={<CommandCenter />} />
                        <Route path="map" element={<YardMapPage />} />
                        <Route path="trailers" element={<TrailersPage />} />
                        <Route path="temperature" element={<TemperaturePage />} />
                        <Route path="gate" element={<GatePage />} />
                        <Route path="dock" element={<DockPage />} />
                        <Route path="movements" element={<MovementsPage />} />
                        <Route path="exceptions" element={<AlertsPage />} />
                        <Route
                          path="alerts"
                          element={<Navigate to="/exceptions" replace />}
                        />
                        <Route
                          path="walk"
                          element={<Navigate to="/exceptions" replace />}
                        />
                        <Route path="devices" element={<DevicesPage />} />
                        <Route
                          path="infrastructure"
                          element={<YardInfrastructureV2Page />}
                        />
                        <Route
                          path="infrastructure-old"
                          element={<YardInfrastructurePage />}
                        />
                        <Route
                          path="infrastructure-v2"
                          element={<Navigate to="/infrastructure" replace />}
                        />
                        <Route path="analytics" element={<AnalyticsPage />} />
                        <Route path="reports" element={<ReportsPage />} />
                        <Route path="insights" element={<InsightsPage />} />
                        <Route path="integrations" element={<IntegrationsPage />} />
                        <Route path="architecture" element={<ArchitecturePage />} />
                        <Route path="users" element={<UsersPage />} />
                        <Route path="trailer/:id" element={<TrailerDetail />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Route>
                      </Route>
                    </Route>
                  </Routes>
                  </GeofenceProvider>
                  </NotificationsProvider>
                  </ExceptionsProvider>
                  </SmartYardProvider>
                </YardProvider>
              </AuthProvider>
            </DevicesProvider>
          </UsersProvider>
        </SnackbarProvider>
      </DbBoot>
    </BrowserRouter>
  )
}
