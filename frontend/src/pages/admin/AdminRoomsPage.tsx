import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { roomsApi } from "../../api/client";
import { Layout } from "../../components/Layout";
import { SkeletonTableRows } from "../../components/Skeleton";
import { useToastContext } from "../../contexts/ToastContext";

export function AdminRoomsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { show } = useToastContext();

  const { data: rooms, isLoading } = useQuery({
    queryKey: ["rooms-all"],
    queryFn: () => roomsApi.list(false).then((r) => r.data),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      roomsApi.update(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms-all"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      show("Sala atualizada.", "success");
    },
    onError: () => show("Erro ao atualizar sala.", "error"),
  });

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Gerenciar Salas</h2>
          <p className="mt-1 text-sm text-gray-600">
            Todas as salas do sistema
          </p>
        </div>
        <button
          onClick={() => navigate("/rooms/new")}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Nova Sala
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left font-medium text-gray-500">Nome</th>
                <th className="px-5 py-3 text-left font-medium text-gray-500">Localização</th>
                <th className="px-5 py-3 text-center font-medium text-gray-500">Capacidade</th>
                <th className="px-5 py-3 text-center font-medium text-gray-500">Status</th>
                <th className="px-5 py-3 text-right font-medium text-gray-500">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && <SkeletonTableRows cols={5} rows={4} />}
              {rooms?.map((room) => (
                <tr key={room.id} className="hover:bg-gray-50">
                  <td className="px-5 py-4 font-medium text-gray-800">{room.name}</td>
                  <td className="px-5 py-4 text-gray-600">{room.location}</td>
                  <td className="px-5 py-4 text-center text-gray-600">{room.capacity}</td>
                  <td className="px-5 py-4 text-center">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        room.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {room.is_active ? "Ativa" : "Inativa"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() =>
                        toggleMutation.mutate({ id: room.id, is_active: !room.is_active })
                      }
                      className={`rounded-lg border px-3 py-1 text-xs transition-colors ${
                        room.is_active
                          ? "border-red-200 text-red-500 hover:bg-red-50"
                          : "border-green-200 text-green-600 hover:bg-green-50"
                      }`}
                    >
                      {room.is_active ? "Desativar" : "Ativar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
