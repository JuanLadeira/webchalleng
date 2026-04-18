import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { bookingsApi } from "../api/client";
import { Layout } from "../components/Layout";
import type { Booking } from "../api/client";

function formatRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const day = s.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
  const timeS = s.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const timeE = e.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return { day, range: `${timeS} – ${timeE}` };
}

interface BookingRowProps {
  booking: Booking;
  onClick: () => void;
}

function BookingRow({ booking, onClick }: BookingRowProps) {
  const { day, range } = formatRange(booking.start_at, booking.end_at);
  const isActive = booking.status === "active";

  return (
    <li>
      <button
        onClick={onClick}
        className="group flex w-full items-center justify-between rounded-xl border border-gray-100 bg-white px-5 py-4 shadow-sm transition-all hover:border-blue-200 hover:shadow-md text-left"
      >
        <div className="flex items-start gap-4">
          {/* Data */}
          <div className="flex min-w-[3.5rem] flex-col items-center rounded-lg bg-blue-50 px-3 py-2 text-center group-hover:bg-blue-100 transition-colors">
            <span className="text-[10px] font-medium uppercase text-blue-400">{day.split(", ")[0]}</span>
            <span className="text-xl font-bold text-blue-700">{day.split(", ")[1]?.split(" ")[0]}</span>
            <span className="text-[10px] text-blue-400">{day.split(" ").slice(-1)[0]}</span>
          </div>

          {/* Info */}
          <div>
            <p className="font-semibold text-gray-800 group-hover:text-blue-700 transition-colors">
              {booking.title}
            </p>
            <p className="mt-0.5 text-sm text-gray-500">{range}</p>
            {booking.participants.length > 0 && (
              <p className="mt-1 text-xs text-gray-400">
                👥 {booking.participants.map((p) => p.email).join(", ")}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              isActive
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {isActive ? "Ativa" : "Cancelada"}
          </span>
          <span className="text-gray-300 group-hover:text-blue-400 transition-colors text-sm">
            →
          </span>
        </div>
      </button>
    </li>
  );
}

export function MyBookingsPage() {
  const navigate = useNavigate();

  const { data: bookings, isLoading, isError } = useQuery({
    queryKey: ["bookings"],
    queryFn: () => bookingsApi.listMine().then((r) => r.data),
  });

  const active = bookings?.filter((b) => b.status === "active") ?? [];
  const past = bookings?.filter((b) => b.status !== "active") ?? [];

  const goToCalendar = (booking: Booking) => {
    navigate(`/calendar?highlight=${booking.id}&date=${booking.start_at.slice(0, 10)}`);
  };

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Minhas Reservas</h2>
          <p className="mt-1 text-sm text-gray-500">
            Clique em uma reserva para ver no calendário
          </p>
        </div>
        <button
          onClick={() => navigate("/bookings/new")}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Nova Reserva
        </button>
      </div>

      {isLoading && <p className="text-sm text-gray-400">Carregando...</p>}
      {isError && (
        <p role="alert" className="text-sm text-red-500">
          Erro ao carregar reservas.
        </p>
      )}

      {bookings && (
        <div className="space-y-8">
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Ativas ({active.length})
            </h3>
            {active.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-white py-12 text-center">
                <p className="text-sm text-gray-400">Nenhuma reserva ativa.</p>
                <button
                  onClick={() => navigate("/bookings/new")}
                  className="mt-2 text-sm text-blue-600 hover:underline"
                >
                  Criar uma reserva →
                </button>
              </div>
            ) : (
              <ul className="space-y-3">
                {active.map((b) => (
                  <BookingRow key={b.id} booking={b} onClick={() => goToCalendar(b)} />
                ))}
              </ul>
            )}
          </section>

          {past.length > 0 && (
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Histórico ({past.length})
              </h3>
              <ul className="space-y-3">
                {past.map((b) => (
                  <BookingRow key={b.id} booking={b} onClick={() => goToCalendar(b)} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Layout>
  );
}
