import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ToastProvider } from "./contexts/ToastContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { PrivateRoute } from "./components/PrivateRoute";
import { OwnerRoute } from "./components/OwnerRoute";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { RoomsPage } from "./pages/RoomsPage";
import { RoomDetailPage } from "./pages/RoomDetailPage";
import { RoomFormPage } from "./pages/RoomFormPage";
import { MyBookingsPage } from "./pages/MyBookingsPage";
import { CalendarPage } from "./pages/CalendarPage";

// Lazy loading — rotas admin só carregam para usuários OWNER
const AdminRoomsPage = lazy(() =>
  import("./pages/admin/AdminRoomsPage").then((m) => ({ default: m.AdminRoomsPage }))
);
const AdminUsersPage = lazy(() =>
  import("./pages/admin/AdminUsersPage").then((m) => ({ default: m.AdminUsersPage }))
);

function AdminFallback() {
  return (
    <div className="flex h-screen items-center justify-center">
      <span className="text-sm text-gray-400">Carregando...</span>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              {/* Públicas */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Autenticadas */}
              <Route path="/rooms" element={<PrivateRoute><RoomsPage /></PrivateRoute>} />
              <Route path="/rooms/:id" element={<PrivateRoute><RoomDetailPage /></PrivateRoute>} />
              <Route path="/rooms/new" element={<PrivateRoute><RoomFormPage /></PrivateRoute>} />
              <Route path="/bookings" element={<PrivateRoute><MyBookingsPage /></PrivateRoute>} />
              <Route path="/bookings/new" element={<Navigate to="/calendar" replace />} />
              <Route path="/calendar" element={<PrivateRoute><CalendarPage /></PrivateRoute>} />

              {/* Admin — só OWNER, com lazy loading */}
              <Route
                path="/admin/rooms"
                element={
                  <OwnerRoute>
                    <Suspense fallback={<AdminFallback />}>
                      <AdminRoomsPage />
                    </Suspense>
                  </OwnerRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <OwnerRoute>
                    <Suspense fallback={<AdminFallback />}>
                      <AdminUsersPage />
                    </Suspense>
                  </OwnerRoute>
                }
              />

              <Route path="*" element={<Navigate to="/rooms" replace />} />
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
