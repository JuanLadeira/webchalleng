import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { roomsApi } from "../api/client";
import { Layout } from "../components/Layout";
import { RoomCard } from "../components/RoomCard";

export function RoomsPage() {
  const navigate = useNavigate();
  const { data: rooms, isLoading, isError } = useQuery({
    queryKey: ["rooms"],
    queryFn: () => roomsApi.list().then((r) => r.data),
  });

  const activeRooms = rooms?.filter((r) => r.is_active) ?? [];

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Salas disponíveis</h2>
          <p className="mt-1 text-sm text-gray-500">
            Selecione uma sala para ver detalhes e fazer uma reserva
          </p>
        </div>
        <button
          onClick={() => navigate("/rooms/new")}
          className="rounded-lg border border-blue-600 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
        >
          + Nova Sala
        </button>
      </div>

      {isLoading && (
        <p className="text-sm text-gray-400">Carregando salas...</p>
      )}

      {isError && (
        <p role="alert" className="text-sm text-red-500">
          Erro ao carregar salas.
        </p>
      )}

      {!isLoading && !isError && activeRooms.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white py-16 text-center">
          <p className="text-gray-400">Nenhuma sala cadastrada.</p>
          <button
            onClick={() => navigate("/rooms/new")}
            className="mt-3 text-sm text-blue-600 hover:underline"
          >
            Criar primeira sala →
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {activeRooms.map((room) => (
          <RoomCard key={room.id} room={room} />
        ))}
      </div>
    </Layout>
  );
}
