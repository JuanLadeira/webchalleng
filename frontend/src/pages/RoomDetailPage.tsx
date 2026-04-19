import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { bookingsApi, roomsApi } from "../api/client";
import { Layout } from "../components/Layout";
import { BookingList } from "../components/BookingList";
import { BookingModal } from "../components/BookingModal";
import { Toast, useToast } from "../components/Toast";

export function RoomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast, show, hide } = useToast();
  const [showBookingModal, setShowBookingModal] = useState(false);

  const { data: room, isLoading } = useQuery({
    queryKey: ["rooms", id],
    queryFn: () => roomsApi.get(id!).then((r) => r.data),
    enabled: !!id,
  });

  const { data: bookings } = useQuery({
    queryKey: ["bookings"],
    queryFn: () => bookingsApi.listMine().then((r) => r.data),
  });

  const roomBookings = bookings?.filter((b) => b.room_id === id) ?? [];

  const cancelMutation = useMutation({
    mutationFn: (bookingId: string) => bookingsApi.cancel(bookingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      show("Reserva cancelada.", "success");
    },
    onError: () => show("Erro ao cancelar reserva.", "error"),
  });

  if (isLoading) {
    return (
      <Layout>
        <p className="text-sm text-gray-400">Carregando...</p>
      </Layout>
    );
  }

  if (!room) {
    return (
      <Layout>
        <p className="text-sm text-red-500">Sala não encontrada.</p>
      </Layout>
    );
  }

  return (
    <Layout>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">{room.name}</h2>
        <p className="text-sm text-gray-500">{room.location}</p>
        <p className="mt-1 text-sm text-gray-600">
          Capacidade: {room.capacity} pessoas
        </p>
        {room.description && (
          <p className="mt-2 text-sm text-gray-600">{room.description}</p>
        )}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-gray-700">Minhas reservas nesta sala</h3>
        <button
          onClick={() => setShowBookingModal(true)}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
        >
          Nova Reserva
        </button>
      </div>

      <BookingList
        bookings={roomBookings}
        onCancel={(bookingId) => cancelMutation.mutate(bookingId)}
        onViewInCalendar={(booking) =>
          navigate(`/calendar?highlight=${booking.id}&date=${booking.start_at.split("T")[0]}`)
        }
      />

      {showBookingModal && (
        <BookingModal
          mode="create"
          roomId={room.id}
          onClose={() => setShowBookingModal(false)}
          onSuccess={() => {
            setShowBookingModal(false);
            queryClient.invalidateQueries({ queryKey: ["bookings"] });
            show("Reserva criada com sucesso!", "success");
          }}
          showToast={show}
        />
      )}
    </Layout>
  );
}
