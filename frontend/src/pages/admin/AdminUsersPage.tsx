import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi, type UserRole } from "../../api/client";
import { Layout } from "../../components/Layout";
import { SkeletonTableRows } from "../../components/Skeleton";
import { useToastContext } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";

const ROLE_LABELS: Record<UserRole, string> = {
  OWNER: "Administrador",
  MEMBER: "Membro",
  SUPER_ADMIN: "Super Admin",
};

export function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { show } = useToastContext();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => adminApi.listUsers().then((r) => r.data),
  });

  const toggleRoleMutation = useMutation({
    mutationFn: (userId: string) => adminApi.toggleRole(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      show("Role atualizado.", "success");
      setConfirmingId(null);
    },
    onError: () => {
      show("Erro ao atualizar role.", "error");
      setConfirmingId(null);
    },
  });

  return (
    <Layout>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Usuários</h2>
        <p className="mt-1 text-sm text-gray-600">
          Gerencie os usuários e seus acessos
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left font-medium text-gray-500">Nome</th>
                <th className="px-5 py-3 text-left font-medium text-gray-500">E-mail</th>
                <th className="px-5 py-3 text-center font-medium text-gray-500">Role</th>
                <th className="px-5 py-3 text-center font-medium text-gray-500">Status</th>
                <th className="px-5 py-3 text-right font-medium text-gray-500">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && <SkeletonTableRows cols={5} rows={4} />}
              {users?.map((u) => {
                const isConfirming = confirmingId === u.id;
                const nextRole = u.role === "OWNER" ? "Membro" : "Administrador";
                return (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-5 py-4 font-medium text-gray-800">{u.name}</td>
                    <td className="px-5 py-4 text-gray-600">{u.email}</td>
                    <td className="px-5 py-4 text-center">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          u.role === "OWNER"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          u.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-600"
                        }`}
                      >
                        {u.is_active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {u.id !== currentUser?.id && u.role !== "SUPER_ADMIN" && (
                        isConfirming ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-xs text-gray-500">
                              Tornar {nextRole}?
                            </span>
                            <button
                              onClick={() => setConfirmingId(null)}
                              className="rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-50"
                            >
                              Não
                            </button>
                            <button
                              onClick={() => toggleRoleMutation.mutate(u.id)}
                              disabled={toggleRoleMutation.isPending}
                              className="rounded border border-purple-200 bg-purple-50 px-2 py-0.5 text-xs text-purple-700 hover:bg-purple-100 disabled:opacity-50"
                            >
                              {toggleRoleMutation.isPending ? "..." : "Sim"}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmingId(u.id)}
                            className="rounded-lg border border-gray-200 px-3 py-1 text-xs text-gray-600 transition-colors hover:bg-gray-50"
                          >
                            → {nextRole}
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
