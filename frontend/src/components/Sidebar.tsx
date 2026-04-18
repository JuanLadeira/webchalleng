import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

interface NavItemProps {
  to: string;
  label: string;
  icon: string;
}

function NavItem({ to, label, icon }: NavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
          isActive
            ? "bg-blue-600 text-white"
            : "text-gray-400 hover:bg-gray-800 hover:text-white"
        }`
      }
    >
      <span className="text-base">{icon}</span>
      {label}
    </NavLink>
  );
}

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isOwner = user?.role === "OWNER" || user?.role === "SUPER_ADMIN";

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <aside className="flex h-screen w-60 flex-col bg-gray-900 px-3 py-5">
      {/* Logo */}
      <div className="mb-6 px-3">
        <h1 className="text-lg font-bold text-white">Meeting Rooms</h1>
        <p className="text-xs text-gray-500">Gestão de Reservas</p>
      </div>

      {/* Nav principal */}
      <nav className="flex flex-col gap-1">
        <NavItem to="/calendar" label="Calendário" icon="📆" />
        <NavItem to="/bookings" label="Minhas Reservas" icon="📅" />
        <NavItem to="/bookings/new" label="Nova Reserva" icon="+" />
      </nav>

      {/* Nav admin — só OWNER */}
      {isOwner && (
        <>
          <div className="my-4 border-t border-gray-700" />
          <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Administração
          </p>
          <nav className="flex flex-col gap-1">
            <NavItem to="/admin/rooms" label="Gerenciar Salas" icon="🚪" />
            <NavItem to="/admin/users" label="Usuários" icon="👥" />
          </nav>
        </>
      )}

      {/* Usuário + logout — empurrado para o rodapé */}
      <div className="mt-auto border-t border-gray-700 pt-4">
        <div className="mb-2 px-3">
          <p className="text-sm font-medium text-white">{user?.name}</p>
          <p className="truncate text-xs text-gray-500">{user?.email}</p>
          <span className="mt-1 inline-block rounded-full bg-gray-700 px-2 py-0.5 text-xs text-gray-300">
            {user?.role}
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
        >
          <span>↩</span>
          Sair
        </button>
      </div>
    </aside>
  );
}
