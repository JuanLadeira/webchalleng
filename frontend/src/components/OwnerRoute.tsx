import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../contexts/AuthContext";

export function OwnerRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="text-gray-400">Carregando...</span>
      </div>
    );
  }

  if (!user || (user.role !== "OWNER" && user.role !== "SUPER_ADMIN")) {
    return <Navigate to="/rooms" replace />;
  }

  return <>{children}</>;
}
