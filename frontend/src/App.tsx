import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { PrivateRoute } from "./components/PrivateRoute";
import { OwnerRoute } from "./components/OwnerRoute";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { RoomsPage } from "./pages/RoomsPage";
import { RoomDetailPage } from "./pages/RoomDetailPage";
import { RoomFormPage } from "./pages/RoomFormPage";
import { BookingFormPage } from "./pages/BookingFormPage";
import { MyBookingsPage } from "./pages/MyBookingsPage";
import { AdminRoomsPage } from "./pages/admin/AdminRoomsPage";
import { AdminUsersPage } from "./pages/admin/AdminUsersPage";
import { CalendarPage } from "./pages/CalendarPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Públicas */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Autenticadas */}
          <Route path="/rooms" element={<PrivateRoute><RoomsPage /></PrivateRoute>} />
          <Route path="/rooms/:id" element={<PrivateRoute><RoomDetailPage /></PrivateRoute>} />
          <Route path="/rooms/new" element={<PrivateRoute><RoomFormPage /></PrivateRoute>} />
          <Route path="/bookings" element={<PrivateRoute><MyBookingsPage /></PrivateRoute>} />
          <Route path="/bookings/new" element={<PrivateRoute><BookingFormPage /></PrivateRoute>} />
          <Route path="/calendar" element={<PrivateRoute><CalendarPage /></PrivateRoute>} />

          {/* Admin — só OWNER */}
          <Route path="/admin/rooms" element={<OwnerRoute><AdminRoomsPage /></OwnerRoute>} />
          <Route path="/admin/users" element={<OwnerRoute><AdminUsersPage /></OwnerRoute>} />

          <Route path="*" element={<Navigate to="/rooms" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
