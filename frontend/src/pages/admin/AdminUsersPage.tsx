import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../api/client";
import { Layout } from "../../components/Layout";
import { Toast, useToast } from "../../components/Toast";
import { useAuth } from "../../contexts/AuthContext";

export function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { toast, show, hide } = useToast();

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => adminApi.listUsers().then((r) => r.data),
  });

  const toggleRoleMutation = useMutation({
    mutationFn: (userId: string) => adminApi.toggleRole(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      show("Role atualizado.", "success");
    },
    onError: () => show("Erro ao atualizar role.", "error"),
  });

  return (
    <Layout>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Usuários</h2>
        <p className="mt-1 text-sm text-gray-500">
          Gerencie os usuários e seus acessos
        </p>
      </div>

      {isLoading && <p className="text-sm text-gray-400">Carregando...</p>}

      {users && (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left font-medium text-gray-500">Nome</th>
                <th className="px-5 py-3 text-left font-medium text-gray-500">E-mail</th>
                <th className="px-5 py-3 text-center font-medium text-gray-500">Role</th>
                <th className="px-5 py-3 text-center font-medium text-gray-500">Status</th>
                <th className="px-5 py-3 text-right font-medium text-gray-500">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-5 py-4 font-medium text-gray-800">{u.name}</td>
                  <td className="px-5 py-4 text-gray-500">{u.email}</td>
                  <td className="px-5 py-4 text-center">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        u.role === "OWNER"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {u.role}
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
                      <button
                        onClick={() => toggleRoleMutation.mutate(u.id)}
                        className="rounded-lg border border-gray-200 px-3 py-1 text-xs text-gray-600 transition-colors hover:bg-gray-50"
                      >
                        {u.role === "OWNER" ? "→ Member" : "→ Owner"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
